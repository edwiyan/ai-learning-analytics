from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.core.database import get_db
from backend.core.deps import get_current_user, require_role
from backend.models.user import User, UserRole
from backend.models.sus_survey import SusSurveyResponse
from backend.schemas.sus_survey import (
    SusSurveyCreate, SusSurveyOut, SusSurveyResultsOut,
    compute_sus_score, sus_rating,
)

router = APIRouter(prefix="/surveys", tags=["surveys"])


@router.post("/sus", response_model=SusSurveyOut, status_code=201)
def submit_sus(
    payload: SusSurveyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    for i in range(1, 11):
        val = payload.responses.get(f"q{i}")
        if val is None or not (1 <= int(val) <= 5):
            raise HTTPException(400, detail=f"Invalid or missing response for q{i} — must be 1–5")

    score = compute_sus_score(payload.responses)
    record = SusSurveyResponse(
        user_id=current_user.id,
        responses=payload.responses,
        sus_score=score,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/sus/results", response_model=SusSurveyResultsOut)
def get_sus_results(
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin)),
):
    rows = db.query(SusSurveyResponse).all()
    if not rows:
        return SusSurveyResultsOut(
            total_responses=0,
            avg_sus_score=0.0,
            min_score=0.0,
            max_score=0.0,
            usability_rating="No data",
            threshold_pct=0.0,
        )
    scores = [r.sus_score for r in rows]
    avg = round(sum(scores) / len(scores), 2)
    above = sum(1 for s in scores if s >= 68)
    return SusSurveyResultsOut(
        total_responses=len(rows),
        avg_sus_score=avg,
        min_score=round(min(scores), 2),
        max_score=round(max(scores), 2),
        usability_rating=sus_rating(avg),
        threshold_pct=round(above / len(scores) * 100, 1),
    )
