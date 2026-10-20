// Debounced, race-guarded discovery preview for the Filters sheet.
// - 250 ms debounce; each new request aborts the previous one.
// - A response is accepted only if sequence + fingerprint + context
//   revision all match (raceGuard), not merely because it wasn't aborted.
// - The last accepted response stays available (stable facets/histogram),
//   but `pending` is true whenever a newer fingerprint is outstanding, so
//   callers must not show its item_count as current.
import { useCallback, useEffect, useRef, useState } from "react";

import { queryFingerprint } from "../../lib/discovery/fingerprint";
import { createRequestTracker } from "../../lib/discovery/raceGuard";
import {
  DiscoveryError,
  type DiscoveryQueryRequest,
  type DiscoveryQueryResponse,
} from "../../lib/discovery/types";
import { discoveryQuery, isAbortError } from "../../services/discovery";

export const PREVIEW_DEBOUNCE_MS = 250;

type Settled = {
  key: string | null;
  response: DiscoveryQueryResponse | null;
  error: DiscoveryError | null;
};

export function useDiscoveryPreview(request: DiscoveryQueryRequest | null): {
  response: DiscoveryQueryResponse | null;
  pending: boolean;
  error: DiscoveryError | null;
  retry: () => void;
} {
  const [settled, setSettled] = useState<Settled>({ key: null, response: null, error: null });
  const [attempt, setAttempt] = useState(0);
  const [tracker] = useState(createRequestTracker);
  const current = useRef<{ fingerprint: string; contextRevision: number }>({
    fingerprint: "",
    contextRevision: -1,
  });
  const key = request == null ? null : JSON.stringify(request);

  useEffect(() => {
    if (key == null) {
      tracker.invalidate();
      return;
    }
    const req = JSON.parse(key) as DiscoveryQueryRequest;
    const fingerprint = queryFingerprint(req);
    current.current = { fingerprint, contextRevision: req.context_revision };
    const token = tracker.next(fingerprint, req.context_revision);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      discoveryQuery(req, controller.signal).then(
        (response) => {
          if (!tracker.accept(token, response.context_revision, current.current)) return;
          setSettled({ key, response, error: null });
        },
        (e: unknown) => {
          if (isAbortError(e) || !tracker.accept(token, req.context_revision, current.current)) return;
          const error =
            e instanceof DiscoveryError ? e : new DiscoveryError("NETWORK", "Results could not load.");
          setSettled((s) => ({ key, response: s.response, error }));
        },
      );
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, attempt, tracker]);

  // Unmount (sheet discarded): nothing pending may land.
  useEffect(() => () => tracker.invalidate(), [tracker]);

  const retry = useCallback(() => {
    setSettled((s) => ({ ...s, key: null, error: null }));
    setAttempt((a) => a + 1);
  }, []);

  const isCurrent = key != null && settled.key === key;
  return {
    response: settled.response,
    pending: key != null && !isCurrent,
    error: isCurrent ? settled.error : null,
    retry,
  };
}
