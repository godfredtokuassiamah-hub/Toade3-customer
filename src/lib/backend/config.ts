// The ONE switch for where catalog / store / cart / order data comes from.
//
//   'auto'   (default) try Supabase; if the backend isn't deployed yet
//            (missing table/function: 42P01, 42883, PGRST202, PGRST205, 404)
//            fall back to the local mock data. Network failures fall back in
//            __DEV__ only. Real errors (business codes, 401/403, 5xx) are
//            never hidden. See src/lib/backend/fallback.ts.
//   'remote' always Supabase; every error propagates (use once the admin
//            has run supabase/migrations 0004-0008).
//   'mock'   never call Supabase; local mock data only.
export type BackendMode = "auto" | "remote" | "mock";

export const BACKEND_MODE: BackendMode = "auto";
