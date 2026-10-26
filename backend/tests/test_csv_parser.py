import io
import pytest
import pandas as pd

from backend.services.assessment.csv_parser import parse_assessment_csv


def _make_csv(rows: list[dict]) -> bytes:
    df = pd.DataFrame(rows)
    buf = io.BytesIO()
    df.to_csv(buf, index=False)
    return buf.getvalue()


VALID_ROW = {
    "student_id": "2023-00001",
    "question_text": "What is the derivative of x^2?",
    "score": 8,
    "max_score": 10,
}


def test_valid_csv_parses_successfully():
    csv_bytes = _make_csv([VALID_ROW, {**VALID_ROW, "student_id": "2023-00002", "score": 5}])
    records = parse_assessment_csv(csv_bytes)
    assert len(records) == 2


def test_student_id_is_hashed():
    csv_bytes = _make_csv([VALID_ROW])
    records = parse_assessment_csv(csv_bytes)
    assert records[0]["student_id_hash"] != "2023-00001"
    assert len(records[0]["student_id_hash"]) == 64  # SHA-256 hex


def test_score_normalized_to_percentage():
    row = {**VALID_ROW, "score": 5, "max_score": 10}
    records = parse_assessment_csv(_make_csv([row]))
    assert records[0]["normalized_score"] == pytest.approx(50.0)
    assert records[0]["score"] == pytest.approx(5.0)
    assert records[0]["max_score"] == pytest.approx(10.0)


def test_missing_required_column_raises():
    bad = {"student_id": "2023-00001", "score": 8}
    with pytest.raises(ValueError, match="Missing required columns"):
        parse_assessment_csv(_make_csv([bad]))


def test_empty_csv_raises():
    with pytest.raises(ValueError, match="no valid rows"):
        parse_assessment_csv(b"student_id,question_text,score,max_score\n")


def test_score_exceeds_max_raises():
    bad = {**VALID_ROW, "score": 15, "max_score": 10}
    with pytest.raises(ValueError, match="score > max_score"):
        parse_assessment_csv(_make_csv([bad]))
