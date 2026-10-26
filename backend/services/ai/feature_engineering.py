from collections import defaultdict
from sqlalchemy.orm import Session
from backend.models.score import StudentScore
from backend.models.assessment import Assessment, GradingPeriod, AssessmentCategory
from backend.models.syllabus import Competency, SyllabusStatus
from backend.models.grade_weight import GradeWeight
from backend.models.attendance import AttendanceRecord, AttendanceStatus

PASSING_THRESHOLD = 75.0

# Chronological order of grading periods, used to compute the period-over-period
# grade decline that feeds the At-Risk rule (capstone Table 3).
PERIOD_ORDER = [
    GradingPeriod.prelim,
    GradingPeriod.midterm,
    GradingPeriod.semi_final,
    GradingPeriod.final,
]

from datetime import timezone as _tz


def mastery_level(pct: float) -> str:
    """Map a mastery percentage to the capstone mastery levels (Table 3).

    Proficient (>=85), Developing (75-84), Emerging (<75). An "Emerging" level is
    equivalent to a Learning Gap for the competency.
    """
    if pct >= 85:
        return "Proficient"
    if pct >= PASSING_THRESHOLD:
        return "Developing"
    return "Emerging"


def _aware(dt):
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=_tz.utc)
    return dt


def _compute_timeliness(scores: list, assessment_map: dict) -> tuple[float, int]:
    """Returns (timeliness_score 0–1, late_submission_count)."""
    assessments_with_dates = {
        aid: a for aid, a in assessment_map.items() if a.date is not None
    }
    if not assessments_with_dates:
        return 1.0, 0

    total = 0
    late = 0
    for s in scores:
        a = assessments_with_dates.get(str(s.assessment_id))
        if a is None or s.submission_date is None:
            continue
        total += 1
        if _aware(s.submission_date) > _aware(a.date):
            late += 1

    if total == 0:
        return 1.0, 0
    return round(1.0 - late / total, 3), late


def _compute_weighted_avg(period_scores: dict, course_id: str, db: Session) -> float:
    """Apply grade weights per period×category if configured; fall back to simple average."""
    weights = db.query(GradeWeight).filter(GradeWeight.course_id == course_id).all()
    if not weights:
        all_vals = [v for vals in period_scores.values() for v in vals]
        return sum(all_vals) / len(all_vals) if all_vals else 0.0

    weight_map = {(str(w.grading_period), str(w.assessment_category)): w.weight_percent for w in weights}
    total_weight = 0.0
    weighted_sum = 0.0
    for (period, category), vals in period_scores.items():
        key = (period, category)
        w = weight_map.get(key, 0.0)
        if w > 0 and vals:
            weighted_sum += (sum(vals) / len(vals)) * w
            total_weight += w

    if total_weight == 0:
        all_vals = [v for vals in period_scores.values() for v in vals]
        return sum(all_vals) / len(all_vals) if all_vals else 0.0
    return weighted_sum / total_weight


def build_student_features(student_id_hash: str, course_id: str, db: Session) -> dict | None:
    assessments = db.query(Assessment).filter(Assessment.course_id == course_id).all()
    if not assessments:
        return None

    assessment_map = {str(a.id): a for a in assessments}
    assessment_ids = list(assessment_map.keys())
    scores = db.query(StudentScore).filter(
        StudentScore.student_id_hash == student_id_hash,
        StudentScore.assessment_id.in_(assessment_ids),
    ).all()

    if not scores:
        return None

    # period → list of percentages (for period averages)
    period_scores: dict[str, list[float]] = defaultdict(list)
    # (period, category) → list of percentages (for weighted avg)
    period_cat_scores: dict[tuple, list[float]] = defaultdict(list)
    # formative vs summative separated averages
    formative_scores: list[float] = []
    summative_scores: list[float] = []

    for s in scores:
        pct = (s.score / s.max_score * 100) if s.max_score > 0 else 0.0
        period_scores[s.grading_period].append(pct)
        a = assessment_map.get(str(s.assessment_id))
        category = str(a.assessment_category) if a and a.assessment_category else "formative"
        period_cat_scores[(str(s.grading_period), category)].append(pct)
        if category == "summative":
            summative_scores.append(pct)
        else:
            formative_scores.append(pct)

    period_avgs = {p: sum(v) / len(v) for p, v in period_scores.items()}

    # Grade decline between the two most recent grading periods that have data.
    # Positive value = a decline (drop in average). Per capstone Table 3, a decline
    # greater than 15% is one of the two At-Risk triggers.
    present_periods = [(p, period_avgs[p]) for p in PERIOD_ORDER if p in period_avgs]
    grade_decline_pct = 0.0
    if len(present_periods) >= 2:
        prev_avg = present_periods[-2][1]
        curr_avg = present_periods[-1][1]
        if prev_avg > 0:
            grade_decline_pct = (prev_avg - curr_avg) / prev_avg * 100

    # Build competency averages first — these only include mapped scores (competency_id set),
    # so they are clean of unmapped/test assessments that would skew the risk calculation.
    competency_scores: dict[str, list[float]] = defaultdict(list)
    for s in scores:
        if s.competency_id:
            pct = (s.score / s.max_score * 100) if s.max_score > 0 else 0.0
            competency_scores[str(s.competency_id)].append(pct)

    comp_avgs = {cid: sum(v) / len(v) for cid, v in competency_scores.items()}

    # Use competency-mapped average when available so avg_score is consistent with displayed
    # competency scores; fall back to all scores only when no competency mapping exists yet.
    if comp_avgs:
        avg_score = sum(comp_avgs.values()) / len(comp_avgs)
    else:
        avg_score = _compute_weighted_avg(period_cat_scores, course_id, db)

    prelim = period_avgs.get(GradingPeriod.prelim, avg_score)
    midterm = period_avgs.get(GradingPeriod.midterm, prelim)
    semi = period_avgs.get(GradingPeriod.semi_final, midterm)

    formative_avg = sum(formative_scores) / len(formative_scores) if formative_scores else None
    summative_avg = sum(summative_scores) / len(summative_scores) if summative_scores else None
    weak = [cid for cid, avg in comp_avgs.items() if avg < PASSING_THRESHOLD]
    total_comps = len(comp_avgs)
    weak_ratio = len(weak) / total_comps if total_comps > 0 else 0.0

    # Timeliness features
    timeliness_score, late_count = _compute_timeliness(scores, assessment_map)

    # Attendance features
    att_records = db.query(AttendanceRecord).filter(
        AttendanceRecord.student_id_hash == student_id_hash,
        AttendanceRecord.course_id == course_id,
    ).all()
    att_dates = set(r.date for r in att_records)
    total_sessions = len(att_dates)
    absent_count = sum(1 for r in att_records if r.status == AttendanceStatus.absent)
    absence_rate = absent_count / total_sessions if total_sessions > 0 else 0.0

    return {
        "avg_score": round(avg_score, 2),
        "prelim_avg": round(prelim, 2),
        "midterm_avg": round(midterm, 2),
        "semi_final_avg": round(semi, 2),
        "score_trend": round(midterm - prelim, 2),
        "grade_decline_pct": round(grade_decline_pct, 2),
        "weak_competencies_ratio": round(weak_ratio, 2),
        "below_passing_count": len(weak),
        "weak_competency_ids": weak,
        "competency_avgs": comp_avgs,
        "formative_avg": round(formative_avg, 2) if formative_avg is not None else None,
        "summative_avg": round(summative_avg, 2) if summative_avg is not None else None,
        "absence_rate": round(absence_rate, 3),
        "absence_count": absent_count,
        "timeliness_score": timeliness_score,
        "late_submission_count": late_count,
    }


def get_all_students_in_course(course_id: str, db: Session) -> list[str]:
    assessments = db.query(Assessment).filter(Assessment.course_id == course_id).all()
    if not assessments:
        return []
    assessment_ids = [str(a.id) for a in assessments]
    rows = db.query(StudentScore.student_id_hash).filter(
        StudentScore.assessment_id.in_(assessment_ids)
    ).distinct().all()
    return [r.student_id_hash for r in rows]


def recompute_competency_mastery(course_id: str, db: Session) -> int:
    """Recompute and persist the pre-aggregated competency_mastery rows for a course
    (capstone Table 9). Replaces any existing rows for the course; returns the count written."""
    from backend.models.competency_mastery import CompetencyMastery

    students = get_all_students_in_course(course_id, db)
    db.query(CompetencyMastery).filter(
        CompetencyMastery.course_id == course_id
    ).delete(synchronize_session=False)

    written = 0
    for student_hash in students:
        features = build_student_features(student_hash, course_id, db)
        if not features:
            continue
        for competency_id, avg in features["competency_avgs"].items():
            level = mastery_level(avg)
            db.add(CompetencyMastery(
                student_id_hash=student_hash,
                course_id=course_id,
                competency_id=competency_id,
                mastery_percentage=round(avg, 2),
                mastery_level=level,
                risk_flag=(level == "Emerging"),
            ))
            written += 1
    db.commit()
    return written
