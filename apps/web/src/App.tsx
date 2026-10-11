import { Navigate, NavLink, Outlet, Route, Routes, Link } from 'react-router-dom';
import { Headphones, LayoutDashboard, MapPin, Route as RouteIcon, Languages, Music, QrCode, Map, ChartNoAxesCombined, Users, LogOut } from 'lucide-react';
import { managementRoles, adminRoles, useSession } from './contexts/Session';
import { Login } from './pages/Login';
import { Dashboard } from './pages/admin/Dashboard';
import { ResourcePage } from './pages/admin/ResourcePage';
import { ContentPage } from './pages/admin/ContentPage';
import { TourEditor } from './pages/admin/TourEditor';
import { AdminMap } from './pages/admin/AdminMap';
import { Home, Catalog, Detail, AccessPage } from './pages/public/Catalog';
import { ExploreMap } from './pages/public/ExploreMap';
import { QrPage } from './pages/public/QrPage';
import { AudioPlayer } from './components/AudioPlayer';
import { LanguagePicker } from './components/LanguagePicker';
const links = [
  ['dashboard', 'Tổng quan', LayoutDashboard], ['pois', 'Địa điểm', MapPin], ['tours', 'Tour tham quan', RouteIcon],
  ['translations', 'Đa ngôn ngữ', Languages], ['audio', 'Audio & TTS', Music], ['qr', 'Mã QR', QrCode],
  ['map', 'Bản đồ POI', Map], ['analytics', 'Thống kê', ChartNoAxesCombined], ['users', 'Người dùng', Users],
] as const;
function AdminLayout() {
  const { session, logout } = useSession();
  if (!session) return <Navigate to="/login" replace/>;
  if (!managementRoles.includes(session.role)) return <div className="state"><h1>Không có quyền quản trị</h1><Link to="/">Về trang chủ</Link><button onClick={logout}>Đăng xuất</button></div>;
  return <div className="admin-shell"><aside className="sidebar"><Link className="brand" to="/"><Headphones/>AudioTour<span>CMS</span></Link><p className="sidebar-caption">KHÔNG GIAN QUẢN TRỊ</p><nav>{links.filter(([path]) => path !== 'users' || adminRoles.includes(session.role)).map(([path, label, Icon]) => <NavLink key={path} to={`/admin/${path}`}><Icon size={19}/>{label}</NavLink>)}</nav><div className="sidebar-bottom"><span className="avatar">{session.username.slice(0, 1).toUpperCase()}</span><div><strong>{session.username}</strong><small>{session.role}</small></div><button aria-label="Đăng xuất" className="icon-button" onClick={logout}><LogOut size={18}/></button></div></aside><div className="admin-main"><header className="admin-top"><span>Hệ thống thuyết minh đa ngôn ngữ</span><Link to="/">Mở web tham quan ↗</Link></header><main><Outlet/></main></div><AudioPlayer/></div>;
}
function PublicLayout() { return <><header className="public-top"><Link className="brand" to="/"><Headphones/>AudioTour</Link><nav><NavLink to="/pois">Địa điểm</NavLink><NavLink to="/tours">Tour</NavLink><NavLink to="/map">Bản đồ</NavLink><NavLink to="/qr">Quét QR</NavLink></nav><div className="top-actions"><LanguagePicker/><Link className="access-link" to="/access">Quyền nghe</Link></div></header><main className="public-main"><Outlet/></main><footer><Link className="brand" to="/"><Headphones size={20}/>AudioTour</Link><span>Khám phá theo cách của bạn · Thuyết minh đa ngôn ngữ</span><Link to="/admin">Quản trị</Link></footer><AudioPlayer/></>; }
export function App() { return <Routes><Route path="/login" element={<Login/>}/><Route element={<PublicLayout/>}><Route index element={<Home/>}/><Route path="pois" element={<Catalog kind="poi"/>}/><Route path="pois/:id" element={<Detail kind="poi"/>}/><Route path="tours" element={<Catalog kind="tour"/>}/><Route path="tours/:id" element={<Detail kind="tour"/>}/><Route path="map" element={<ExploreMap/>}/><Route path="qr" element={<QrPage/>}/><Route path="qr/:code" element={<QrPage/>}/><Route path="access" element={<AccessPage/>}/></Route><Route path="/admin" element={<AdminLayout/>}><Route index element={<Navigate to="dashboard" replace/>}/><Route path="dashboard" element={<Dashboard/>}/><Route path="analytics" element={<Dashboard analytics/>}/><Route path="pois" element={<ResourcePage resource="pois"/>}/><Route path="tours" element={<ResourcePage resource="tours"/>}/><Route path="tours/:id" element={<TourEditor/>}/><Route path="translations" element={<ContentPage mode="translations"/>}/><Route path="audio" element={<ContentPage mode="audio"/>}/><Route path="qr" element={<ResourcePage resource="qr"/>}/><Route path="users" element={<ResourcePage resource="users"/>}/><Route path="map" element={<AdminMap/>}/></Route><Route path="*" element={<div className="state"><h1>Không tìm thấy trang</h1><Link to="/">Về trang chủ</Link></div>}/></Routes>; }
