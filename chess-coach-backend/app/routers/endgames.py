from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth_dependency import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.endgame import EndgameMoveRequest, EndgameMoveResponse, EndgameTemplateResponse
from app.services.endgame_service import ENDGAME_TEMPLATES, evaluate_endgame_move, get_template, public_template
from app.services.progression_service import award_xp


router = APIRouter(prefix="/endgames", tags=["Endgames"])


@router.get("/", response_model=list[EndgameTemplateResponse])
def list_endgame_templates(current_user: User = Depends(get_current_user)):
    return [public_template(template) for template in ENDGAME_TEMPLATES]


@router.get("/{template_key}", response_model=EndgameTemplateResponse)
def get_endgame_template(template_key: str, current_user: User = Depends(get_current_user)):
    template = get_template(template_key)
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Endgame template not found")

    return public_template(template)


@router.post("/{template_key}/move", response_model=EndgameMoveResponse)
def submit_endgame_move(
    template_key: str,
    payload: EndgameMoveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        result = evaluate_endgame_move(
            template_key=template_key,
            ply_index=payload.ply_index,
            user_move=payload.user_move,
            previous_mistakes=payload.mistakes,
        )
        if result["completed"]:
            current_user.endgame_completions = (current_user.endgame_completions or 0) + 1
            result["progression"] = award_xp(db=db, user=current_user, amount=35)
        return result
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Endgame template not found")
