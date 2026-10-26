import io
import pandas as pd
from backend.core.security import hash_student_id

REQUIRED_COLUMNS = {"student_id", "question_text", "score", "max_score"}
# competency_code lets the instructor tag a question directly (e.g. "DSA-01"),
# skipping LLM topic mapping for that question.
OPTIONAL_COLUMNS = {"submission_date", "competency_code"}


def parse_assessment_csv(file_bytes: bytes) -> list[dict]:
    df = pd.read_csv(io.BytesIO(file_bytes))
    df.columns = df.columns.str.strip().str.lower()

    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(missing)}")

    df = df.dropna(subset=list(REQUIRED_COLUMNS))
    df["score"] = pd.to_numeric(df["score"], errors="coerce")
    df["max_score"] = pd.to_numeric(df["max_score"], errors="coerce")
    df = df.dropna(subset=["score", "max_score"])

    if df.empty:
        raise ValueError("CSV contains no valid rows")

    invalid = df[df["score"] > df["max_score"]]
    if not invalid.empty:
        raise ValueError(f"{len(invalid)} rows have score > max_score")

    # SHA-256 hash student IDs before storing
    df["student_id_hash"] = df["student_id"].astype(str).apply(hash_student_id)

    # Normalize score to percentage
    df["normalized_score"] = (df["score"] / df["max_score"] * 100).round(2)

    if "submission_date" in df.columns:
        df["submission_date"] = pd.to_datetime(df["submission_date"], errors="coerce", utc=True)

    records = []
    for _, row in df.iterrows():
        sub_date = None
        if "submission_date" in df.columns and pd.notna(row["submission_date"]):
            sub_date = row["submission_date"].to_pydatetime()
        competency_code = None
        if "competency_code" in df.columns and pd.notna(row["competency_code"]):
            competency_code = str(row["competency_code"]).strip().upper() or None
        record = {
            "competency_code": competency_code,
            "student_id_hash": row["student_id_hash"],
            "question_text": str(row["question_text"]).strip(),
            "score": float(row["score"]),
            "max_score": float(row["max_score"]),
            "normalized_score": float(row["normalized_score"]),
            "submission_date": sub_date,
        }
        records.append(record)

    return records
