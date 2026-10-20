import { Navigate, NavLink, Outlet, Route, Routes, Link } from 'react-router-dom';
import { Headphones, LayoutDashboard, MapPin, Route as RouteIcon, Languages, Music, QrCode, Map, ChartNoAxesCombined, Users, LogOut, Store, Calendar, CreditCard, Settings, Package, WandSparkles } from 'lucide-react';
import { managementRoles, adminRoles, useSession } from './contexts/Session';
import { Login } from './pages/Login';
import { Dashboard } from './pages/admin/DashboardConsole';
import { ResourcePage } from './pages/admin/ResourcePage';
import { ContentPage } from './pages/admin/ContentConsole';
import { TourEditor } from './pages/admin/TourEditor';
import { ReviewPage } from './pages/admin/ReviewConsole';
import { AdminMap } from './pages/admin/AdminMap';
import { OperationsPage, SystemPage } from './pages/admin/OperationsPage';
import { AutomationPage } from './pages/admin/AutomationPage';
import { roleLabels } from './components/AdminTable';
const links = [
  ['dashboard', 'Tổng quan', LayoutDashboard], ['pois', 'Địa điểm', MapPin], ['tours', 'Tour tham quan', RouteIcon],
  ['narrations', 'Thuyết minh', Languages], ['review', 'Duyệt nội dung', Languages], ['translations', 'Đa ngôn ngữ', Languages], ['media', 'Hình ảnh', MapPin], ['audio', 'Âm thanh', Music], ['qr', 'Mã QR', QrCode],
  ['map', 'Bản đồ POI', Map], ['analytics', 'Thống kê', ChartNoAxesCombined], ['users', 'Người dùng', Users],
  ['vendors', 'Hồ sơ chủ sạp', Store], ['validity', 'Thời hạn POI', Calendar], ['plans', 'Gói dịch vụ', Package], ['transactions', 'Giao dịch', CreditCard], ['settings', 'Cấu hình hệ thống', Settings], ['automation', 'Dịch và tạo audio', WandSparkles], ['languages', 'Ngôn ngữ', Languages],
] as const;
const groups = [
  { title: 'TỔNG QUAN', paths: ['dashboard', 'analytics'] },
  { title: 'HỒ SƠ VÀ DUYỆT', paths: ['vendors', 'review'] },
  { title: 'NỘI DUNG THAM QUAN', paths: ['pois', 'tours', 'map', 'narrations', 'translations', 'media', 'audio', 'automation', 'qr'] },
  { title: 'DỊCH VỤ VÀ THANH TOÁN', paths: ['validity', 'plans', 'transactions'] },
  { title: 'QUẢN TRỊ HỆ THỐNG', paths: ['users', 'languages', 'settings'] },
];
const restricted = ['users', 'vendors', 'validity', 'plans', 'transactions', 'settings', 'languages', 'automation'];
function AdminLayout() {
  const { session, logout, preview } = useSession();
  if (!session) return <Navigate to="/login" replace/>;
  if (!managementRoles.includes(session.role)) return <div className="state"><h1>Không có quyền quản trị</h1><p>Web dành cho chủ sạp và người quản lý.</p><button onClick={logout}>Đăng xuất</button></div>;
  return <div className="admin-shell"><aside className="sidebar"><Link className="brand" to="/admin/dashboard"><Headphones/>AudioTour<span>CMS</span></Link><p className="sidebar-caption">KHÔNG GIAN QUẢN TRỊ</p><nav>{groups.map(group => <div className="nav-group" key={group.title}><p className="nav-group-title">{group.title}</p>{links.filter(([path]) => group.paths.includes(path) && (!restricted.includes(path) || adminRoles.includes(session.role))).map(([path, label, Icon]) => <NavLink key={path} to={`/admin/${path}`}><Icon size={19}/>{path === 'review' && !preview && !adminRoles.includes(session.role) ? 'Trạng thái gửi duyệt' : label}</NavLink>)}</div>)}</nav><div className="sidebar-bottom"><span className="avatar">{session.username.slice(0, 1).toUpperCase()}</span><div><strong>{session.username}</strong><small>{preview ? 'Dữ liệu mẫu' : roleLabels[session.role] || session.role}</small></div><>{preview ? <Link to="/login">Đăng nhập</Link> : <button aria-label="Đăng xuất" className="icon-button" onClick={logout}><LogOut size={18}/></button>}</></div></aside><div className="admin-main"><header className="admin-top"><span>Hệ thống thuyết minh đa ngôn ngữ</span><span>Dành cho chủ sạp / người quản lý</span></header><main>{preview && <p className="notice" role="status">Bạn đang xem thử với dữ liệu mẫu. <Link to="/login">Đăng nhập</Link> để quản lý dữ liệu thật.</p>}<Outlet/></main></div></div>;
}

function AdminOnly() {
 const { session, preview } = useSession();
 return session && (preview || adminRoles.includes(session.role)) ? <Outlet/> : <div className="state"><h1>Không có quyền quản lý người dùng</h1><Link to="/admin/dashboard">Về Dashboard</Link></div>;
}
export function App() { return <Routes>
<Route path="/" element={<Navigate to="/admin" replace/>}/><Route path="/login" element={<Login/>}/>
<Route path="/admin" element={<AdminLayout/>}>
<Route index element={<Navigate to="dashboard" replace/>}/>
<Route path="dashboard" element={<Dashboard/>}/><Route path="analytics" element={<Dashboard analytics/>}/>
<Route path="pois" element={<ResourcePage resource="pois"/>}/><Route path="tours" element={<ResourcePage resource="tours"/>}/><Route path="tours/:id" element={<TourEditor/>}/>
<Route path="review" element={<ReviewPage/>}/><Route path="narrations" element={<ContentPage key="narrations" mode="narrations"/>}/><Route path="translations" element={<ContentPage key="translations" mode="translations"/>}/><Route path="media" element={<ContentPage key="media" mode="media"/>}/><Route path="audio" element={<ContentPage key="audio" mode="audio"/>}/>
<Route path="qr" element={<ResourcePage resource="qr"/>}/><Route element={<AdminOnly/>}><Route path="users" element={<ResourcePage resource="users"/>}/><Route path="vendors" element={<OperationsPage key="vendors" mode="vendors"/>}/><Route path="validity" element={<OperationsPage key="validity" mode="validity"/>}/><Route path="transactions" element={<OperationsPage key="transactions" mode="transactions"/>}/><Route path="plans" element={<SystemPage plans/>}/><Route path="settings" element={<SystemPage/>}/><Route path="languages" element={<ResourcePage resource="languages"/>}/><Route path="automation" element={<AutomationPage/>}/></Route><Route path="map" element={<AdminMap/>}/>
</Route><Route path="*" element={<div className="state"><h1>Không tìm thấy trang</h1><p>Web dành riêng cho quản trị. Khách tham quan sử dụng ứng dụng Mobile.</p><Link to="/admin">Về quản trị</Link></div>}/></Routes>; }
