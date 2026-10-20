import { useCallback, useEffect, useState } from "react";
import { isAbortError } from "../../services/discovery";

type Settled<R> = { key: string | null; data: R | null; error: boolean };

// Debounced, latest-wins request. Each params change aborts the previous
// request (its timer and its in-flight promise), so an older response can
// never overwrite a newer one; results are also tagged with the params key
// they belong to. Pass null params to pause. `run` must be stable (a
// module-level function).
export function useDebouncedRequest<P, R>(
  params: P | null,
  run: (params: P, signal: AbortSignal) => Promise<R>,
  delayMs: number,
): { data: R | null; pending: boolean; error: boolean; retry: () => void } {
  const [settled, setSettled] = useState<Settled<R>>({ key: null, data: null, error: false });
  const [attempt, setAttempt] = useState(0);
  const key = params == null ? null : JSON.stringify(params);

  useEffect(() => {
    if (key == null) return;
    const controller = new AbortController();
    const parsed = JSON.parse(key) as P;
    const timer = setTimeout(() => {
      run(parsed, controller.signal).then(
        (data) => {
          if (!controller.signal.aborted) setSettled({ key, data, error: false });
        },
        (e: unknown) => {
          if (controller.signal.aborted || isAbortError(e)) return;
          setSettled((s) => ({ key, data: s.data, error: true }));
        },
      );
    }, delayMs);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, attempt, delayMs, run]);

  const retry = useCallback(() => {
    setSettled((s) => ({ ...s, key: null, error: false }));
    setAttempt((a) => a + 1);
  }, []);

  const current = key != null && settled.key === key;
  return {
    // Last settled data (may be for older params while pending).
    data: settled.data,
    pending: key != null && !current,
    error: current && settled.error,
    retry,
  };
}
