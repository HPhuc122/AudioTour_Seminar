/** SQL/API datetimes are UTC, including legacy timestamps with no explicit zone. */
export function parseApiUtc(value: string): number {
  const trimmed = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(trimmed)) return NaN
  return Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed) ? trimmed : `${trimmed}Z`)
}

export function remainingAccessSeconds(deadline: number | null, now = Date.now()): number | null {
  return deadline === null ? null : Number.isFinite(deadline) ? Math.max(0, Math.ceil((deadline - now) / 1000)) : 0
}

export function deadlineFromRemaining(seconds: number, now = Date.now()): number {
  return now + (Number.isFinite(seconds) ? Math.max(0, seconds) : 0) * 1000
}
