from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth_dependency import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.calculation import (
    CalculationAttemptRequest,
    CalculationAttemptResponse,
    CalculationDrillResponse,
)
from app.services.calculation_service import CALCULATION_DRILLS, evaluate_calculation_attempt, get_drill, public_drill
from app.services.progression_service import award_xp


router = APIRouter(prefix="/calculation", tags=["Calculation Training"])


@router.get("/drills", response_model=list[CalculationDrillResponse])
def list_calculation_drills(current_user: User = Depends(get_current_user)):
    return [public_drill(drill) for drill in CALCULATION_DRILLS]


@router.get("/drills/{drill_key}", response_model=CalculationDrillResponse)
def get_calculation_drill(drill_key: str, current_user: User = Depends(get_current_user)):
    drill = get_drill(drill_key)
    if not drill:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Calculation drill not found")

    return public_drill(drill)


@router.post("/drills/{drill_key}/attempt", response_model=CalculationAttemptResponse)
def submit_calculation_attempt(
    drill_key: str,
    payload: CalculationAttemptRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        result = evaluate_calculation_attempt(drill_key, payload.user_move)
        if result["is_correct"]:
            current_user.calculation_completions = (current_user.calculation_completions or 0) + 1
            result["progression"] = award_xp(db=db, user=current_user, amount=25)
        return result
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Calculation drill not found")
