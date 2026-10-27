import json
from contextlib import contextmanager

from app.core.access import scope
from app.core.database import get_connection
from app.repositories.admin_repository import AdminRepository


class ReviewRepository(AdminRepository):
    def __init__(self, connection=None):
        self.connection = connection

    @contextmanager
    def transaction(self):
        if self.connection:
            yield self
            return
        with get_connection() as connection:
            try:
                yield ReviewRepository(connection)
                connection.commit()
            except Exception:
                connection.rollback()
                raise

    def fetchall(self, query, params=()):
        if not self.connection:
            return super().fetchall(query, params)
        with self.connection.cursor() as cursor:
            cursor.execute(query, params)
            return cursor.fetchall()

    def fetchone(self, query, params=()):
        if not self.connection:
            return super().fetchone(query, params)
        with self.connection.cursor() as cursor:
            cursor.execute(query, params)
            return cursor.fetchone()

    def execute(self, query, params=()):
        if not self.connection:
            return super().execute(query, params)
        with self.connection.cursor() as cursor:
            cursor.execute(query, params)

    def _where(self, cfg, filters, include_deleted):
        where, params = super()._where(cfg, filters, include_deleted)
        resource = next(k for k, v in self.TABLES.items() if v is cfg)
        clause, values = scope(resource)
        return (where + " AND " if where else "WHERE ") + f"({clause})", params + list(
            values
        )

    def lock(self, resource, item_id):
        cfg = self._cfg(resource)
        clause, params = scope(resource)
        return self.fetchone(
            f"SELECT * FROM {cfg['table']} WITH (UPDLOCK, HOLDLOCK) WHERE Id = %s AND ({clause})",
            (item_id,) + params,
        )

    def submit(self, resource, row, payload, uid, operation="update"):
        # Keep every submission immutable; replace pending proposals under row lock.
        self.execute(
            "UPDATE ContentSubmissions SET Status = 'Superseded' WHERE Resource = %s AND EntityId = %s AND Status = 'Pending'",
            (resource, row["Id"]),
        )
        return self.fetchone(
            "INSERT INTO ContentSubmissions (Resource, EntityId, BaseVersion, PayloadJson, Operation, SubmittedByUserId, Status) OUTPUT INSERTED.* VALUES (%s,%s,%s,%s,%s,%s,'Pending')",
            (
                resource,
                row["Id"],
                row.get("Version", 1),
                json.dumps(payload, ensure_ascii=False, default=str),
                operation,
                uid,
            ),
        )

    def latest(self, resource, item_id):
        return self.fetchone(
            "SELECT TOP 1 * FROM ContentSubmissions WHERE Resource = %s AND EntityId = %s ORDER BY Id DESC",
            (resource, item_id),
        )

    def overlay(self, resource, row):
        result = dict(row)
        draft = self.latest(resource, row["Id"])
        if draft:
            result.update(
                SubmissionId=draft["Id"],
                SubmissionStatus=draft["Status"],
                RejectionReason=draft.get("RejectionReason"),
                PublicVersion=row.get("Version", 1),
            )
            if (
                draft["Status"] in {"Pending", "Rejected"}
                and draft["Operation"] != "delete"
            ):
                result.update(
                    {
                        k: v
                        for k, v in json.loads(draft["PayloadJson"]).items()
                        if not k.startswith("_")
                    }
                )
        return result

    def submissions(self, status=None, page=1, page_size=50):
        clauses, params = [], []
        if status:
            clauses.append("s.Status = %s")
            params.append(status)
        visible = []
        for resource in (
            "pois",
            "tours",
            "audio",
            "media",
            "narrations",
            "poi-translations",
            "tour-translations",
        ):
            cfg = self._cfg(resource)
            clause, values = scope(resource)
            visible.append(
                f"(s.Resource = '{resource}' AND EXISTS (SELECT 1 FROM {cfg['table']} WHERE Id = s.EntityId AND ({clause})))"
            )
            params.extend(values)
        clauses.append("(" + " OR ".join(visible) + ")")
        where = " AND ".join(clauses)
        total = (
            self.scalar(
                f"SELECT COUNT(*) AS total FROM ContentSubmissions s WHERE {where}",
                tuple(params),
            )
            or 0
        )
        rows = self.fetchall(
            f"SELECT s.* FROM ContentSubmissions s WHERE {where} ORDER BY s.Id DESC OFFSET %s ROWS FETCH NEXT %s ROWS ONLY",
            tuple(params) + ((page - 1) * page_size, page_size),
        )
        return {"items": rows, "total": total, "page": page, "pageSize": page_size}

    def review_submission(self, submission, status, reviewer, reason):
        self.execute(
            "UPDATE ContentSubmissions SET Status=%s, ReviewedByUserId=%s, ReviewedAt=SYSUTCDATETIME(), RejectionReason=%s WHERE Id=%s",
            (status, reviewer, reason, submission["Id"]),
        )

    def archive(self, resource, row, reviewer):
        self.execute(
            "INSERT INTO ContentVersions (EntityType, EntityId, Version, SnapshotJson, CreatedBy) VALUES (%s,%s,%s,%s,%s)",
            (
                resource,
                row["Id"],
                row.get("Version", 1),
                json.dumps(row, ensure_ascii=False, default=str),
                reviewer,
            ),
        )
