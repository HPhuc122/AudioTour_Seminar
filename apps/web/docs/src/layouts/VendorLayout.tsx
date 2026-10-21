import {
  ChartNoAxesCombined,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  MapPin,
  Store,
} from 'lucide-react';
import { Link, NavLink, Navigate, Outlet } from 'react-router-dom';
import { useSession } from '../contexts/Session';

const navigation = [
  { to: '/vendor/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
  { to: '/vendor/pois', label: 'Địa điểm của tôi', icon: MapPin },
  { to: '/vendor/submissions', label: 'Gửi duyệt', icon: ClipboardList },
  { to: '/vendor/statistics', label: 'Thống kê', icon: ChartNoAxesCombined },
];

export function VendorLayout() {
  const { session, logout, preview } = useSession();

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (session.role !== 'Vendor') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return (
    <div className="admin-shell vendor-shell">
      <aside className="sidebar vendor-sidebar">
        <Link className="brand" to="/vendor/dashboard">
          <Store />
          AudioTour
          <span>CHỦ SẠP</span>
        </Link>

        <p className="sidebar-caption">KHÔNG GIAN CHỦ SẠP</p>

        <nav aria-label="Điều hướng chủ sạp">
          <div className="nav-group">
            <p className="nav-group-title">QUẢN LÝ NỘI DUNG</p>
            {navigation.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to}>
                <Icon size={19} />
                {label}
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="sidebar-bottom">
          <span className="avatar">
            {session.username.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>{session.username}</strong>
            <small>Chủ sạp</small>
          </div>
          <button
            aria-label="Đăng xuất"
            className="icon-button"
            onClick={logout}
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-top">
          <span>Quản lý địa điểm và nội dung AudioTour</span>
          <span>
            {preview
              ? 'Chế độ xem thử · Dữ liệu mẫu'
              : 'Chỉ hiển thị dữ liệu trong phạm vi tài khoản'}
          </span>
        </header>
        <main>
          {preview && (
            <div className="vendor-preview-banner" role="status">
              Bạn đang xem thử giao diện Chủ sạp bằng dữ liệu mẫu. Thay đổi và
              tải file lên đã bị khóa; đăng nhập bằng tài khoản thật để thao
              tác với dữ liệu hệ thống.
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
