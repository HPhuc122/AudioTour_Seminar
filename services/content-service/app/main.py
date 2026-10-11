from fastapi import FastAPI

from app.api.admin import router as admin_router
from app.api.public import router as public_router
from app.api.web import router as web_router

app = FastAPI(title="AudioTour Content Service")
app.include_router(public_router)
app.include_router(admin_router)
app.include_router(web_router)


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
