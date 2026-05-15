from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.auth_dependency import get_current_user
from app.models.user import User
from app.models.tournament import TournamentSimulation
from app.schemas.tournament import (
    TournamentSimulationCreate,
    TournamentSimulationUpdate,
    TournamentSimulationResponse
)


router = APIRouter(
    prefix="/tournaments",
    tags=["Tournament Simulation"]
)


@router.post("/simulation", response_model=TournamentSimulationResponse)
def create_tournament_simulation(
    payload: TournamentSimulationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    simulation = TournamentSimulation(
        user_id=current_user.id,
        time_control=payload.time_control,
        opponent_style=payload.opponent_style,
        notes=payload.notes
    )

    db.add(simulation)
    db.commit()
    db.refresh(simulation)

    return simulation


@router.get("/simulation", response_model=List[TournamentSimulationResponse])
def get_my_tournament_simulations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return (
        db.query(TournamentSimulation)
        .filter(TournamentSimulation.user_id == current_user.id)
        .order_by(TournamentSimulation.created_at.desc())
        .all()
    )


@router.patch("/simulation/{simulation_id}", response_model=TournamentSimulationResponse)
def update_tournament_simulation(
    simulation_id: int,
    payload: TournamentSimulationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    simulation = (
        db.query(TournamentSimulation)
        .filter(
            TournamentSimulation.id == simulation_id,
            TournamentSimulation.user_id == current_user.id
        )
        .first()
    )

    if not simulation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tournament simulation not found"
        )

    if payload.result is not None:
        simulation.result = payload.result

    if payload.accuracy is not None:
        simulation.accuracy = payload.accuracy

    if payload.notes is not None:
        simulation.notes = payload.notes

    db.commit()
    db.refresh(simulation)

    return simulation