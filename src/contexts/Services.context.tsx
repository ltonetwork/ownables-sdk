import React, { createContext, useContext, useEffect, useMemo } from 'react';
import ServiceContainer from '../services/ServiceContainer';
import { useAccount, useChainId } from "wagmi"

export interface ServicesContextValue {
  container: ServiceContainer | null;
}

const ServicesContext = createContext<ServicesContextValue>({ container: null });

interface ServicesProviderProps {
  address?: string;
  children: React.ReactNode;
}

export const ServicesProvider: React.FC<ServicesProviderProps> = ({ children }) => {
  const account = useAccount();
  const chainId = useChainId();

  const container = useMemo(() => new ServiceContainer(account?.address, chainId), [account, chainId]);

  // Dispose previous container on address change/unmount
  useEffect(() => {
    return () => {
      container.dispose().catch(() => void 0);
    };
  }, [container]);

  return (
    <ServicesContext.Provider value={{ container }}>
      {children}
    </ServicesContext.Provider>
  );
};

export function useContainer(): ServiceContainer {
  const { container } = useContext(ServicesContext);
  if (!container) throw new Error('useContainer must be used within ServicesProvider');
  return container;
}

export default ServicesContext;
