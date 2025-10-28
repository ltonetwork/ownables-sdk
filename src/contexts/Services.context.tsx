import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import ServiceContainer from "../services/ServiceContainer";
import { RelayService } from "../services/Relay.service";
import {
  useAccount,
  useChainId,
  useWalletClient,
  usePublicClient,
} from "wagmi";

type Ctx = { container: ServiceContainer | null };
const ServicesContext = createContext<Ctx>({ container: null });

export const ServicesProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { address } = useAccount();
  const chainId = useChainId();
  const walletClient = useWalletClient();
  const publicClient = usePublicClient();

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
      if (container?.key === key) {
        console.log("ServicesProvider: Keeping existing container", { key });
        return;
      }

      // Replace previous
      if (container) {
        console.log("ServicesProvider: Replacing container", {
          oldKey: container.key,
          newKey: key,
          reason: "walletClient.data changed during transaction",
        });
        const [oldAddress, oldChainId] = container.key.split(":");
        if (oldAddress && oldChainId) {
          RelayService.clearWalletAuth(oldAddress, parseInt(oldChainId));
        }
        await container.dispose().catch(() => {});
      }

      const instance = new ServiceContainer(
        address!,
        chainId,
        walletClient.data || undefined,
        publicClient || undefined
      );
      if (!cancelled) {
        setContainer(instance);
      } else {
        await instance.dispose().catch(() => {});
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, address, chainId, publicClient]); // removed walletClient.data - it changes during transactions

  // Dispose on unmount
  useEffect(() => {
    return () => {
      container?.dispose().catch(() => {});
    };
  }, [container]);

  const ctx = useMemo<Ctx>(() => ({ container }), [container]);

  return (
    <ServicesContext.Provider value={ctx}>{children}</ServicesContext.Provider>
  );
};

export function useContainer(): ServiceContainer | null {
  return useContext(ServicesContext).container;
}

export default ServicesContext;
