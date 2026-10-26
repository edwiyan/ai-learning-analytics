import json
from openai import OpenAI
from backend.core.config import settings

client = OpenAI(api_key=settings.openai_api_key)

MAP_PROMPT = """You are an academic assessment mapper. Given a question and a list of course competencies, identify which competency this question best assesses and classify its Bloom's Taxonomy level.

Return ONLY valid JSON:
{{
  "competency_code": "string (the matching competency code, or null if no match)",
  "confidence_score": 0.0,
  "bloom_level": "string (one of: Remembering, Understanding, Applying, Analyzing, Evaluating, Creating)"
}}

confidence_score is between 0.0 and 1.0. Use null for competency_code if confidence < 0.3.
bloom_level: classify based on the cognitive demand of the question.

Question: {question}

Competencies:
{competencies}"""


def map_question_to_competency(question_text: str, competencies: list[dict]) -> dict:
    comp_list = "\n".join(
        f"- {c['competency_code']}: {c['topic_name']} — {', '.join(c.get('learning_outcomes', [])[:2])}"
        for c in competencies
    )
    response = client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "user", "content": MAP_PROMPT.format(
                question=question_text, competencies=comp_list
            )}
        ],
        temperature=0.0,
        response_format={"type": "json_object"},
    )
    result = json.loads(response.choices[0].message.content)
    return {
        "competency_code": result.get("competency_code"),
        "confidence_score": float(result.get("confidence_score", 0.0)),
        "bloom_level": result.get("bloom_level"),
    }
