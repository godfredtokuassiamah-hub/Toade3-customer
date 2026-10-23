// The app's fallback runner: BACKEND_MODE + __DEV__ + the Supabase session.
// Services call backend.run({...}); see ./fallback.ts for the rules.
import { isDevSession } from "../auth/devLogin";
import { supabase } from "../supabase";
import { BACKEND_MODE } from "./config";
import { BackendError, mapBackendError } from "./errors";
import { createFallbackRunner } from "./fallback";

// A real Supabase session; the dev login never has one.
export async function hasSupabaseSession(): Promise<boolean> {
  if (isDevSession()) return false;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session != null;
  } catch {
    return false;
  }
}

export async function currentUserId(): Promise<string | null> {
  if (isDevSession()) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

export const backend = createFallbackRunner({
  mode: BACKEND_MODE,
  isDev: __DEV__,
  hasSession: hasSupabaseSession,
  log: (message) => console.log(message),
});

// Throws a mapped BackendError for a Supabase { error, status } result.
export function raise(error: unknown, status?: number): never {
  throw mapBackendError(error, status);
}

// Unwraps a Supabase response: data, or a thrown BackendError.
export function unwrap<T>(res: { data: T | null; error: unknown; status?: number }): T {
  if (res.error) raise(res.error, res.status);
  if (res.data == null) throw new BackendError("UNKNOWN", "Empty response", { status: res.status });
  return res.data;
}
