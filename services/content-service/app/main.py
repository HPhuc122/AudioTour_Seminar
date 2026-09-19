from fastapi import FastAPI

from app.api.public import router as public_router

app = FastAPI(title="AudioTour Content Service")
app.include_router(public_router)


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
