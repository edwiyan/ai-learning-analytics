"""Ingestion metrics (capstone §3.1 Objective 1: 100% valid parsing rate,
processing time < 2 s per file). Each syllabus or CSV upload attempt is recorded
as an "ingestion" audit-log entry with its outcome and timings.
"""
from sqlalchemy.orm import Session

from backend.core.audit import log_action

INGESTION_TARGET_MS = 2000


def record_ingestion(db: Session, user_id: str, kind: str, parse_ok: bool, processing_ms: float,
                     filename: str | None = None, **extra) -> None:
    log_action(db, user_id, "ingestion", target_table=kind, extra={
        "kind": kind,
        "parse_ok": parse_ok,
        "processing_ms": round(processing_ms, 1),
        "filename": filename,
        **extra,
    })
