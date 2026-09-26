import { useState } from 'react';
import { PACKAGES } from '../data';

interface Props {
  hasTicket: boolean;
  ticketMinutes: number;
  onBack: () => void;
  onActivate: (pkg: string) => void;
}

const fmt = (m: number) => {
  if (m < 60) return `${m} phút`;
  return `${Math.floor(m / 60)} giờ`;
};

export default function Packages({ hasTicket, ticketMinutes, onBack, onActivate }: Props) {
  const [paying, setPaying] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const handlePay = (id: string) => {
    setPaying(id);
    setError(false);
    setTimeout(() => {
      setPaying(null);
      onActivate(id);
    }, 2000);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto hide-scrollbar" style={{ background: '#f7fdf9' }}>
      <div className="px-5 pt-12 pb-4" style={{ borderBottom: '1px solid #ffffff' }}>
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: '#ffffff' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a3d2b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-extrabold" style={{ color: '#0f2d1e' }}>Gói Vé</h1>
            <p className="text-xs" style={{ color: '#6b9e80' }}>Chọn gói phù hợp với hành trình của bạn</p>
          </div>
        </div>
      </div>

      {/* Active ticket banner */}
      {hasTicket && (
        <div className="mx-5 mt-4 p-4 rounded-2xl" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#dcfce7' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: '#16a34a' }}>Vé đang hoạt động</p>
              <p className="text-xs" style={{ color: '#6b9e80' }}>Còn lại: {Math.floor(ticketMinutes / 60)}g {ticketMinutes % 60}ph</p>
            </div>
            <div className="flex-1" />
            <div className="text-right">
              <div className="text-2xl font-extrabold tabular-nums" style={{ color: '#16a34a' }}>
                {String(Math.floor(ticketMinutes / 60)).padStart(2, '0')}:{String(ticketMinutes % 60).padStart(2, '0')}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 p-5">
        {PACKAGES.map((pkg) => (
          <div
            key={pkg.id}
            className="rounded-2xl overflow-hidden"
            style={{ border: `1.5px solid ${pkg.isFree ? '#c8ead8' : pkg.id === 'pkg-full' ? '#16a34a' : '#c8ead8'}` }}
          >
            {pkg.id === 'pkg-full' && (
              <div className="px-4 py-1.5 text-center text-xs font-bold tracking-wider" style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', color: 'white' }}>
                PHỔ BIẾN NHẤT
              </div>
            )}
            <div className="p-4" style={{ background: '#ffffff' }}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ background: pkg.isFree ? '#c8ead8' : '#db277720', color: pkg.isFree ? '#5a8a6e' : '#db2777', border: `1px solid ${pkg.isFree ? '#a7f3d0' : '#db277740'}` }}
                    >
                      {pkg.isFree ? 'Miễn phí' : 'Trả phí'}
                    </span>
                  </div>
                  <h3 className="text-base font-extrabold" style={{ color: '#0f2d1e' }}>{pkg.name}</h3>
                </div>
                <div className="text-right">
                  {pkg.price === 0 ? (
                    <span className="text-2xl font-extrabold" style={{ color: '#16a34a' }}>FREE</span>
                  ) : (
                    <>
                      <span className="text-2xl font-extrabold" style={{ color: '#0f2d1e' }}>
                        {(pkg.price / 1000).toFixed(0)}k
                      </span>
                      <span className="text-xs ml-0.5" style={{ color: '#6b9e80' }}>₫</span>
                    </>
                  )}
                  <p className="text-xs" style={{ color: '#6b9e80' }}>Hiệu lực {fmt(pkg.duration)}</p>
                </div>
              </div>

              {/* Features */}
              <div className="flex flex-col gap-1.5 mb-4">
                {pkg.features.map((f, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full flex items-center justify-center flex-none" style={{ background: '#dcfce7' }}>
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </div>
                    <span className="text-xs" style={{ color: '#5a8a6e' }}>{f}</span>
                  </div>
                ))}
              </div>

              {/* Areas */}
              <div className="flex flex-col gap-1 mb-4 p-3 rounded-xl" style={{ background: '#ffffff' }}>
                <p className="text-xs font-semibold mb-1" style={{ color: '#6b9e80' }}>Khu vực được phép</p>
                {pkg.areas.map((a, i) => (
                  <p key={i} className="text-xs" style={{ color: '#5a8a6e' }}>• {a}</p>
                ))}
              </div>

              {/* Languages */}
              <div className="flex flex-wrap gap-1 mb-4">
                {pkg.languages.map((l, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#c8ead8', color: '#5a8a6e' }}>{l}</span>
                ))}
              </div>

              {/* CTA */}
              {paying === pkg.id ? (
                <div className="w-full py-3.5 rounded-xl flex items-center justify-center gap-2" style={{ background: '#c8ead8' }}>
                  <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#5a8a6e', borderTopColor: 'transparent' }} />
                  <span className="text-sm font-semibold" style={{ color: '#5a8a6e' }}>Đang xử lý...</span>
                </div>
              ) : pkg.isFree ? (
                <button
                  onClick={() => handlePay(pkg.id)}
                  className="w-full py-3.5 rounded-xl text-sm font-bold transition-all active:scale-95"
                  style={{ background: '#16a34a', color: 'white' }}
                >
                  Kích hoạt miễn phí
                </button>
              ) : (
                <button
                  onClick={() => handlePay(pkg.id)}
                  className="w-full py-3.5 rounded-xl text-sm font-bold transition-all active:scale-95"
                  style={{ background: '#db2777', color: 'white' }}
                >
                  Thanh toán {(pkg.price).toLocaleString('vi-VN')}₫
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
