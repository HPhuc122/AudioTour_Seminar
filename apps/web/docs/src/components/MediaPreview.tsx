import { useEffect, useState } from 'react';
import { baseUrl } from '../services/api';
import { previewToken } from '../services/preview';

export function MediaPreview({ path, token, image = false }: { path: string; token: string; image?: boolean }) {
  const [url, setUrl] = useState(''); const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController(); let objectUrl = ''; let active = true;
    setUrl(''); setError('');
    if (token === previewToken) { setError('Media mẫu chưa có file để xem trước.'); return; }
    void fetch(`${baseUrl}/api/v1/${path}`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal }).then(async r => {
      if (!r.ok) throw new Error(`Không tải được media (${r.status}). Kiểm tra file trên Backend.`);
      return r.blob();
    }).then(blob => { if (active) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); } }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [path, token]);
  return <div>{error && <p className="error" role="alert">{error}</p>}{url && (image ? <img src={url} alt="Ảnh xem trước nội dung gửi duyệt" style={{ maxWidth: '100%', maxHeight: 360, objectFit: 'contain' }}/> : <audio controls src={url}/>)}</div>;
}
