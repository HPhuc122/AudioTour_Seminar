import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Headphones, ArrowRight } from 'lucide-react';
import { managementRoles, useSession } from '../contexts/Session';
import { api } from '../services/api';
import { vendorDemoSession } from '../services/vendorPreview';

export function Login() {
  const { login, session, preview } = useSession(); const navigate = useNavigate(); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  function enterVendorDemo() { login(vendorDemoSession); navigate('/vendor/dashboard', { replace: true }); }
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(''); const data = new FormData(event.currentTarget);
    try { const result = await api.login(String(data.get('username')), String(data.get('password'))); if (!managementRoles.includes(result.role)) throw new Error('Tài khoản này không có quyền truy cập Web.'); login(result); navigate(result.role === 'Vendor' ? '/vendor/dashboard' : '/admin/dashboard', { replace: true }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể đăng nhập.'); } finally { setBusy(false); }
  }
  if (!preview && session && managementRoles.includes(session.role)) return <Navigate to={session.role === 'Vendor' ? '/vendor/dashboard' : '/admin/dashboard'} replace/>;
  return <div className="login-shell"><div className="login-story"><Link to="/" className="brand"><Headphones/>AudioTour</Link><span className="eyebrow">QUẢN LÝ NỘI DUNG</span><h1>Mỗi địa điểm,<br/>một câu chuyện.</h1><p>Quản lý trải nghiệm tham quan, kết nối nội dung và mang những câu chuyện đến với mọi người.</p><div className="sound-wave">{Array.from({ length: 32 }, (_, i) => <i key={i} style={{ height: `${20 + ((i * 37) % 100)}px` }}/>)}</div></div><div className="login-form"><span className="eyebrow">CHÀO MỪNG TRỞ LẠI</span><h2>Đăng nhập AudioTour</h2><p>Sử dụng tài khoản được cấp trong hệ thống. Hệ thống sẽ mở đúng không gian theo vai trò tài khoản.</p><form onSubmit={submit}><label>Tên đăng nhập<input name="username" autoComplete="username" required/></label><label>Mật khẩu<input name="password" type="password" autoComplete="current-password" required/></label>{error && <p className="error" role="alert">{error}</p>}<button className="primary" disabled={busy}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}<ArrowRight size={18}/></button></form><p>Chủ sạp quản lý POI và nội dung của mình. Người quản lý sử dụng khu vực Admin.</p><p className="register-login-link">Chưa có tài khoản Chủ sạp? <Link to="/register">Đăng ký tại đây</Link></p><button className="vendor-preview-button" type="button" onClick={enterVendorDemo}>Xem thử giao diện Chủ sạp</button><small className="vendor-preview-caption">Không cần tài khoản · dữ liệu mẫu · không ghi vào hệ thống</small></div></div>;
}
