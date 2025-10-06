import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import ServiceContainer from '../services/ServiceContainer';
import { useAccount, useChainId } from 'wagmi';

type Ctx = { container: ServiceContainer | null };
const ServicesContext = createContext<Ctx>({ container: null });

export const ServicesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { address } = useAccount();
  const chainId = useChainId();

  const key = address && chainId ? `${address}:${chainId}` : null;

  const [container, setContainer] = useState<ServiceContainer | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // No identity yet, clear any existing container
      if (!key) {
        if (container) {
          await container.dispose().catch(() => {});
        }
        if (!cancelled) setContainer(null);
        return;
      }

      // Same key, keep current
      if (container?.key === key) return;

      // Replace previous
      if (container) {
        await container.dispose().catch(() => {});
      }

      const instance = new ServiceContainer(address!, chainId);
      if (!cancelled) {
        setContainer(instance);
      } else {
        await instance.dispose().catch(() => {});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [key, address, chainId]); // depends on wallet identity

  // Dispose on unmount
  useEffect(() => {
    return () => {
      container?.dispose().catch(() => {});
    };
  }, [container]);

  const ctx = useMemo<Ctx>(() => ({ container }), [container]);

  return (
    <ServicesContext.Provider value={ctx}>
      {children}
    </ServicesContext.Provider>
  );
};

export function useContainer(): ServiceContainer | null {
  return useContext(ServicesContext).container;
}

export default ServicesContext;
