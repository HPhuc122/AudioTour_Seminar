import type { Field, Row } from '../types';
export function validateFields(row: Row, fields: Field[]): string | undefined {
  for (const f of fields) {
    const value = row[f.key];
    if (f.required && (value === null || value === undefined || String(value).trim() === '')) return `${f.label}: cần nhập thông tin.`;
    if (f.type === 'number' && value !== null && value !== undefined) {
      const n = Number(value);
      if (!Number.isFinite(n) || (f.min !== undefined && n < f.min) || (f.max !== undefined && n > f.max)) return `${f.label}: giá trị không hợp lệ.`;
      if (f.step === '1' && !Number.isInteger(n)) return `${f.label}: cần nhập số nguyên.`;
    }
    if (f.maxLength && String(value ?? '').length > f.maxLength) return `${f.label}: tối đa ${f.maxLength} ký tự.`;
    if (f.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) return `${f.label}: email không hợp lệ.`;
  }
}
