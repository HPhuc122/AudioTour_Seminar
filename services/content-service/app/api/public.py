from fastapi import APIRouter, Query

from app.schemas.content import PoiResponse, TourResponse
from app.services.content_service import ContentService

router = APIRouter(tags=["public"])
service = ContentService()


def ok(data, message: str = "Success"):
    return {"success": True, "message": message, "data": data}


@router.get("/api/v1/public/tours")
def list_tours(lang: str = Query(default="vi")):
    return ok([TourResponse(**item).model_dump(by_alias=True) for item in service.list_tours(lang)])


@router.get("/api/v1/public/tours/{tour_id}")
def get_tour(tour_id: int, lang: str = Query(default="vi")):
    return ok(TourResponse(**service.get_tour(tour_id, lang)).model_dump(by_alias=True))


@router.get("/api/v1/public/pois")
def list_pois(lang: str = Query(default="vi")):
    return ok([PoiResponse(**item).model_dump(by_alias=True) for item in service.list_pois(lang)])
