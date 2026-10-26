"""AI-suggested review resources for a course (instructor accepts or declines each one).

Candidates come from the shared resource repository. Each competency's candidates are
pre-ranked by keyword overlap between the competency (code, topic, learning outcomes)
and the resource (title, tags, description); when an LLM is configured it re-rates the
shortlist and writes a one-line reason. Only repository ids are accepted from the model,
so it cannot invent resources. Existing instructor decisions are never overwritten.
"""
import logging
import re

from sqlalchemy.orm import Session

from backend.models.resource import CourseResource, CourseResourceStatus, Resource
from backend.models.syllabus import Competency, Syllabus, SyllabusStatus
from backend.services.ai.llm_client import complete_json, llm_configured
from backend.services.ai.prompts import build_resource_suggestion_prompt

logger = logging.getLogger(__name__)

SHORTLIST = 6        # candidates per competency sent to the LLM
PER_COMPETENCY = 3   # suggestions kept per competency
MIN_LLM_RELEVANCE = 0.4

_STOPWORDS = {
    "a", "an", "and", "the", "of", "to", "in", "on", "for", "with", "by", "from", "at", "as",
    "is", "are", "be", "using", "use", "into", "its", "their", "basic", "introduction",
    "students", "student", "able", "will", "understand", "learn", "apply", "explain",
    "describe", "identify", "demonstrate", "different", "various", "concepts", "concept",
}


def _tokens(*texts) -> set[str]:
    words: set[str] = set()
    for text in texts:
        for w in re.findall(r"[a-z0-9]+", (text or "").lower()):
            if len(w) > 2 and w not in _STOPWORDS:
                words.add(w[:-1] if w.endswith("s") and len(w) > 4 else w)
    return words


def _keyword_score(comp_tokens: set[str], resource: Resource) -> tuple[float, list[str]]:
    res_tokens = _tokens(resource.title, " ".join(resource.competency_tags or []), resource.description)
    shared = sorted(comp_tokens & res_tokens)
    # Three shared keywords count as a full match.
    return round(min(len(shared) / 3, 1.0), 3), shared


def _validated_competencies(course_id, db: Session) -> list[Competency]:
    syllabus = (db.query(Syllabus)
                .filter(Syllabus.course_id == course_id, Syllabus.status == SyllabusStatus.validated)
                .first())
    if not syllabus:
        return []
    return db.query(Competency).filter(Competency.syllabus_id == syllabus.id).all()


def _llm_rerank(comp: Competency, shortlist: list[tuple[Resource, float, list[str]]]) -> dict[str, tuple[float, str]]:
    prompt = build_resource_suggestion_prompt(
        {"competency_code": comp.competency_code, "topic_name": comp.topic_name,
         "learning_outcomes": comp.learning_outcomes or []},
        [{"id": str(r.id), "type": r.type.value if hasattr(r.type, "value") else str(r.type),
          "title": r.title, "tags": r.competency_tags or []} for r, _, _ in shortlist],
    )
    data = complete_json(prompt, purpose="resource_suggestion")
    valid_ids = {str(r.id) for r, _, _ in shortlist}
    ratings: dict[str, tuple[float, str]] = {}
    for row in data.get("ratings", []) if isinstance(data, dict) else []:
        rid = str(row.get("resource_id", ""))
        if rid not in valid_ids:
            continue  # ignore anything the model made up
        try:
            relevance = max(0.0, min(1.0, float(row.get("relevance", 0))))
        except (TypeError, ValueError):
            continue
        ratings[rid] = (relevance, str(row.get("reason") or "")[:300])
    return ratings


def suggest_course_resources(course_id, db: Session) -> dict:
    """(Re)generate AI suggestions for every validated competency of a course.
    Returns counts; decisions the instructor already made are kept as they are."""
    competencies = _validated_competencies(course_id, db)
    if not competencies:
        return {"competencies": 0, "new_suggestions": 0, "ai_reranked": False}

    repository = db.query(Resource).filter(Resource.course_id.is_(None)).all()
    existing = {
        (str(link.resource_id), str(link.competency_id)): link
        for link in db.query(CourseResource).filter(CourseResource.course_id == course_id).all()
    }
    use_llm = llm_configured()
    reranked = False
    created = 0

    for comp in competencies:
        comp_tokens = _tokens(comp.competency_code, comp.topic_name, " ".join(comp.learning_outcomes or []))
        scored = []
        for r in repository:
            score, shared = _keyword_score(comp_tokens, r)
            if score > 0:
                scored.append((r, score, shared))
        scored.sort(key=lambda x: x[1], reverse=True)
        shortlist = scored[:SHORTLIST]
        if not shortlist:
            continue

        picks: list[tuple[Resource, float, str]] = []
        ratings = {}
        if use_llm:
            try:
                ratings = _llm_rerank(comp, shortlist)
                reranked = reranked or bool(ratings)
            except Exception as exc:  # LLM down: keep the keyword ranking
                logger.warning("Resource re-rank failed for %s: %s", comp.competency_code, exc)
        if ratings:
            for r, _, _ in shortlist:
                relevance, reason = ratings.get(str(r.id), (0.0, ""))
                if relevance >= MIN_LLM_RELEVANCE:
                    picks.append((r, relevance, reason or "Recommended by the AI for this competency."))
            picks.sort(key=lambda x: x[1], reverse=True)
        else:
            for r, score, shared in shortlist:
                picks.append((r, min(score, 1.0), "Matches this competency on: " + ", ".join(shared[:5])))

        for r, score, reason in picks[:PER_COMPETENCY]:
            key = (str(r.id), str(comp.id))
            link = existing.get(key)
            if link is None:
                link = CourseResource(course_id=course_id, resource_id=r.id, competency_id=comp.id,
                                      status=CourseResourceStatus.suggested.value, source="ai")
                db.add(link)
                existing[key] = link
                created += 1
            if link.source == "ai" and link.status == CourseResourceStatus.suggested.value:
                link.score, link.reason = round(score, 3), reason

    db.commit()
    return {"competencies": len(competencies), "new_suggestions": created, "ai_reranked": reranked}
