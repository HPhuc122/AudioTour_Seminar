"""Durable per-language jobs. Approval and enqueue share one SQL transaction."""
import logging
import os
import threading
import uuid
from pathlib import Path

from fastapi import HTTPException

from app.core.access import actor, admin
from app.core.config import settings
from app.repositories.review_repository import ReviewRepository
from app.services.narration_provider import NarrationProvider, ProviderFailure, configuration

logger = logging.getLogger(__name__)


def schema_ready(repo):
    return bool(repo.scalar("SELECT CASE WHEN OBJECT_ID('NarrationJobs','U') IS NOT NULL AND OBJECT_ID('NarrationHeads','U') IS NOT NULL AND OBJECT_ID('NarrationPublications','U') IS NOT NULL AND COL_LENGTH('AudioTracks','AutomationJobId') IS NOT NULL AND COL_LENGTH('NarrationDrafts','IsDeleted') IS NOT NULL THEN 1 ELSE 0 END"))


def require_schema(repo):
    if not schema_ready(repo):
        raise HTTPException(503, 'Run scripts/migrate_narration_jobs.py before approving narration')


def enqueue(repo, source, submission_id, reviewer, new_approval=True):
    require_schema(repo)
    # Serialize all approved narratives for a POI, including distinct draft ids.
    poi = repo.lock('pois', source['PoiId'])
    if not poi or poi.get('DeletedAt'):
        raise HTTPException(409, 'POI was deleted')
    head = repo.fetchone('SELECT * FROM NarrationHeads WHERE PoiId=%s', (source['PoiId'],))
    if not new_approval and head and (head['NarrationId'], head['SourceVersion']) != (source['Id'], source['Version']):
        raise HTTPException(409, 'A newer approval exists for this POI')
    if head:
        repo.execute('UPDATE NarrationHeads SET NarrationId=%s,SourceVersion=%s,SubmissionId=%s WHERE PoiId=%s', (source['Id'], source['Version'], submission_id, source['PoiId']))
    else:
        repo.execute('INSERT INTO NarrationHeads(PoiId,NarrationId,SourceVersion,SubmissionId) VALUES (%s,%s,%s,%s)', (source['PoiId'], source['Id'], source['Version'], submission_id))
    repo.execute("UPDATE NarrationJobs SET Status='Superseded',LeaseToken=NULL,LeaseUntil=NULL,UpdatedAt=SYSUTCDATETIME() WHERE PoiId=%s AND NOT (NarrationId=%s AND SourceVersion=%s) AND Status IN ('Queued','Processing','Failed')", (source['PoiId'], source['Id'], source['Version']))
    languages = repo.fetchall('SELECT Code FROM Languages WHERE IsActive=1 ORDER BY Code')
    for language in languages:
        code = language['Code']
        if repo.scalar('SELECT COUNT(*) FROM NarrationJobs WHERE NarrationId=%s AND SourceVersion=%s AND LanguageCode=%s', (source['Id'], source['Version'], code)):
            continue
        repo.execute("UPDATE NarrationJobs SET Status='Superseded', LeaseToken=NULL, LeaseUntil=NULL, UpdatedAt=SYSUTCDATETIME() WHERE PoiId=%s AND LanguageCode=%s AND Status IN ('Queued','Processing','Failed')", (source['PoiId'], code))
        repo.execute('''INSERT INTO NarrationJobs
            (PoiId,NarrationId,SourceVersion,SubmissionId,ReviewerId,SourceLanguage,LanguageCode,SourceText,SourceName,SourceVoice)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)''',
            (source['PoiId'], source['Id'], source['Version'], submission_id, reviewer,
             source['LanguageCode'], code, source['TextContent'], poi['Name'], source.get('Voice')))


class NarrationJobs:
    def __init__(self, repository=None, provider=None):
        self.repo = repository or ReviewRepository()
        self.provider = provider or NarrationProvider()

    def recover(self):
        # Only expired leases are recoverable: safe with multiple service processes.
        self.repo.execute("""UPDATE NarrationJobs SET
            Status=CASE WHEN Attempts>=MaxAttempts THEN 'Failed' ELSE 'Queued' END,
            ErrorCode='LeaseExpired', ErrorMessage='Worker lease expired; interrupted task recovered',
            LeaseToken=NULL, LeaseUntil=NULL, AvailableAt=SYSUTCDATETIME(), UpdatedAt=SYSUTCDATETIME()
            WHERE Status='Processing' AND LeaseUntil<=SYSUTCDATETIME()""")

    def claim(self, poi_id=None):
        token = str(uuid.uuid4())
        poi_filter = ' AND PoiId=%s' if poi_id is not None else ''
        with self.repo.transaction() as tx:
            return tx.fetchone(""";WITH candidate AS (
                SELECT TOP 1 * FROM NarrationJobs WITH(UPDLOCK,READPAST,ROWLOCK)
                WHERE Status='Queued' AND AvailableAt<=SYSUTCDATETIME() AND Attempts<MaxAttempts
                """ + poi_filter + """ ORDER BY Id)
                UPDATE candidate SET Status='Processing',Attempts=Attempts+1,TotalAttempts=TotalAttempts+1,
                  LeaseToken=%s,LeaseUntil=DATEADD(minute,10,SYSUTCDATETIME()),UpdatedAt=SYSUTCDATETIME()
                OUTPUT INSERTED.*""", ((poi_id,) if poi_id is not None else ()) + (token,))

    def process_one(self, poi_id=None):
        self.recover()
        job = self.claim(poi_id)
        if not job:
            return False
        token = actor.set({'id': job['ReviewerId'], 'role': 'Admin', 'username': 'narration-worker'})
        path = None
        publishing = False
        try:
            text, name, audio, mime, extension = self.provider.render(job)
            relative = 'uploads/audio/' + uuid.uuid4().hex + extension
            path = (Path(settings.media_root) / relative).resolve()
            path.parent.mkdir(parents=True, exist_ok=True)
            # Never expose a partial file. The UUID belongs to this lease only.
            temporary = path.with_suffix(path.suffix + '.part')
            try:
                temporary.write_bytes(audio)
                temporary.replace(path)
            finally:
                temporary.unlink(missing_ok=True)
            publishing = True
            if not self.publish(job, text, name, relative, mime, len(audio)):
                path.unlink(missing_ok=True)
            return True
        except ProviderFailure as exc:
            if path:
                path.unlink(missing_ok=True)
            self.fail(job, exc.code, exc.message, exc.retryable, exc.retry_after)
        except Exception:
            # Do not log provider URLs, response bodies, credentials or source text.
            if path:
                try:
                    # A commit acknowledgement may have been lost. Never delete
                    # bytes referenced by a possibly committed publication.
                    if not publishing or not self.repo.scalar('SELECT COUNT(*) FROM MediaFiles WHERE RelativePath=%s', (relative,)):
                        path.unlink(missing_ok=True)
                except Exception:
                    pass  # Retain unreferenced bytes if DB outcome is unknown.
            self.fail(job, 'ProcessingError', 'Processing failed; check database and media storage', True)
        finally:
            actor.reset(token)
        return True

    def fail(self, job, code, message, retryable, retry_after=None):
        retry = retryable and job['Attempts'] < job['MaxAttempts']
        delay = min(300, 5 * 2 ** (job['Attempts'] - 1))
        if retry_after is not None:
            # Do not shorten the provider's cooldown. SQL DATEADD takes an int.
            delay = min(2147483647, max(delay, retry_after))
        self.repo.execute('''UPDATE NarrationJobs SET Status=%s,ErrorCode=%s,ErrorMessage=%s,
            AvailableAt=DATEADD(second,%s,SYSUTCDATETIME()),LeaseToken=NULL,LeaseUntil=NULL,UpdatedAt=SYSUTCDATETIME()
            WHERE Id=%s AND Status='Processing' AND LeaseToken=%s''',
            ('Queued' if retry else 'Failed', code, message[:1000], delay, job['Id'], job['LeaseToken']))

    def publish(self, job, text, name, relative, mime, size):
        with self.repo.transaction() as tx:
            # Same lock ordering as approval: source -> parent -> job.
            source = tx.lock('narrations', job['NarrationId'])
            poi = tx.lock('pois', job['PoiId'])
            current = tx.fetchone('SELECT * FROM NarrationJobs WITH(UPDLOCK,HOLDLOCK) WHERE Id=%s AND LeaseUntil>SYSUTCDATETIME()', (job['Id'],))
            if not current or current['Status'] != 'Processing' or current['LeaseToken'] != job['LeaseToken']:
                return False
            valid = source and poi and not poi.get('DeletedAt') and not source.get('IsDeleted') and source['ReviewStatus'] == 'Approved' and source['Version'] == job['SourceVersion']
            newer = tx.scalar('SELECT COUNT(*) FROM NarrationJobs WHERE PoiId=%s AND LanguageCode=%s AND Id>%s', (job['PoiId'], job['LanguageCode'], job['Id']))
            head = tx.fetchone('SELECT * FROM NarrationHeads WHERE PoiId=%s', (job['PoiId'],))
            valid = valid and head and (head['NarrationId'], head['SourceVersion']) == (job['NarrationId'], job['SourceVersion'])
            language = tx.scalar('SELECT COUNT(*) FROM Languages WHERE Code=%s AND IsActive=1', (job['LanguageCode'],))
            if not valid or newer or not language:
                tx.execute("UPDATE NarrationJobs SET Status='Superseded',LeaseToken=NULL,LeaseUntil=NULL,UpdatedAt=SYSUTCDATETIME() WHERE Id=%s", (job['Id'],))
                return False
            if not (Path(settings.media_root) / relative).is_file():
                raise RuntimeError('Generated file missing')
            prior = tx.fetchone('SELECT * FROM NarrationPublications WITH(UPDLOCK,HOLDLOCK) WHERE PoiId=%s AND LanguageCode=%s', (job['PoiId'], job['LanguageCode']))
            translation = tx.fetchone('SELECT * FROM POITranslations WITH(UPDLOCK,HOLDLOCK) WHERE POIId=%s AND LanguageCode=%s', (job['PoiId'], job['LanguageCode']))
            payload = {'POIId': job['PoiId'], 'LanguageCode': job['LanguageCode'], 'Name': name,
                       'Description': text, 'ReviewStatus': 'Approved', 'RejectionReason': None}
            if translation:
                tx.archive('poi-translations', translation, job['ReviewerId'])
                payload['Version'] = translation['Version'] + 1
                translation = tx.update_row('poi-translations', translation['Id'], payload)
                tx.execute('UPDATE POITranslations SET IsDeleted=0 WHERE Id=%s', (translation['Id'],))
            else:
                translation = tx.create_row('poi-translations', payload)
            media = tx.save_media_file(Path(relative).name, Path(relative).name, mime, size, relative, job['ReviewerId'], job['PoiId'], None, 'Approved')
            tx.update_row('media', media['Id'], {'ReviewStatus': 'Approved', 'ReviewedByUserId': job['ReviewerId']})
            track = tx.create_row('audio', {'POIId': job['PoiId'], 'LanguageCode': job['LanguageCode'],
                'Title': name, 'AudioType': 'prerecorded', 'FileUrl': relative, 'MimeType': mime,
                'FileSizeBytes': size, 'IsActive': True, 'ReviewStatus': 'Approved', 'AutomationJobId': job['Id']})
            if prior:
                tx.update_row('audio', prior['AudioTrackId'], {'IsActive': False})
                tx.execute('UPDATE NarrationPublications SET JobId=%s,AudioTrackId=%s,TranslationId=%s,SourceVersion=%s,PublishedAt=SYSUTCDATETIME() WHERE PoiId=%s AND LanguageCode=%s',
                    (job['Id'], track['Id'], translation['Id'], job['SourceVersion'], job['PoiId'], job['LanguageCode']))
            else:
                tx.execute('INSERT INTO NarrationPublications(PoiId,LanguageCode,JobId,AudioTrackId,TranslationId,SourceVersion) VALUES (%s,%s,%s,%s,%s,%s)',
                    (job['PoiId'], job['LanguageCode'], job['Id'], track['Id'], translation['Id'], job['SourceVersion']))
            tx.execute("UPDATE NarrationJobs SET Status='Succeeded',AudioTrackId=%s,ResultText=%s,ResultName=%s,ErrorCode=NULL,ErrorMessage=NULL,LeaseToken=NULL,LeaseUntil=NULL,UpdatedAt=SYSUTCDATETIME() WHERE Id=%s", (track['Id'], text, name, job['Id']))
            tx.execute("INSERT INTO AuditLogs(UserId,TableName,RecordId,Action,NewValues) VALUES (%s,'NarrationJobs',%s,'Published',%s)",
                (job['ReviewerId'], str(job['Id']), '{"approvalInherited":true}'))
            return True

    def retry(self, job_id):
        admin()
        with self.repo.transaction() as tx:
            item = tx.fetchone('SELECT * FROM NarrationJobs WHERE Id=%s', (job_id,))
            if not item:
                raise HTTPException(404, 'Job not found')
            source = tx.lock('narrations', item['NarrationId'])
            tx.lock('pois', item['PoiId'])
            item = tx.fetchone('SELECT * FROM NarrationJobs WITH(UPDLOCK,HOLDLOCK) WHERE Id=%s', (job_id,))
            newer = tx.scalar('SELECT COUNT(*) FROM NarrationJobs WHERE PoiId=%s AND LanguageCode=%s AND Id>%s', (item['PoiId'], item['LanguageCode'], item['Id']))
            head = tx.fetchone('SELECT * FROM NarrationHeads WHERE PoiId=%s', (item['PoiId'],))
            if item['Status'] != 'Failed' or newer or not source or source.get('IsDeleted') or source['Version'] != item['SourceVersion'] or source['ReviewStatus'] != 'Approved' or not head or (head['NarrationId'], head['SourceVersion']) != (item['NarrationId'], item['SourceVersion']):
                raise HTTPException(409, 'Only failed jobs for the latest approved source can be retried')
            tx.execute("UPDATE NarrationJobs SET Status='Queued',Attempts=0,RetryCount=RetryCount+1,ErrorCode=NULL,ErrorMessage=NULL,AvailableAt=SYSUTCDATETIME(),UpdatedAt=SYSUTCDATETIME() WHERE Id=%s", (job_id,))
            return {'id': job_id, 'status': 'Queued'}


class NarrationWorker:
    def __init__(self):
        self.stop_event = threading.Event()
        self.thread = None

    def start(self):
        self.thread = threading.Thread(target=self.loop, name='narration-worker', daemon=True)
        self.thread.start()

    def loop(self):
        jobs = NarrationJobs()
        while not self.stop_event.is_set():
            try:
                if schema_ready(jobs.repo):
                    jobs.recover()
                    # Explicit opt-in. Missing adapters never trigger paid calls.
                    if configuration()['automatic'] and jobs.process_one():
                        continue
            except Exception:
                logger.warning('Narration worker unavailable; check database/migration')
            self.stop_event.wait(2)

    def stop(self):
        self.stop_event.set()
        if self.thread:
            self.thread.join(timeout=1)
