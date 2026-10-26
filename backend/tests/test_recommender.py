"""
Recommender Engine Tests — tag-match logic (no sklearn, no TF-IDF)

Covers:
  1. Resources matched by exact competency code tag
  2. Resources matched by partial topic name tag
  3. Unrelated resources excluded (score = 0)
  4. Empty weak_competency_ids returns empty list immediately
  5. No resources in DB returns empty list
  6. top_n cap is respected
  7. Results sorted by match count descending
  8. OpenAI fallback: personalized_message is None when key is blank
"""

import types
import pytest
from unittest.mock import MagicMock, patch


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_competency(code: str, topic: str, comp_id: str = None):
    c = types.SimpleNamespace()
    c.id = comp_id or code
    c.competency_code = code
    c.topic_name = topic
    c.learning_outcomes = []
    return c


def _make_resource(res_id: str, title: str, res_type: str, url: str, tags: list):
    r = types.SimpleNamespace()
    r.id = res_id
    r.title = title
    r.type = res_type
    r.url = url
    r.competency_tags = tags
    return r


def _make_db(competencies: list, resources: list):
    """Return a mock Session whose query().filter().all() returns competencies
    and whose query().all() returns resources, in that call order."""
    db = MagicMock()
    # First query call → competency filter → .all() → competencies
    # Second query call → resource .all() → resources
    comp_query = MagicMock()
    comp_query.filter.return_value.all.return_value = competencies
    res_query = MagicMock()
    res_query.all.return_value = resources
    db.query.side_effect = [comp_query, res_query]
    return db


# ── Tests ─────────────────────────────────────────────────────────────────────

def test_matched_by_exact_competency_code():
    """Resource tagged with the exact weak competency code must be returned."""
    from backend.services.ai.recommender import get_recommendations

    competencies = [_make_competency("CLO1", "Object-Oriented Programming", "id-clo1")]
    resources = [
        _make_resource("r1", "OOP Basics", "reading", "http://a.com", ["CLO1"]),
        _make_resource("r2", "Unrelated Topic", "video", "http://b.com", ["CLO9"]),
    ]
    db = _make_db(competencies, resources)

    results = get_recommendations(["id-clo1"], "course-x", db)

    assert len(results) == 1
    assert results[0]["title"] == "OOP Basics"
    assert results[0]["relevance_score"] > 0


def test_matched_by_topic_name():
    """Resource tagged with a topic name substring must also be matched."""
    from backend.services.ai.recommender import get_recommendations

    competencies = [_make_competency("CLO2", "Data Structures", "id-clo2")]
    resources = [
        _make_resource("r1", "Data Structures Guide", "video", "http://a.com",
                       ["data structures"]),
    ]
    db = _make_db(competencies, resources)

    results = get_recommendations(["id-clo2"], "course-x", db)

    assert len(results) == 1
    assert results[0]["title"] == "Data Structures Guide"


def test_unrelated_resource_excluded():
    """Resource whose tags share nothing with weak competencies must not appear."""
    from backend.services.ai.recommender import get_recommendations

    competencies = [_make_competency("CLO1", "Networking", "id-clo1")]
    resources = [
        _make_resource("r1", "Database Design", "reading", "http://a.com",
                       ["CLO9", "databases"]),
    ]
    db = _make_db(competencies, resources)

    results = get_recommendations(["id-clo1"], "course-x", db)

    assert results == []


def test_empty_weak_competency_ids_returns_empty():
    """Passing an empty list must short-circuit and return [] immediately."""
    from backend.services.ai.recommender import get_recommendations

    db = MagicMock()
    results = get_recommendations([], "course-x", db)

    assert results == []
    db.query.assert_not_called()


def test_no_resources_in_db_returns_empty():
    """If the resource table is empty the function must return []."""
    from backend.services.ai.recommender import get_recommendations

    competencies = [_make_competency("CLO1", "OOP", "id-clo1")]
    db = _make_db(competencies, [])

    results = get_recommendations(["id-clo1"], "course-x", db)

    assert results == []


def test_top_n_cap_respected():
    """Results must be capped at top_n even when more resources match."""
    from backend.services.ai.recommender import get_recommendations

    competencies = [_make_competency("CLO1", "OOP", "id-clo1")]
    resources = [
        _make_resource(f"r{i}", f"Resource {i}", "video", f"http://{i}.com", ["CLO1"])
        for i in range(10)
    ]
    db = _make_db(competencies, resources)

    results = get_recommendations(["id-clo1"], "course-x", db, top_n=3)

    assert len(results) == 3


def test_results_sorted_by_match_count_descending():
    """Resource with more matching tags must rank above one with fewer."""
    from backend.services.ai.recommender import get_recommendations

    competencies = [
        _make_competency("CLO1", "OOP", "id-clo1"),
        _make_competency("CLO2", "Recursion", "id-clo2"),
    ]
    resources = [
        # r1 matches both CLO1 and CLO2 → 2 matches
        _make_resource("r1", "OOP and Recursion", "reading", "http://a.com",
                       ["CLO1", "CLO2"]),
        # r2 matches only CLO1 → 1 match
        _make_resource("r2", "OOP Only", "video", "http://b.com", ["CLO1"]),
    ]
    db = _make_db(competencies, resources)

    results = get_recommendations(["id-clo1", "id-clo2"], "course-x", db)

    assert len(results) == 2
    assert results[0]["title"] == "OOP and Recursion"
    assert results[1]["title"] == "OOP Only"


def test_personalized_message_none_when_openai_unconfigured():
    """personalized_message must be None when OpenAI key is blank."""
    from backend.services.ai import recommender as rec

    original_settings = rec.settings
    rec.settings = types.SimpleNamespace(openai_api_key="", openai_model="gpt-4o-mini")

    try:
        competencies = [_make_competency("CLO1", "OOP", "id-clo1")]
        resources = [
            _make_resource("r1", "OOP Guide", "reading", "http://a.com", ["CLO1"]),
        ]
        db = _make_db(competencies, resources)

        results = get_recommendations_with_blank_key = rec.get_recommendations(
            ["id-clo1"], "course-x", db
        )

        assert len(results) == 1
        assert results[0]["personalized_message"] is None
    finally:
        rec.settings = original_settings


def test_result_keys_present():
    """Every result dict must contain all required keys."""
    from backend.services.ai.recommender import get_recommendations

    competencies = [_make_competency("CLO1", "OOP", "id-clo1")]
    resources = [
        _make_resource("r1", "OOP Guide", "reading", "http://a.com", ["CLO1"]),
    ]
    db = _make_db(competencies, resources)

    results = get_recommendations(["id-clo1"], "course-x", db)

    assert len(results) == 1
    required_keys = {"id", "title", "type", "url", "competency_tags",
                     "relevance_score", "personalized_message"}
    assert required_keys.issubset(results[0].keys())
