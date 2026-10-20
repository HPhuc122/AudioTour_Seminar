import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser';
import { Camera, QrCode } from 'lucide-react';
import { api } from '../../services/api';
import { useSession } from '../../contexts/Session';
import { PageTitle } from '../../components/States';
import { parseQr } from '../../lib/qr';
export function QrPage() {
  const { code } = useParams(); const { setGuest } = useSession(); const navigate = useNavigate(); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [camera, setCamera] = useState(false); const video = useRef<HTMLVideoElement>(null); const controls = useRef<IScannerControls | undefined>(undefined); const processing = useRef(false);
  const open = useCallback(async (input: string) => { if (processing.current) return; processing.current = true; setBusy(true); setError(''); controls.current?.stop(); setCamera(false);
    try { const parsed = parseQr(input, window.location.origin); const target = await api.resolveQr(parsed); const access = await api.startQr(parsed); if (access.accessToken) setGuest(access.accessToken); if (access.requiresPayment) { navigate('/access', { state: { code: parsed, access } }); } else navigate(`/${target.targetType === 'poi' ? 'pois' : 'tours'}/${target.targetId}`); }
    catch (e) { setError(e instanceof Error ? e.message : 'Không đọc được QR.'); } finally { processing.current = false; setBusy(false); }
  }, [navigate, setGuest]);
  const openRef = useRef(open); openRef.current = open;
  const lastCode = useRef('');
  useEffect(() => { if (code && lastCode.current !== code) { lastCode.current = code; void openRef.current(code); } }, [code]);
  useEffect(() => { if (!camera) return; let cancelled = false; const reader = new BrowserQRCodeReader(); void reader.decodeFromVideoDevice(undefined, video.current!, result => { if (result && !cancelled) void openRef.current(result.getText()); }).then(c => { if (cancelled) c.stop(); else controls.current = c; }).catch(e => { if (!cancelled) { setCamera(false); setError(`Không mở được camera: ${e.message}. Bạn có thể nhập mã bên dưới.`); } }); return () => { cancelled = true; controls.current?.stop(); controls.current = undefined; }; }, [camera]);
  return <><PageTitle eyebrow="KẾT NỐI VỚI ĐIỂM ĐẾN" title="Quét mã QR"/><section className="panel qr-panel"><div className="qr-frame">{camera ? <video ref={video} autoPlay muted playsInline/> : <QrCode size={100}/>}</div><h2>Một mã QR, mở cả câu chuyện</h2><p>Quét mã tại địa điểm để mở POI hoặc tour và kiểm tra quyền nghe. Không cần GPS.</p><button className="primary" disabled={busy} onClick={() => setCamera(v => !v)}><Camera size={18}/>{camera ? 'Dừng camera' : 'Mở camera quét QR'}</button><form onSubmit={e => { e.preventDefault(); void open(String(new FormData(e.currentTarget).get('code'))); }}><label>Hoặc nhập mã / đường dẫn AudioTour<input name="code" defaultValue={code} required placeholder="Mã QR tại điểm đến"/></label><button disabled={busy}>{busy ? 'Đang kiểm tra…' : 'Mở nội dung'}</button></form>{error && <p className="error" role="alert">{error}</p>}<small>Camera cần HTTPS hoặc localhost và sự cho phép của bạn.</small></section></>;
}
