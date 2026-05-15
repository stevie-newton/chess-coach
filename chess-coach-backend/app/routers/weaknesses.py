from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.auth_dependency import get_current_user
from app.models.user import User
from app.models.weakness import Weakness
from app.schemas.weakness import WeaknessResponse


router = APIRouter(
    prefix="/weaknesses",
    tags=["Weaknesses"]
)


@router.get("/", response_model=List[WeaknessResponse])
def get_my_weaknesses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return (
        db.query(Weakness)
        .filter(Weakness.user_id == current_user.id)
        .order_by(Weakness.severity.desc(), Weakness.frequency.desc())
        .all()
    )