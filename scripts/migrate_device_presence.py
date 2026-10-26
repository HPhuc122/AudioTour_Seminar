"""Allow web device presence without modifying existing device records."""
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / 'services/auth-service'))
from app.core.database import get_connection

with get_connection() as connection:
    try:
        with connection.cursor() as cursor:
            cursor.execute((root / 'infra/sql/005_web_device_presence.sql').read_text(encoding='utf-8'))
        connection.commit()
    except Exception:
        connection.rollback()
        raise
print('Device platform constraint now supports web; existing data preserved.')
