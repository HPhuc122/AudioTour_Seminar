from app.core.database import get_connection


class ContentRepository:
    """SQL Server queries only; no HTTP or business-policy code."""

    def list_public_tours(self, language: str) -> list[dict]:
        query = """SELECT t.Id AS id, t.Code AS code, tt.Name AS name, tt.Description AS description, t.EstimatedMinutes AS estimated_minutes FROM Tours t INNER JOIN TourTranslations tt ON tt.TourId = t.Id AND tt.LanguageCode = %s WHERE t.IsActive = 1 AND t.DeletedAt IS NULL ORDER BY tt.Name"""
        with get_connection() as connection, connection.cursor() as cursor:
            cursor.execute(query, (language,))
            return cursor.fetchall()

    def get_public_tour(self, tour_id: int, language: str) -> dict | None:
        query = """SELECT t.Id AS id, t.Code AS code, tt.Name AS name, tt.Description AS description, t.EstimatedMinutes AS estimated_minutes FROM Tours t INNER JOIN TourTranslations tt ON tt.TourId = t.Id AND tt.LanguageCode = %s WHERE t.Id = %s AND t.IsActive = 1 AND t.DeletedAt IS NULL"""
        with get_connection() as connection, connection.cursor() as cursor:
            cursor.execute(query, (language, tour_id))
            return cursor.fetchone()

    def list_public_pois(self, language: str) -> list[dict]:
        query = """SELECT p.Id AS id, p.Code AS code, pt.Name AS name, p.Latitude AS latitude, p.Longitude AS longitude, p.Category AS category FROM POIs p INNER JOIN POITranslations pt ON pt.POIId = p.Id AND pt.LanguageCode = %s WHERE p.IsActive = 1 AND p.DeletedAt IS NULL ORDER BY pt.Name"""
        with get_connection() as connection, connection.cursor() as cursor:
            cursor.execute(query, (language,))
            return cursor.fetchall()
