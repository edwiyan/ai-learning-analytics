"""Syllabus alignment check for the syllabus approval chain (capstone §3.11.2,
Phase 1 "AI Content Alignment Analysis", pilot-light version).

Two checks, both advisory:
  * measurable outcomes (rule-based): each learning outcome should start with an
    observable Bloom action verb, not a vague one ("understand", "know", ...)
  * program alignment (LLM): which program outcomes each CLO supports, which
    CLOs support none, and which program outcomes the course leaves uncovered.
    Skipped when the program has no outcomes recorded or no LLM is available.
"""
import re

from sqlalchemy.orm import Session

from backend.models.course import Course
from backend.models.curriculum import Curriculum
from backend.models.curriculum_subject import CurriculumSubject
from backend.models.program import Program
from backend.models.syllabus import Competency, Syllabus
from backend.services.ai.llm_client import LLMUnavailable, complete_json, llm_configured
from backend.services.ai.prompts import build_syllabus_alignment_prompt

VAGUE_VERBS = {"understand", "know", "learn", "appreciate", "be", "become", "realize", "familiarize", "grasp"}
MEASURABLE_VERBS = {
    # Remembering / Understanding
    "define", "list", "identify", "recall", "name", "state", "describe", "explain", "summarize",
    "classify", "discuss", "interpret", "illustrate", "compare", "contrast", "distinguish", "differentiate",
    # Applying / Analyzing
    "apply", "use", "solve", "compute", "calculate", "implement", "demonstrate", "construct", "perform",
    "execute", "trace", "write", "analyze", "examine", "determine", "organize", "outline", "debug",
    "test", "simulate", "model", "represent", "convert",
    # Evaluating / Creating
    "evaluate", "assess", "justify", "critique", "judge", "argue", "defend", "select", "recommend",
    "design", "develop", "create", "formulate", "plan", "propose", "compose", "build", "produce", "program",
}


def _first_verb(outcome: str) -> str:
    text = re.sub(r"^(students?|learners?)\s+(will|should|can|must)\s+(be\s+able\s+to\s+)?", "",
                  outcome.strip(), flags=re.IGNORECASE)
    text = re.sub(r"^(be\s+able\s+to|to)\s+", "", text, flags=re.IGNORECASE)
    match = re.match(r"[A-Za-z]+", text)
    return match.group(0).lower() if match else ""


def measurability(competencies: list[Competency]) -> list[dict]:
    rows = []
    for c in competencies:
        outcomes = c.learning_outcomes or [c.topic_name]
        issues = []
        for o in outcomes:
            verb = _first_verb(o)
            if verb in VAGUE_VERBS:
                issues.append(f'"{verb}" is not observable; use a measurable verb (e.g. explain, apply, analyze).')
            elif verb and verb not in MEASURABLE_VERBS:
                issues.append(f'Check that "{verb}" describes an observable, assessable action.')
        rows.append({"competency_code": c.competency_code, "topic_name": c.topic_name,
                     "measurable": not issues, "issues": issues})
    return rows


def program_for_course(course: Course, db: Session) -> Program | None:
    if not course or not course.curriculum_subject_id:
        return None
    subject = db.query(CurriculumSubject).filter(CurriculumSubject.id == course.curriculum_subject_id).first()
    curriculum = db.query(Curriculum).filter(Curriculum.id == subject.curriculum_id).first() if subject else None
    return db.query(Program).filter(Program.id == curriculum.program_id).first() if curriculum else None


def syllabus_alignment(syllabus: Syllabus, db: Session) -> dict:
    competencies = db.query(Competency).filter(Competency.syllabus_id == syllabus.id).all()
    course = db.query(Course).filter(Course.id == syllabus.course_id).first()
    program = program_for_course(course, db)
    outcomes = [o for o in (program.program_outcomes or []) if o and o.strip()] if program else []

    result = {
        "syllabus_id": str(syllabus.id),
        "program_name": program.program_name if program else None,
        "program_outcomes": outcomes,
        "measurability": measurability(competencies),
        "program_alignment": None,
        "alignment_status": None,
        "advisory": True,
    }

    if not program:
        result["alignment_status"] = "Course is not linked to a curriculum program, so program alignment was not checked."
    elif not outcomes:
        result["alignment_status"] = f"{program.program_name} has no program outcomes recorded yet (Programs page)."
    elif not llm_configured():
        result["alignment_status"] = "AI is not configured, so program alignment was not checked."
    else:
        po_codes = [f"PO{i + 1}" for i in range(len(outcomes))]
        clos = [{"competency_code": c.competency_code, "topic_name": c.topic_name,
                 "learning_outcomes": c.learning_outcomes or []} for c in competencies]
        try:
            raw = complete_json(build_syllabus_alignment_prompt(clos, list(zip(po_codes, outcomes))),
                                purpose="syllabus_alignment", temperature=0.0)
            valid_clos = {c.competency_code for c in competencies}
            mapping = []
            for row in raw.get("clo_alignment", []):
                code = row.get("competency_code")
                if code not in valid_clos:
                    continue  # drop hallucinated CLOs
                pos = [p for p in (row.get("program_outcomes") or []) if p in po_codes]
                mapping.append({"competency_code": code, "program_outcomes": pos,
                                "note": (row.get("note") or "")[:300]})
            covered = {p for m in mapping for p in m["program_outcomes"]}
            result["program_alignment"] = {
                "outcome_codes": dict(zip(po_codes, outcomes)),
                "clo_alignment": mapping,
                "unaligned_clos": [m["competency_code"] for m in mapping if not m["program_outcomes"]],
                "uncovered_program_outcomes": [p for p in po_codes if p not in covered],
            }
            result["alignment_status"] = "checked"
        except LLMUnavailable:
            result["alignment_status"] = "AI is temporarily unavailable; program alignment was not checked."
    return result
