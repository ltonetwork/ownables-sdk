import { useEffect, useMemo, useState } from 'react';
import { useContainer } from '../contexts/Services.context';
import IDBService from '../services/IDB.service';

export interface UseIDBState {
  service: IDBService | null;
  ready: boolean;
  error: Error | null;
}

export function useIDB(): UseIDBState {
  const container = useContainer();
  const service = useMemo(() => container.get<IDBService>('idb'), [container]);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setError(null);

    service
      .open()
      .then(() => { if (!cancelled) { IDBService.setDefault(service); setReady(true); } })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e : new Error(String(e))); });

    return () => {
      cancelled = true;
      service.close().catch(() => void 0);
    };
  }, [service]);

  return { service, ready, error };
}

export default useIDB;
