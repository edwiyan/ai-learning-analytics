"""Persist rule-based risk results so changes over time can be detected.

predict_risk() is computed on read by the dashboards; this module records a
RiskPrediction row whenever a student's level changes, and reports those
transitions so callers can raise alerts (capstone §3.8.2: At-Risk triggers a
faculty alert and a student notification).
"""
from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from backend.models.prediction import RiskLevel, RiskPrediction
from backend.services.ai.feature_engineering import get_all_students_in_course
from backend.services.ai.risk_predictor import predict_risk


@dataclass
class RiskTransition:
    student_id_hash: str
    previous: RiskLevel | None
    current: RiskLevel
    learning_gap_count: int = 0
    grade_decline_pct: float = 0.0
    weak_competency_ids: list = field(default_factory=list)

    @property
    def became_at_risk(self) -> bool:
        return self.current == RiskLevel.at_risk and self.previous != RiskLevel.at_risk


def latest_prediction(student_id_hash: str, course_id, db: Session) -> RiskPrediction | None:
    return (
        db.query(RiskPrediction)
        .filter(RiskPrediction.student_id_hash == student_id_hash,
                RiskPrediction.course_id == course_id)
        .order_by(RiskPrediction.predicted_at.desc(), RiskPrediction.id.desc())
        .first()
    )


def refresh_course_risk(course_id, db: Session) -> list[RiskTransition]:
    """Snapshot each student's current risk level; returns the students whose level
    changed since their last snapshot (including first-time snapshots)."""
    transitions = []
    for student_hash in get_all_students_in_course(str(course_id), db):
        result = predict_risk(student_hash, str(course_id), db)
        features = result.get("features")
        if not features:
            continue
        previous = latest_prediction(student_hash, course_id, db)
        previous_level = previous.risk_level if previous else None
        current = result["risk_level"]
        if previous_level == current:
            continue
        db.add(RiskPrediction(
            student_id_hash=student_hash,
            course_id=course_id,
            grading_period=features.get("latest_period") or "unknown",
            risk_level=current,
            confidence=result.get("confidence"),
            weak_competencies=result.get("weak_competency_ids", []),
        ))
        transitions.append(RiskTransition(
            student_id_hash=student_hash,
            previous=previous_level,
            current=current,
            learning_gap_count=features.get("below_passing_count", 0),
            grade_decline_pct=features.get("grade_decline_pct", 0.0),
            weak_competency_ids=result.get("weak_competency_ids", []),
        ))
    db.commit()
    return transitions
