import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env, isSupabaseConfigured } from "@/lib/env";

/**
 * Refreshes the Supabase session on every request and enforces route
 * protection. In demo mode (no keys) it passes everything through so the
 * seed experience stays reachable.
 */
export async function updateSession(request: NextRequest) {
  if (!isSupabaseConfigured) return NextResponse.next({ request });

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  /*
    Do not run code between createServerClient and getUser().

    Deliberately NOT the cached `getAuthUser()` used everywhere else.
    This runs in the proxy, before rendering begins and in its own
    context, so React's per-request cache does not reach it — and it
    needs THIS client, the one wired to write refreshed cookies back
    onto the response. One verification here, one shared by the whole
    render: two in total, which is the floor.
  */
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAppRoute = pathname === "/app" || pathname.startsWith("/app/");

  // Unauthenticated user hitting a protected route → login.
  if (!user && isAppRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Authenticated user hitting an auth page → into the app.
  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
