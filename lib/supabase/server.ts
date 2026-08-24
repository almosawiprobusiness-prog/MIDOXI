import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { env, isSupabaseConfigured } from "@/lib/env";

/**
 * Server Supabase client (RSC, route handlers, server actions).
 * Returns null in demo mode. Uses the current getAll/setAll cookie API.
 */
export async function createClient() {
  if (!isSupabaseConfigured) return null;
  const cookieStore = await cookies();

  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component — safe to ignore; the proxy
          // refreshes the session.
        }
      },
    },
  });
}

/**
 * Who is signed in — verified once per request, however many times it is asked.
 *
 * `supabase.auth.getUser()` is not a local read. It sends the JWT to
 * Supabase's auth server and waits for it to come back verified, which
 * measured at ~131ms against this project. That is the right thing to
 * do — `getSession()` reads a cookie the client could have written, so
 * it can never be the basis of an access decision — but it should
 * happen ONCE.
 *
 * It was happening far more than once. Rendering a single /app page
 * called it in the proxy, again in `getCurrentUser()`, again in the
 * search index, twice more for the notification bell, and again in
 * whatever the page's own adapters needed — six or more serial round
 * trips, ~800ms of waiting, before a line of football data was fetched.
 * Every one of them asked the same question about the same request and
 * got the same answer.
 *
 * React's `cache()` scopes memoisation to a single request, so the
 * second and later callers get the first call's result and no network
 * happens. It is per-request by construction: two people loading a page
 * at the same moment never share an entry, and nothing is retained
 * between requests, so this cannot serve a stale identity.
 */
export const getAuthUser = cache(async () => {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * Service-role client — bypasses RLS. SERVER ONLY. Use exclusively for
 * trusted operations (webhooks, admin jobs). Never import into client code.
 */
export function createAdminClient() {
  if (!env.supabaseUrl || !env.supabaseServiceKey) return null;
  return createServerClient(env.supabaseUrl, env.supabaseServiceKey, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}
