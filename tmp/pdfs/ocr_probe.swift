import AppKit
import Foundation
import PDFKit
import Vision

guard CommandLine.arguments.count >= 3 else {
    fputs("usage: ocr_probe.swift PDF PAGE\n", stderr)
    exit(2)
}

let url = URL(fileURLWithPath: CommandLine.arguments[1])
let pageNumber = Int(CommandLine.arguments[2]) ?? 1

guard let document = PDFDocument(url: url),
      let page = document.page(at: pageNumber - 1) else {
    fputs("cannot open PDF page\n", stderr)
    exit(1)
}

let bounds = page.bounds(for: .mediaBox)
let scale = CGFloat(Double(CommandLine.arguments.count >= 4 ? CommandLine.arguments[3] : "2.5") ?? 2.5)
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
) else {
    fputs("cannot create render context\n", stderr)
    exit(1)
}

context.setFillColor(NSColor.white.cgColor)
context.fill(CGRect(x: 0, y: 0, width: width, height: height))
context.saveGState()
context.scaleBy(x: scale, y: scale)
page.draw(with: .mediaBox, to: context)
context.restoreGState()

guard let image = context.makeImage() else {
    fputs("cannot render PDF page\n", stderr)
    exit(1)
}

let request = VNRecognizeTextRequest()
request.recognitionLevel = CommandLine.arguments.count >= 5 && CommandLine.arguments[4] == "fast" ? .fast : .accurate
request.recognitionLanguages = ["ru-RU", "en-US"]
request.usesLanguageCorrection = true
request.customWords = [
    "Сородич", "Сородичи", "Камарилья", "Анархи", "Шабаш", "Маскарад",
    "Становление", "Дисциплина", "Вентру", "Бруха", "Тореадор", "Малкавиан",
    "Носферату", "Тремер", "Гангрел", "Каитиф", "слабокровный"
]

let handler = VNImageRequestHandler(cgImage: image, options: [:])
do {
    try handler.perform([request])
} catch {
    fputs("OCR failed: \(error)\n", stderr)
    exit(1)
}

let observations = request.results ?? []
for observation in observations {
    guard let candidate = observation.topCandidates(1).first else { continue }
    let box = observation.boundingBox
    print(String(format: "%.5f\t%.5f\t%.5f\t%.5f\t%.4f\t%@",
                 box.minX, box.minY, box.width, box.height,
                 candidate.confidence, candidate.string))
}
