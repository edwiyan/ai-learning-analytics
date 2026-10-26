import pytest
from unittest.mock import MagicMock, patch

from backend.models.prediction import RiskLevel


def _make_features(avg_score: float, below_count: int = 0, grade_decline_pct: float = 0.0):
    return {
        "avg_score": avg_score,
        "below_passing_count": below_count,
        "grade_decline_pct": grade_decline_pct,
        "weak_competencies_ratio": 0.0,
        "weak_competency_ids": [],
        "score_trend": 0.0,
        "competency_avgs": {},
    }


@patch("backend.services.ai.risk_predictor.build_student_features")
def test_rule_based_at_risk(mock_features):
    from backend.services.ai.risk_predictor import predict_risk

    # 4 learning gaps (>= 3) triggers At-Risk per capstone Table 3
    mock_features.return_value = _make_features(avg_score=55.0, below_count=4)
    result = predict_risk("abc123hash", "course-uuid", MagicMock())
    assert result["risk_level"] == RiskLevel.at_risk
    assert result["confidence"] > 0


@patch("backend.services.ai.risk_predictor.build_student_features")
def test_rule_based_at_risk_grade_decline(mock_features):
    from backend.services.ai.risk_predictor import predict_risk

    # A >15% grade decline triggers At-Risk even with few gaps
    mock_features.return_value = _make_features(avg_score=80.0, below_count=0, grade_decline_pct=18.0)
    result = predict_risk("abc123hash", "course-uuid", MagicMock())
    assert result["risk_level"] == RiskLevel.at_risk


@patch("backend.services.ai.risk_predictor.build_student_features")
def test_rule_based_excelling(mock_features):
    from backend.services.ai.risk_predictor import predict_risk

    mock_features.return_value = _make_features(avg_score=92.0, below_count=0)
    result = predict_risk("abc123hash", "course-uuid", MagicMock())
    assert result["risk_level"] == RiskLevel.excelling


@patch("backend.services.ai.risk_predictor.build_student_features")
def test_rule_based_on_track(mock_features):
    from backend.services.ai.risk_predictor import predict_risk

    mock_features.return_value = _make_features(avg_score=78.0, below_count=1)
    result = predict_risk("abc123hash", "course-uuid", MagicMock())
    assert result["risk_level"] == RiskLevel.on_track


@patch("backend.services.ai.risk_predictor.build_student_features")
def test_predict_risk_returns_required_keys(mock_features):
    from backend.services.ai.risk_predictor import predict_risk

    mock_features.return_value = _make_features(avg_score=65.0, below_count=1)
    result = predict_risk("abc123hash", "course-uuid", MagicMock())
    assert "risk_level" in result
    assert "confidence" in result
    assert "weak_competency_ids" in result
