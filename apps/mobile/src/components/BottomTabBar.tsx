import type { ReactElement } from 'react';
import type { Screen } from '../App';

interface Props {
  active: Screen;
  onChange: (s: Screen) => void;
  onQR: () => void;
}

const tabs: { id: Screen; label: string; icon: (active: boolean) => ReactElement }[] = [
  {
    id: 'home',
    label: 'Trang chủ',
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? '#16a34a' : 'none'} stroke={a ? '#16a34a' : '#5a8a6e'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    id: 'map',
    label: 'Bản đồ',
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? '#16a34a' : '#5a8a6e'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
        <line x1="8" y1="2" x2="8" y2="18"/>
        <line x1="16" y1="6" x2="16" y2="22"/>
      </svg>
    ),
  },
  {
    id: 'tours',
    label: 'Tour',
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? '#16a34a' : '#5a8a6e'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
  },
  {
    id: 'packages',
    label: 'Vé',
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? '#16a34a' : '#5a8a6e'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 12v10H4V12"/>
        <path d="M22 7H2v5h20V7z"/>
        <path d="M12 22V7"/>
        <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
        <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
      </svg>
    ),
  },
  {
    id: 'search',
    label: 'Tìm kiếm',
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? '#16a34a' : '#5a8a6e'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    ),
  },
];

export default function BottomTabBar({ active, onChange, onQR }: Props) {
  return (
    <div className="relative flex items-center justify-around" style={{ background: '#ffffff', borderTop: '1px solid #c8ead8', boxShadow: '0 -4px 24px #16a34a12', paddingBottom: 'env(safe-area-inset-bottom, 8px)', paddingTop: '8px', height: '68px' }}>
      {tabs.map((tab, i) => {
        if (i === 2) {
          return (
            <div key="fab-slot" className="flex flex-col items-center" style={{ width: 64 }}>
              {/* FAB */}
              <button
                onClick={onQR}
                className="flex items-center justify-center rounded-full shadow-lg transition-transform active:scale-95"
                style={{ width: 52, height: 52, background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', marginTop: -28, border: '3px solid #ffffff' }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7"/>
                  <rect x="14" y="3" width="7" height="7"/>
                  <rect x="3" y="14" width="7" height="7"/>
                  <rect x="14" y="14" width="3" height="3"/>
                  <rect x="18" y="18" width="3" height="3"/>
                </svg>
              </button>
              <span className="text-xs mt-0.5" style={{ color: '#6b9e80', fontSize: 10 }}>Quét QR</span>
            </div>
          );
        }
        const adjustedI = i > 2 ? i - 1 : i;
        const allTabs = [tabs[0], tabs[1], tabs[3], tabs[4]];
        const t = allTabs[adjustedI];
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className="flex flex-col items-center gap-0.5 transition-opacity"
            style={{ width: 56 }}
          >
            {t.icon(isActive)}
            <span className="text-xs" style={{ color: isActive ? '#16a34a' : '#6b9e80', fontSize: 10, fontWeight: isActive ? 600 : 400 }}>
              {t.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
