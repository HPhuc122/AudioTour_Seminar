"""Entry point for the AudioTour API gateway."""

from fastapi import FastAPI

app = FastAPI(title="AudioTour Gateway")


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
