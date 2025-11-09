import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { useService } from './useService';

export function usePolling(interval = 5000, enabled = false) {
  const { address, isConnected } = useAccount();
  const pollingService = useService('polling');
  const [messages, setMessages] = useState<number | null>(null);

  useEffect(() => {
    // Only poll if enabled and all required conditions are met
    if (!enabled || !pollingService || !isConnected || !address) {
      return;
    }

    let stopped = false;
    const stop = pollingService.startPolling(
      address,
      (newCount: number) => {
        if (!stopped) setMessages(newCount);
      },
      interval
    );

    return () => {
      stopped = true;
      stop?.();
    };
  }, [pollingService, isConnected, address, interval, enabled]);

  return messages;
}
