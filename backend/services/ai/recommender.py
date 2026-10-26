from sqlalchemy.orm import Session

from backend.models.resource import CourseResource, CourseResourceStatus, Resource
from backend.models.syllabus import Competency
from backend.services.ai.llm_client import complete_text, llm_configured
from backend.services.ai.prompts import build_encouragement_prompt

# Resources the instructor accepted for one of the student's weak competencies rank
# above plain tag matches.
INSTRUCTOR_ACCEPTED_BOOST = 3


def _generate_encouragement(weak_competencies: list, resource_title: str) -> str | None:
    """Generate one personalized encouragement message via GPT-4o-mini for the first recommendation."""
    if not llm_configured():
        return None
    try:
        prompt = build_encouragement_prompt([c.topic_name for c in weak_competencies], resource_title)
        return complete_text(prompt, purpose="encouragement", temperature=0.7, max_tokens=80)
    except Exception:
        return None


def get_recommendations(
    weak_competency_ids: list[str],
    course_id: str,
    db: Session,
    top_n: int = 5,
) -> list[dict]:
    if not weak_competency_ids:
        return []

    weak_competencies = db.query(Competency).filter(
        Competency.id.in_(weak_competency_ids)
    ).all()
    if not weak_competencies:
        return []

    # Build a set of search terms from competency codes and topic names (lowercased).
    # Resources are pre-tagged by faculty using these same identifiers.
    search_terms: set[str] = set()
    for c in weak_competencies:
        if c.competency_code:
            search_terms.add(c.competency_code.lower().strip())
        if c.topic_name:
            search_terms.add(c.topic_name.lower().strip())

    # Shared repository resources plus this course's own instructor resources.
    resources = [
        r for r in db.query(Resource).all()
        if getattr(r, "course_id", None) is None or str(r.course_id) == str(course_id)
    ]
    if not resources:
        return []

    # Instructor curation for this course: declined resources are never recommended;
    # accepted ones are matched directly to the competency they were accepted for.
    weak_ids = {str(c.id) for c in weak_competencies}
    declined: set[str] = set()
    accepted_for_weak: set[str] = set()
    for link in db.query(CourseResource).filter(CourseResource.course_id == course_id).all():
        rid = str(link.resource_id)
        if link.status == CourseResourceStatus.declined.value:
            declined.add(rid)
        elif link.status == CourseResourceStatus.accepted.value and \
                (link.competency_id is None or str(link.competency_id) in weak_ids):
            accepted_for_weak.add(rid)
    declined -= accepted_for_weak  # accepted for another competency wins over a decline

    scored: list[tuple[Resource, int, bool]] = []
    for r in resources:
        rid = str(r.id)
        if rid in declined:
            continue
        tags = [t.lower().strip() for t in (r.competency_tags or [])]
        # Count how many resource tags overlap with any weak competency term
        match_count = sum(
            1 for tag in tags
            if any(term in tag or tag in term for term in search_terms)
        )
        endorsed = rid in accepted_for_weak
        if endorsed:
            match_count += INSTRUCTOR_ACCEPTED_BOOST
        elif getattr(r, "course_id", None) is not None:
            continue  # a course resource the instructor did not attach to these competencies
        if match_count > 0:
            scored.append((r, match_count, endorsed))

    if not scored:
        return []

    scored.sort(key=lambda x: x[1], reverse=True)
    top = scored[:top_n]

    results = []
    for i, (r, match_count, endorsed) in enumerate(top):
        total_tags = len(r.competency_tags or []) or 1
        relevance = 1.0 if endorsed else round(min(match_count / total_tags, 1.0), 3)

        # GPT encouragement only on the first result to avoid latency/cost on every item
        message = _generate_encouragement(weak_competencies, r.title) if i == 0 else None

        results.append({
            "id": str(r.id),
            "title": r.title,
            "type": r.type.value if hasattr(r.type, "value") else r.type,
            "url": r.url,
            "description": getattr(r, "description", None),
            "file_name": getattr(r, "file_name", None),
            "has_file": bool(getattr(r, "file_path", None)),
            "instructor_endorsed": endorsed,
            "competency_tags": r.competency_tags or [],
            "relevance_score": relevance,
            "personalized_message": message,
        })

    return results
