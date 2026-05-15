from pydantic import BaseModel
from datetime import datetime


class WeaknessResponse(BaseModel):
    id: int
    category: str
    frequency: int
    severity: int
    last_seen: datetime
    created_at: datetime

    class Config:
        from_attributes = True
