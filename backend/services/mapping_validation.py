"""Mapping validation: sampling and metrics (panel comment 1).

* Sampling — a stratified random sample of AI-mapped assessment items, allocated to
  courses and, within a course, to confidence bands (>= / < the review threshold) in
  proportion to their size. The seed is stored so the sample can be reproduced.
* Ground truth — the label both validators agree on, otherwise the adjudicator's.
* Metrics — accuracy (AI answer == ground truth) with a 95% Wilson interval, Cohen's
  kappa between the two validators before adjudication, accuracy per competency and
  per confidence band (whether the self-reported confidence separates right from wrong).
"""
import math
import random
from collections import Counter, defaultdict

from sqlalchemy.orm import Session

from backend.models.assessment import Assessment, AssessmentItem
from backend.models.mapping_validation import MappingValidationItem

NONE = "none"  # label key for "no matching competency"
DEFAULT_SAMPLE_SIZE = 306  # 85% ± 4% at 95% confidence: 1.96² × 0.85 × 0.15 / 0.04²


# ── sampling ──────────────────────────────────────────────────────────────────

def eligible_items(db: Session, course_ids) -> list[AssessmentItem]:
    """Items the AI actually mapped (pre-tagged CSV items have no AI answer to score)."""
    return (db.query(AssessmentItem)
            .join(Assessment, AssessmentItem.assessment_id == Assessment.id)
            .filter(Assessment.course_id.in_(course_ids), AssessmentItem.ai_mapped_at.isnot(None))
            .all())


def _allocate(sizes: dict, n: int) -> dict:
    """Largest-remainder proportional allocation of n across strata (never above a stratum's size)."""
    total = sum(sizes.values())
    if total <= n:
        return dict(sizes)
    raw = {k: n * v / total for k, v in sizes.items()}
    alloc = {k: min(int(r), sizes[k]) for k, r in raw.items()}
    leftover = n - sum(alloc.values())
    for k in sorted(raw, key=lambda k: raw[k] - int(raw[k]), reverse=True):
        if leftover <= 0:
            break
        if alloc[k] < sizes[k]:
            alloc[k] += 1
            leftover -= 1
    return alloc


def draw_sample(items: list[AssessmentItem], course_of: dict, n: int, seed: int, threshold: float):
    """Return [(item, course_id, band)] — stratified by course, then confidence band."""
    rng = random.Random(seed)
    strata = defaultdict(list)
    for it in sorted(items, key=lambda i: str(i.id)):   # stable order before shuffling
        conf = it.ai_confidence if it.ai_confidence is not None else it.confidence_score
        band = "high" if conf is not None and conf >= threshold else "low"
        strata[(course_of[str(it.id)], band)].append(it)
    by_course = defaultdict(int)
    for (course, _), its in strata.items():
        by_course[course] += len(its)
    per_course = _allocate(dict(by_course), n)
    chosen = []
    for course, k in per_course.items():
        bands = {band: len(its) for (c, band), its in strata.items() if c == course}
        for band, m in _allocate(bands, k).items():
            chosen += [(it, course, band) for it in rng.sample(strata[(course, band)], m)]
    rng.shuffle(chosen)
    return chosen


# ── metrics (pure functions) ──────────────────────────────────────────────────

def wilson_interval(successes: int, n: int, z: float = 1.96):
    if n == 0:
        return None, None
    p = successes / n
    denom = 1 + z * z / n
    centre = (p + z * z / (2 * n)) / denom
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denom
    return round(max(0.0, centre - half) * 100, 1), round(min(1.0, centre + half) * 100, 1)


def cohens_kappa(pairs: list[tuple]) -> float | None:
    """Cohen's kappa for two raters over categorical labels [(a, b), ...]."""
    n = len(pairs)
    if n == 0:
        return None
    observed = sum(1 for a, b in pairs if a == b) / n
    ca, cb = Counter(a for a, _ in pairs), Counter(b for _, b in pairs)
    expected = sum(ca[k] * cb.get(k, 0) for k in ca) / (n * n)
    if expected == 1:
        return 1.0
    return round((observed - expected) / (1 - expected), 3)


def label_key(competency_id, none_fits) -> str:
    return NONE if none_fits or competency_id is None else str(competency_id)


def ground_truth(item: MappingValidationItem, validator_a, validator_b) -> str | None:
    """Agreed label, else the adjudication, else None (still open)."""
    labels = {str(l.validator_id): label_key(l.competency_id, l.none_fits) for l in item.labels}
    a, b = labels.get(str(validator_a)), labels.get(str(validator_b))
    if a is not None and a == b:
        return a
    if item.adjudication is not None:
        return label_key(item.adjudication.competency_id, item.adjudication.none_fits)
    return None


def compute_metrics(items, assignments_by_course: dict, competency_names: dict, target: float = 85.0) -> dict:
    """items: MappingValidationItem with labels/adjudication loaded.
    assignments_by_course: {course_id: assignment}; competency_names: {id: (code, topic)}."""
    pairs, scored = [], []
    labeled_a = labeled_b = disagreements = adjudicated = 0
    for it in items:
        asg = assignments_by_course.get(str(it.course_id))
        if asg is None:
            continue
        labels = {str(l.validator_id): label_key(l.competency_id, l.none_fits) for l in it.labels}
        a, b = labels.get(str(asg.validator_a_id)), labels.get(str(asg.validator_b_id))
        labeled_a += a is not None
        labeled_b += b is not None
        if a is not None and b is not None:
            pairs.append((a, b))
            if a != b:
                disagreements += 1
                adjudicated += it.adjudication is not None
        gt = ground_truth(it, asg.validator_a_id, asg.validator_b_id)
        if gt is not None:
            ai = label_key(it.ai_competency_id, it.ai_competency_id is None)
            scored.append((it, gt, ai == gt))

    correct = sum(1 for _, _, ok in scored if ok)
    lo, hi = wilson_interval(correct, len(scored))
    accuracy = round(correct / len(scored) * 100, 1) if scored else None

    by_band = {}
    for band in ("high", "low"):
        rows = [ok for it, _, ok in scored if it.confidence_band == band]
        b_lo, b_hi = wilson_interval(sum(rows), len(rows))
        by_band[band] = {"items": len(rows), "correct": sum(rows),
                         "accuracy_pct": round(sum(rows) / len(rows) * 100, 1) if rows else None,
                         "ci_low": b_lo, "ci_high": b_hi}

    per_comp = defaultdict(lambda: [0, 0])
    for _, gt, ok in scored:
        per_comp[gt][0] += 1
        per_comp[gt][1] += ok
    by_competency = []
    for key, (n, ok) in per_comp.items():
        code, topic = competency_names.get(key, ("—", "No matching competency" if key == NONE else "Unknown"))
        by_competency.append({"competency_code": code, "topic_name": topic, "items": n, "correct": ok,
                              "accuracy_pct": round(ok / n * 100, 1)})
    by_competency.sort(key=lambda r: (r["accuracy_pct"], -r["items"]))

    total = len(items)
    return {
        "items": total,
        "labeled_by_both": len(pairs),
        "labeled_a": labeled_a,
        "labeled_b": labeled_b,
        "disagreements": disagreements,
        "adjudicated": adjudicated,
        "awaiting_adjudication": disagreements - adjudicated,
        "ground_truth_items": len(scored),
        "correct": correct,
        "accuracy_pct": accuracy,
        "ci_low": lo,
        "ci_high": hi,
        "target_pct": target,
        "meets_target": accuracy is not None and accuracy >= target,
        # stricter reading: even the lower end of the 95% interval reaches the target
        "meets_target_at_ci_low": lo is not None and lo >= target,
        "kappa": cohens_kappa(pairs),
        "agreement_pct": round(sum(1 for a, b in pairs if a == b) / len(pairs) * 100, 1) if pairs else None,
        "by_band": by_band,
        "by_competency": by_competency,
        "none_fits_ground_truth": sum(1 for _, gt, _ in scored if gt == NONE),
        "complete": total > 0 and len(scored) == total,
    }
