import { useEffect, useRef, useState } from 'react';
import { baseUrl } from '../services/api';

export function GoogleVoicePreview({ text, language, token }: { text: string; language: string; token: string }) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [message, setMessage] = useState('');
  const [playing, setPlaying] = useState(false);
  const active = useRef<SpeechSynthesisUtterance | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const supported = 'speechSynthesis' in window;
  const audio = useRef<HTMLAudioElement | null>(null);
  const url = useRef('');
  const request = useRef<AbortController | null>(null);
  const [audioUrl, setAudioUrl] = useState('');
  useEffect(() => () => {
    request.current?.abort(); audio.current?.pause();
    if (url.current) URL.revokeObjectURL(url.current);
  }, []);
  useEffect(() => {
    if (!supported) return;
    const update = () => setVoices(speechSynthesis.getVoices());
    update(); speechSynthesis.addEventListener('voiceschanged', update);
    return () => {
      speechSynthesis.removeEventListener('voiceschanged', update);
      clearTimeout(timeout.current);
      if (active.current) { active.current = null; speechSynthesis.cancel(); }
    };
  }, [supported]);
  const voice = voices.find(v => /google/i.test(v.name) && v.lang.toLowerCase().split(/[-_]/)[0] === language.toLowerCase().split(/[-_]/)[0]);
  function stop() {
    request.current?.abort(); audio.current?.pause();
    active.current = null; clearTimeout(timeout.current);
    if (supported) speechSynthesis.cancel();
    setPlaying(false); setMessage('Đã dừng đọc.');
  }
  async function play() {
    if (!text.trim()) return;
    stop();
    if (!voice) {
      const controller = new AbortController(); request.current = controller;
      setPlaying(true); setMessage('Đang tạo file âm thanh bằng Google…');
      try {
        const response = await fetch(`${baseUrl}/api/v1/web/google-speech/preview`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ text, language }), signal: controller.signal,
        });
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(typeof body?.detail === 'string' ? body.detail : `Không tạo được giọng Google (${response.status}).`);
        }
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        if (url.current) URL.revokeObjectURL(url.current);
        url.current = URL.createObjectURL(blob); setAudioUrl(url.current);
        setMessage('Đã tạo audio Google. Bấm Phát trên thanh âm thanh bên dưới.');
      } catch (e) {
        if (!controller.signal.aborted) setMessage(e instanceof Error ? e.message : 'Không tạo được giọng đọc Google.');
      } finally { if (!controller.signal.aborted) setPlaying(false); }
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice; utterance.lang = voice.lang; utterance.volume = 1;
    active.current = utterance; setPlaying(true); setMessage('Đang mở giọng đọc…');
    timeout.current = setTimeout(() => {
      if (active.current !== utterance) return;
      stop(); setMessage('Giọng Google chưa phát được. Kiểm tra mạng và quyền âm thanh của trình duyệt, rồi thử lại.');
    }, 10000);
    utterance.onstart = () => { if (active.current === utterance) { clearTimeout(timeout.current); setMessage(`Đang đọc bằng ${voice!.name}`); } };
    utterance.onend = () => { if (active.current === utterance) { clearTimeout(timeout.current); active.current = null; setPlaying(false); setMessage('Đã đọc xong.'); } };
    utterance.onerror = e => { if (active.current === utterance) { clearTimeout(timeout.current); active.current = null; setPlaying(false); setMessage(`Không đọc được: ${e.error}`); } };
    speechSynthesis.resume(); speechSynthesis.speak(utterance);
  }
  return <section aria-label="Nghe văn bản bằng giọng Google">
    <button type="button" disabled={!text.trim() || playing} onClick={() => void play()}>Nghe giọng Google</button>
    <button type="button" disabled={!playing} onClick={stop}>Dừng đọc</button>
    {!voice ? <p>Google Cloud Text-to-Speech · {language}</p> : <p>{voice.name} · {voice.lang}</p>}
    {audioUrl && <audio ref={audio} controls src={audioUrl} onError={() => setMessage('Không phát được file âm thanh Google.')}/>}
    {message && <p role="status">{message}</p>}
  </section>;
}
