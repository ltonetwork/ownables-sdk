import * as React from "react";

export default function useBusy(initialState = false): [boolean, <T>(promise: Promise<T>) => Promise<T>] {
  const [isBusy, setIsBusy] = React.useState(initialState);

  async function busy<T>(promise: Promise<T>): Promise<T> {
    setIsBusy(true);
    try {
      return await promise;
    } finally {
      setIsBusy(false);
    }
  }

  return [isBusy, busy];
}
