import { useCallback, useMemo } from "react";
import { useContainer } from "../contexts/Services.context";
import LocalStorageService from "../services/LocalStorage.service";

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
  const container = useContainer();
  const localStorageService = useMemo(
    () => container.get<LocalStorageService>("localStorage"),
    [container]
  );

  const getMessageCount = useCallback(async (): Promise<number> => {
    const stored = await Promise.resolve(
      localStorageService.get(MESSAGE_COUNT_KEY)
    );

    return normalizeCount(stored);
  }, [localStorageService]);

  const setMessageCount = useCallback(
    async (count: number): Promise<void> => {
      const normalized = normalizeCount(count);
      await Promise.resolve(
        localStorageService.set(MESSAGE_COUNT_KEY, normalized)
      );
    },
    [localStorageService]
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
