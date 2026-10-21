import { describe, expect, it } from 'vitest';
import { api } from '../docs/src/services/api';
import { previewData, previewSession } from '../docs/src/services/preview';
import { vendorDemoSession, vendorDemoToken } from '../docs/src/services/vendorPreview';

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
  it('provides a Vendor preview session without backend credentials', () => {
    expect(previewSession.role).toBe('AnalyticsViewer');
    expect(vendorDemoSession.role).toBe('Vendor');
    expect(vendorDemoSession.accessToken).toBe(vendorDemoToken);
  });
  it('loads demo Vendor data locally and blocks write operations', async () => {
    const data = await api.admin<{ items: { Name: string }[] }>(
      'cms/catalog/pois?page=1&pageSize=20',
      vendorDemoToken,
    );
    expect(data.items[0].Name).toBe('Sạp hải sản Vịnh Hy');
    await expect(
      api.admin('pois', vendorDemoToken, { method: 'POST', body: '{}' }),
    ).rejects.toThrow('khóa');
  });
});
