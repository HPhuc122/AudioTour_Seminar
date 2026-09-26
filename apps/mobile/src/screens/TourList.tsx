import { TOURS } from '../data';

interface Props {
  onSelect: (id: string) => void;
  onBack: () => void;
}

export default function TourList({ onSelect, onBack }: Props) {
  return (
    <div className="flex flex-col h-full overflow-y-auto hide-scrollbar" style={{ background: '#f7fdf9' }}>
      <div className="px-5 pt-12 pb-4" style={{ borderBottom: '1px solid #ffffff' }}>
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: '#ffffff' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a3d2b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <h1 className="text-xl font-extrabold" style={{ color: '#0f2d1e' }}>Tour Âm Thanh</h1>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-5">
        {TOURS.map((tour) => (
          <button
            key={tour.id}
            onClick={() => onSelect(tour.id)}
            className="rounded-2xl overflow-hidden text-left transition-transform active:scale-95"
            style={{ border: '1px solid #c8ead8' }}
          >
            <div className="relative" style={{ height: 160 }}>
              <img src={tour.image} alt={tour.name} className="w-full h-full object-cover" />
              <div
                className="absolute inset-0 flex flex-col justify-end p-4"
                style={{ background: 'linear-gradient(to bottom, transparent 20%, #000000cc)' }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-extrabold px-2.5 py-1 rounded-full" style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', color: 'white' }}>
                    {tour.code}
                  </span>
                  <span className="text-xs flex items-center gap-1" style={{ color: '#15803d' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    {tour.duration} phút
                  </span>
                  <span className="text-xs" style={{ color: '#15803d' }}>• {tour.stops.length} điểm dừng</span>
                </div>
                <h3 className="text-lg font-extrabold" style={{ color: 'white' }}>{tour.name}</h3>
              </div>
            </div>
            <div className="p-4" style={{ background: '#ffffff' }}>
              <p className="text-sm leading-relaxed line-clamp-3" style={{ color: '#5a8a6e' }}>{tour.description}</p>
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs" style={{ color: '#6b9e80' }}>{tour.stops.length} điểm tham quan</span>
                <span className="text-xs font-semibold" style={{ color: '#16a34a' }}>Xem chi tiết →</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
