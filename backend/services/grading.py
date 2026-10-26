from sqlalchemy.orm import Session
from backend.models.grade_scale import GradeScale


def get_letter_grade(score_percent: float, db: Session) -> str:
    """Convert a percentage score to a BTECH numeric grade (1.00–5.00 scale)."""
    scale = (
        db.query(GradeScale)
        .filter(GradeScale.min_percent <= score_percent, GradeScale.max_percent >= score_percent)
        .order_by(GradeScale.grade_points)
        .first()
    )
    if scale:
        return scale.letter_grade
    return "5.00" if score_percent < 75 else "1.00"


def get_grade_points(score_percent: float, db: Session) -> float:
    scale = (
        db.query(GradeScale)
        .filter(GradeScale.min_percent <= score_percent, GradeScale.max_percent >= score_percent)
        .order_by(GradeScale.grade_points)
        .first()
    )
    return scale.grade_points if scale else (5.00 if score_percent < 75 else 1.00)
