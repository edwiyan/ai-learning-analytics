from datetime import datetime
from typing import Dict
from uuid import UUID
from pydantic import BaseModel

SUS_QUESTIONS = {
    "q1":  "I think that I would like to use this system frequently.",
    "q2":  "I found the system unnecessarily complex.",
    "q3":  "I thought the system was easy to use.",
    "q4":  "I think that I would need the support of a technical person to use this system.",
    "q5":  "I found the various functions in this system were well integrated.",
    "q6":  "I thought there was too much inconsistency in this system.",
    "q7":  "I would imagine that most people would learn to use this system very quickly.",
    "q8":  "I found the system very cumbersome to use.",
    "q9":  "I felt very confident using the system.",
    "q10": "I needed to learn a lot of things before I could get going with this system.",
}


def compute_sus_score(responses: Dict[str, int]) -> float:
    total = 0
    for i in range(1, 11):
        val = responses.get(f"q{i}", 3)
        total += (val - 1) if i % 2 == 1 else (5 - val)
    return round(total * 2.5, 2)


def sus_rating(score: float) -> str:
    if score >= 90:
        return "Excellent"
    if score >= 80:
        return "Good"
    if score >= 68:
        return "OK"
    if score >= 51:
        return "Poor"
    return "Awful"


class SusSurveyCreate(BaseModel):
    responses: Dict[str, int]


class SusSurveyOut(BaseModel):
    id: UUID
    sus_score: float
    submitted_at: datetime

    class Config:
        from_attributes = True


class SusSurveyResultsOut(BaseModel):
    total_responses: int
    avg_sus_score: float
    min_score: float
    max_score: float
    usability_rating: str
    threshold_pct: float
