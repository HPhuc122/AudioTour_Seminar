"""Reconcile direct SQL description edits once per Content worker startup."""
import json
import logging
import os

from app.core.access import actor
from app.repositories.review_repository import ReviewRepository

ORIGIN = 'database-description-sync'
logger = logging.getLogger('uvicorn.error')


def enabled():
    return os.getenv('NARRATION_DB_SYNC_ENABLED', 'true').lower() in {'1', 'true', 'yes'}


def canonical(value):
    return (value or '').replace('\r\n', '\n').strip()


def metadata(repo, submission_id):
    row = repo.fetchone('SELECT PayloadJson FROM ContentSubmissions WHERE Id=%s', (submission_id,))
    try:
        value = json.loads(row['PayloadJson']) if row else {}
        return value if value.get('origin') == ORIGIN else None
    except (ValueError, TypeError, AttributeError):
        return None


def inputs_unchanged(repo, payload, poi, language):
    """Do not overwrite edits made after this startup's snapshot."""
    if payload.get('fallback') and canonical(poi.get('Description')) != payload['sourceText']:
        return False
    for code in {payload['sourceLanguage'], language}:
        row = repo.fetchone('''SELECT t.Description,t.IsDeleted,j.ResultText,j.NarrationId,j.SourceVersion
            FROM POITranslations t WITH(UPDLOCK,HOLDLOCK) LEFT JOIN NarrationPublications n
            ON n.PoiId=t.POIId AND n.LanguageCode=t.LanguageCode
            LEFT JOIN NarrationJobs j ON j.Id=n.JobId
            WHERE t.POIId=%s AND t.LanguageCode=%s''', (poi['Id'], code))
        expected = payload['baseline'].get(code)
        if expected is None:
            if row:
                return False
        elif not row or row['IsDeleted']:
            return False
        elif canonical(row['Description']) != canonical(expected['description']):
            # A completed job from this same batch is an expected change.
            if (row.get('NarrationId'), row.get('SourceVersion')) != (payload['narrationId'], payload['sourceVersion']) or canonical(row['Description']) != canonical(row.get('ResultText')):
                return False
    return True


def reconcile_startup(repository=None, poi_id=None, dry_run=False):
    repo = repository or ReviewRepository()
    reviewer = repo.scalar("SELECT TOP 1 u.Id FROM Users u JOIN Roles r ON r.Id=u.RoleId WHERE u.IsActive=1 AND r.Name IN ('Admin','SuperAdmin') ORDER BY u.Id")
    if not reviewer:
        logger.warning('Description sync skipped: no active administrator for audit attribution')
        return []
    token = actor.set({'id': reviewer, 'role': 'Admin', 'username': ORIGIN})
    results = []
    try:
        candidates = repo.fetchall('SELECT PoiId FROM NarrationHeads' + (' WHERE PoiId=%s' if poi_id is not None else ''), (poi_id,) if poi_id is not None else ())
        for candidate in candidates:
            try:
                result = reconcile_poi(repo, candidate['PoiId'], reviewer, dry_run)
            except Exception:
                # A bad POI must not prevent other POIs or normal jobs from running.
                logger.warning('Description sync POI %s failed; check schema/data and restart to retry', candidate['PoiId'])
                result = {'poiId': candidate['PoiId'], 'status': 'error'}
            results.append(result)
            if result['status'] not in {'unchanged', 'skipped'}:
                logger.info('Description sync POI %s: %s; source=%s', candidate['PoiId'], result['status'], result.get('sourceLanguage'))
        logger.info('Description sync startup checked %s POIs; %s changed, %s blocked/errors',
                    len(results), sum(r['status'] in {'queued', 'changed'} for r in results),
                    sum(r['status'] in {'blocked', 'error'} for r in results))
        return results
    finally:
        actor.reset(token)


def reconcile_poi(repo, poi_id, reviewer, dry_run):
    from app.services.narration_jobs import enqueue
    with repo.transaction() as tx:
        head = tx.fetchone('SELECT * FROM NarrationHeads WHERE PoiId=%s', (poi_id,))
        if not head:
            return {'poiId': poi_id, 'status': 'skipped'}
        # Match publication/approval lock order: narration, then POI.
        source = tx.lock('narrations', head['NarrationId'])
        drafts = tx.fetchall('SELECT * FROM NarrationDrafts WITH(UPDLOCK,HOLDLOCK) WHERE PoiId=%s ORDER BY Id', (poi_id,))
        poi = tx.lock('pois', poi_id)
        current_head = tx.fetchone('SELECT * FROM NarrationHeads WHERE PoiId=%s', (poi_id,))
        if not poi or poi.get('DeletedAt') or not poi.get('IsActive') or not source or source.get('IsDeleted') or current_head != head:
            return {'poiId': poi_id, 'status': 'skipped'}
        prior = metadata(tx, head['SubmissionId'])
        rows = tx.fetchall('''SELECT t.LanguageCode,t.Name,t.Description,t.Version,
            j.ResultText,j.NarrationId AS PublishedNarrationId,j.SourceVersion AS PublishedVersion
            FROM POITranslations t JOIN Languages l ON l.Code=t.LanguageCode AND l.IsActive=1
            LEFT JOIN NarrationPublications n ON n.PoiId=t.POIId AND n.LanguageCode=t.LanguageCode
            LEFT JOIN NarrationJobs j ON j.Id=n.JobId AND j.Status='Succeeded'
            WHERE t.POIId=%s AND t.IsDeleted=0 AND t.ReviewStatus='Approved' ORDER BY t.LanguageCode''', (poi_id,))
        changed = []
        for row in rows:
            baseline = row['ResultText']
            if prior and (row.get('PublishedNarrationId'), row.get('PublishedVersion')) != (head['NarrationId'], head['SourceVersion']):
                baseline = prior['baseline'].get(row['LanguageCode'], {}).get('description', baseline)
            if baseline is not None and canonical(row['Description']) != canonical(baseline):
                changed.append(row)
        if not changed and prior and prior.get('fallback') and canonical(poi.get('Description')) != prior['sourceText']:
            changed = [r for r in rows if r['LanguageCode'] in prior['changedLanguages']]
        if not changed:
            # Reuse the same batch on restart, including partially published jobs.
            if prior and not dry_run and inputs_unchanged(tx, prior, poi, prior['sourceLanguage']):
                tx.execute("""UPDATE NarrationJobs SET Status='Queued',Attempts=0,RetryCount=RetryCount+1,
                    LeaseToken=NULL,LeaseUntil=NULL,UpdatedAt=SYSUTCDATETIME()
                    WHERE NarrationId=%s AND Status='Failed'""", (head['NarrationId'],))
            return {'poiId': poi_id, 'status': 'unchanged'}
        fallback = len(changed) > 1
        language = 'vi' if fallback else changed[0]['LanguageCode']
        text = canonical(poi.get('Description') if fallback else changed[0]['Description'])
        if not text or (fallback and not tx.scalar("SELECT COUNT(*) FROM Languages WHERE Code='vi' AND IsActive=1")):
            logger.warning('Description sync POI %s blocked: empty source or inactive Vietnamese fallback', poi_id)
            return {'poiId': poi_id, 'status': 'blocked', 'sourceLanguage': language}
        result = {'poiId': poi_id, 'status': 'changed' if dry_run else 'queued', 'sourceLanguage': language,
                  'changedLanguages': [r['LanguageCode'] for r in changed], 'fallback': fallback}
        if dry_run:
            return result
        baseline = {r['LanguageCode']: {'description': r['Description'], 'name': r['Name']} for r in rows}
        name = poi['Name'] if fallback else changed[0]['Name']
        existing = next((d for d in drafts if d['LanguageCode'] == language), None)
        if existing and existing.get('IsDeleted'):
            logger.warning('Description sync POI %s blocked: source narrative was deleted', poi_id)
            return {'poiId': poi_id, 'status': 'blocked', 'sourceLanguage': language}
        values = {'PoiId': poi_id, 'Title': name, 'LanguageCode': language,
            'TextContent': text, 'Voice': language, 'Status': 'Approved', 'ReviewStatus': 'Approved',
            'SubmittedByUserId': reviewer, 'ReviewedByUserId': reviewer,
            'Version': existing['Version'] + 1 if existing else 1}
        if existing:
            tx.archive('narrations', existing, reviewer)
            draft = tx.update_row('narrations', existing['Id'], values)
        else:
            draft = tx.create_row('narrations', values)
        payload = {'origin': ORIGIN, 'sourceLanguage': language, 'sourceText': text,
                   'fallback': fallback, 'baseline': baseline, 'narrationId': draft['Id'],
                   'sourceVersion': draft['Version'], 'changedLanguages': result['changedLanguages']}
        submission = tx.submit('narrations', draft, payload, reviewer, 'update')
        tx.execute("UPDATE ContentSubmissions SET Status='Approved',ReviewedByUserId=%s,ReviewedAt=SYSUTCDATETIME() WHERE Id=%s", (reviewer, submission['Id']))
        enqueue(tx, draft, submission['Id'], reviewer, source_name=name)
        tx.execute("INSERT INTO AuditLogs(UserId,TableName,RecordId,Action,NewValues) VALUES (%s,'NarrationDrafts',%s,'DBSync',%s)",
                   (reviewer, str(draft['Id']), json.dumps({'origin': ORIGIN, 'sourceLanguage': language, 'fallback': fallback, 'changedLanguages': result['changedLanguages']})))
        return result
