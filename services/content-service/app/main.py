from fastapi import FastAPI

app = FastAPI(title="AudioTour Content Service")


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
