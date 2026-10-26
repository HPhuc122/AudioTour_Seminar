from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import math


def retry_after_seconds(value, default=30):
    if not value:
        return default
    try:
        seconds = float(value)
    except (TypeError, ValueError):
        try:
            date = parsedate_to_datetime(value)
            if date.tzinfo is None:
                date = date.replace(tzinfo=timezone.utc)
            seconds = (date - datetime.now(timezone.utc)).total_seconds()
        except (ValueError, TypeError, OverflowError):
            return default
    if not math.isfinite(seconds):
        return default
    return max(1, math.ceil(seconds))


@dataclass
class AdapterError(Exception):
    status: int
    code: str
    message: str
    retryable: bool = False
    retry_after: int = 0
    uncertain: bool = False
