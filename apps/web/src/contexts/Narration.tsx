import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from '../services/api';
import { useSession } from './Session';
import type { PublicPoi } from '../types';
import { UniqueQueue } from '../lib/queue';
type Entry = { id: number; poi: PublicPoi; language: string; trigger: string; token: string };
type Current = { name: string; mode: string; elapsed: number; duration: number };
const Context = createContext<{ current: Current | null; pending: number; error: string; playing: boolean; busy: boolean; enqueue: (poi: PublicPoi, trigger?: string, token?: string) => Promise<void>; toggle: () => void; stop: () => void; seek: (n: number) => void }>(null!);
export function NarrationProvider({ children }: { children: ReactNode }) {
  const { language, guest, setGuest } = useSession(); const [current, setCurrent] = useState<Current | null>(null); const [error, setError] = useState(''); const [playing, setPlaying] = useState(false); const [pending, setPending] = useState(0); const [busy, setBusy] = useState(false);
  const queue = useRef(new UniqueQueue<Entry>()); const audio = useRef<HTMLAudioElement | null>(null); const speaking = useRef<SpeechSynthesisUtterance | null>(null); const running = useRef(false); const version = useRef(0); const activeId = useRef<number | undefined>(undefined); const finish = useRef<() => void>(() => {}); const preparing = useRef(new Set<number>());
  const pump = useRef<() => Promise<void>>(async () => {});
  const stop = useCallback(() => { version.current++; queue.current.clear(); preparing.current.clear(); audio.current?.pause(); if ('speechSynthesis' in window) speechSynthesis.cancel(); finish.current(); audio.current = null; speaking.current = null; running.current = false; activeId.current = undefined; setCurrent(null); setPlaying(false); setPending(0); setBusy(false); }, []);
  useEffect(() => { stop(); return stop; }, [language, stop]);
  useEffect(() => { const hide = () => { if (document.hidden) stop(); }; document.addEventListener('visibilitychange', hide); return () => document.removeEventListener('visibilitychange', hide); }, [stop]);
  pump.current = async () => {
    if (running.current) return;
    const entry = queue.current.shift(); setPending(queue.current.size); if (!entry) return;
    running.current = true; activeId.current = entry.id; const run = version.current; let objectUrl = ''; let seconds = 0; let played = false;
    setBusy(true); setError('');
    try {
      const detail = await api.authorizedPoi(entry.id, entry.language, entry.token);
      if (run !== version.current) return;
      const tracks = (detail.audioTracks || []) as (NonNullable<PublicPoi['audioTracks']>[number] & { ttsText?: string })[];
      const track = tracks.find(t => t.isAvailable) || tracks.find(t => t.ttsText);
      if (!track) throw new Error('Chưa có audio hoặc TTS cho ngôn ngữ này.');
      setCurrent({ name: detail.name, mode: track.isAvailable ? 'File audio' : 'TTS', elapsed: 0, duration: track.durationSeconds || 0 });
      if (track.isAvailable) {
        const blob = await api.audioBlob(track.audioTrackId || track.id, entry.token); if (run !== version.current) return;
        objectUrl = URL.createObjectURL(blob); const element = new Audio(objectUrl); audio.current = element;
        await new Promise<void>((resolve, reject) => {
          finish.current = resolve;
          element.onended = () => resolve(); element.onerror = () => reject(new Error('File audio không phát được.'));
          element.onplaying = () => { played = true; setPlaying(true); setBusy(false); };
          element.onpause = () => setPlaying(false);
          let previous = 0;
          element.ontimeupdate = () => { const delta = element.currentTime - previous; if (delta > 0 && delta < 2) seconds += delta; previous = element.currentTime; setCurrent(c => c && ({ ...c, elapsed: element.currentTime, duration: Number.isFinite(element.duration) ? element.duration : c.duration })); };
          element.play().catch(() => { setError('Trình duyệt yêu cầu thao tác phát. Nhấn nút phát để tiếp tục.'); setBusy(false); });
        });
      } else {
        if (!('speechSynthesis' in window)) throw new Error('Trình duyệt chưa hỗ trợ TTS.');
        const voices = speechSynthesis.getVoices(); const voice = voices.find(v => v.lang.toLowerCase().startsWith(entry.language.toLowerCase()));
        if (voices.length && !voice) throw new Error('Thiết bị chưa có giọng TTS cho ngôn ngữ này. Hãy chọn file audio hoặc cài giọng phù hợp.');
        await new Promise<void>((resolve, reject) => {
          const utterance = new SpeechSynthesisUtterance(track.ttsText!); utterance.lang = entry.language; if (voice) utterance.voice = voice; speaking.current = utterance; finish.current = resolve;
          let started = 0; let timer: ReturnType<typeof setInterval> | undefined;
          utterance.onstart = () => { played = true; started = performance.now(); setPlaying(true); setBusy(false); timer = setInterval(() => { if (!speechSynthesis.paused) seconds += 0.5; setCurrent(c => c && ({ ...c, elapsed: seconds })); }, 500); };
          const done = () => { if (timer) clearInterval(timer); if (started && seconds === 0) seconds = (performance.now() - started) / 1000; resolve(); };
          finish.current = done; utterance.onend = done; utterance.onerror = e => { if (timer) clearInterval(timer); if (e.error === 'canceled' || e.error === 'interrupted') resolve(); else reject(new Error(`TTS thất bại: ${e.error}`)); };
          speechSynthesis.speak(utterance);
        });
      }
      if (played) { try { if (track.isAvailable) await api.playLog(track.audioTrackId || track.id, entry.language, entry.trigger, seconds); else await api.ttsLog(entry.id, entry.language, entry.trigger, seconds, entry.token); } catch { if (run === version.current) setError('Đã phát, nhưng chưa gửi được nhật ký lượt nghe.'); } }
    } catch (e) { if (run === version.current) setError(e instanceof Error ? e.message : 'Không phát được thuyết minh.'); }
    finally { if (objectUrl) URL.revokeObjectURL(objectUrl); if (run === version.current) { audio.current = null; speaking.current = null; running.current = false; activeId.current = undefined; setPlaying(false); setBusy(false); setCurrent(null); void pump.current(); } }
  };
  async function enqueue(poi: PublicPoi, trigger = 'manual', suppliedToken?: string) {
    if (activeId.current === poi.id || preparing.current.has(poi.id)) return;
    preparing.current.add(poi.id); const run = version.current; setError('');
    try { let token = suppliedToken || guest; if (!token || !(await api.validate(token)).isValid) { const result = await api.startTarget('poi', poi.id); if (!result.accessToken) throw new Error('Nội dung cần quyền nghe. Hãy quét QR tại điểm tham quan.'); token = result.accessToken; if (run === version.current) setGuest(token); }
      if (run !== version.current) return;
      queue.current.add({ id: poi.id, poi, trigger, language, token }); setPending(queue.current.size); void pump.current();
    } catch (e) { if (run === version.current) setError(e instanceof Error ? e.message : 'Không mở được quyền nghe.'); } finally { preparing.current.delete(poi.id); }
  }
  const toggle = () => { if (audio.current) { if (audio.current.paused) void audio.current.play().catch(() => setError('Không thể phát audio.')); else audio.current.pause(); } else if (speaking.current) { if (speechSynthesis.paused) { speechSynthesis.resume(); setPlaying(true); } else { speechSynthesis.pause(); setPlaying(false); } } };
  return <Context.Provider value={{ current, pending, error, playing, busy, enqueue, toggle, stop, seek: n => { if (audio.current) audio.current.currentTime = n; } }}>{children}</Context.Provider>;
}
export const useNarration = () => useContext(Context);
