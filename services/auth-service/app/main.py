from fastapi import FastAPI

from app.api.auth import admin_router, router as auth_router

app = FastAPI(title="AudioTour Auth Service")
app.include_router(auth_router)
app.include_router(admin_router)


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
