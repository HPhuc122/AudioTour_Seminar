import { LANGUAGES } from '../data';

interface Props {
  current: string;
  onSelect: (code: string) => void;
  onClose: () => void;
}

export default function LanguageSheet({ current, onSelect, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div
        className="rounded-t-3xl p-5 pb-8"
        style={{ background: '#ffffff', border: '1px solid #ffffff' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: '#c8ead8' }} />
        <h2 className="text-lg font-extrabold mb-4" style={{ color: '#0f2d1e' }}>Chọn ngôn ngữ thuyết minh</h2>
        <div className="grid grid-cols-2 gap-2">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => { onSelect(lang.code); onClose(); }}
              className="flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all"
              style={{
                background: current === lang.code ? '#dcfce7' : '#ffffff',
                border: `1.5px solid ${current === lang.code ? '#16a34a' : '#c8ead8'}`,
              }}
            >
              <span className="text-2xl">{lang.flag}</span>
              <div className="text-left">
                <p className="text-sm font-semibold" style={{ color: current === lang.code ? '#16a34a' : '#0f2d1e' }}>{lang.name}</p>
              </div>
              {current === lang.code && (
                <svg className="ml-auto" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
