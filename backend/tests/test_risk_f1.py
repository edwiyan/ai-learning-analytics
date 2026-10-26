"""
Risk classifier regression test (internal QA).

Per the capstone evaluation design, the system's primary quality measures are
usability (SUS >= 68) and functional suitability — NOT algorithmic accuracy. This
test is an internal regression guard that the deterministic rule keeps reproducing
the capstone Table 3 criteria; it is not the project's headline evaluation metric.

At-Risk   : (learning_gap_count >= 3) OR (grade_decline_pct > 15)
Excelling : avg_score >= 85 AND learning_gap_count == 0
On-Track  : everything else
"""

import pytest

from backend.models.prediction import RiskLevel
from backend.services.ai.risk_predictor import _rule_based_risk

THRESHOLD = 0.80

# ── Labeled dataset (25 samples) ──────────────────────────────────────────────
# Columns: avg_score, below_passing_count (learning gaps), grade_decline_pct, label
# Labels follow the Table 3 rule above.

DATASET = [
    # ── At-Risk (8) — 3+ gaps OR >15% decline ────────────────────────────────
    (55.0, 5,  8.0, "At-Risk"),
    (62.0, 4,  5.0, "At-Risk"),
    (68.0, 3,  2.0, "At-Risk"),
    (78.0, 1, 20.0, "At-Risk"),   # few gaps but steep decline
    (60.0, 3, 10.0, "At-Risk"),
    (45.0, 6, 12.0, "At-Risk"),
    (82.0, 0, 18.0, "At-Risk"),   # decent avg but declining > 15%
    (72.0, 3, -2.0, "At-Risk"),

    # ── On-Track (9) — <3 gaps, decline <=15, avg < 85 ───────────────────────
    (70.0, 2,  0.0, "On-Track"),
    (75.0, 1,  2.0, "On-Track"),
    (78.0, 2, -3.0, "On-Track"),
    (80.0, 2,  5.0, "On-Track"),
    (82.0, 1,  3.0, "On-Track"),
    (73.0, 2, 10.0, "On-Track"),
    (77.0, 1, 15.0, "On-Track"),  # exactly 15 — not > 15
    (84.9, 0,  0.0, "On-Track"),  # avg < 85 and no gaps -> not Excelling
    (71.0, 0, 14.0, "On-Track"),

    # ── Excelling (8) — avg >= 85 AND no gaps (and decline <= 15) ─────────────
    (92.0, 0,  2.0, "Excelling"),
    (88.0, 0,  0.0, "Excelling"),
    (95.0, 0, -1.0, "Excelling"),
    (87.0, 0,  1.0, "Excelling"),
    (90.0, 0,  5.0, "Excelling"),
    (86.0, 0,  0.0, "Excelling"),
    (100.0, 0, 0.0, "Excelling"),
    (85.0, 0, 10.0, "Excelling"),
]


def _make_features(avg, below_count, grade_decline_pct=0.0):
    return {
        "avg_score": avg,
        "below_passing_count": below_count,
        "grade_decline_pct": grade_decline_pct,
        "weak_competencies_ratio": 0.0,
        "weak_competency_ids": [],
        "competency_avgs": {},
    }


def _macro_f1(y_true: list, y_pred: list, labels: list) -> float:
    """Compute macro-averaged F1 without sklearn."""
    f1s = []
    for label in labels:
        tp = sum(1 for t, p in zip(y_true, y_pred) if t == label and p == label)
        fp = sum(1 for t, p in zip(y_true, y_pred) if t != label and p == label)
        fn = sum(1 for t, p in zip(y_true, y_pred) if t == label and p != label)
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = (2 * precision * recall / (precision + recall)
              if (precision + recall) > 0 else 0.0)
        f1s.append(f1)
    return sum(f1s) / len(f1s) if f1s else 0.0


# ── Tests ─────────────────────────────────────────────────────────────────────

def test_rule_based_f1_score():
    """Regression guard: rule must reproduce the Table 3 labels (macro F1 >= 0.80)."""
    y_true, y_pred = [], []

    for avg, below_count, decline, label in DATASET:
        features = _make_features(avg, below_count, decline)
        predicted = _rule_based_risk(features).value
        y_true.append(label)
        y_pred.append(predicted)

    labels = ["At-Risk", "On-Track", "Excelling"]
    score = _macro_f1(y_true, y_pred, labels)

    print(f"\n=== Risk Classifier Regression (Rule-Based) ===")
    print(f"Samples  : {len(DATASET)}  (At-Risk: 8, On-Track: 9, Excelling: 8)")
    print(f"Macro F1 : {score:.4f}  (target: >={THRESHOLD})")

    assert score >= THRESHOLD, (
        f"Rule-based macro F1 {score:.4f} is below the required {THRESHOLD}."
    )


def test_dataset_covers_all_risk_levels():
    """Dataset must contain all three risk levels."""
    labels = {row[-1] for row in DATASET}
    assert "At-Risk" in labels
    assert "On-Track" in labels
    assert "Excelling" in labels


def test_boundary_at_risk_gap_trigger():
    """learning_gap_count >= 3 -> At-Risk; at 2 -> not triggered by gaps alone."""
    f_three = _make_features(80.0, 3, 0.0)
    assert _rule_based_risk(f_three) == RiskLevel.at_risk

    f_two = _make_features(80.0, 2, 0.0)
    assert _rule_based_risk(f_two) != RiskLevel.at_risk


def test_boundary_at_risk_decline_trigger():
    """grade_decline_pct > 15 -> At-Risk; at exactly 15 -> not triggered."""
    f_above = _make_features(80.0, 0, 15.1)
    assert _rule_based_risk(f_above) == RiskLevel.at_risk

    f_equal = _make_features(80.0, 0, 15.0)
    assert _rule_based_risk(f_equal) != RiskLevel.at_risk


def test_excelling_requires_high_mastery_and_no_gaps():
    """Excelling needs avg >= 85 AND zero learning gaps -- neither alone suffices."""
    # avg below 85, no gaps -> On-Track
    f = _make_features(84.9, 0, 0.0)
    assert _rule_based_risk(f) == RiskLevel.on_track

    # high avg but a gap present (and < 3, so not At-Risk) -> On-Track
    f = _make_features(90.0, 1, 0.0)
    assert _rule_based_risk(f) == RiskLevel.on_track

    # both conditions met -> Excelling
    f = _make_features(90.0, 0, 0.0)
    assert _rule_based_risk(f) == RiskLevel.excelling
