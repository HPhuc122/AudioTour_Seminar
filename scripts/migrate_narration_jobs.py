"""Apply only the additive durable narration queue migration."""
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / 'services/content-service'))
from app.core.database import get_connection

sql = (root / 'services/content-service/migrations/004_narration_jobs.sql').read_text(encoding='utf-8')
with get_connection() as connection:
    try:
        with connection.cursor() as cursor:
            cursor.execute(sql)
        connection.commit()
    except Exception:
        connection.rollback()
        raise
print('NarrationHeads, NarrationJobs, NarrationPublications and audio lineage migration applied; existing content unchanged.')
