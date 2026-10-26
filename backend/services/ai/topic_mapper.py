import json
from openai import OpenAI
from backend.core.config import settings
from backend.services.ai.prompts import build_mapping_prompt


client = OpenAI(api_key=settings.openai_api_key)

def map_question_to_competency(question_text: str, competencies: list[dict]) -> dict:
    response = client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "user", "content": build_mapping_prompt(question_text, competencies)}
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
