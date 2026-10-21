import { useState, type FormEvent } from 'react';
import { ArrowRight, Headphones, Store } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

export function Register() {
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');

    const form = event.currentTarget;
    const values = new FormData(form);
    const username = String(values.get('username') || '').trim();
    const email = String(values.get('email') || '').trim();
    const password = String(values.get('password') || '');
    const passwordConfirm = String(values.get('passwordConfirm') || '');

    if (password !== passwordConfirm) {
      setError('Mật khẩu xác nhận chưa khớp.');
      return;
    }

    if (new TextEncoder().encode(password).length > 72) {
      setError('Mật khẩu quá dài. Vui lòng dùng tối đa 72 byte.');
      return;
    }

    setBusy(true);
    try {
      await api.registerVendor({
        username,
        email,
        password,
        preferredLanguage: 'vi',
      });
      setMessage(
        'Tạo tài khoản chủ sạp thành công. Bạn có thể đăng nhập để vào khu vực Chủ sạp.',
      );
      form.reset();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Không thể tạo tài khoản. Vui lòng thử lại.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-shell">
      <section className="login-story">
        <Link className="brand" to="/">
          <Headphones />
          AudioTour
        </Link>
        <span className="eyebrow">DÀNH CHO CHỦ SẠP</span>
        <h1>
          Đưa câu chuyện
          <br />
          của bạn đến
          <br />
          gần du khách.
        </h1>
        <p>
          Tạo tài khoản để quản lý địa điểm và gửi nội dung thuyết minh đến hệ
          thống AudioTour.
        </p>
        <div className="sound-wave" aria-hidden="true">
          {Array.from({ length: 32 }, (_, index) => (
            <i
              key={index}
              style={{ height: `${20 + ((index * 37) % 100)}px` }}
            />
          ))}
        </div>
      </section>

      <section className="login-form">
        <span className="eyebrow">TẠO TÀI KHOẢN MỚI</span>
        <h2>Đăng ký Chủ sạp</h2>
        <p>
          Điền thông tin đăng nhập. Vai trò Chủ sạp được hệ thống gán tự động;
          bạn không thể tự chọn quyền quản trị.
        </p>

        <div className="register-notice">
          <Store size={19} />
          <p>
            Hiện hệ thống tạo tài khoản Vendor hoạt động ngay. Quy trình hồ sơ
            kinh doanh và xét duyệt Chủ sạp riêng chưa được triển khai.
          </p>
        </div>

        {message ? (
          <div className="register-success" role="status">
            <strong>Đăng ký hoàn tất</strong>
            <p>{message}</p>
            <Link className="primary button" to="/login">
              Đi đến đăng nhập <ArrowRight size={17} />
            </Link>
          </div>
        ) : (
          <form onSubmit={(event) => void submit(event)}>
            <label>
              Tên đăng nhập
              <input
                autoComplete="username"
                maxLength={100}
                minLength={3}
                name="username"
                required
              />
            </label>
            <label>
              Email
              <input
                autoComplete="email"
                maxLength={254}
                name="email"
                required
                type="email"
              />
            </label>
            <label>
              Mật khẩu
              <input
                autoComplete="new-password"
                minLength={8}
                name="password"
                required
                type="password"
              />
            </label>
            <label>
              Xác nhận mật khẩu
              <input
                autoComplete="new-password"
                minLength={8}
                name="passwordConfirm"
                required
                type="password"
              />
            </label>

            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}

            <button className="primary" disabled={busy}>
              {busy ? 'Đang tạo tài khoản…' : 'Tạo tài khoản'}
              <ArrowRight size={18} />
            </button>
          </form>
        )}

        <p className="register-login-link">
          Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
        </p>
      </section>
    </div>
  );
}
