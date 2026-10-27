"""Durable narration automation endpoints; status is scoped for Vendor/Admin."""
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.api.admin import ok, require_admin, scoped_user, service
from app.core.access import scope
from app.services.narration_jobs import NarrationJobs, enqueue, require_schema, schema_ready
from app.services.narration_provider import configuration
from app.core.config import settings
from pathlib import Path

router = APIRouter(prefix="/api/v1/cms/automation", tags=["automation"], dependencies=[Depends(scoped_user)])


@router.get("/status")
def status(poiId: int | None = Query(None, ge=1), page: int = Query(1, ge=1), pageSize: int = Query(50, ge=1, le=100)):
    repo = service._repository
    config = configuration()
    if not schema_ready(repo):
        return ok({**config, "schemaReady": False, "jobs": [], "total": 0, "page": page, "pageSize": pageSize})
    clause, params = scope('pois')
    where = "j.PoiId IN (SELECT Id FROM POIs WHERE " + clause + ")"
    if poiId is not None:
        service._get('pois', poiId)
        where += " AND j.PoiId=%s"
        params += (poiId,)
    columns = "j.Id,j.PoiId,j.NarrationId,j.SourceVersion,j.SubmissionId,j.LanguageCode,j.Status,j.Attempts,j.TotalAttempts,j.MaxAttempts,j.RetryCount,j.ErrorCode,j.ErrorMessage,j.AudioTrackId,j.CreatedAt,j.UpdatedAt,j.AvailableAt,j.LeaseUntil"
    rows = repo.fetchall("SELECT " + columns + ",a.FileUrl AS filePath,n.JobId AS publishedJobId FROM NarrationJobs j LEFT JOIN AudioTracks a ON a.Id=j.AudioTrackId LEFT JOIN NarrationPublications n ON n.JobId=j.Id WHERE " + where + " ORDER BY j.Id DESC OFFSET %s ROWS FETCH NEXT %s ROWS ONLY", params + ((page-1)*pageSize, pageSize))
    root = Path(settings.media_root).resolve()
    for row in rows:
        relative = row.pop('filePath', None)
        published = row.pop('publishedJobId', None)
        path = (root / relative).resolve() if relative else None
        row['ready'] = bool(published and path and root in path.parents and path.is_file())
    total = repo.scalar("SELECT COUNT(*) FROM NarrationJobs j WHERE " + where, params)
    return ok({**config, "schemaReady": True, "jobs": rows, "total": total, "page": page, "pageSize": pageSize})


@router.post("/jobs/{job_id}/retry", dependencies=[Depends(require_admin)])
def retry(job_id: int):
    require_schema(service._repository)
    return ok(NarrationJobs(service._repository).retry(job_id))


class GenerateRequest(BaseModel):
    languages: list[str] = Field(default_factory=list, max_length=20)
    generateAudio: bool = True


@router.post("/{resource}/{entity_id}", dependencies=[Depends(require_admin)])
def generate(resource: str, entity_id: int, payload: GenerateRequest):
    from fastapi import HTTPException
    from app.core.access import admin
    if resource != 'narrations':
        raise HTTPException(422, 'Automation requires an approved narration, not an unreviewed POI description')
    with service._repository.transaction() as repo:
        require_schema(repo)
        source = repo.lock('narrations', entity_id)
        if not source or source.get('IsDeleted') or source['ReviewStatus'] != 'Approved':
            raise HTTPException(409, 'Narration must be approved first')
        # Cannot re-enqueue an older approval after a newer narrative for this POI.
        approved = repo.fetchone("SELECT TOP 1 * FROM ContentSubmissions WHERE Resource='narrations' AND EntityId=%s AND Status='Approved' ORDER BY Id DESC", (entity_id,))
        if not approved:
            raise HTTPException(409, 'No approved submission to inherit')
        enqueue(repo, source, approved['Id'], admin()['id'], new_approval=False)
    return ok({'status': 'Queued', 'message': 'Queued missing enabled languages; existing jobs are not duplicated'})
