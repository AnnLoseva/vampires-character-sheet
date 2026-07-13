from __future__ import annotations

import argparse
import json
import re
import statistics
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import pdfplumber


DASHES = str.maketrans({
    "\u00ad": "",
    "\u2010": "-",
    "\u2011": "-",
    "\u2012": "-",
    "\u2013": "-",
    "\u2014": "-",
    "\u2015": "-",
    "\u2212": "-",
})
CYRILLIC_RE = re.compile(r"[А-Яа-яЁё]")
LOWER_START_RE = re.compile(r"^[a-zа-яё]")
PAGE_NUMBER_RE = re.compile(r"^\d{1,4}$")
SENTENCE_END_RE = re.compile(r"[.!?…:\"»)]$")
BULLET_RE = re.compile(r"^(?:[•●▪◦*]|\d+[.)])\s*")


@dataclass
class Line:
    text: str
    x: float
    right: float
    top: float
    bottom: float
    height: float
    confidence: float = 1.0


def normalize_line(value: str) -> str:
    text = value.translate(DASHES)
    text = text.replace("\u00a0", " ").replace("\u202f", " ")
    text = text.replace("І", "И").replace("і", "и")
    text = re.sub(r"\b1м\b", "Им", text)
    text = re.sub(r"\s*\|\s*", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"\s+([,.;:!?…])", r"\1", text)
    text = re.sub(r"([«(])\s+", r"\1", text)
    text = re.sub(r"\s+([»)])", r"\1", text)
    return text


def clean_v5_content(text: str) -> str:
    replacements = {
        "кровых наш голод": "кровью наш Голод",
        "Жить до-звериному": "Жить по-звериному",
        "мечте византийско тривирате": "мечте о Византийском триумвирате",
        "действуютпо собственной": "действуют по собственной",
        "масао конфликта": "масштаба конфликта",
        "ве диверсант.": "•• ДИВЕРСАНТ.",
    }
    for source, target in replacements.items():
        text = text.replace(source, target)
    text = re.sub(r"\b1210\b", "1d10", text)
    for label in (
        "домен", "информаторы", "дополнительно", "статус", "враги",
        "мавла", "подручные", "стадо", "недостаток статуса", "бастион",
        "диверсант", "архитектор по найму", "лабиринт", "чутьё на лей-линии",
    ):
        text = re.sub(
            rf"(?i)\b{re.escape(label)}\b(?=\s*[:.])",
            label.upper(),
            text,
        )
    return text


def is_heading(line: Line, median_height: float) -> bool:
    text = line.text
    letters = [char for char in text if char.isalpha()]
    upper_ratio = (
        sum(char.isupper() for char in letters) / len(letters)
        if letters else 0.0
    )
    return (
        len(text) <= 100
        and not text.endswith((".", ",", ";"))
        and (
            (len(text) <= 45 and line.height >= median_height * 1.60)
            or (len(letters) >= 3 and upper_ratio >= 0.82)
        )
    )


def build_paragraphs(lines: Iterable[Line]) -> str:
    ordered = [line for line in lines if line.text]
    if not ordered:
        return ""

    median_height = statistics.median(
        [line.height for line in ordered if line.height > 0]
    )
    base_x = min(line.x for line in ordered)
    paragraphs: list[str] = []
    current = ""
    previous: Line | None = None
    previous_heading = False

    for line in ordered:
        text = normalize_line(line.text)
        if not text or PAGE_NUMBER_RE.fullmatch(text):
            continue
        if text.upper().replace(" ", "") == "КНИГАПРАВИЛ":
            continue

        heading = is_heading(Line(text, line.x, line.right, line.top, line.bottom, line.height), median_height)
        same_column = previous is not None and abs(line.x - previous.x) <= 0.08
        previous_word = current.rsplit(" ", 1)[-1][:-1] if current.endswith("-") else ""
        forced_join = bool(
            current.endswith("-")
            and (
                LOWER_START_RE.match(text)
                or (same_column and not heading)
                or (
                    same_column
                    and previous_word.isupper()
                    and text.split(" ", 1)[0].rstrip(":").isupper()
                )
            )
        )

        if forced_join:
            current = current[:-1] + text
        else:
            gap = 0.0 if previous is None else max(0.0, line.top - previous.bottom)
            indented = line.x - base_x > 0.012
            new_paragraph = (
                not current
                or heading
                or previous_heading
                or bool(BULLET_RE.match(text))
                or (
                    gap > median_height * 0.72
                    and previous is not None
                    and bool(SENTENCE_END_RE.search(previous.text))
                    and text[:1].isupper()
                )
                or (
                    indented
                    and previous is not None
                    and bool(SENTENCE_END_RE.search(previous.text))
                    and text[:1].isupper()
                )
            )
            if new_paragraph:
                if current:
                    paragraphs.append(current.strip())
                current = text
            else:
                current = f"{current} {text}"

        previous = line
        previous_heading = heading

    if current:
        paragraphs.append(current.strip())

    text = "\n\n".join(paragraph for paragraph in paragraphs if paragraph)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def dominant_column_order(lines: list[Line]) -> list[Line] | None:
    """Return column-major order when OCR lines have clear 2/3-column starts."""
    if len(lines) < 20:
        return None

    buckets: dict[float, int] = {}
    for line in lines:
        if line.right - line.x < 0.15 or line.x < 0.04 or line.x > 0.86:
            continue
        bucket = round(line.x / 0.025) * 0.025
        buckets[bucket] = buckets.get(bucket, 0) + 1

    selected: list[tuple[float, int]] = []
    for x, count in sorted(buckets.items(), key=lambda item: item[1], reverse=True):
        if count < 8 or any(abs(x - anchor) < 0.18 for anchor, _ in selected):
            continue
        selected.append((x, count))
        if len(selected) == 3:
            break

    if len(selected) < 2:
        return None

    anchors = sorted(x for x, _ in selected)
    columns: list[list[Line]] = [[] for _ in anchors]
    for line in lines:
        column = min(range(len(anchors)), key=lambda index: abs(line.x - anchors[index]))
        columns[column].append(line)

    if any(len(column) < 6 for column in columns):
        return None
    return [
        line
        for column in columns
        for line in sorted(column, key=lambda item: (item.top, item.x))
    ]


def reading_order(lines: list[Line]) -> list[Line]:
    return dominant_column_order(lines) or spatial_reading_order(lines)


def dehyphenate_paragraph_boundaries(text: str) -> str:
    return re.sub(r"([A-Za-zА-Яа-яЁё])-\s*\n+\s*([a-zа-яё])", r"\1\2", text)


def merge_line_fragments(lines: list[Line]) -> list[Line]:
    """Join OCR observations that split one visual line into adjacent pieces."""
    merged: list[Line] = []
    for line in sorted(lines, key=lambda item: (item.top, item.x)):
        if merged:
            previous = merged[-1]
            horizontal_gap = line.x - previous.right
            if (
                abs(line.top - previous.top) <= 0.006
                and -0.005 <= horizontal_gap <= 0.02
                and previous.right - previous.x < 0.20
            ):
                previous.text = f"{previous.text} {line.text}"
                previous.right = max(previous.right, line.right)
                previous.bottom = max(previous.bottom, line.bottom)
                previous.height = max(previous.height, line.height)
                previous.confidence = min(previous.confidence, line.confidence)
                continue
        merged.append(line)
    return merged


def projected_gaps(lines: list[Line], axis: str) -> list[tuple[float, float]]:
    if axis == "x":
        intervals = sorted((line.x, line.right) for line in lines)
    else:
        intervals = sorted((line.top, line.bottom) for line in lines)
    if not intervals:
        return []
    merged: list[list[float]] = [[intervals[0][0], intervals[0][1]]]
    for start, end in intervals[1:]:
        if start <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])
    return [
        (merged[index][1], merged[index + 1][0])
        for index in range(len(merged) - 1)
        if merged[index + 1][0] > merged[index][1]
    ]


def spatial_reading_order(lines: list[Line], depth: int = 0) -> list[Line]:
    if len(lines) <= 2 or depth >= 12:
        return sorted(lines, key=lambda line: (line.top, line.x))

    median_height = statistics.median(line.height for line in lines if line.height > 0)
    x_gaps = projected_gaps(lines, "x")
    y_gaps = projected_gaps(lines, "y")
    best_x = max(x_gaps, key=lambda gap: gap[1] - gap[0], default=None)
    best_y = max(y_gaps, key=lambda gap: gap[1] - gap[0], default=None)
    x_size = 0.0 if best_x is None else best_x[1] - best_x[0]
    y_size = 0.0 if best_y is None else best_y[1] - best_y[0]
    x_score = x_size / 0.010
    y_threshold = max(0.018, median_height * 1.35)
    y_score = y_size / y_threshold

    if x_score < 1.0 and y_score < 1.0:
        return sorted(lines, key=lambda line: (line.top, line.x))

    if best_y is not None and y_size >= 0.012:
        cut = (best_y[0] + best_y[1]) / 2
        above = [line for line in lines if line.bottom <= cut]
        below = [line for line in lines if line.top >= cut]
        if (
            above
            and below
            and len(above) + len(below) == len(lines)
            and min(len(above), len(below)) <= 3
            and max(len(above), len(below)) >= 5
        ):
            return spatial_reading_order(above, depth + 1) + spatial_reading_order(below, depth + 1)

    # Prefer a real vertical gutter. This keeps ordinary two-column prose in
    # reading order even when one column contains large paragraph gaps. Pages
    # with centered full-width headings have no such gutter until a horizontal
    # band split isolates the heading.
    if x_score >= 1.0 and best_x is not None:
        cut = (best_x[0] + best_x[1]) / 2
        left = [line for line in lines if line.right <= cut]
        right = [line for line in lines if line.x >= cut]
        if left and right and len(left) + len(right) == len(lines):
            return spatial_reading_order(left, depth + 1) + spatial_reading_order(right, depth + 1)

    if y_score >= 1.0 and best_y is not None:
        cut = (best_y[0] + best_y[1]) / 2
        above = [line for line in lines if line.bottom <= cut]
        below = [line for line in lines if line.top >= cut]
        if above and below and len(above) + len(below) == len(lines):
            return spatial_reading_order(above, depth + 1) + spatial_reading_order(below, depth + 1)

    return sorted(lines, key=lambda line: (line.top, line.x))


def v5_page_content(raw_lines: list[dict]) -> str:
    lines: list[Line] = []
    index = 0
    while index < len(raw_lines):
        raw = raw_lines[index]
        text = normalize_line(str(raw.get("text", "")))
        confidence = float(raw.get("confidence", 1.0))
        y = float(raw.get("y", 0.0))
        height = float(raw.get("height", 0.0))
        if y < 0.045 or y > 0.92 or not text:
            index += 1
            continue
        if confidence <= 0.5 and len(text) <= 5 and (float(raw.get("x", 0.0)) < 0.05 or float(raw.get("x", 0.0)) > 0.95):
            index += 1
            continue

        if (
            len(text) == 1
            and text.isalpha()
            and text.isupper()
            and index + 1 < len(raw_lines)
        ):
            next_raw = raw_lines[index + 1]
            next_text = normalize_line(str(next_raw.get("text", "")))
            if next_text.startswith("- ") or LOWER_START_RE.match(next_text):
                text = text + (next_text[2:] if next_text.startswith("- ") else next_text)
                raw = next_raw
                y = float(raw.get("y", y))
                height = float(raw.get("height", height))
                index += 1

        lines.append(Line(
            text=text,
            x=float(raw.get("x", 0.0)),
            right=float(raw.get("x", 0.0)) + float(raw.get("width", 0.0)),
            top=1.0 - (y + height),
            bottom=1.0 - y,
            height=height,
            confidence=float(raw.get("confidence", 1.0)),
        ))
        index += 1

    lines = merge_line_fragments(lines)
    return clean_v5_content(dehyphenate_paragraph_boundaries(build_paragraphs(reading_order(lines))))


def write_row(handle, *, source: str, title: str, page: int, content: str) -> None:
    if len(CYRILLIC_RE.findall(content)) < 8:
        return
    row = {
        "source": source,
        "title": title,
        "lang": "ru",
        "page": page,
        "content": content,
    }
    handle.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")


def build_v5(raw_path: Path, output_path: Path) -> None:
    page_count = 0
    written = 0
    errors: list[tuple[int, str]] = []
    with raw_path.open(encoding="utf-8") as source, output_path.open("w", encoding="utf-8") as output:
        for line in source:
            record = json.loads(line)
            page = int(record["page"])
            page_count += 1
            if record.get("error"):
                errors.append((page, str(record["error"])))
                continue
            content = v5_page_content(record.get("lines", []))
            before = output.tell()
            write_row(
                output,
                source="v5-corebook-ru",
                title="VTM v5: Книга правил (RU)",
                page=page,
                content=content,
            )
            if output.tell() > before:
                written += 1
    print(f"V5: read {page_count} PDF pages, wrote {written} text pages, OCR errors={len(errors)}")
    for page, error in errors[:10]:
        print(f"  page {page}: {error}")


def group_words(words: list[dict], page_width: float, page_height: float) -> list[Line]:
    grouped: list[list[dict]] = []
    for word in sorted(words, key=lambda item: (float(item["top"]), float(item["x0"]))):
        top = float(word["top"])
        if not grouped:
            grouped.append([word])
            continue
        current_top = statistics.median(float(item["top"]) for item in grouped[-1])
        if abs(top - current_top) <= 2.8:
            grouped[-1].append(word)
        else:
            grouped.append([word])

    lines: list[Line] = []
    for group in grouped:
        ordered = sorted(group, key=lambda item: float(item["x0"]))
        text = normalize_line(" ".join(str(item["text"]) for item in ordered))
        if not text:
            continue
        x0 = min(float(item["x0"]) for item in ordered)
        top = min(float(item["top"]) for item in ordered)
        bottom = max(float(item["bottom"]) for item in ordered)
        lines.append(Line(
            text=text,
            x=x0 / page_width,
            right=max(float(item["x1"]) for item in ordered) / page_width,
            top=top / page_height,
            bottom=bottom / page_height,
            height=(bottom - top) / page_height,
        ))
    return lines


def page_has_two_columns(words: list[dict], page_width: float) -> bool:
    if len(words) < 30:
        return False
    visual_lines: list[list[dict]] = []
    for word in sorted(words, key=lambda item: (float(item["top"]), float(item["x0"]))):
        top = float(word["top"])
        if not visual_lines:
            visual_lines.append([word])
            continue
        line_top = statistics.median(float(item["top"]) for item in visual_lines[-1])
        if abs(top - line_top) <= 2.8:
            visual_lines[-1].append(word)
        else:
            visual_lines.append([word])

    two_column_votes = 0
    single_column_votes = 0
    left_only_tops: list[float] = []
    right_only_tops: list[float] = []
    divider = page_width / 2
    for line in visual_lines:
        ordered = sorted(line, key=lambda item: float(item["x0"]))
        left = [item for item in ordered if (float(item["x0"]) + float(item["x1"])) / 2 < divider]
        right = [item for item in ordered if (float(item["x0"]) + float(item["x1"])) / 2 >= divider]
        line_top = statistics.median(float(item["top"]) for item in ordered)
        if max(float(item["x1"]) for item in ordered) < divider + 5:
            left_only_tops.append(line_top)
        if min(float(item["x0"]) for item in ordered) > divider - 5:
            right_only_tops.append(line_top)
        if not left or not right:
            continue
        center_gap = min(float(item["x0"]) for item in right) - max(float(item["x1"]) for item in left)
        if center_gap >= 12:
            two_column_votes += 1
        elif center_gap <= 7:
            single_column_votes += 1
    overlapping_column_lines = sum(
        any(abs(left_top - right_top) < 15 for right_top in right_only_tops)
        for left_top in left_only_tops
    )
    return (
        (two_column_votes >= 2 and two_column_votes > single_column_votes * 1.4)
        or overlapping_column_lines >= 4
    )


def build_v20(pdf_path: Path, output_path: Path) -> None:
    written = 0
    with pdfplumber.open(pdf_path) as pdf, output_path.open("w", encoding="utf-8") as output:
        for page_number, page in enumerate(pdf.pages, start=1):
            words = page.extract_words(
                x_tolerance=2,
                y_tolerance=3,
                keep_blank_chars=False,
                use_text_flow=False,
            )
            words = [word for word in words if float(word["bottom"]) < page.height - 42]
            if page_has_two_columns(words, page.width):
                left_words = [word for word in words if (float(word["x0"]) + float(word["x1"])) / 2 < page.width / 2]
                right_words = [word for word in words if (float(word["x0"]) + float(word["x1"])) / 2 >= page.width / 2]
                parts = [
                    build_paragraphs(group_words(left_words, page.width, page.height)),
                    build_paragraphs(group_words(right_words, page.width, page.height)),
                ]
                content = dehyphenate_paragraph_boundaries(
                    "\n\n".join(part for part in parts if part)
                )
            else:
                content = dehyphenate_paragraph_boundaries(
                    build_paragraphs(group_words(words, page.width, page.height))
                )

            before = output.tell()
            write_row(
                output,
                source="v20-corebook-ru",
                title="VTM V20: Юбилейное издание (RU)",
                page=page_number,
                content=content,
            )
            if output.tell() > before:
                written += 1
            if page_number == 1 or page_number % 50 == 0 or page_number == len(pdf.pages):
                print(f"V20: {page_number}/{len(pdf.pages)}")
    print(f"V20: wrote {written} text pages")


def main() -> None:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)

    v5 = subparsers.add_parser("v5")
    v5.add_argument("raw", type=Path)
    v5.add_argument("output", type=Path)

    v20 = subparsers.add_parser("v20")
    v20.add_argument("pdf", type=Path)
    v20.add_argument("output", type=Path)

    args = parser.parse_args()
    if args.command == "v5":
        build_v5(args.raw, args.output)
    else:
        build_v20(args.pdf, args.output)


if __name__ == "__main__":
    main()
