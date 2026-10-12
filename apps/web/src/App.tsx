import { Navigate, NavLink, Outlet, Route, Routes, Link } from 'react-router-dom';
import { Headphones, LayoutDashboard, MapPin, Route as RouteIcon, Languages, Music, QrCode, Map, ChartNoAxesCombined, Users, LogOut } from 'lucide-react';
import { managementRoles, adminRoles, useSession } from './contexts/Session';
import { Login } from './pages/Login';
import { Dashboard } from './pages/admin/Dashboard';
import { ResourcePage } from './pages/admin/ResourcePage';
import { ContentPage } from './pages/admin/ContentPage';
import { TourEditor } from './pages/admin/TourEditor';
import { AdminMap } from './pages/admin/AdminMap';
const links = [
  ['dashboard', 'Tổng quan', LayoutDashboard], ['pois', 'Địa điểm', MapPin], ['tours', 'Tour tham quan', RouteIcon],
  ['translations', 'Đa ngôn ngữ', Languages], ['media', 'Hình ảnh', MapPin], ['audio', 'Audio & TTS', Music], ['qr', 'Mã QR', QrCode],
  ['map', 'Bản đồ POI', Map], ['analytics', 'Thống kê', ChartNoAxesCombined], ['users', 'Người dùng', Users],
] as const;
function AdminLayout() {
  const { session, logout } = useSession();
  if (!session) return <Navigate to="/login" replace/>;
  if (!managementRoles.includes(session.role)) return <div className="state"><h1>Không có quyền quản trị</h1><p>Web dành cho chủ sạp và người quản lý.</p><button onClick={logout}>Đăng xuất</button></div>;
  return <div className="admin-shell"><aside className="sidebar"><Link className="brand" to="/admin/dashboard"><Headphones/>AudioTour<span>CMS</span></Link><p className="sidebar-caption">KHÔNG GIAN QUẢN TRỊ</p><nav>{links.filter(([path]) => path !== 'users' || adminRoles.includes(session.role)).map(([path, label, Icon]) => <NavLink key={path} to={`/admin/${path}`}><Icon size={19}/>{label}</NavLink>)}</nav><div className="sidebar-bottom"><span className="avatar">{session.username.slice(0, 1).toUpperCase()}</span><div><strong>{session.username}</strong><small>{session.role}</small></div><button aria-label="Đăng xuất" className="icon-button" onClick={logout}><LogOut size={18}/></button></div></aside><div className="admin-main"><header className="admin-top"><span>Hệ thống thuyết minh đa ngôn ngữ</span><span>Dành cho chủ sạp / người quản lý</span></header><main><Outlet/></main></div></div>;
}

function AdminOnly() {
 const { session } = useSession();
 return session && adminRoles.includes(session.role) ? <Outlet/> : <div className="state"><h1>Không có quyền quản lý người dùng</h1><Link to="/admin/dashboard">Về Dashboard</Link></div>;
}
export function App() { return <Routes>
<Route path="/" element={<Navigate to="/admin" replace/>}/><Route path="/login" element={<Login/>}/>
<Route path="/admin" element={<AdminLayout/>}>
<Route index element={<Navigate to="dashboard" replace/>}/>
<Route path="dashboard" element={<Dashboard/>}/><Route path="analytics" element={<Dashboard analytics/>}/>
<Route path="pois" element={<ResourcePage resource="pois"/>}/><Route path="tours" element={<ResourcePage resource="tours"/>}/><Route path="tours/:id" element={<TourEditor/>}/>
<Route path="translations" element={<ContentPage mode="translations"/>}/><Route path="media" element={<ContentPage mode="media"/>}/><Route path="audio" element={<ContentPage mode="audio"/>}/>
<Route path="qr" element={<ResourcePage resource="qr"/>}/><Route element={<AdminOnly/>}><Route path="users" element={<ResourcePage resource="users"/>}/></Route><Route path="map" element={<AdminMap/>}/>
</Route><Route path="*" element={<div className="state"><h1>Không tìm thấy trang</h1><p>Web dành riêng cho quản trị. Khách tham quan sử dụng ứng dụng Mobile.</p><Link to="/admin">Về quản trị</Link></div>}/></Routes>; }
