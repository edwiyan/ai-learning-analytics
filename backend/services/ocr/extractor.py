import io
import logging

import pdfplumber
from docx import Document
from docx.oxml.ns import qn
from docx.table import Table
from docx.text.paragraph import Paragraph

logger = logging.getLogger(__name__)


def _ocr_pdf(file_bytes: bytes) -> str:
    """Last-resort OCR for scanned/image-only PDFs.

    Rasterizes each page and runs Tesseract. Requires the Tesseract binary
    plus the pdf2image/pytesseract/Pillow Python packages. If any of those are
    unavailable (e.g. the binary is not installed on the host), this degrades
    gracefully to an empty string rather than crashing the upload — consistent
    with the capstone's "graceful degradation" mitigation (§3.9).
    """
    try:
        import pytesseract
        from pdf2image import convert_from_bytes
    except Exception as exc:  # libs not installed
        logger.warning("OCR fallback unavailable (missing libs): %s", exc)
        return ""
    try:
        images = convert_from_bytes(file_bytes)
        return "\n".join(pytesseract.image_to_string(img) for img in images).strip()
    except Exception as exc:  # Tesseract/Poppler binary missing or page error
        logger.warning("OCR fallback failed: %s", exc)
        return ""


def extract_text_from_pdf(file_bytes: bytes) -> str:
    try:
        text_parts = []
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    text_parts.append(text)
        extracted = "\n".join(text_parts).strip()
    except Exception as exc:
        raise ValueError(f"Could not read PDF: {exc}") from exc

    # Scanned/image-only PDFs yield no embedded text → try OCR fallback.
    if not extracted:
        logger.info("No embedded text in PDF; attempting Tesseract OCR fallback.")
        extracted = _ocr_pdf(file_bytes)
    return extracted


def extract_text_from_docx(file_bytes: bytes) -> str:
    try:
        doc = Document(io.BytesIO(file_bytes))
        # Walk the body in document order so table content (where syllabi usually
        # keep CLOs and competencies) is kept; table cells are joined with " | ".
        lines = []
        for block in doc.element.body.iterchildren():
            if block.tag == qn("w:p"):
                lines.append(Paragraph(block, doc).text)
            elif block.tag == qn("w:tbl"):
                for row in Table(block, doc).rows:
                    cells = []
                    for cell in row.cells:
                        text = " ".join(cell.text.split())
                        if text and (not cells or cells[-1] != text):  # skip merged-cell repeats
                            cells.append(text)
                    lines.append(" | ".join(cells))
        return "\n".join(l for l in lines if l.strip())
    except Exception as exc:
        raise ValueError(f"Could not read DOCX: {exc}") from exc


def extract_text(file_bytes: bytes, filename: str) -> str:
    ext = (filename or "").lower().rsplit(".", 1)[-1]
    if ext == "pdf":
        return extract_text_from_pdf(file_bytes)
    if ext in ("docx", "doc"):
        return extract_text_from_docx(file_bytes)
    raise ValueError(f"Unsupported file type: .{ext}")
