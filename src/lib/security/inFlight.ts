// In-flight de-duplication: while a call for `key` is pending, later calls
// with the same key share its promise instead of sending a second request
// (double taps, two screens asking at once). The entry is removed when the
// call settles, success or failure, so a later call runs again. Pure.

export type InFlight = {
  run<T>(key: string, fn: () => Promise<T>): Promise<T>;
  size(): number;
};

export function createInFlight(): InFlight {
  const pending = new Map<string, Promise<unknown>>();
  return {
    run<T>(key: string, fn: () => Promise<T>): Promise<T> {
      const existing = pending.get(key);
      if (existing) return existing as Promise<T>;
      // async wrapper: a synchronous throw in fn becomes a rejection.
      const tracked: Promise<T> = (async () => fn())().finally(() => {
        if (pending.get(key) === tracked) pending.delete(key);
      });
      pending.set(key, tracked);
      return tracked;
    },
    size: () => pending.size,
  };
}
