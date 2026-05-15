from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, engine
from app.models import user, game, analysis, weakness, training, puzzle, opening, tournament, mistake_replay
from app.routers import (
    auth, games, analysis as analysis_router, openings, puzzles, weaknesses, training as training_router, openings, 
    tournaments, dashboard, coach, study_schedule as study_schedule_router, import_games, board, mistake_replay as mistake_replay_router, daily_training, profiles
    )

from app.models import study_schedule


app = FastAPI(
    title="Chess Coach Backend",
    description="Personal AI chess improvement backend",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8081",
        "http://localhost:8082",
        "http://127.0.0.1:8081",
        "http://127.0.0.1:8082",
        *settings.cors_origins,
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3})(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth.router)
app.include_router(games.router)
app.include_router(analysis_router.router)
app.include_router(weaknesses.router)
app.include_router(training_router.router)
app.include_router(board.router)
app.include_router(puzzles.router)
app.include_router(coach.router)
app.include_router(openings.router)
app.include_router(tournaments.router)
app.include_router(mistake_replay_router.router)
app.include_router(dashboard.router)
app.include_router(study_schedule_router.router)
app.include_router(import_games.router)
app.include_router(daily_training.router)
app.include_router(profiles.router)
@app.get("/")
def root():
    return {
        "message": "Chess Coach Backend is running"
    }
