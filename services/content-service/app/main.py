from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.services.narration_jobs import NarrationWorker

from app.api.admin import router as admin_router
from app.api.public import router as public_router
from app.api.web import router as web_router

from app.api.admin_console import router as console_router
from app.api.admin_automation import router as automation_router

@asynccontextmanager
async def lifespan(app):
    worker = NarrationWorker()
    worker.start()
    yield
    worker.stop()


app = FastAPI(title="AudioTour Content Service", lifespan=lifespan)
app.include_router(public_router)
app.include_router(admin_router)
app.include_router(web_router)
app.include_router(console_router)
app.include_router(automation_router)


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
