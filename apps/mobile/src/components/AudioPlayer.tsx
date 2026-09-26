import { useState, useEffect, useRef } from 'react';

interface Props {
  locationName: string;
  language: string;
}

export default function AudioPlayer({ locationName, language }: Props) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0.18);
  const [speed, setSpeed] = useState(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => {
        setProgress((p) => Math.min(p + 0.003, 1));
      }, 100);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing]);

  const totalSeconds = 142;
  const current = Math.floor(progress * totalSeconds);
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const speeds = [0.75, 1, 1.25, 1.5, 2];
  const nextSpeed = () => {
    const i = speeds.indexOf(speed);
    setSpeed(speeds[(i + 1) % speeds.length]);
  };

  const bars = Array.from({ length: 40 }, (_, i) => {
    const h = 8 + Math.sin(i * 0.7) * 6 + Math.sin(i * 1.3) * 4 + Math.random() * 4;
    return Math.max(4, Math.min(24, h));
  });

  return (
    <div className="rounded-2xl p-4" style={{ background: '#ffffff', border: '1px solid #c8ead8' }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: '#bbf7d0' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#16a34a"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: '#0f2d1e' }}>{locationName}</p>
          <p className="text-xs" style={{ color: '#16a34a' }}>{language}</p>
        </div>
        <button onClick={nextSpeed} className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: '#c8ead8', color: '#5a8a6e' }}>
          {speed}×
        </button>
      </div>

      {/* Waveform */}
      <div className="flex items-center gap-px mb-3" style={{ height: 32 }}>
        {bars.map((h, i) => {
          const filled = i / bars.length < progress;
          return (
            <div
              key={i}
              className="flex-1 rounded-full transition-all"
              style={{ height: h, background: filled ? '#16a34a' : '#c8ead8', cursor: 'pointer' }}
              onClick={() => setProgress(i / bars.length)}
            />
          );
        })}
      </div>

      <div className="flex items-center justify-between mb-3">
        <span className="text-xs" style={{ color: '#6b9e80' }}>{fmt(current)}</span>
        <span className="text-xs" style={{ color: '#6b9e80' }}>{fmt(totalSeconds)}</span>
      </div>

      <div className="flex items-center justify-center gap-6">
        <button onClick={() => setProgress((p) => Math.max(0, p - 0.07))} className="transition-opacity active:opacity-60">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5a8a6e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 19 2 12 11 5 11 19"/>
            <line x1="22" y1="5" x2="22" y2="19"/>
          </svg>
        </button>
        <button
          onClick={() => setPlaying(!playing)}
          className="flex items-center justify-center rounded-full transition-transform active:scale-95"
          style={{ width: 48, height: 48, background: 'linear-gradient(135deg, #16a34a, #15803d)' }}
        >
          {playing ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          )}
        </button>
        <button onClick={() => setProgress((p) => Math.min(1, p + 0.07))} className="transition-opacity active:opacity-60">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5a8a6e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 19 22 12 13 5 13 19"/>
            <line x1="2" y1="5" x2="2" y2="19"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
