import json
import re

from openai import OpenAI

from backend.core.config import settings
from backend.services.ai.syllabus_parser import _is_openai_configured

QUESTION_TYPES = ("multiple_choice", "short_answer", "problem")
DEFAULT_POINTS = {"multiple_choice": 1.0, "short_answer": 5.0, "problem": 10.0}
BLOOM_LEVELS = ("Remembering", "Understanding", "Applying", "Analyzing", "Evaluating", "Creating")

GENERATE_PROMPT = """You are an experienced college instructor writing exam questions for the course "{course}" ({period} examination).

Write exactly the number of questions requested for each competency below. Every question must directly assess
that competency's topic and learning outcomes, be answerable on paper, and be suitable for Filipino college students.

Question type: {type_rule}

Return ONLY valid JSON in this exact format:
{{
  "questions": [
    {{
      "competency_code": "string (must be one of the codes below)",
      "question_type": "multiple_choice | short_answer | problem",
      "question_text": "string (the question stem only; do not number it)",
      "choices": ["string", "string", "string", "string"] or null,
      "answer_key": "string (for multiple_choice: the letter A-D; otherwise a concise model answer or rubric)",
      "bloom_level": "Remembering | Understanding | Applying | Analyzing | Evaluating | Creating"
    }}
  ]
}}

Rules:
- multiple_choice questions have exactly 4 plausible choices (no "all of the above") and one correct answer
- short_answer and problem questions have "choices": null
- Match the requested Bloom's level when one is given
- Do not repeat questions

Competencies (code | topic | learning outcomes | how many | Bloom's level):
{plan}"""

_TYPE_RULES = {
    "mixed": "mix multiple_choice for lower-order outcomes, short_answer and problem for higher-order ones",
    "multiple_choice": "multiple_choice only",
    "short_answer": "short_answer only",
    "problem": "problem only (problems the student must work out and show a solution for)",
}

# Template stems used when no LLM is available; {o} is a learning outcome, {t} the topic.
_STEMS = {
    "Remembering": "Define and briefly describe the key concepts of {t}.",
    "Understanding": "Explain, in your own words, how to {o}.",
    "Applying": "Apply your knowledge of {t}: {O}. Show your complete solution.",
    "Analyzing": "Analyze the following and support your answer with an example: {O}.",
    "Evaluating": "Evaluate and justify your answer: {O}.",
    "Creating": "Design a solution that demonstrates how to {o}.",
}
_DEFAULT_BLOOM_CYCLE = ("Understanding", "Applying", "Analyzing")


# Outcomes cut off by PDF column wrapping can end mid-phrase ("...using arrays and")
_DANGLING_TAIL = re.compile(r"(?:[\s,]+(?:and|or|of|the|a|an|to|with|using|through|for|in|on|by|from|as))+[\s,]*$",
                            re.IGNORECASE)


def _outcome_phrases(comp: dict) -> list[str]:
    phrases = []
    for outcome in comp.get("learning_outcomes") or []:
        for part in re.split(r"[;\n]", str(outcome)):
            part = part.strip().rstrip(".,").strip()
            part = re.sub(r"\s+\S+[-–]$", "", part)  # word cut at a hyphen ("real-" of "real-world")
            part = _DANGLING_TAIL.sub("", part)
            if len(part) >= 8:
                phrases.append(part)
    return phrases or [f"apply the concepts of {comp['topic_name']}"]


def _template_questions(plan: list[dict], question_type: str) -> list[dict]:
    qtype = "problem" if question_type == "problem" else "short_answer"
    questions, seen = [], set()
    for entry in plan:
        comp = entry["competency"]
        phrases = _outcome_phrases(comp)
        for i in range(entry["count"]):
            bloom = entry.get("bloom_level") or _DEFAULT_BLOOM_CYCLE[i % len(_DEFAULT_BLOOM_CYCLE)]
            outcome = phrases[i % len(phrases)]
            text = _STEMS.get(bloom, _STEMS["Understanding"]).format(
                t=comp["topic_name"], o=outcome[0].lower() + outcome[1:], O=outcome[0].upper() + outcome[1:],
            )
            # Same stem + outcome again (more items than outcomes): ask for a fresh example
            if text in seen:
                text = f"{text} Use a different example from your previous answer."
            variant, base = 1, text
            while text in seen:
                variant += 1
                text = f"{base} (Variation {variant})"
            seen.add(text)
            questions.append({
                "competency_code": comp["competency_code"],
                "question_type": qtype,
                "question_text": text,
                "choices": None,
                "answer_key": None,
                "bloom_level": bloom,
            })
    return questions


def _llm_questions(plan: list[dict], question_type: str, course: str, period: str) -> list[dict]:
    lines = []
    for entry in plan:
        comp = entry["competency"]
        outcomes = "; ".join(_outcome_phrases(comp))
        lines.append(f"- {comp['competency_code']} | {comp['topic_name']} | {outcomes} | "
                     f"{entry['count']} | {entry.get('bloom_level') or 'any'}")
    client = OpenAI(api_key=settings.openai_api_key)
    response = client.chat.completions.create(
        model=settings.openai_model,
        messages=[{"role": "user", "content": GENERATE_PROMPT.format(
            course=course, period=period, type_rule=_TYPE_RULES.get(question_type, _TYPE_RULES["mixed"]),
            plan="\n".join(lines),
        )}],
        temperature=0.4,
        response_format={"type": "json_object"},
    )
    return json.loads(response.choices[0].message.content).get("questions", [])


def _clean(raw: dict, valid_codes: set[str]) -> dict | None:
    code = str(raw.get("competency_code") or "").strip().upper()
    text = str(raw.get("question_text") or "").strip()
    qtype = raw.get("question_type") if raw.get("question_type") in QUESTION_TYPES else "short_answer"
    if code not in valid_codes or not text:
        return None
    choices = raw.get("choices")
    if qtype == "multiple_choice":
        if not isinstance(choices, list) or len(choices) < 2:
            qtype, choices = "short_answer", None
        else:
            choices = [re.sub(r"^[A-Da-d][.)]\s*", "", str(c)).strip() for c in choices][:6]
    else:
        choices = None
    bloom = raw.get("bloom_level") if raw.get("bloom_level") in BLOOM_LEVELS else None
    return {
        "competency_code": code,
        "question_type": qtype,
        "question_text": text,
        "choices": choices,
        "answer_key": (str(raw["answer_key"]).strip() or None) if raw.get("answer_key") else None,
        "bloom_level": bloom,
        "points": DEFAULT_POINTS[qtype],
    }


def generate_questions(plan: list[dict], question_type: str = "mixed",
                       course: str = "", period: str = "") -> tuple[list[dict], str]:
    """
    plan: [{"competency": {competency_code, topic_name, learning_outcomes}, "count": int, "bloom_level": str|None}]
    Returns (questions, source) where source is "ai" or "template".
    Falls back to outcome-based template drafts when the LLM is unavailable.
    """
    plan = [p for p in plan if p["count"] > 0]
    if not plan:
        return [], "template"
    valid_codes = {p["competency"]["competency_code"].strip().upper() for p in plan}

    if _is_openai_configured():
        try:
            raw = _llm_questions(plan, question_type, course, period)
            cleaned = [q for q in (_clean(r, valid_codes) for r in raw) if q]
            if cleaned:
                return cleaned, "ai"
        except Exception:
            pass

    drafted = [_clean(q, valid_codes) for q in _template_questions(plan, question_type)]
    return [q for q in drafted if q], "template"
