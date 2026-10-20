import { useCallback, useEffect, useRef, useState } from 'react';
export function useResource<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T>(); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  const version = useRef(0);
  const reload = useCallback(async () => {
    const id = ++version.current; setLoading(true); setError(''); setData(undefined);
    try { const result = await loader(); if (id === version.current) setData(result); }
    catch (reason) { if (id === version.current) setError(reason instanceof Error ? reason.message : 'Không thể kết nối máy chủ.'); }
    finally { if (id === version.current) setLoading(false); }
  }, [loader]);
  const invalidate = useCallback(() => { version.current++; }, []);
  useEffect(() => { void reload(); return invalidate; }, [reload, invalidate]);
  return { data, error, loading, reload };
}
