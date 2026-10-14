import { describe, expect, it } from 'vitest';
import { previewData } from '../src/services/preview';

describe('local preview boundary', () => {
  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('rejects %s instead of changing data', method => {
    expect(() => previewData('/api/v1/pois/1', { method })).toThrow('đăng nhập');
  });
  it('does not fall through to live data for unsupported endpoints', () => {
    expect(() => previewData('/api/v1/cms/audio-preview/1/stream')).toThrow('đăng nhập');
  });
  it('returns copies so a preview edit cannot change subsequent results', () => {
    const data = previewData<{ items: { Name: string }[] }>('/api/v1/pois');
    data.items[0].Name = 'Changed';
    expect(previewData<typeof data>('/api/v1/pois').items[0].Name).toBe('Sạp hải sản Vịnh Hy');
  });
});
