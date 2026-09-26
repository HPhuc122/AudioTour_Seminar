import { useState } from 'react';
import { LOCATIONS } from '../data';
import AudioPlayer from '../components/AudioPlayer';

interface Props {
  locationId: string;
  hasTicket: boolean;
  ticketMinutes: number;
  language: string;
  onBack: () => void;
  onMap: () => void;
  onPackages: () => void;
}

export default function LocationDetail({ locationId, hasTicket, ticketMinutes, language, onBack, onMap, onPackages }: Props) {
  const loc = LOCATIONS.find((l) => l.id === locationId)!;
  const [imgIndex, setImgIndex] = useState(0);
  const [showFull, setShowFull] = useState(false);

  const langLabel: Record<string, string> = { vi: 'Tiếng Việt', en: 'English', zh: '中文', ko: '한국어', ja: '日本語', fr: 'Français' };

  const fmt = (m: number) => `${Math.floor(m / 60)}g ${m % 60}ph`;

  return (
    <div className="flex flex-col h-full overflow-y-auto hide-scrollbar" style={{ background: '#f7fdf9' }}>
      {/* Hero image with swipe */}
      <div className="relative" style={{ height: 280 }}>
        <img src={loc.images[imgIndex]} alt={loc.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, #00000025 0%, #f7fdf9f5 90%)' }} />

        {/* Back */}
        <button
          onClick={onBack}
          className="absolute top-12 left-5 w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: '#00000060', backdropFilter: 'blur(8px)', border: '1px solid #ffffff20' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>

        {/* Image dots */}
        {loc.images.length > 1 && (
          <div className="absolute bottom-16 left-0 right-0 flex justify-center gap-1.5">
            {loc.images.map((_, i) => (
              <button key={i} onClick={() => setImgIndex(i)}>
                <div className="rounded-full" style={{ width: i === imgIndex ? 20 : 6, height: 6, background: i === imgIndex ? '#16a34a' : '#ffffff60', transition: 'all 0.2s' }} />
              </button>
            ))}
          </div>
        )}

        {/* Location name */}
        <div className="absolute bottom-4 left-5 right-5">
          <p className="text-xs font-semibold tracking-wider uppercase mb-1" style={{ color: '#16a34a' }}>{loc.category}</p>
          <h1 className="text-2xl font-extrabold" style={{ color: '#0f2d1e' }}>{loc.name}</h1>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 pt-4 flex flex-col gap-4 pb-8">
        {/* Description */}
        <p className="text-sm leading-relaxed" style={{ color: '#5a8a6e' }}>
          {showFull ? loc.descriptionLong : loc.descriptionLong.slice(0, 120) + '...'}
          <button onClick={() => setShowFull(!showFull)} className="ml-1 font-semibold" style={{ color: '#16a34a' }}>
            {showFull ? 'Thu gọn' : 'Xem thêm'}
          </button>
        </p>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={onMap}
            className="flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-95"
            style={{ background: '#ffffff', border: '1px solid #c8ead8', color: '#1a3d2b' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
            </svg>
            Bản đồ
          </button>
          {hasTicket ? (
            <button
              className="flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-95"
              style={{ background: '#16a34a', color: 'white' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Nghe ngay
            </button>
          ) : (
            <button
              onClick={onPackages}
              className="flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-95"
              style={{ background: '#db2777', color: 'white' }}
            >
              Chọn gói vé
            </button>
          )}
        </div>

        {/* Audio panel */}
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #c8ead8' }}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ background: '#ffffff' }}>
            <p className="text-sm font-semibold" style={{ color: '#0f2d1e' }}>Thuyết minh Audio</p>
            <span className="text-xs px-2 py-1 rounded-full" style={{ background: '#dcfce7', color: '#16a34a' }}>
              {langLabel[language] || language}
            </span>
          </div>

          <div className="p-4">
            {hasTicket ? (
              <>
                <div className="flex items-center gap-2 mb-4 p-3 rounded-xl" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <p className="text-sm font-semibold" style={{ color: '#16a34a' }}>Vé còn hiệu lực: {fmt(ticketMinutes)}</p>
                </div>
                <AudioPlayer locationName={loc.name} language={langLabel[language] || language} />
              </>
            ) : (
              <div className="py-4 text-center">
                <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: '#c8ead8' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b9e80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </div>
                <p className="text-sm font-semibold mb-1" style={{ color: '#1a3d2b' }}>Cần vé để nghe thuyết minh</p>
                <p className="text-xs mb-4" style={{ color: '#6b9e80' }}>Mua vé để trải nghiệm thuyết minh audio tại địa điểm này</p>
                <button
                  onClick={onPackages}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95"
                  style={{ background: '#db2777', color: 'white' }}
                >
                  Xem gói vé
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Menu images */}
        {loc.menuImages.length > 0 && (
          <div>
            <h3 className="text-sm font-bold mb-3" style={{ color: '#0f2d1e' }}>Ảnh menu & món ăn</h3>
            <div className="grid grid-cols-2 gap-2">
              {loc.menuImages.map((img, i) => (
                <div key={i} className="rounded-xl overflow-hidden" style={{ height: 100 }}>
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
