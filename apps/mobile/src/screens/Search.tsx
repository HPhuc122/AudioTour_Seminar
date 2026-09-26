import { useState } from 'react';
import { LOCATIONS, TOURS } from '../data';

interface Props {
  onLocationSelect: (id: string) => void;
  onTourSelect: (id: string) => void;
}

export default function Search({ onLocationSelect, onTourSelect }: Props) {
  const [query, setQuery] = useState('');

  const q = query.toLowerCase().trim();
  const locs = q ? LOCATIONS.filter((l) => l.name.toLowerCase().includes(q) || l.category.toLowerCase().includes(q) || l.description.toLowerCase().includes(q)) : [];
  const tours = q ? TOURS.filter((t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)) : [];
  const hasResults = locs.length > 0 || tours.length > 0;

  return (
    <div className="flex flex-col h-full" style={{ background: '#f7fdf9' }}>
      {/* Header */}
      <div className="px-5 pt-12 pb-4">
        <h1 className="text-xl font-extrabold mb-4" style={{ color: '#0f2d1e' }}>Tìm kiếm</h1>
        <div className="relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b9e80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm địa điểm, tour, danh mục..."
            className="w-full pl-10 pr-4 py-3.5 rounded-2xl text-sm outline-none"
            style={{ background: '#ffffff', border: '1px solid #c8ead8', color: '#0f2d1e' }}
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3.5 top-1/2 -translate-y-1/2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b9e80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar px-5">
        {!q && (
          <div className="text-center pt-12">
            <div className="text-5xl mb-4">🔍</div>
            <p className="text-base font-semibold mb-2" style={{ color: '#1a3d2b' }}>Khám phá Vĩnh Hy</p>
            <p className="text-sm" style={{ color: '#6b9e80' }}>Tìm kiếm theo tên địa điểm, danh mục, hoặc tour</p>
          </div>
        )}

        {q && !hasResults && (
          <div className="text-center pt-12">
            <div className="text-5xl mb-4">😕</div>
            <p className="text-base font-semibold mb-2" style={{ color: '#1a3d2b' }}>Không tìm thấy kết quả</p>
            <p className="text-sm" style={{ color: '#6b9e80' }}>Thử từ khóa khác như "hải sản", "bến cá", hoặc "tour"</p>
          </div>
        )}

        {locs.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#6b9e80' }}>Địa điểm ({locs.length})</p>
            <div className="flex flex-col gap-2">
              {locs.map((loc) => (
                <button
                  key={loc.id}
                  onClick={() => onLocationSelect(loc.id)}
                  className="flex items-center gap-3 p-3 rounded-2xl text-left transition-all active:scale-98"
                  style={{ background: '#ffffff', border: '1px solid #c8ead8' }}
                >
                  <img src={loc.image} alt={loc.name} className="w-14 h-14 rounded-xl object-cover flex-none" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold" style={{ color: '#0f2d1e' }}>{loc.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#16a34a' }}>{loc.category}</p>
                    <p className="text-xs truncate mt-0.5" style={{ color: '#6b9e80' }}>{loc.description}</p>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b9e80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>
              ))}
            </div>
          </div>
        )}

        {tours.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#6b9e80' }}>Tour ({tours.length})</p>
            <div className="flex flex-col gap-2">
              {tours.map((tour) => (
                <button
                  key={tour.id}
                  onClick={() => onTourSelect(tour.id)}
                  className="flex items-center gap-3 p-3 rounded-2xl text-left transition-all active:scale-98"
                  style={{ background: '#ffffff', border: '1px solid #c8ead8' }}
                >
                  <img src={tour.image} alt={tour.name} className="w-14 h-14 rounded-xl object-cover flex-none" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: '#dcfce7', color: '#16a34a' }}>{tour.code}</span>
                      <span className="text-xs" style={{ color: '#6b9e80' }}>{tour.duration} phút</span>
                    </div>
                    <p className="text-sm font-bold" style={{ color: '#0f2d1e' }}>{tour.name}</p>
                    <p className="text-xs truncate mt-0.5" style={{ color: '#6b9e80' }}>{tour.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
