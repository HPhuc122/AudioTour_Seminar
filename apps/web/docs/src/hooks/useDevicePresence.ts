import { useEffect } from 'react';
import { baseUrl } from '../services/api';
import type { Session } from '../types';

export function useDevicePresence(session: Session | null) {
  useEffect(() => {
    if (!session) return;
    let deviceId: string;
    try {
      const key = `audiotour:web-device:${session.userId}`;
      const stored = localStorage.getItem(key);
      deviceId = stored && /^web-[a-f0-9-]{36}$/.test(stored) ? stored : `web-${crypto.randomUUID()}`;
      localStorage.setItem(key, deviceId);
    } catch { return; }
    let active = true;
    let pending = false;
    let controller: AbortController | undefined;
    async function heartbeat() {
      if (!active || pending || document.visibilityState !== 'visible' || Date.parse(session!.expiresAtUtc) <= Date.now()) return;
      pending = true;
      controller = new AbortController();
      try {
        await fetch(`${baseUrl}/api/v1/auth/me`, {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${session!.accessToken}`, 'X-Web-Device-Id': deviceId },
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
        });
      } catch { /* Presence must not interrupt the user's current task. */ }
      finally { pending = false; }
    }
    void heartbeat();
    const interval = setInterval(() => void heartbeat(), 60000);
    const visible = () => { if (document.visibilityState === 'visible') void heartbeat(); };
    document.addEventListener('visibilitychange', visible);
    return () => { active = false; clearInterval(interval); controller?.abort(); document.removeEventListener('visibilitychange', visible); };
  }, [session]);
}
