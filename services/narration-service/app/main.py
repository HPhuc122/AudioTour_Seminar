from fastapi import FastAPI

app = FastAPI(title="AudioTour Narration Service")


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
