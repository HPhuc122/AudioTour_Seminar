import { useCallback, useState } from 'react';
import { X } from 'lucide-react';
import { api, json } from '../services/api';
import { useResource } from '../hooks/useResource';
import { PoiPicker } from './PoiPicker';
import { State } from './States';
import type { Row } from '../types';

const formats: Record<string, string> = { mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', aac: 'audio/aac', flac: 'audio/flac' };
export function AudioUploadDialog({ token, initialPoi, onSaved, onClose }: { token: string; initialPoi: number; onSaved: () => Promise<void>; onClose: () => void }) {
  const [poi, setPoi] = useState(initialPoi); const [title, setTitle] = useState(''); const [language, setLanguage] = useState('vi'); const [file, setFile] = useState<File>(); const [media, setMedia] = useState<Row>(); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const languages = useResource(useCallback(() => api.languages(), []));
  async function save() {
    if (!poi || !title.trim() || !language || (!file && !media)) { setError('Cần chọn POI, nhập tên, chọn ngôn ngữ và file âm thanh.'); return; }
    setBusy(true); setError('');
    let uploaded = media;
    try {
      if (!uploaded) {
        if (!file!.size) throw new Error('File âm thanh đang trống.');
        const extension = file!.name.split('.').pop()?.toLowerCase() || '';
        const mime = formats[extension];
        if (!mime) throw new Error('Chọn file MP3, WAV, OGG, M4A, AAC hoặc FLAC.');
        const input = file!.type === mime ? file! : new File([file!], file!.name, { type: mime });
        uploaded = await api.upload(input, poi, token); setMedia(uploaded);
      }
      await api.admin('audio', token, json('POST', { POIId: poi, LanguageCode: language, Title: title.trim(), AudioType: 'prerecorded', FileUrl: uploaded.RelativePath, MimeType: uploaded.ContentType, FileSizeBytes: uploaded.FileSize, IsActive: true }));
      await onSaved(); onClose();
    } catch (e) { setError((e instanceof Error ? e.message : 'Không thêm được audio.') + (uploaded ? ' File đã tải lên được giữ lại; bấm lưu lại để thử tạo bản ghi audio.' : '')); } finally { setBusy(false); }
  }
  return <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label="Thêm file âm thanh"><div className="modal-title"><h2>Thêm file âm thanh</h2><button aria-label="Đóng" className="icon-button" disabled={busy} onClick={onClose}><X/></button></div><p>Chọn file từ máy, gắn với địa điểm và ngôn ngữ. Audio mới sẽ ở trạng thái chờ duyệt.</p><form onSubmit={e => { e.preventDefault(); void save(); }}><fieldset className="audio-upload-fields" disabled={busy || !!media}><PoiPicker token={token} value={poi} onChange={setPoi} label="Địa điểm của audio"/><label>File âm thanh<input aria-label="File âm thanh" type="file" accept=".mp3,.wav,.ogg,.m4a,.aac,.flac" required={!media} onChange={e => { const chosen = e.target.files?.[0]; setFile(chosen); setError(''); if (chosen && !title) setTitle(chosen.name.replace(/\.[^.]+$/, '')); }}/></label>{file && <p className="muted">{file.name} · {(file.size / 1024 / 1024).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} MB</p>}</fieldset><div className="form-grid"><label>Tên audio<input aria-label="Tên audio" required value={title} disabled={busy} onChange={e => setTitle(e.target.value)}/></label><label>Ngôn ngữ<select aria-label="Ngôn ngữ" required value={language} disabled={busy || languages.loading} onChange={e => setLanguage(e.target.value)}><option value="">Chọn ngôn ngữ…</option>{languages.data?.map(l => <option key={l.code} value={l.code}>{l.nativeName || l.name}</option>)}</select></label></div><State error={languages.error} retry={() => void languages.reload()}/>{error && <p className="error" role="alert">{error}</p>}<div className="form-actions"><button type="button" disabled={busy} onClick={onClose}>Hủy</button><button className="primary" disabled={busy || languages.loading || !!languages.error}>{busy ? 'Đang thêm audio…' : 'Lưu vào thư viện'}</button></div></form></section></div>;
}
