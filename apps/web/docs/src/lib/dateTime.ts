export function utcDate(value: unknown) {
  const text = String(value || '');
  return new Date(/[Zz]|[+-]\d\d:\d\d$/.test(text) ? text : text + 'Z');
}

export function dateLabel(value: unknown) {
  return value ? utcDate(value).toLocaleString('vi-VN') : '—';
}

export function localDateInput(value: unknown) {
  if (!value) return '';
  const date = utcDate(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
