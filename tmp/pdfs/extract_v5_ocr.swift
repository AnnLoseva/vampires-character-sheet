import AppKit
import Foundation
import PDFKit
import Vision

struct OCRLine: Codable {
    let order: Int
    let text: String
    let confidence: Float
    let x: Double
    let y: Double
    let width: Double
    let height: Double
}

struct OCRPage: Codable {
    let page: Int
    let lines: [OCRLine]
    let error: String?
}

guard CommandLine.arguments.count >= 3 else {
    fputs("usage: extract_v5_ocr.swift INPUT.pdf OUTPUT.jsonl [scale] [start-page] [end-page]\n", stderr)
    exit(2)
}

let inputURL = URL(fileURLWithPath: CommandLine.arguments[1])
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2])
let scale = CGFloat(Double(CommandLine.arguments.count >= 4 ? CommandLine.arguments[3] : "2.0") ?? 2.0)

guard let document = PDFDocument(url: inputURL) else {
    fputs("cannot open input PDF\n", stderr)
    exit(1)
}

let startPage = max(1, Int(CommandLine.arguments.count >= 5 ? CommandLine.arguments[4] : "1") ?? 1)
let endPage = min(
    document.pageCount,
    Int(CommandLine.arguments.count >= 6 ? CommandLine.arguments[5] : String(document.pageCount)) ?? document.pageCount
)

FileManager.default.createFile(atPath: outputURL.path, contents: nil)
guard let output = try? FileHandle(forWritingTo: outputURL) else {
    fputs("cannot open output JSONL\n", stderr)
    exit(1)
}
defer { try? output.close() }

let encoder = JSONEncoder()
encoder.outputFormatting = [.withoutEscapingSlashes]

let customWords = [
    "Сородич", "Сородичи", "Камарилья", "Анархи", "Шабаш", "Маскарад",
    "Становление", "Дисциплина", "Дисциплины", "Извечная борьба", "Война Эпох",
    "Человечность", "Голод", "Зверь", "Вентру", "Бруха", "Тореадор", "Малкавиан",
    "Носферату", "Тремер", "Гангрел", "Каитиф", "слабокровный", "слабокровные",
    "Прорицание", "Анимализм", "Доминирование", "Величие", "Стремительность",
    "Стойкость", "Метаморфозы", "Сокрытие", "Кровавое чародейство", "Обливион"
]

func renderPage(_ page: PDFPage) -> CGImage? {
    let bounds = page.bounds(for: .mediaBox)
    let width = max(1, Int(bounds.width * scale))
    let height = max(1, Int(bounds.height * scale))
    guard let context = CGContext(
        data: nil,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: 0,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else { return nil }

    context.setFillColor(NSColor.white.cgColor)
    context.fill(CGRect(x: 0, y: 0, width: width, height: height))
    context.saveGState()
    context.scaleBy(x: scale, y: scale)
    page.draw(with: .mediaBox, to: context)
    context.restoreGState()
    return context.makeImage()
}

for pageIndex in (startPage - 1)..<endPage {
    let pageNumber = pageIndex + 1
    let result: OCRPage = autoreleasepool {
        guard let page = document.page(at: pageIndex), let image = renderPage(page) else {
            return OCRPage(page: pageNumber, lines: [], error: "render failed")
        }

        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.recognitionLanguages = ["ru-RU", "en-US"]
        request.usesLanguageCorrection = true
        request.minimumTextHeight = 0.006
        request.customWords = customWords

        do {
            try VNImageRequestHandler(cgImage: image, options: [:]).perform([request])
            let observations = request.results ?? []
            let lines = observations.enumerated().compactMap { order, observation -> OCRLine? in
                guard let candidate = observation.topCandidates(1).first else { return nil }
                let box = observation.boundingBox
                return OCRLine(
                    order: order,
                    text: candidate.string,
                    confidence: candidate.confidence,
                    x: box.minX,
                    y: box.minY,
                    width: box.width,
                    height: box.height
                )
            }
            return OCRPage(page: pageNumber, lines: lines, error: nil)
        } catch {
            return OCRPage(page: pageNumber, lines: [], error: String(describing: error))
        }
    }

    do {
        var data = try encoder.encode(result)
        data.append(0x0A)
        try output.write(contentsOf: data)
    } catch {
        fputs("cannot write page \(pageNumber): \(error)\n", stderr)
        exit(1)
    }

    if pageNumber == startPage || pageNumber % 10 == 0 || pageNumber == endPage {
        fputs("OCR \(pageNumber)/\(endPage), lines=\(result.lines.count)\n", stderr)
    }
}
