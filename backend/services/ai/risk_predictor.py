from sqlalchemy.orm import Session

from backend.models.prediction import RiskLevel
from backend.services.ai.feature_engineering import build_student_features, get_all_students_in_course


def _rule_based_risk(features: dict) -> RiskLevel:
    """Deterministic risk classification aligned with the capstone Table 3 criteria.

    At-Risk is triggered when a student has 3 or more learning gaps (competencies
    below the 75% passing threshold) OR a grade decline greater than 15% between the
    two most recent grading periods. Behavioral signals (attendance, submission
    timeliness) are intentionally excluded from the flag per Delimitation #2 — they
    remain available as descriptive features but do not drive academic risk.
    """
    avg = features["avg_score"]
    learning_gap_count = features["below_passing_count"]
    grade_decline_pct = features.get("grade_decline_pct", 0.0)

    # At-Risk: (learning_gap_count >= 3) OR (grade_decline > 15%)
    if learning_gap_count >= 3 or grade_decline_pct > 15.0:
        return RiskLevel.at_risk
    # Excelling: strong overall mastery with no learning gaps
    if avg >= 85 and learning_gap_count == 0:
        return RiskLevel.excelling
    return RiskLevel.on_track


def explain_risk(features: dict | None, risk_level) -> str:
    """Plain-language reason for a rule-based classification (which rule fired)."""
    level = getattr(risk_level, "value", risk_level)
    if not features:
        return "No assessment data yet"
    gaps = features.get("below_passing_count", 0)
    decline = features.get("grade_decline_pct", 0.0) or 0.0
    if level == RiskLevel.at_risk.value:
        parts = []
        if gaps >= 3:
            parts.append(f"{gaps} competencies below 75%")
        if decline > 15.0:
            parts.append(f"{decline:.1f}% grade decline")
        return "; ".join(parts)
    if level == RiskLevel.excelling.value:
        return f"Average {features.get('avg_score', 0):.1f}% with no learning gaps"
    return f"{gaps} learning gap{'s' if gaps != 1 else ''}" if gaps else "Meets expectations"


def predict_risk(student_id_hash: str, course_id: str, db: Session) -> dict:
    """Classify a student's risk in a course with the deterministic rules above.

    `confidence` is kept only because the risk_predictions table has the column; the
    rules are deterministic, so it carries no meaning and is never shown to users.
    """
    features = build_student_features(student_id_hash, course_id, db)
    if not features:
        return {"risk_level": RiskLevel.on_track, "confidence": None, "weak_competency_ids": [],
                "reason": explain_risk(None, RiskLevel.on_track)}

    risk_level = _rule_based_risk(features)

    return {
        "risk_level": risk_level,
        "confidence": None,
        "weak_competency_ids": features["weak_competency_ids"],
        "reason": explain_risk(features, risk_level),
        "features": features,
    }
