import { useCallback } from "react";
import { useService } from "./useService"

const MESSAGE_COUNT_KEY = "messageCount";

const normalizeCount = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, value);
  }

  const parsed = parseInt(String(value ?? "0"), 10);
  if (Number.isNaN(parsed)) {
    return 0;
  }

  return Math.max(0, parsed);
};

export interface UseMessageCountResult {
  getMessageCount: () => Promise<number>;
  setMessageCount: (count: number) => Promise<void>;
  decrementMessageCount: () => Promise<number>;
}

export const useMessageCount = (): UseMessageCountResult => {
  const storage = useService('localStorage');

  const getMessageCount = useCallback(async (): Promise<number> => {
    const stored = await Promise.resolve(
      storage?.get(MESSAGE_COUNT_KEY)
    );

    return normalizeCount(stored);
  }, [storage]);

  const setMessageCount = useCallback(
    async (count: number): Promise<void> => {
      const normalized = normalizeCount(count);
      storage?.set(MESSAGE_COUNT_KEY, normalized);
    },
    [storage]
  );

  const decrementMessageCount = useCallback(async (): Promise<number> => {
    const current = await getMessageCount();
    const next = Math.max(0, current - 1);
    await setMessageCount(next);
    return next;
  }, [getMessageCount, setMessageCount]);

  return {
    getMessageCount,
    setMessageCount,
    decrementMessageCount,
  };
};

export default useMessageCount;
