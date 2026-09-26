import { useState } from 'react';
import { LOCATIONS, CATEGORIES } from '../data';

interface Props {
  onSelect: (id: string) => void;
  onBack: () => void;
}

const CAT_COLORS: Record<string, string> = {
  'Hải sản': '#0ea5e9',
  'Quán cà phê': '#f59e0b',
  'Đặc sản': '#a855f7',
  'Di tích': '#6366f1',
  'Chợ': '#f97316',
};

export default function LocationList({ onSelect, onBack }: Props) {
  const [active, setActive] = useState('Tất cả');

  const filtered = active === 'Tất cả' ? LOCATIONS : LOCATIONS.filter((l) => l.category === active);

  return (
    <div className="flex flex-col h-full" style={{ background: '#f7fdf9' }}>
      {/* Header */}
      <div className="px-5 pt-12 pb-4" style={{ borderBottom: '1px solid #ffffff' }}>
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: '#ffffff' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a3d2b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <h1 className="text-xl font-extrabold" style={{ color: '#0f2d1e' }}>Địa điểm</h1>
        </div>
        {/* Category chips */}
        <div className="flex gap-2 overflow-x-auto hide-scrollbar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActive(cat)}
              className="flex-none px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{
                background: active === cat ? '#16a34a' : '#ffffff',
                color: active === cat ? 'white' : '#5a8a6e',
                border: `1px solid ${active === cat ? '#16a34a' : '#c8ead8'}`,
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto hide-scrollbar">
        <div className="grid grid-cols-2 gap-3 p-4">
          {filtered.map((loc) => (
            <button
              key={loc.id}
              onClick={() => onSelect(loc.id)}
              className="rounded-2xl overflow-hidden text-left transition-transform active:scale-95"
              style={{ background: '#ffffff', border: '1px solid #c8ead8' }}
            >
              <div className="relative" style={{ height: 130 }}>
                <img src={loc.image} alt={loc.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 40%, #00000099)' }} />
                <span
                  className="absolute top-2 left-2 text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: `${CAT_COLORS[loc.category] || '#6b9e80'}33`, color: CAT_COLORS[loc.category] || '#5a8a6e', border: `1px solid ${CAT_COLORS[loc.category] || '#6b9e80'}55` }}
                >
                  {loc.category}
                </span>
              </div>
              <div className="p-2.5">
                <p className="text-sm font-bold mb-1" style={{ color: '#0f2d1e' }}>{loc.name}</p>
                <p className="text-xs leading-relaxed line-clamp-2" style={{ color: '#6b9e80' }}>{loc.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
