import json
import re
from openai import OpenAI, AuthenticationError, APIConnectionError
from backend.core.config import settings
from backend.services.ai.prompts import build_syllabus_prompt


def _is_openai_configured() -> bool:
    key = settings.openai_api_key or ""
    return bool(key) and not key.startswith("placeholder") and not key.startswith("sk-test")


# A line that starts with an explicit code: topic-level ("DSA-01", "IM-3") or outcome-level ("CLO1", "CO-2")
_CODED_LINE = re.compile(
    r"^(?P<code>[A-Z]{2,6}-\d{1,3}|(?:CLO|CO|LO|SLO|ILO)[\s\-]?\d+)\b[\s.:)|]*(?P<rest>.+)$"
)
_OUTCOME_CODE = re.compile(r"^(?:CLO|CO|LO|SLO|ILO)[\s\-]?\d+$")
_CLO_REF = re.compile(r"\s+\|?\s*(?:CLO|CO|LO|SLO|ILO)[\s\-]?\d+\b")
_PERIOD = re.compile(r"^\s*\|?\s*(?:Prelim|Midterm|Semi[\s\-]?Final|Finals?)\b\s*\|?\s*", re.IGNORECASE)
_PO_SUFFIX = re.compile(r"\s+\|?\s*[a-n](?:\s*,\s*[a-n])*\s*$")
_COURSE_TITLE = re.compile(r"^Course Title\s*[|:]?\s*(.+)$", re.IGNORECASE)


def _extract_coded_competencies(lines: list[str]) -> list[dict]:
    """
    Pick up rows that start with an explicit competency code, e.g. a table row
    "DSA-01 | Algorithm Analysis | CLO1 | Prelim | Determine the growth rate…"
    or the PDF-flattened "DSA-01 Algorithm Analysis CLO1 Prelim Determine…".
    Topic-level codes win over CLO lines when a syllabus has both.
    """
    topic_rows, outcome_rows = {}, {}
    for line in lines:
        m = _CODED_LINE.match(line)
        if not m:
            continue
        code = re.sub(r"\s+", "", m.group("code").upper())
        rest = m.group("rest").strip()
        is_outcome = bool(_OUTCOME_CODE.match(code))
        target = outcome_rows if is_outcome else topic_rows
        if code in target or len(rest) < 5:
            continue

        if is_outcome:
            outcome = _PO_SUFFIX.sub("", rest.split(" | ")[0]).strip()
            target[code] = {"competency_code": code, "topic_name": outcome[:120], "learning_outcomes": [outcome]}
            continue

        if " | " in rest:
            cells = [c.strip() for c in rest.split(" | ") if c.strip()]
            topic, outcome = cells[0], (cells[-1] if len(cells) > 1 else cells[0])
        else:
            parts = _CLO_REF.split(rest, maxsplit=1)
            topic = parts[0].strip()
            outcome = _PERIOD.sub("", parts[1]).strip() if len(parts) > 1 else topic
        target[code] = {"competency_code": code, "topic_name": topic[:120], "learning_outcomes": [outcome]}

    rows = topic_rows if len(topic_rows) >= 2 else outcome_rows
    return list(rows.values())[:30]


def _extract_competencies_from_text(raw_text: str) -> dict:
    """
    Rule-based fallback: parse competencies from coded rows, else numbered/bulleted lines.
    Returns the same dict shape as the OpenAI parser.
    """
    lines = [l.strip() for l in raw_text.splitlines() if l.strip()]
    course_title = next((m.group(1).strip() for l in lines if (m := _COURSE_TITLE.match(l))), "")

    coded = _extract_coded_competencies(lines)
    if len(coded) >= 2:
        return {"course_title": course_title, "competencies": coded}

    competencies = []
    seen = set()

    pattern = re.compile(
        r"^(?:(?:CLO|CO|LO|SLO|ILO)[\s\-:]?\d+[.:)]?\s*|(?:\d+[.)]\s+))(.+)", re.IGNORECASE
    )

    for line in lines:
        m = pattern.match(line)
        if m:
            topic = m.group(1).strip()
        elif len(line) > 15 and not line.endswith(":"):
            topic = line
        else:
            continue

        if topic in seen or len(topic) < 10:
            continue
        seen.add(topic)
        code = f"CLO{len(competencies) + 1}"
        competencies.append({
            "competency_code": code,
            "topic_name": topic[:120],
            "learning_outcomes": [topic],
        })
        if len(competencies) >= 20:
            break

    if not competencies:
        competencies = [
            {"competency_code": "CLO1", "topic_name": "Competency 1 (edit me)", "learning_outcomes": []},
            {"competency_code": "CLO2", "topic_name": "Competency 2 (edit me)", "learning_outcomes": []},
        ]

    return {"course_title": course_title, "competencies": competencies}


def parse_syllabus(raw_text: str) -> dict:
    if not _is_openai_configured():
        return _extract_competencies_from_text(raw_text)

    try:
        client = OpenAI(api_key=settings.openai_api_key)
        response = client.chat.completions.create(
            model=settings.openai_model,
            messages=[{"role": "user", "content": build_syllabus_prompt(raw_text)}],
            temperature=0.1,
            response_format={"type": "json_object"},
        )
        return json.loads(response.choices[0].message.content)
    except (AuthenticationError, APIConnectionError):
        return _extract_competencies_from_text(raw_text)
    except Exception:
        return _extract_competencies_from_text(raw_text)
