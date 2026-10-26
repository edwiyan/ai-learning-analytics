from sqlalchemy.orm import Session

from backend.models.resource import Resource
from backend.models.syllabus import Competency
from backend.core.config import settings


def _is_openai_configured() -> bool:
    key = settings.openai_api_key or ""
    return bool(key) and not key.startswith("placeholder") and not key.startswith("sk-test")


def _generate_encouragement(weak_competencies: list, resource_title: str) -> str | None:
    """Generate one personalized encouragement message via GPT-4o-mini for the first recommendation."""
    if not _is_openai_configured():
        return None
    try:
        from openai import OpenAI
        client = OpenAI(api_key=settings.openai_api_key)
        gap_names = ", ".join(c.topic_name for c in weak_competencies[:3])
        prompt = (
            f"Write 1-2 encouraging sentences for a student who needs to improve on: {gap_names}. "
            f"Suggest they check out: \"{resource_title}\". Be warm, specific, and supportive."
        )
        resp = client.chat.completions.create(
            model=settings.openai_model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=80,
        )
        return resp.choices[0].message.content.strip()
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

    resources = db.query(Resource).all()
    if not resources:
        return []

    scored: list[tuple[Resource, int]] = []
    for r in resources:
        tags = [t.lower().strip() for t in (r.competency_tags or [])]
        # Count how many resource tags overlap with any weak competency term
        match_count = sum(
            1 for tag in tags
            if any(term in tag or tag in term for term in search_terms)
        )
        if match_count > 0:
            scored.append((r, match_count))

    if not scored:
        return []

    scored.sort(key=lambda x: x[1], reverse=True)
    top = scored[:top_n]

    results = []
    for i, (r, match_count) in enumerate(top):
        total_tags = len(r.competency_tags or []) or 1
        relevance = round(min(match_count / total_tags, 1.0), 3)

        # GPT encouragement only on the first result to avoid latency/cost on every item
        message = _generate_encouragement(weak_competencies, r.title) if i == 0 else None

        results.append({
            "id": str(r.id),
            "title": r.title,
            "type": r.type,
            "url": r.url,
            "competency_tags": r.competency_tags or [],
            "relevance_score": relevance,
            "personalized_message": message,
        })

    return results
