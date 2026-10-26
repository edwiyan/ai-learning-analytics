"""Assessment alignment hints for Program Director review (capstone §3.11.2,
Phase 2 "AI Assessment Difficulty Predictor", pilot-light version).

Compares the drafted exam questions (each tagged with a competency and Bloom
level, by the LLM question generator or the instructor) against the assessment's
Table of Specifications, and flags:
  * questions not linked to any competency, or to one outside the TOS
  * questions whose Bloom level is 2+ levels away from the TOS target
  * TOS rows whose planned item count the exam does not meet (or exceeds)
  * a higher-order (Evaluating/Creating) share well above what the TOS plans
Hints are advisory only; the Program Director still decides.
"""
from collections import Counter

from sqlalchemy.orm import Session

from backend.models.assessment import Assessment
from backend.models.exam_question import ExamQuestion
from backend.models.tos import TableOfSpecifications

BLOOM_ORDER = ["Remembering", "Understanding", "Applying", "Analyzing", "Evaluating", "Creating"]
HIGHER_ORDER = {"Evaluating", "Creating"}


def _bloom_index(level: str | None) -> int | None:
    if not level:
        return None
    try:
        return BLOOM_ORDER.index(level.strip().capitalize())
    except ValueError:
        return None


def alignment_hints(assessment: Assessment, db: Session) -> dict:
    questions = (
        db.query(ExamQuestion)
        .filter(ExamQuestion.assessment_id == assessment.id)
        .order_by(ExamQuestion.order_index)
        .all()
    )
    tos_rows = db.query(TableOfSpecifications).filter(
        TableOfSpecifications.assessment_id == assessment.id
    ).all()
    tos_by_comp = {str(t.competency_id): t for t in tos_rows}

    hints = []

    def add(severity, kind, message, question=None):
        hints.append({
            "severity": severity,  # "warning" | "info"
            "kind": kind,
            "message": message,
            "question_id": str(question.id) if question else None,
            "question_number": (questions.index(question) + 1) if question else None,
        })

    if not questions:
        add("info", "no_questions", "No exam questions are drafted in AILAS for this assessment, so items "
                                    "cannot be checked against the Table of Specifications.")
    if not tos_rows:
        add("info", "no_tos", "This assessment has no Table of Specifications to check questions against.")

    counts = Counter()
    for q in questions:
        cid = str(q.competency_id) if q.competency_id else None
        code = q.competency.competency_code if q.competency else None
        if cid is None:
            add("warning", "unlinked", "Question is not linked to any syllabus competency.", q)
            continue
        counts[cid] += 1
        if tos_rows and cid not in tos_by_comp:
            add("warning", "outside_tos", f"Question targets {code}, which is not in the Table of Specifications.", q)
            continue
        tos = tos_by_comp.get(cid)
        qi, ti = _bloom_index(q.bloom_level), _bloom_index(tos.bloom_level if tos else None)
        if qi is not None and ti is not None and abs(qi - ti) >= 2:
            direction = "harder" if qi > ti else "easier"
            add("warning", "bloom_mismatch",
                f"Question is at {BLOOM_ORDER[qi]} but the TOS plans {BLOOM_ORDER[ti]} for {code} "
                f"(likely {direction} than intended).", q)

    for cid, tos in tos_by_comp.items():
        planned, actual = tos.item_count or 0, counts.get(cid, 0)
        code = tos.competency.competency_code if tos.competency else cid[:8]
        if questions and planned and actual < planned:
            add("warning", "under_covered", f"TOS plans {planned} item(s) for {code}; the exam has {actual}.")
        elif questions and planned and actual > planned:
            add("info", "over_covered", f"TOS plans {planned} item(s) for {code}; the exam has {actual}.")

    tos_total = sum(t.item_count or 0 for t in tos_rows)
    tos_higher = sum(t.item_count or 0 for t in tos_rows if (t.bloom_level or "").capitalize() in HIGHER_ORDER)
    q_higher = sum(1 for q in questions if (q.bloom_level or "").capitalize() in HIGHER_ORDER)
    if questions and tos_total:
        planned_share = tos_higher / tos_total
        actual_share = q_higher / len(questions)
        if actual_share - planned_share >= 0.2:
            add("warning", "difficulty",
                f"{round(actual_share * 100)}% of questions are Evaluating/Creating vs. "
                f"{round(planned_share * 100)}% planned: the exam may be disproportionately difficult.")

    return {
        "assessment_id": str(assessment.id),
        "question_count": len(questions),
        "tos_rows": len(tos_rows),
        "warnings": sum(1 for h in hints if h["severity"] == "warning"),
        "hints": hints,
        "advisory": True,
    }
