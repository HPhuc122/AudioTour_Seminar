from fastapi import HTTPException, status

from app.repositories.content_repository import ContentRepository


class ContentService:
    def __init__(self, repository: ContentRepository | None = None) -> None:
        self._repository = repository or ContentRepository()

    def list_tours(self, language: str) -> list[dict]:
        return self._repository.list_public_tours(language)

    def get_tour(self, tour_id: int, language: str) -> dict:
        tour = self._repository.get_public_tour(tour_id, language)
        if tour is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tour not found")
        return tour

    def list_pois(self, language: str) -> list[dict]:
        return self._repository.list_public_pois(language)
