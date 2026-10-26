"""Durable idempotency responses. Never persist credentials or request text."""
import hashlib
import json
import math
import sqlite3
import time
import uuid
from contextlib import contextmanager

from app.errors import AdapterError


class Store:
    def __init__(self, path):
        self.path = str(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        with self.connection() as db:
            db.execute('PRAGMA journal_mode=WAL')
            db.execute('''CREATE TABLE IF NOT EXISTS adapter_results (
                operation TEXT NOT NULL, key TEXT NOT NULL, fingerprint TEXT NOT NULL,
                state TEXT NOT NULL, owner TEXT, lease_until REAL, retry_at REAL NOT NULL DEFAULT 0,
                status INTEGER, mime TEXT, body BLOB, error_code TEXT, message TEXT,
                updated_at REAL NOT NULL, PRIMARY KEY(operation,key))''')

    @contextmanager
    def connection(self):
        db = sqlite3.connect(self.path, timeout=10, isolation_level=None)
        db.row_factory = sqlite3.Row
        db.execute('PRAGMA synchronous=FULL')
        try:
            yield db
        finally:
            db.close()

    def begin(self, operation, key, payload):
        fingerprint = hashlib.sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
        now, owner = time.time(), str(uuid.uuid4())
        with self.connection() as db:
            db.execute('BEGIN IMMEDIATE')
            row = db.execute('SELECT * FROM adapter_results WHERE operation=? AND key=?', (operation, key)).fetchone()
            if row:
                if row['fingerprint'] != fingerprint:
                    raise AdapterError(409, 'IdempotencyConflict', 'Idempotency-Key already belongs to different request content')
                if row['state'] == 'succeeded':
                    db.commit()
                    return None, (bytes(row['body']), row['mime'])
                if row['state'] == 'processing' and row['lease_until'] > now:
                    raise AdapterError(429, 'RequestInProgress', 'This request is already processing', True, 5)
                if row['state'] in {'processing', 'uncertain'}:
                    db.execute("UPDATE adapter_results SET state='uncertain',updated_at=? WHERE operation=? AND key=?", (now, operation, key))
                    db.commit()
                    raise AdapterError(409, 'ProviderResultUnknown', 'Previous outcome is unknown; reconcile before any new paid request', uncertain=True)
                if row['retry_at'] > now:
                    raise AdapterError(row['status'], row['error_code'], row['message'], row['status'] in {429, 503} and row['error_code'] != 'AdapterConfiguration', max(1, math.ceil(row['retry_at'] - now)))
                db.execute("UPDATE adapter_results SET state='processing',owner=?,lease_until=?,updated_at=? WHERE operation=? AND key=?", (owner, now + 180, now, operation, key))
            else:
                db.execute("INSERT INTO adapter_results(operation,key,fingerprint,state,owner,lease_until,updated_at) VALUES (?,?,?,'processing',?,?,?)", (operation, key, fingerprint, owner, now + 180, now))
            db.commit()
        return owner, None

    def complete(self, operation, key, owner, body, mime):
        with self.connection() as db:
            updated = db.execute("UPDATE adapter_results SET state='succeeded',body=?,mime=?,status=200,owner=NULL,lease_until=NULL,updated_at=? WHERE operation=? AND key=? AND owner=? AND state='processing'", (body, mime, time.time(), operation, key, owner)).rowcount
            if updated != 1:
                raise AdapterError(409, 'ProviderResultUnknown', 'Request ownership changed before response persistence', uncertain=True)

    def fail(self, operation, key, owner, error):
        with self.connection() as db:
            db.execute("UPDATE adapter_results SET state=?,status=?,error_code=?,message=?,retry_at=?,owner=NULL,lease_until=NULL,updated_at=? WHERE operation=? AND key=? AND owner=? AND state='processing'", (
                'uncertain' if error.uncertain else 'failed', error.status, error.code, error.message,
                time.time() + (error.retry_after or 30), time.time(), operation, key, owner))
