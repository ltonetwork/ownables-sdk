import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import ServiceContainer from '../services/ServiceContainer';
import { useAccount, useChainId } from 'wagmi';

type Ctx = { container: ServiceContainer };
const ServicesContext = createContext<Ctx | undefined>(undefined);

export const ServicesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { address } = useAccount();
  const chainId = useChainId();

  // Build a stable key only when both are known
  const key = address && chainId ? `${address}:${chainId}` : null;

  // Hold the live instance
  const ref = useRef<ServiceContainer | null>(null);
  const [ready, setReady] = useState(false); // gates children

  // Create/replace exactly once per key
  useEffect(() => {
    let cancelled = false;

    async function make() {
      // Wait until we have a key
      if (!key) {
        // no identity yet, ensure no instance and keep children gated
        if (ref.current) {
          await ref.current.dispose().catch(() => {});
          ref.current = null;
        }
        setReady(false);
        return;
      }

      // If same key, do nothing
      if ((ref.current as any)?.__key === key) {
        setReady(true);
        return;
      }

      // Replace previous
      if (ref.current) {
        await ref.current.dispose().catch(() => {});
        ref.current = null;
        setReady(false);
      }

      // Create once for this key
      const instance = new ServiceContainer(address!, chainId);
      (instance as any).__key = key; // tag for identity
      if (!cancelled) {
        ref.current = instance;
        setReady(true);
      } else {
        // if unmounted mid-create, dispose
        await instance.dispose().catch(() => {});
      }
    }

    make();
    return () => { cancelled = true; };
  }, [key, address, chainId]);

  // Stable context value, identity only changes when we actually swapped instance
  const ctx = useMemo<Ctx | undefined>(
    () => (ref.current ? { container: ref.current } : undefined),
    [ready] // flips to true when instance is set
  );

  // Dispose on unmount
  useEffect(() => {
    return () => { ref.current?.dispose().catch(() => {}); ref.current = null; };
  }, []);

  // Gate children until we have a live container
  if (!ctx) return null; // or a tiny loader

  return (
    <ServicesContext.Provider value={ctx}>
      {children}
    </ServicesContext.Provider>
  );
};

export function useContainer(): ServiceContainer {
  const ctx = useContext(ServicesContext);
  if (!ctx) throw new Error('useContainer must be used within ServicesProvider');
  return ctx.container;
}

export default ServicesContext;
