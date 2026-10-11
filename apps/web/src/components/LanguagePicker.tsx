import { useCallback } from 'react';
import { Languages } from 'lucide-react';
import { useSession } from '../contexts/Session';
import { useResource } from '../hooks/useResource';
import { api } from '../services/api';
export function LanguagePicker() { const { language, setLanguage } = useSession(); const resource = useResource(useCallback(() => api.languages(), [])); return <label className="language-picker"><Languages size={17}/><select aria-label="Ngôn ngữ thuyết minh" value={language} onChange={e => setLanguage(e.target.value)}>{!resource.data?.some(l => l.code === language) && <option value={language}>{language.toUpperCase()}</option>}{resource.data?.map(l => <option key={l.code} value={l.code}>{l.nativeName || l.name}</option>)}</select>{resource.error && <button title={resource.error} onClick={() => void resource.reload()} type="button">↻</button>}</label>; }
