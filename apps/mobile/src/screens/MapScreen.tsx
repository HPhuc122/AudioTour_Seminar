import { useState } from 'react';
import { LOCATIONS } from '../data';

interface Props {
  onLocationSelect: (id: string) => void;
}

const CAT_ICONS: Record<string, string> = {
  'Hải sản': '🐟',
  'Quán cà phê': '☕',
  'Đặc sản': '🍜',
  'Di tích': '🏛',
  'Chợ': '🛒',
};

export default function MapScreen({ onLocationSelect }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [autoPlay, setAutoPlay] = useState(true);
  const [nearbyAlert] = useState(true);

  const selectedLoc = LOCATIONS.find((l) => l.id === selected);

  // Map each location to a visual position on our mock map (0-100 percentage)
  const positions: Record<string, { x: number; y: number }> = {
    'loc-1': { x: 48, y: 35 },
    'loc-2': { x: 60, y: 45 },
    'loc-3': { x: 38, y: 55 },
    'loc-4': { x: 30, y: 42 },
    'loc-5': { x: 65, y: 30 },
    'loc-6': { x: 22, y: 62 },
  };

  return (
    <div className="relative flex flex-col h-full overflow-hidden" style={{ background: '#f7fdf9' }}>
      {/* Geofence banner */}
      {nearbyAlert && (
        <div
          className="absolute top-12 left-4 right-4 z-20 flex items-center gap-3 px-4 py-3 rounded-2xl"
          style={{ background: '#16a34a', boxShadow: '0 4px 24px #16a34a55' }}
        >
          <div className="w-2 h-2 rounded-full animate-ping" style={{ background: 'white', flexShrink: 0 }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold" style={{ color: 'white' }}>Bạn đang ở gần Bến Cá Vĩnh Hy</p>
            <p className="text-xs" style={{ color: '#15803d' }}>Đang phát thuyết minh tự động</p>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </div>
      )}

      {/* Online/Offline indicator */}
      <div className="absolute top-14 right-4 z-20 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full" style={{ background: '#ffffffdd', backdropFilter: 'blur(8px)', border: '1px solid #c8ead8' }}>
        <div className="w-2 h-2 rounded-full" style={{ background: '#16a34a' }} />
        <span className="text-xs font-medium" style={{ color: '#1a3d2b' }}>Online</span>
      </div>

      {/* Mock Map */}
      <div className="flex-1 relative overflow-hidden" style={{ background: '#e8f5ee' }}>
        {/* Map texture/grid */}
        <svg className="absolute inset-0 w-full h-full" style={{ opacity: 0.08 }}>
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#16a34a" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Water areas */}
        <div className="absolute rounded-3xl" style={{ right: -20, top: '10%', width: '45%', height: '70%', background: '#0ea5e920', border: '1px solid #0ea5e930' }} />
        <div className="absolute rounded-2xl" style={{ left: '15%', bottom: '15%', width: '25%', height: '15%', background: '#0ea5e915', border: '1px solid #0ea5e920' }} />

        {/* Road lines */}
        <svg className="absolute inset-0 w-full h-full">
          <path d="M 10% 50% Q 50% 30% 90% 50%" stroke="#c8ead8" strokeWidth="8" fill="none" strokeLinecap="round" />
          <path d="M 30% 20% L 30% 80%" stroke="#c8ead8" strokeWidth="6" fill="none" strokeLinecap="round" />
          <path d="M 30% 50% L 70% 50%" stroke="#c8ead8" strokeWidth="6" fill="none" strokeLinecap="round" />
          <path d="M 30% 35% Q 50% 30% 65% 28%" stroke="#bbf7d0" strokeWidth="4" fill="none" />
          <path d="M 10% 50% Q 50% 30% 90% 50%" stroke="#a7f3d0" strokeWidth="2" fill="none" strokeLinecap="round" strokeDasharray="4 8" />
        </svg>

        {/* Location markers */}
        {LOCATIONS.map((loc) => {
          const pos = positions[loc.id];
          const isSel = selected === loc.id;
          return (
            <button
              key={loc.id}
              onClick={() => setSelected(isSel ? null : loc.id)}
              className="absolute transition-transform active:scale-90"
              style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%, -50%)' }}
            >
              {/* Geofence circle */}
              <div
                className="absolute rounded-full"
                style={{ width: 60, height: 60, top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: '#16a34a10', border: '1px solid #16a34a40', animation: isSel ? 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite' : 'none' }}
              />
              {/* Marker */}
              <div
                className="relative flex items-center justify-center rounded-full text-base transition-all"
                style={{
                  width: isSel ? 44 : 36,
                  height: isSel ? 44 : 36,
                  background: isSel ? '#16a34a' : '#ffffff',
                  border: `2px solid ${isSel ? '#16a34a' : '#c8ead8'}`,
                  boxShadow: isSel ? '0 0 20px #16a34a66' : 'none',
                  fontSize: isSel ? 20 : 16,
                }}
              >
                {CAT_ICONS[loc.category] || '📍'}
                {loc.stopNumber && (
                  <span
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-xs flex items-center justify-center font-bold"
                    style={{ background: '#16a34a', color: 'white', fontSize: 9 }}
                  >
                    {loc.stopNumber}
                  </span>
                )}
              </div>
            </button>
          );
        })}

        {/* User location */}
        <div className="absolute" style={{ left: '52%', top: '48%', transform: 'translate(-50%, -50%)' }}>
          <div className="absolute rounded-full animate-ping" style={{ width: 32, height: 32, top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: '#3b82f620' }} />
          <div className="w-4 h-4 rounded-full" style={{ background: '#3b82f6', border: '2px solid white', boxShadow: '0 2px 8px #3b82f666' }} />
        </div>
      </div>

      {/* Controls */}
      <div className="absolute right-4 z-10" style={{ top: '50%', transform: 'translateY(-50%)' }}>
        <div className="flex flex-col gap-2">
          <button className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#ffffff', border: '1px solid #c8ead8' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a3d2b" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          <button className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#ffffff', border: '1px solid #c8ead8' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a3d2b" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>
      </div>

      {/* Auto-play toggle */}
      <div className="absolute left-4 z-10" style={{ bottom: selectedLoc ? 200 : 16 }}>
        <button
          onClick={() => {}}
          className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: '#ffffffdd', backdropFilter: 'blur(8px)', border: '1px solid #c8ead8' }}
        >
          <span className="text-xs font-medium" style={{ color: '#1a3d2b' }}>Tự động phát GPS</span>
          <div
            className="relative rounded-full transition-all"
            style={{ width: 32, height: 18, background: autoPlay ? '#16a34a' : '#c8ead8' }}
            onClick={() => setAutoPlay(!autoPlay)}
          >
            <div className="absolute rounded-full transition-all" style={{ width: 14, height: 14, top: 2, left: autoPlay ? 16 : 2, background: 'white' }} />
          </div>
        </button>
      </div>

      {/* Bottom sheet when marker selected */}
      {selectedLoc && (
        <div
          className="absolute bottom-0 left-0 right-0 rounded-t-3xl p-4"
          style={{ background: '#ffffff', border: '1px solid #ffffff', boxShadow: '0 -8px 40px #00000080' }}
        >
          <div className="flex gap-3">
            <img src={selectedLoc.image} alt={selectedLoc.name} className="rounded-xl object-cover flex-none" style={{ width: 72, height: 72 }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold mb-0.5" style={{ color: '#16a34a' }}>{selectedLoc.category}</p>
              <p className="text-base font-bold mb-1" style={{ color: '#0f2d1e' }}>{selectedLoc.name}</p>
              <p className="text-xs line-clamp-2" style={{ color: '#6b9e80' }}>{selectedLoc.description}</p>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => onLocationSelect(selectedLoc.id)}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
              style={{ background: '#16a34a', color: 'white' }}
            >
              Xem chi tiết
            </button>
            <button
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
              style={{ background: '#ffffff', border: '1px solid #c8ead8', color: '#1a3d2b' }}
            >
              <span className="flex items-center justify-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Nghe
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
