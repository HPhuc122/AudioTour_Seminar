import { useState } from 'react';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

type State = 'scanning' | 'loading' | 'success' | 'error';

export default function QRScanner({ onClose, onSuccess }: Props) {
  const [state, setState] = useState<State>('scanning');

  const simulate = () => {
    setState('loading');
    setTimeout(() => {
      setState('success');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
    }, 1500);
  };

  const simulateError = () => {
    setState('error');
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#000000f0' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-12 pb-4">
        <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: '#ffffff' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a3d2b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
        <h1 className="text-base font-bold" style={{ color: 'white' }}>Quét Mã QR</h1>
        <div style={{ width: 36 }} />
      </div>

      {/* Scanner view */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        {state === 'scanning' && (
          <>
            <p className="text-sm mb-8 text-center" style={{ color: '#5a8a6e' }}>Đưa mã QR trên vé vào khung hình bên dưới</p>
            {/* Scanner frame */}
            <div className="relative" style={{ width: 240, height: 240 }}>
              {/* Fake camera view */}
              <div className="absolute inset-0 rounded-2xl overflow-hidden" style={{ background: '#0f2d1e' }}>
                <div className="w-full h-full flex items-center justify-center">
                  <div className="grid grid-cols-5 gap-1 opacity-40">
                    {Array.from({ length: 25 }).map((_, i) => (
                      <div key={i} className="w-8 h-8 rounded" style={{ background: i % 3 === 0 ? '#16a34a' : '#1a3d2b' }} />
                    ))}
                  </div>
                </div>
                {/* Scan line */}
                <div
                  className="absolute left-4 right-4 h-0.5 rounded-full"
                  style={{ background: '#16a34a', top: '40%', boxShadow: '0 0 12px #16a34a', animation: 'scan 2s ease-in-out infinite' }}
                />
              </div>

              {/* Corner marks */}
              {[
                { top: 0, left: 0, border: 'top left' },
                { top: 0, right: 0, border: 'top right' },
                { bottom: 0, left: 0, border: 'bottom left' },
                { bottom: 0, right: 0, border: 'bottom right' },
              ].map((pos, i) => (
                <div
                  key={i}
                  className="absolute w-8 h-8"
                  style={{
                    ...pos,
                    borderTop: pos.border.includes('top') ? '3px solid #16a34a' : 'none',
                    borderBottom: pos.border.includes('bottom') ? '3px solid #16a34a' : 'none',
                    borderLeft: pos.border.includes('left') ? '3px solid #16a34a' : 'none',
                    borderRight: pos.border.includes('right') ? '3px solid #16a34a' : 'none',
                    borderTopLeftRadius: pos.border === 'top left' ? 8 : 0,
                    borderTopRightRadius: pos.border === 'top right' ? 8 : 0,
                    borderBottomLeftRadius: pos.border === 'bottom left' ? 8 : 0,
                    borderBottomRightRadius: pos.border === 'bottom right' ? 8 : 0,
                  }}
                />
              ))}
            </div>

            <style>{`
              @keyframes scan {
                0%, 100% { top: 20%; }
                50% { top: 75%; }
              }
            `}</style>

            {/* Simulate buttons */}
            <div className="flex flex-col gap-3 mt-10 w-full">
              <button
                onClick={simulate}
                className="w-full py-4 rounded-2xl text-sm font-bold transition-all active:scale-95"
                style={{ background: '#16a34a', color: 'white' }}
              >
                Mô phỏng quét thành công
              </button>
              <button
                onClick={simulateError}
                className="w-full py-3.5 rounded-2xl text-sm font-semibold transition-all active:scale-95"
                style={{ background: '#ffffff', border: '1px solid #c8ead8', color: '#5a8a6e' }}
              >
                Mô phỏng mã QR lỗi
              </button>
            </div>
          </>
        )}

        {state === 'loading' && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: '#c8ead8', borderTopColor: '#16a34a' }} />
            <p className="text-base font-semibold" style={{ color: '#1a3d2b' }}>Đang xác thực vé...</p>
          </div>
        )}

        {state === 'success' && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: '#dcfce7', border: '2px solid #16a34a' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <p className="text-xl font-extrabold" style={{ color: '#16a34a' }}>Vé đã kích hoạt!</p>
            <div className="px-4 py-3 rounded-2xl text-center" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
              <p className="text-sm font-semibold" style={{ color: '#16a34a' }}>🎫 Vé thuyết minh toàn khu đang hoạt động</p>
              <p className="text-xs mt-1" style={{ color: '#6b9e80' }}>Hiệu lực: 2 giờ 00 phút</p>
            </div>
            <p className="text-sm text-center" style={{ color: '#5a8a6e' }}>Đang chuyển đến địa điểm...</p>
          </div>
        )}

        {state === 'error' && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: '#ef444420', border: '2px solid #ef4444' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </div>
            <p className="text-xl font-extrabold" style={{ color: '#ef4444' }}>Mã QR không khả dụng</p>
            <p className="text-sm text-center" style={{ color: '#5a8a6e' }}>Vui lòng kiểm tra lại mã QR hoặc liên hệ hỗ trợ</p>
            <button
              onClick={() => setState('scanning')}
              className="px-6 py-3 rounded-xl text-sm font-bold transition-all active:scale-95"
              style={{ background: '#ffffff', border: '1px solid #c8ead8', color: '#1a3d2b' }}
            >
              Thử lại
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
