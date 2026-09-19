from pydantic import BaseModel, Field


class TourResponse(BaseModel):
    id: int
    code: str
    name: str
    description: str | None = None
    estimated_minutes: int | None = Field(default=None, serialization_alias="estimatedMinutes")


class PoiResponse(BaseModel):
    id: int
    code: str
    name: str
    latitude: float
    longitude: float
    category: str | None = None
