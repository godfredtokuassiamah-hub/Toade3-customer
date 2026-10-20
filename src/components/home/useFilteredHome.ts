// Filtered Home: when Home has applied filters it renders the SERVER's
// filtered sections (discoveryQuery, surface = "home"), never a client-side
// filter of the static cards. Latest request wins (race guard).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { takePrimedResults, useDiscoveryContext } from "../../lib/discovery/discoveryStore";
import type { AppliedDiscovery } from "../../lib/discovery/filterState";
import { queryFingerprint } from "../../lib/discovery/fingerprint";
import { createRequestTracker } from "../../lib/discovery/raceGuard";
import { buildQueryRequest, HOME_RESULTS_LIMIT } from "../../lib/discovery/request";
import type { DiscoveryQueryResponse } from "../../lib/discovery/types";
import { discoveryQuery, isAbortError } from "../../services/discovery";

type Settled = { key: string; response: DiscoveryQueryResponse | null; error: boolean };

export function useFilteredHome(applied: AppliedDiscovery, enabled: boolean) {
  const context = useDiscoveryContext();
  const request = useMemo(
    () => (enabled ? buildQueryRequest(applied, context, "home", "results", HOME_RESULTS_LIMIT, null) : null),
    [enabled, applied, context],
  );
  const key = request ? `${queryFingerprint(request)}|${request.context_revision}` : null;
  const [settled, setSettled] = useState<Settled>({ key: "", response: null, error: false });
  const [attempt, setAttempt] = useState(0);
  const [tracker] = useState(createRequestTracker);
  const current = useRef({ fingerprint: "", contextRevision: -1 });

  useEffect(() => {
    if (!request || key == null) {
      tracker.invalidate();
      return;
    }
    const fp = queryFingerprint(request);
    current.current = { fingerprint: fp, contextRevision: request.context_revision };
    const token = tracker.next(fp, request.context_revision);
    const controller = new AbortController();
    const primed = attempt === 0 ? takePrimedResults(fp, request.context_revision) : null;
    (primed ? Promise.resolve(primed) : discoveryQuery(request, controller.signal)).then(
      (response) => {
        if (!tracker.accept(token, response.context_revision, current.current)) return;
        setSettled({ key, response, error: false });
      },
      (e: unknown) => {
        if (isAbortError(e) || !tracker.accept(token, request.context_revision, current.current)) return;
        setSettled({ key, response: null, error: true });
      },
    );
    return () => controller.abort();
  }, [request, key, attempt, tracker]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  const isCurrent = key != null && settled.key === key;
  return {
    response: isCurrent ? settled.response : null,
    loading: key != null && !isCurrent,
    error: isCurrent && settled.error,
    retry,
  };
}
