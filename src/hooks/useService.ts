import { useEffect, useState } from 'react';
import { useContainer } from '../contexts/Services.context';
import { ServiceKey, ServiceMap } from '../services/ServiceContainer';

export function useService<K extends ServiceKey>(key: K): ServiceMap[K] | null {
  const container = useContainer();
  const [service, setService] = useState<ServiceMap[K] | null>(null);

  useEffect(() => {
    let alive = true;
    container.get(key).then(s => {
      if (alive) setService(s);
    });
    return () => { alive = false; };
  }, [container, key]);

  return service;
}
