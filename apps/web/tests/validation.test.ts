import { describe, it, expect } from 'vitest';
import { validateFields } from '../docs/src/lib/validation';
describe('CMS form validation', () => {
  it('rejects whitespace-only required text', () => expect(validateFields({ Name: '  ' }, [{ key: 'Name', label: 'Tên', required: true }])).toContain('cần nhập'));
  it('rejects out-of-range and nonfinite coordinates', () => {
    for (const Latitude of [91, -91, Infinity, NaN]) expect(validateFields({ Latitude }, [{ key: 'Latitude', label: 'Vĩ độ', type: 'number', min: -90, max: 90 }])).toBeTruthy();
  });
  it('rejects fractional duration fields that must be integers', () => expect(validateFields({ Days: 1.5 }, [{ key: 'Days', label: 'Ngày', type: 'number', step: '1' }])).toContain('số nguyên'));
  it('rejects invalid email and oversize strings', () => {
    expect(validateFields({ email: 'abc@' }, [{ key: 'email', label: 'Email', type: 'email' }])).toBeTruthy();
    expect(validateFields({ Code: 'abcde' }, [{ key: 'Code', label: 'Mã', maxLength: 4 }])).toBeTruthy();
  });
  it('accepts zero, optional numeric null and valid email', () => expect(validateFields({ n: 0, optional: null, email: 'a@b.vn' }, [{ key: 'n', label: 'N', type: 'number', required: true, min: 0 }, { key: 'optional', label: 'Tùy chọn', type: 'number' }, { key: 'email', label: 'Email', type: 'email' }])).toBeUndefined());
});
