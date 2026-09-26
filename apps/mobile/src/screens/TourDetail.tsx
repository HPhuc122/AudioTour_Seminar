import { useState } from 'react';
import { TOURS, LOCATIONS } from '../data';
import AudioPlayer from '../components/AudioPlayer';

interface Props {
  tourId: string;
  hasTicket: boolean;
  ticketMinutes: number;
  language: string;
  onBack: () => void;
  onLocationSelect: (id: string) => void;
  onPackages: () => void;
}

export default function TourDetail({ tourId, hasTicket, ticketMinutes, language, onBack, onLocationSelect, onPackages }: Props) {
  const tour = TOURS.find((t) => t.id === tourId)!;
  const stops = tour.stops.map((id) => LOCATIONS.find((l) => l.id === id)!);
  const [activeStop, setActiveStop] = useState(0);

  const langLabel: Record<string, string> = { vi: 'Tiếng Việt', en: 'English', zh: '中文', ko: '한국어', ja: '日本語', fr: 'Français' };
  const fmt = (m: number) => `${Math.floor(m / 60)}g ${m % 60}ph`;

  return (
    <div className="flex flex-col h-full overflow-y-auto hide-scrollbar" style={{ background: '#f7fdf9' }}>
      {/* Hero */}
      <div className="relative" style={{ height: 240 }}>
        <img src={tour.image} alt={tour.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, #00000025 0%, #f7fdf9f5 90%)' }} />
        <button
          onClick={onBack}
          className="absolute top-12 left-5 w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: '#00000060', backdropFilter: 'blur(8px)', border: '1px solid #ffffff20' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div className="absolute bottom-4 left-5 right-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-extrabold px-2.5 py-1 rounded-full" style={{ background: '#16a34a', color: 'white' }}>{tour.code}</span>
            <span className="text-xs" style={{ color: '#15803d' }}>{tour.duration} phút • {stops.length} điểm</span>
          </div>
          <h1 className="text-2xl font-extrabold" style={{ color: '#0f2d1e' }}>{tour.name}</h1>
        </div>
      </div>

      <div className="px-5 pt-4 flex flex-col gap-5 pb-8">
        <p className="text-sm leading-relaxed" style={{ color: '#5a8a6e' }}>{tour.description}</p>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95"
            style={{ background: '#16a34a', color: 'white' }}
          >
            Bắt đầu tuyến đường
          </button>
          <button
            className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95"
            style={{ background: '#ffffff', border: '1px solid #c8ead8', color: '#1a3d2b' }}
          >
            Xem trên bản đồ
          </button>
        </div>

        {/* Stop stepper */}
        <div>
          <p className="text-sm font-bold mb-3" style={{ color: '#0f2d1e' }}>Điểm dừng ({stops.length})</p>
          {/* Horizontal carousel */}
          <div className="flex gap-2 overflow-x-auto hide-scrollbar mb-4">
            {stops.map((stop, i) => (
              <button
                key={stop.id}
                onClick={() => setActiveStop(i)}
                className="flex-none px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: activeStop === i ? '#16a34a' : '#ffffff',
                  color: activeStop === i ? 'white' : '#5a8a6e',
                  border: `1px solid ${activeStop === i ? '#16a34a' : '#c8ead8'}`,
                }}
              >
                {i + 1}. {stop.name}
              </button>
            ))}
          </div>

          {/* Stop list */}
          <div className="flex flex-col gap-2">
            {stops.map((stop, i) => (
              <button
                key={stop.id}
                onClick={() => onLocationSelect(stop.id)}
                className="flex items-center gap-3 p-3 rounded-2xl text-left transition-all active:scale-98"
                style={{
                  background: activeStop === i ? '#f0fdf4' : '#ffffff',
                  border: `1px solid ${activeStop === i ? '#16a34a40' : '#c8ead8'}`,
                }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-none text-sm font-bold"
                  style={{ background: activeStop === i ? '#16a34a' : '#c8ead8', color: 'white' }}
                >
                  {i + 1}
                </div>
                <img src={stop.image} alt={stop.name} className="w-12 h-12 rounded-xl object-cover flex-none" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: '#0f2d1e' }}>{stop.name}</p>
                  <p className="text-xs truncate" style={{ color: '#6b9e80' }}>{stop.description}</p>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b9e80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            ))}
          </div>
        </div>

        {/* Audio panel for active stop */}
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #c8ead8' }}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ background: '#ffffff' }}>
            <p className="text-sm font-semibold" style={{ color: '#0f2d1e' }}>Điểm {activeStop + 1}: {stops[activeStop].name}</p>
            <span className="text-xs px-2 py-1 rounded-full" style={{ background: '#dcfce7', color: '#16a34a' }}>
              {langLabel[language]}
            </span>
          </div>
          <div className="p-4">
            {hasTicket ? (
              <>
                <div className="flex items-center gap-2 mb-4 p-3 rounded-xl" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <p className="text-sm font-semibold" style={{ color: '#16a34a' }}>Vé còn hiệu lực: {fmt(ticketMinutes)}</p>
                </div>
                <AudioPlayer locationName={stops[activeStop].name} language={langLabel[language]} />
              </>
            ) : (
              <div className="py-3 text-center">
                <p className="text-sm font-semibold mb-2" style={{ color: '#1a3d2b' }}>Cần vé để nghe thuyết minh</p>
                <button onClick={onPackages} className="px-5 py-2.5 rounded-xl text-sm font-bold" style={{ background: '#db2777', color: 'white' }}>
                  Xem gói vé
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
