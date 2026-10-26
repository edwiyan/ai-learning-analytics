"""Assemble the Academic Performance & Early Intervention report dataset.

One row per (student, course) with the rule-based risk result, placed in the student's
college, program, curriculum, section and year level, then aggregated every way the
report needs. The PDF and Excel renderers and the on-screen preview all use this.

Scope follows the viewer's role: an instructor sees their own courses, a Program
Director or Dean sees their college, the VP and administrators see everything.
"""
from collections import Counter, defaultdict
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from backend.core.security import hash_student_id
from backend.models.course import Course
from backend.models.curriculum import Curriculum
from backend.models.curriculum_subject import CurriculumSubject
from backend.models.enrollment import StudentEnrollment
from backend.models.instructor_intervention import InstructorIntervention
from backend.models.prediction import RiskLevel
from backend.models.program import Program
from backend.models.section import Section
from backend.models.syllabus import Competency, Syllabus
from backend.models.user import User, UserRole
from backend.services.ai.feature_engineering import get_all_students_in_course
from backend.services.ai.risk_predictor import predict_risk

INSTITUTION = "Dalubhasaang Politekniko ng Lungsod ng Baliwag (BTECH)"
LEVELS = [RiskLevel.at_risk.value, RiskLevel.on_track.value, RiskLevel.excelling.value]
MASTERY_THRESHOLD = 75.0
GRADE_DECLINE_THRESHOLD = 15.0
YEAR_LABELS = {1: "1st Year", 2: "2nd Year", 3: "3rd Year", 4: "4th Year", 5: "5th Year"}
ROLE_LABELS = {
    UserRole.admin: "Administrator", UserRole.vp_academic_affairs: "VP for Academic Affairs",
    UserRole.dean: "Dean", UserRole.program_director: "Program Director", UserRole.instructor: "Instructor",
}


class ReportFilters:
    def __init__(self, college=None, program=None, curriculum_id=None, section=None, course_id=None):
        self.college = college or None
        self.program = program or None
        self.curriculum_id = str(curriculum_id) if curriculum_id else None
        self.section = section or None
        self.course_id = str(course_id) if course_id else None

    def describe(self, names: dict) -> list[tuple[str, str]]:
        out = []
        if self.college:
            out.append(("College", self.college))
        if self.program:
            out.append(("Program", self.program))
        if self.curriculum_id:
            out.append(("Curriculum", names.get(self.curriculum_id, self.curriculum_id)))
        if self.section:
            out.append(("Section", self.section))
        if self.course_id:
            out.append(("Course", names.get(self.course_id, self.course_id)))
        return out


def scoped_courses(db: Session, user: User) -> list[Course]:
    q = db.query(Course)
    if user.role == UserRole.instructor:
        q = q.filter(Course.instructor_id == user.id)
    elif user.role in (UserRole.dean, UserRole.program_director):
        q = q.join(User, Course.instructor_id == User.id).filter(User.college == user.college)
    return q.order_by(Course.code).all()


def scope_label(user: User) -> str:
    if user.role == UserRole.instructor:
        return f"Courses handled by {user.full_name}"
    if user.role in (UserRole.dean, UserRole.program_director):
        return f"{user.college or 'Unassigned'} — college-wide"
    return "Institution-wide"


def _student_context(db: Session) -> tuple[dict, dict]:
    """hash -> student User, and hash -> enrollment placement (section, curriculum, program)."""
    students = db.query(User).filter(User.role == UserRole.student, User.student_number.isnot(None)).all()
    by_hash = {hash_student_id(s.student_number): s for s in students}

    sections = {str(s.id): s for s in db.query(Section).all()}
    curricula = {str(c.id): c for c in db.query(Curriculum).all()}
    programs = {str(p.id): p for p in db.query(Program).all()}
    placement = {}
    for e in db.query(StudentEnrollment).filter(StudentEnrollment.status == "active").all():
        sec = sections.get(str(e.section_id))
        cur = curricula.get(str(e.curriculum_id))
        prog = programs.get(str(cur.program_id)) if cur else None
        placement[e.student_id_hash] = {
            "section": sec.section_name if sec else None,
            "year_level": YEAR_LABELS.get(sec.year_level, f"Year {sec.year_level}") if sec else None,
            "curriculum_id": str(cur.id) if cur else None,
            "curriculum": cur.name if cur else None,
            "program": prog.program_name if prog else None,
        }
    return by_hash, placement


def build_report(db: Session, user: User, filters: ReportFilters) -> dict:
    courses = scoped_courses(db, user)
    names = {str(c.id): f"{c.code} — {c.title}" for c in courses}
    names.update({str(c.id): c.name for c in db.query(Curriculum).all()})
    if filters.course_id:
        courses = [c for c in courses if str(c.id) == filters.course_id]

    by_hash, placement = _student_context(db)
    instructors = {str(u.id): u for u in db.query(User).filter(User.role == UserRole.instructor).all()}
    subjects = {str(s.id): s for s in db.query(CurriculumSubject).all()}
    curricula = {str(c.id): c for c in db.query(Curriculum).all()}
    programs = {str(p.id): p for p in db.query(Program).all()}

    interventions = defaultdict(list)
    course_ids = [c.id for c in courses]
    if course_ids:
        for iv in db.query(InstructorIntervention).filter(InstructorIntervention.course_id.in_(course_ids)).all():
            interventions[(str(iv.course_id), iv.student_id_hash)].append(iv)

    rows = []
    comp_scores = defaultdict(list)  # competency id -> [mastery %]
    comp_meta = {}                   # competency id -> (course, competency)
    for course in courses:
        instructor = instructors.get(str(course.instructor_id))
        subject = subjects.get(str(course.curriculum_subject_id)) if course.curriculum_subject_id else None
        course_cur = curricula.get(str(subject.curriculum_id)) if subject else None
        course_prog = programs.get(str(course_cur.program_id)) if course_cur else None
        comps = {str(c.id): c for c in db.query(Competency).join(Syllabus, Competency.syllabus_id == Syllabus.id)
                 .filter(Syllabus.course_id == course.id).all()}

        for sid_hash in get_all_students_in_course(str(course.id), db):
            student = by_hash.get(sid_hash)
            place = placement.get(sid_hash, {})
            result = predict_risk(sid_hash, str(course.id), db)
            features = result.get("features")
            level = getattr(result["risk_level"], "value", str(result["risk_level"]))
            comp_avgs = (features or {}).get("competency_avgs") or {}
            weak = sorted(((comps[str(cid)].topic_name, pct) for cid, pct in comp_avgs.items()
                           if str(cid) in comps and pct < MASTERY_THRESHOLD), key=lambda x: x[1])
            for cid, pct in comp_avgs.items():
                if str(cid) in comps:
                    comp_scores[str(cid)].append(pct)
                    comp_meta[str(cid)] = (course, comps[str(cid)])
            ivs = sorted(interventions.get((str(course.id), sid_hash), []), key=lambda i: i.created_at or datetime.min)
            row = {
                "student_hash": sid_hash,
                "name": student.full_name if student else f"Student {sid_hash[:8]}",
                "student_number": student.student_number if student else "",
                "college": (student.college if student and student.college else None)
                           or (instructor.college if instructor else None) or "Unassigned",
                "program": place.get("program") or (student.program if student else None)
                           or (course_prog.program_name if course_prog else None) or "Unassigned",
                # Curriculum comes only from the student's enrolment record (not the course's).
                "curriculum_id": place.get("curriculum_id"),
                "curriculum": place.get("curriculum") or "No enrolment record",
                "section": place.get("section") or (student.section if student else None) or "Unassigned",
                "year_level": place.get("year_level") or (student.year_level if student else None) or "Unassigned",
                "course_id": str(course.id),
                "course": course.code,
                "course_title": course.title,
                "academic_period": course.academic_period,
                "instructor": instructor.full_name if instructor else "",
                "avg_score": round(features["avg_score"], 1) if features else None,
                "gap_count": (features or {}).get("below_passing_count", 0),
                "grade_decline_pct": round((features or {}).get("grade_decline_pct", 0.0) or 0.0, 1),
                "risk_level": level,
                "reason": result["reason"],
                "weak_topics": [f"{t} ({p:.0f}%)" for t, p in weak[:4]],
                "intervention": ivs[-1].status.replace("_", " ") if ivs else None,
                "intervention_count": len(ivs),
            }
            rows.append(row)

    # Row-level filters (placement of the student)
    if filters.college:
        rows = [r for r in rows if r["college"] == filters.college]
    if filters.program:
        rows = [r for r in rows if r["program"] == filters.program]
    if filters.curriculum_id:
        rows = [r for r in rows if r["curriculum_id"] == filters.curriculum_id]
    if filters.section:
        rows = [r for r in rows if r["section"] == filters.section]

    kept_courses = {r["course_id"] for r in rows}
    return {
        "institution": INSTITUTION,
        "title": "Academic Performance and Early Intervention Report",
        "scope": scope_label(user),
        "prepared_for": f"{user.full_name} ({ROLE_LABELS.get(user.role, user.role.value)})",
        "generated_at": datetime.now(timezone.utc),
        "filters": filters.describe(names),
        "academic_periods": sorted({r["academic_period"] for r in rows}),
        "rows": sorted(rows, key=lambda r: (LEVELS.index(r["risk_level"]) if r["risk_level"] in LEVELS else 9,
                                            r["course"], r["name"])),
        "summary": _summary(rows),
        "breakdowns": {
            "College": _group(rows, "college"),
            "Program": _group(rows, "program"),
            "Curriculum": _group(rows, "curriculum"),
            "Year Level": _group(rows, "year_level"),
            "Section": _group(rows, "section"),
            "Course": _group(rows, "course_id", label=lambda r: f"{r['course']} — {r['course_title']} ({r['instructor']})"),
        },
        "competency_gaps": _competency_gaps(comp_scores, comp_meta, kept_courses),
        "interventions": _intervention_summary(rows),
    }


def _counts(rows):
    c = Counter(r["risk_level"] for r in rows)
    scores = [r["avg_score"] for r in rows if r["avg_score"] is not None]
    n = len(rows)
    return {
        "total": n,
        "at_risk": c[RiskLevel.at_risk.value],
        "on_track": c[RiskLevel.on_track.value],
        "excelling": c[RiskLevel.excelling.value],
        "at_risk_pct": round(c[RiskLevel.at_risk.value] / n * 100, 1) if n else 0.0,
        "excelling_pct": round(c[RiskLevel.excelling.value] / n * 100, 1) if n else 0.0,
        "on_track_pct": round(c[RiskLevel.on_track.value] / n * 100, 1) if n else 0.0,
        "avg_score": round(sum(scores) / len(scores), 1) if scores else None,
    }


def _summary(rows):
    s = _counts(rows)
    students = {r["student_hash"] for r in rows}
    flagged = {r["student_hash"] for r in rows if r["risk_level"] == RiskLevel.at_risk.value}
    s.update({
        "students": len(students),
        "students_flagged": len(flagged),
        "courses": len({r["course_id"] for r in rows}),
        "sections": len({r["section"] for r in rows if r["section"] != "Unassigned"}),
    })
    return s


def _group(rows, key, label=None):
    groups = defaultdict(list)
    for r in rows:
        groups[r[key]].append(r)
    out = [{"group": label(rs[0]) if label else g, **_counts(rs)} for g, rs in groups.items()]
    return sorted(out, key=lambda x: (-x["at_risk_pct"], x["group"]))


def _competency_gaps(comp_scores, comp_meta, kept_courses):
    out = []
    for cid, scores in comp_scores.items():
        course, comp = comp_meta[cid]
        if str(course.id) not in kept_courses or not scores:
            continue
        below = sum(1 for s in scores if s < MASTERY_THRESHOLD)
        out.append({
            "course": course.code,
            "code": comp.competency_code,
            "topic": comp.topic_name,
            "students": len(scores),
            "avg_mastery": round(sum(scores) / len(scores), 1),
            "below": below,
            "below_pct": round(below / len(scores) * 100, 1),
        })
    return sorted(out, key=lambda x: (-x["below_pct"], x["avg_mastery"]))


def _intervention_summary(rows):
    at_risk = [r for r in rows if r["risk_level"] == RiskLevel.at_risk.value]
    with_plan = [r for r in at_risk if r["intervention_count"]]
    status = Counter(r["intervention"] for r in rows if r["intervention"])
    return {
        "at_risk": len(at_risk),
        "with_intervention": len(with_plan),
        "without_intervention": len(at_risk) - len(with_plan),
        "coverage_pct": round(len(with_plan) / len(at_risk) * 100, 1) if at_risk else None,
        "by_status": dict(status),
    }
