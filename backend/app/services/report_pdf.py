"""Minimal, dependency-free PDF rendering for saved reports.

Produces a plain text document (built-in Helvetica, A4, automatic pagination). It contains only
what is already stored in the report: aggregate CPT metrics, the observation counts and the
limitations. No participant name, email or identifiers other than the report ID are included.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

PAGE_WIDTH, PAGE_HEIGHT = 595, 842
MARGIN = 56
LINE_HEIGHT = 15
MAX_CHARS = 92  # characters per line at 10 pt Helvetica on A4 with these margins


def _escape(text: str) -> str:
    # Built-in fonts use WinAnsi; anything outside Latin-1 is replaced rather than corrupting the file.
    safe = text.encode("latin-1", "replace").decode("latin-1")
    return safe.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _wrap(text: str, width: int = MAX_CHARS) -> list[str]:
    lines: list[str] = []
    for paragraph in text.split("\n"):
        words, current = paragraph.split(" "), ""
        for word in words:
            candidate = f"{current} {word}".strip()
            if len(candidate) > width and current:
                lines.append(current)
                current = word
            else:
                current = candidate
        lines.append(current)
    return lines


def _fmt(value: Any, suffix: str = "") -> str:
    return "not available" if value is None else f"{value}{suffix}"


def report_lines(report: dict[str, Any]) -> list[tuple[str, str]]:
    """(style, text) pairs: style is 'title', 'heading' or 'body'."""
    content = report.get("content") or {}
    metrics = content.get("metrics") or {}
    created = report.get("created_at")
    created_text = created.strftime("%Y-%m-%d %H:%M UTC") if isinstance(created, datetime) else str(created)

    lines: list[tuple[str, str]] = [
        ("title", "Attune research report"),
        ("body", f"Report ID: {report.get('id')}"),
        ("body", f"Created: {created_text}"),
        ("body", f"Template: {report.get('template_version')}"),
        ("body", ""),
        ("heading", "Summary of saved runs"),
        ("body", f"Saved runs included: {_fmt(content.get('summary_count'))}"),
        ("body", f"Trials: {_fmt(metrics.get('trial_count'))}"),
        ("body", f"Accuracy: {_fmt(metrics.get('accuracy_percent'), '%')}"),
        ("body", f"Mean hit reaction time: {_fmt(metrics.get('mean_hit_reaction_time_ms'), ' ms')}"),
        ("body", ""),
        ("heading", "Response counts"),
        ("body", f"Hits: {_fmt(metrics.get('hit_count'))}    Misses: {_fmt(metrics.get('miss_count'))}"),
        (
            "body",
            f"False alarms: {_fmt(metrics.get('false_alarm_count'))}    "
            f"Correct rejections: {_fmt(metrics.get('correct_rejection_count'))}",
        ),
        ("body", ""),
        ("heading", "Limitations"),
    ]
    for item in content.get("limitations") or []:
        lines.extend(("body", f"- {part}") for part in _wrap(str(item), MAX_CHARS - 2))
    lines += [
        ("body", ""),
        (
            "body",
            "This report describes performance on a short computer task. It is not a diagnosis, "
            "a prediction or clinical advice.",
        ),
    ]
    return lines


def render_report_pdf(report: dict[str, Any]) -> bytes:
    styled: list[tuple[str, str]] = []
    for style, text in report_lines(report):
        for part in _wrap(text) if text else [""]:
            styled.append((style, part))

    per_page = (PAGE_HEIGHT - 2 * MARGIN) // LINE_HEIGHT
    pages = [styled[i : i + per_page] for i in range(0, len(styled), per_page)] or [[]]

    objects: list[bytes] = []

    def add(body: str | bytes) -> int:
        objects.append(body.encode("latin-1") if isinstance(body, str) else body)
        return len(objects)

    catalog_id = add("")  # placeholder, filled in below
    pages_id = add("")
    regular_id = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")
    bold_id = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>")

    page_ids: list[int] = []
    for page in pages:
        commands = ["BT"]
        y = PAGE_HEIGHT - MARGIN
        for style, text in page:
            font, size = {"title": ("F2", 18), "heading": ("F2", 12)}.get(style, ("F1", 10))
            commands.append(f"/{font} {size} Tf 1 0 0 1 {MARGIN} {y} Tm ({_escape(text)}) Tj")
            y -= LINE_HEIGHT + (6 if style == "title" else 0)
        commands.append("ET")
        stream = "\n".join(commands).encode("latin-1")
        content_id = add(b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream")
        page_ids.append(
            add(
                f"<< /Type /Page /Parent {pages_id} 0 R /MediaBox [0 0 {PAGE_WIDTH} {PAGE_HEIGHT}] "
                f"/Resources << /Font << /F1 {regular_id} 0 R /F2 {bold_id} 0 R >> >> "
                f"/Contents {content_id} 0 R >>"
            )
        )

    kids = " ".join(f"{pid} 0 R" for pid in page_ids)
    objects[pages_id - 1] = f"<< /Type /Pages /Kids [{kids}] /Count {len(page_ids)} >>".encode("latin-1")
    objects[catalog_id - 1] = f"<< /Type /Catalog /Pages {pages_id} 0 R >>".encode("latin-1")

    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for number, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{number} 0 obj\n".encode() + body + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode()
    for offset in offsets:
        out += f"{offset:010d} 00000 n \n".encode()
    out += (
        f"trailer\n<< /Size {len(objects) + 1} /Root {catalog_id} 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    )
    return bytes(out)
