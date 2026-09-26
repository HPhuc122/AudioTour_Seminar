import { LOCATIONS, TOURS } from '../data';

interface Props {
  onLocationSelect: (id: string) => void;
  onTourSelect: (id: string) => void;
  onNav: (s: string) => void;
  language: string;
  onLangOpen: () => void;
}

const CAT_COLORS: Record<string, string> = {
  'Hải sản': '#0ea5e9',
  'Quán cà phê': '#f59e0b',
  'Đặc sản': '#a855f7',
  'Di tích': '#6366f1',
  'Chợ': '#f97316',
};

export default function Home({ onLocationSelect, onTourSelect, onNav, language, onLangOpen }: Props) {
  return (
    <div className="flex flex-col h-full overflow-y-auto hide-scrollbar" style={{ background: '#f7fdf9' }}>
      {/* Hero */}
      <div className="relative" style={{ height: 300 }}>
        <img
          src="https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&h=600&fit=crop&auto=format"
          alt="Vĩnh Hy"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, #00000040 0%, #f7fdf9f5 90%)' }} />
        {/* Header row */}
        <div className="absolute top-12 left-5 right-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium tracking-widest uppercase" style={{ color: '#16a34a' }}>Audio Tour</p>
            <h1 className="text-xl font-extrabold" style={{ color: '#0f2d1e' }}>KhanhHoi</h1>
          </div>
          <button
            onClick={onLangOpen}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{ background: '#f0fdf499', backdropFilter: 'blur(8px)', border: '1px solid #c8ead8', color: '#1a3d2b' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            {language.toUpperCase()}
          </button>
        </div>

        {/* Hero text */}
        <div className="absolute bottom-5 left-5 right-5">
          <h2 className="text-2xl font-extrabold mb-2 leading-tight" style={{ color: '#0f2d1e' }}>
            Phố ẩm thực & làng chài<br />Vĩnh Hy
          </h2>
          <p className="text-sm mb-4" style={{ color: '#5a8a6e' }}>Thuyết minh audio đa ngôn ngữ tự động theo vị trí GPS</p>
          <div className="flex gap-2">
            <button
              onClick={() => onNav('locations')}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
              style={{ background: '#16a34a', color: 'white' }}
            >
              Địa điểm
            </button>
            <button
              onClick={() => onNav('tours')}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
              style={{ background: '#ffffff', border: '1px solid #c8ead8', color: '#1a3d2b' }}
            >
              Tour
            </button>
            <button
              onClick={() => onNav('packages')}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
              style={{ background: '#ffffff', border: '1px solid #c8ead8', color: '#1a3d2b' }}
            >
              Gói vé
            </button>
          </div>
        </div>
      </div>

      {/* Featured Locations */}
      <div className="px-5 pt-6 pb-2">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold" style={{ color: '#0f2d1e' }}>Địa điểm nổi bật</h3>
          <button onClick={() => onNav('locations')} className="text-xs font-semibold" style={{ color: '#16a34a' }}>
            Xem tất cả →
          </button>
        </div>
      </div>

      <div className="flex gap-3 px-5 overflow-x-auto hide-scrollbar pb-2">
        {LOCATIONS.map((loc) => (
          <button
            key={loc.id}
            onClick={() => onLocationSelect(loc.id)}
            className="flex-none rounded-2xl overflow-hidden transition-transform active:scale-95"
            style={{ width: 200, background: '#ffffff', border: '1px solid #c8ead8' }}
          >
            <div className="relative" style={{ height: 120 }}>
              <img src={loc.image} alt={loc.name} className="w-full h-full object-cover" />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 50%, #00000099)' }} />
              <span
                className="absolute top-2 left-2 text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: `${CAT_COLORS[loc.category] || '#6b9e80'}33`, color: CAT_COLORS[loc.category] || '#5a8a6e', border: `1px solid ${CAT_COLORS[loc.category] || '#6b9e80'}55` }}
              >
                {loc.category}
              </span>
            </div>
            <div className="p-3">
              <p className="text-sm font-bold mb-1 text-left" style={{ color: '#0f2d1e' }}>{loc.name}</p>
              <p className="text-xs text-left leading-relaxed line-clamp-2" style={{ color: '#6b9e80' }}>{loc.description}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Featured Tours */}
      <div className="px-5 pt-6 pb-2">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold" style={{ color: '#0f2d1e' }}>Tour nổi bật</h3>
          <button onClick={() => onNav('tours')} className="text-xs font-semibold" style={{ color: '#16a34a' }}>
            Xem tất cả →
          </button>
        </div>
        <div className="flex flex-col gap-3">
          {TOURS.slice(0, 2).map((tour) => (
            <button
              key={tour.id}
              onClick={() => onTourSelect(tour.id)}
              className="flex gap-3 rounded-2xl overflow-hidden text-left transition-all active:scale-95"
              style={{ background: '#ffffff', border: '1px solid #c8ead8' }}
            >
              <img src={tour.image} alt={tour.name} className="object-cover flex-none" style={{ width: 88, height: 88 }} />
              <div className="flex-1 p-3 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#dcfce7', color: '#16a34a' }}>
                    {tour.code}
                  </span>
                  <span className="text-xs" style={{ color: '#6b9e80' }}>{tour.duration} phút</span>
                </div>
                <p className="text-sm font-bold mb-1" style={{ color: '#0f2d1e' }}>{tour.name}</p>
                <p className="text-xs leading-relaxed line-clamp-2" style={{ color: '#6b9e80' }}>{tour.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* GPS Banner */}
      <div className="mx-5 mt-4 mb-6 rounded-2xl p-4 flex gap-3 items-center" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-none" style={{ background: '#dcfce7' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: '#16a34a' }}>GPS đang hoạt động</p>
          <p className="text-xs mt-0.5" style={{ color: '#6b9e80' }}>Thuyết minh tự động phát khi bạn đến gần địa điểm</p>
        </div>
        <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#16a34a' }} />
      </div>
    </div>
  );
}
