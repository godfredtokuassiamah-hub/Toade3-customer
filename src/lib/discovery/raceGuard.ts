// Race protection (§12): a response is accepted only when its request
// sequence, query fingerprint AND context revision all still match the
// latest request. Cancellation alone is not enough (a resolved promise can
// race the abort).

export type RequestToken = {
  seq: number;
  fingerprint: string;
  contextRevision: number;
};

export type RequestTracker = {
  next: (fingerprint: string, contextRevision: number) => RequestToken;
  // Drops the latest request (close, edit during Apply, context change).
  invalidate: () => void;
  accept: (
    token: RequestToken,
    responseContextRevision: number,
    current: { fingerprint: string; contextRevision: number },
  ) => boolean;
};

export function createRequestTracker(): RequestTracker {
  let seq = 0;
  let latest: RequestToken | null = null;
  return {
    next(fingerprint, contextRevision) {
      seq += 1;
      latest = { seq, fingerprint, contextRevision };
      return latest;
    },
    invalidate() {
      seq += 1;
      latest = null;
    },
    accept(token, responseContextRevision, current) {
      return (
        latest !== null &&
        token.seq === latest.seq &&
        token.fingerprint === current.fingerprint &&
        token.contextRevision === current.contextRevision &&
        responseContextRevision === current.contextRevision
      );
    },
  };
}
