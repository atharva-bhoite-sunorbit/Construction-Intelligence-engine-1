import io
import sys
import zipfile
from types import SimpleNamespace

import pytest
from PIL import Image
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

from backend.app.services.geotech_intel.extractor import (
    GeotechnicalReportExtractor,
    extract_pages_from_pdf,
)
from backend.app.services.geotechnical_service import (
    extract_pages_from_file,
    extract_text_from_file,
    validate_geotechnical_report_text,
)


def _make_docx(text: str) -> bytes:
    content = io.BytesIO()
    document_xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        '<w:body><w:p><w:r><w:t>' + text + '</w:t></w:r></w:p></w:body></w:document>'
    )
    with zipfile.ZipFile(content, "w") as archive:
        archive.writestr("word/document.xml", document_xml)
    return content.getvalue()


def _make_xlsx() -> bytes:
    import openpyxl

    workbook = openpyxl.Workbook()
    sheet = workbook.active
    sheet.title = "Borehole BH-01"
    sheet.append(["Depth", "Description", "SPT N"])
    sheet.append(["0-1.5 m", "Silty sand", 12])
    output = io.BytesIO()
    workbook.save(output)
    workbook.close()
    return output.getvalue()


def _make_mixed_pdf() -> bytes:
    image_data = io.BytesIO()
    Image.new("RGB", (500, 100), "white").save(image_data, format="PNG")
    image_data.seek(0)

    output = io.BytesIO()
    pdf = canvas.Canvas(output)
    pdf.drawString(40, 750, "Geotechnical investigation report digital page with borehole details.")
    pdf.showPage()
    pdf.drawImage(ImageReader(image_data), 40, 650, width=500, height=100)
    pdf.save()
    return output.getvalue()


def test_extracts_text_and_tabular_report_formats():
    csv_text, csv_warnings = extract_text_from_file(
        b"Depth;Description;SPT N\n0-1.5 m;Silty sand;12\n",
        "borelog.csv",
    )
    docx_text, _ = extract_text_from_file(
        _make_docx("Geotechnical investigation report; BH-01: silty sand."),
        "report.docx",
    )
    xlsx_text, _ = extract_text_from_file(_make_xlsx(), "borelog.xlsx")

    assert not csv_warnings
    assert "Silty sand" in csv_text
    assert "BH-01" in docx_text
    assert "Silty sand" in xlsx_text
    assert "SPT N" in xlsx_text


def test_pdf_ocr_runs_for_scanned_pages_in_mixed_documents(monkeypatch):
    class FakeOCR:
        def __call__(self, _image):
            return [([[0, 0], [1, 0], [1, 1], [0, 1]], "Borehole BH-02 clay layer", 0.99)], None

    monkeypatch.setitem(
        sys.modules,
        "rapidocr_onnxruntime",
        SimpleNamespace(RapidOCR=FakeOCR),
    )
    pages = extract_pages_from_pdf(_make_mixed_pdf())

    assert "digital page" in pages[0]
    assert "Borehole BH-02 clay layer" in pages[1]


def test_rejects_unsupported_or_unreadable_report_files():
    with pytest.raises(ValueError, match="Unsupported report format"):
        extract_pages_from_file(b"\x00\x01\x02", "report.bin")

    with pytest.raises(ValueError, match="DOCX file is damaged"):
        extract_pages_from_file(b"not a word document", "report.docx")

    with pytest.raises(ValueError, match="PDF is damaged"):
        extract_pages_from_file(b"not a pdf", "report.pdf")


def test_rejects_short_or_non_geotechnical_text():
    with pytest.raises(ValueError, match="Too little text"):
        validate_geotechnical_report_text("soil")

    with pytest.raises(ValueError, match="No recognizable geotechnical content"):
        validate_geotechnical_report_text(
            "This document contains a sufficiently long description of unrelated financial results."
        )


def test_missing_borehole_depth_and_stratigraphy_are_not_invented():
    report = (
        "GEOTECHNICAL INVESTIGATION REPORT. The site is being evaluated for a proposed structure. "
        "No exploration depth or borehole log is stated in this report."
    )
    extracted = GeotechnicalReportExtractor(report, [report]).extract_all()

    assert extracted["boreholes"] == []
    assert extracted["stratigraphy"] == []
    assert extracted["investigation_information"]["maximum_depth_m"] is None
