import { useEffect, useState } from 'react';
import { baseUrl } from '../services/api';
import { previewToken } from '../services/preview';

export function MediaPreview({ path, token, image = false }: { path: string; token: string; image?: boolean }) {
  const [url, setUrl] = useState(''); const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController(); let objectUrl = ''; let active = true;
    setUrl(''); setError('');
    if (token === previewToken) { setError('Media mẫu chưa có file để xem trước.'); return; }
    void fetch(`${baseUrl}/api/v1/${path}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]) }).then(async r => {
      if (r.status === 404) throw new Error('HTTP 404: Không tìm thấy file media trên máy chủ. Cần kiểm tra hoặc tải lên file thật.');
      if (r.status === 403) throw new Error('HTTP 403: Bạn không có quyền xem file media này.');
      if (!r.ok) throw new Error(`HTTP ${r.status}: Không tải được file media.`);
      const blob = await r.blob();
      if (!blob.size) throw new Error('File media trả về đang trống. Cần kiểm tra file thật trên máy chủ.');
      return blob;
    }).then(blob => { if (active) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); } }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Không kết nối được máy chủ để tải file media.'); });
    return () => { active = false; controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [path, token]);
  return <div className="content-file-preview">{!url && !error && <p role="status">Đang tải {image ? 'ảnh' : 'âm thanh'}…</p>}{error && <p className="error" role="alert">{error}</p>}{url && (image ? <img src={url} alt="Ảnh xem trước nội dung" onError={() => setError('Không hiển thị được ảnh. Cần kiểm tra định dạng và nội dung file thật.')} style={{ maxWidth: '100%', maxHeight: 480, objectFit: 'contain' }}/> : <audio controls src={url} onError={() => setError('Không phát được âm thanh. Cần kiểm tra định dạng và nội dung file thật.')}/>)}</div>;
}
