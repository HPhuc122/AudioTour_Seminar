"""Validation shared by CMS writes. Lengths generated from audited SQL columns."""
import math
import re
from datetime import datetime, timezone
from fastapi import HTTPException

COLUMN_LIMITS = {'audio': {'LanguageCode': 10, 'AudioType': 20, 'FileUrl': 500, 'MimeType': 50, 'Title': 200, 'ReviewStatus': 20, 'RejectionReason': 1000}, 'languages': {'Code': 10, 'Name': 100, 'NativeName': 100}, 'media': {'FileName': 260, 'OriginalFileName': 260, 'FileType': 20, 'ContentType': 100, 'RelativePath': 500, 'ApprovalStatus': 20, 'RejectionReason': 1000, 'ImageCategory': 30, 'ReviewStatus': 20}, 'narrations': {'Title': 200, 'LanguageCode': 10, 'Voice': 100, 'Status': 30, 'RejectionReason': 1000, 'SimulatedAudioUrl': 500, 'ReviewStatus': 20}, 'pois': {'Code': 50, 'ImageUrl': 500, 'Category': 100, 'ReviewStatus': 20, 'RejectionReason': 1000}, 'poi-translations': {'LanguageCode': 10, 'Name': 200, 'ShortDescription': 500, 'ReviewStatus': 20, 'RejectionReason': 1000}, 'qr': {'Code': 200, 'Name': 200}, 'tours': {'Code': 50, 'DefaultLanguage': 10, 'ReviewStatus': 20, 'RejectionReason': 1000}, 'tour-translations': {'LanguageCode': 10, 'Name': 200, 'ReviewStatus': 20, 'RejectionReason': 1000}, 'users': {'Username': 100, 'Email': 254, 'PasswordHash': 512, 'PreferredLanguage': 10, 'RefreshToken': 512}}  # populated from the schema audit by install_backend.py


def validate_content(resource, data, current=None):
    for key, value in data.items():
        if value is None:
            continue
        if isinstance(value, str):
            limit = COLUMN_LIMITS.get(resource, {}).get(key)
            if limit and len(value.encode('utf-16-le')) // 2 > limit:
                raise HTTPException(422, f"{key}: vượt quá độ dài cho phép ({limit})")
            if key in {'Code', 'Name', 'Title', 'LanguageCode', 'DefaultLanguage', 'TextContent'}:
                if not value.strip():
                    raise HTTPException(422, f"{key}: không được để trống")
                data[key] = value.strip()
    for key in ('Priority', 'CooldownSeconds', 'MinDwellSeconds', 'EstimatedMinutes', 'DurationSeconds', 'FileSizeBytes', 'AccessDurationMinutes', 'PriceAmount', 'SortOrder'):
        if key not in data or data[key] is None:
            continue
        try:
            value = float(data[key])
            minimum = 1 if key == 'AccessDurationMinutes' else 0
            if not math.isfinite(value) or value < minimum:
                raise ValueError()
            if key not in {'PriceAmount', 'DurationSeconds'} and not value.is_integer():
                raise ValueError()
        except (TypeError, ValueError):
            raise HTTPException(422, f"{key}: giá trị không hợp lệ")
    for key in ('ValidFrom', 'ValidUntil'):
        if key in data and data[key] is not None:
            try:
                value = data[key] if isinstance(data[key], datetime) else datetime.fromisoformat(str(data[key]).replace('Z', '+00:00'))
                data[key] = value.astimezone(timezone.utc).replace(tzinfo=None) if value.tzinfo else value
            except (TypeError, ValueError):
                raise HTTPException(422, f"{key}: ngày không hợp lệ")
    merged = {**(current or {}), **data}
    start, end = merged.get('ValidFrom'), merged.get('ValidUntil')
    if start and end and end <= start:
        raise HTTPException(422, 'Ngày kết thúc phải sau ngày bắt đầu')
    if resource == 'audio':
        if merged.get('AudioType') in {'file', 'prerecorded'} and not merged.get('FileUrl'):
            raise HTTPException(422, 'Audio thu âm cần file thật')
        if merged.get('AudioType') == 'tts' and not merged.get('TTSText'):
            raise HTTPException(422, 'Audio dạng văn bản cần nội dung đọc')


def validate_user(payload, creating=False):
    if creating and any(not payload.get(k) for k in ('username', 'email', 'password', 'roleId')):
        raise HTTPException(422, 'Tài khoản mới cần tên đăng nhập, email, mật khẩu và vai trò')
    for key in ('username', 'email'):
        if key in payload and payload[key] is not None:
            value = payload[key].strip()
            if not value or len(value.encode('utf-16-le')) // 2 > COLUMN_LIMITS.get('users', {}).get('Username' if key == 'username' else 'Email', 256):
                raise HTTPException(422, f'{key}: giá trị không hợp lệ')
            payload[key] = value
    if payload.get('email') and not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', payload['email']):
        raise HTTPException(422, 'Email không hợp lệ')
    if payload.get('password') and len(payload['password'].encode()) > 72:
        raise HTTPException(422, 'Mật khẩu vượt quá 72 byte')
