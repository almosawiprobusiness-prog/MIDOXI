import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
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
 * Service-role client — bypasses RLS. SERVER ONLY. Use exclusively for
 * trusted operations (webhooks, admin jobs). Never import into client code.
 */
export function createAdminClient() {
  if (!env.supabaseUrl || !env.supabaseServiceKey) return null;
  return createServerClient(env.supabaseUrl, env.supabaseServiceKey, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}
