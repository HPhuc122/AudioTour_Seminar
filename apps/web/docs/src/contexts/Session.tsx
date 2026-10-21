import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '../types';
import { previewToken } from '../services/preview';
import { vendorDemoToken } from '../services/vendorPreview';
export const managementRoles = ['Admin', 'SuperAdmin', 'ContentAdmin', 'TourOperator', 'Vendor', 'AnalyticsViewer'];
export const writeRoles = ['Admin', 'SuperAdmin', 'ContentAdmin', 'TourOperator', 'Vendor'];
export const adminRoles = ['Admin', 'SuperAdmin'];
export const isPreviewSession = (session: Session | null) => session?.accessToken === previewToken || session?.accessToken === vendorDemoToken;
const Context = createContext<{ session: Session | null; preview: boolean; login: (s: Session) => void; logout: () => void; language: string; setLanguage: (s: string) => void; guest: string; setGuest: (s: string) => void }>(null!);
function readSession(): Session | null { try { const s = JSON.parse(sessionStorage.getItem('audiotour:session') || 'null'); return s && Date.parse(s.expiresAtUtc) > Date.now() ? s : null; } catch { return null; } }
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(readSession);
  const [language, changeLanguage] = useState(localStorage.getItem('audiotour:language') || 'vi');
  const [guest, changeGuest] = useState(sessionStorage.getItem('audiotour:guest') || '');
  const logout = () => { sessionStorage.removeItem('audiotour:session'); setSession(null); };
  useEffect(() => { window.addEventListener('audiotour:unauthorized', logout); return () => window.removeEventListener('audiotour:unauthorized', logout); }, []);
  useEffect(() => { if (!session) return; const timer = setTimeout(logout, Math.max(0, Date.parse(session.expiresAtUtc) - Date.now())); return () => clearTimeout(timer); }, [session]);
  return <Context.Provider value={{ session, preview: isPreviewSession(session), login: s => { sessionStorage.setItem('audiotour:session', JSON.stringify(s)); setSession(s); }, logout, language, setLanguage: s => { localStorage.setItem('audiotour:language', s); changeLanguage(s); }, guest, setGuest: s => { sessionStorage.setItem('audiotour:guest', s); changeGuest(s); } }}>{children}</Context.Provider>;
}
export const useSession = () => useContext(Context);
