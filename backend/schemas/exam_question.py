import uuid
from typing import Literal, Optional

from pydantic import BaseModel, Field

QuestionType = Literal["multiple_choice", "short_answer", "problem"]


class GenerateQuestionsRequest(BaseModel):
    competency_ids: Optional[list[uuid.UUID]] = None   # default: all validated competencies
    count_per_competency: int = Field(2, ge=1, le=10)
    question_type: Literal["mixed", "multiple_choice", "short_answer", "problem"] = "mixed"
    use_tos: bool = True      # follow the assessment's Table of Specifications when it has one
    replace: bool = True      # drop existing questions first


class ExamQuestionCreate(BaseModel):
    question_text: str = Field(..., min_length=3)
    question_type: QuestionType = "short_answer"
    choices: Optional[list[str]] = None
    answer_key: Optional[str] = None
    points: float = Field(1.0, gt=0, le=100)
    competency_id: Optional[uuid.UUID] = None
    bloom_level: Optional[str] = None


class ExamQuestionUpdate(BaseModel):
    question_text: Optional[str] = Field(None, min_length=3)
    question_type: Optional[QuestionType] = None
    choices: Optional[list[str]] = None
    answer_key: Optional[str] = None
    points: Optional[float] = Field(None, gt=0, le=100)
    competency_id: Optional[uuid.UUID] = None
    bloom_level: Optional[str] = None
