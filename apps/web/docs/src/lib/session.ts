import type { Session } from '../types';

export function isValidSession(value: unknown, now = Date.now()): value is Session {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<Session>;
  return typeof session.accessToken === 'string'
    && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(session.accessToken)
    && typeof session.expiresAtUtc === 'string'
    && Number.isFinite(Date.parse(session.expiresAtUtc))
    && Date.parse(session.expiresAtUtc) > now
    && typeof session.userId === 'number' && session.userId > 0
    && typeof session.username === 'string' && session.username.length > 0
    && typeof session.role === 'string';
}
