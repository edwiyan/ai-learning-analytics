from backend.services.ai.llm_client import complete_json
from backend.services.ai.prompts import build_mapping_prompt


def map_question_to_competency(question_text: str, competencies: list[dict]) -> dict:
    """Ask the LLM which competency a question assesses. Raises LLMUnavailable when
    no provider can answer; the caller then routes the item to manual review."""
    result = complete_json(build_mapping_prompt(question_text, competencies),
                           purpose="topic_mapping", temperature=0.0)
    return {
        "competency_code": result.get("competency_code"),
        "confidence_score": float(result.get("confidence_score", 0.0)),
        "bloom_level": result.get("bloom_level"),
    }
