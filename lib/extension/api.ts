import "server-only";
import { NextResponse } from "next/server";

/*
  The browser-extension edge of the MIDO XI API.

  AUTH MODEL — deliberately boring: the extension holds NO credentials.
  Chrome treats a fetch from an extension page as same-site with any
  host the extension has host_permissions for, so the player's existing
  Supabase session cookies ride along on `credentials: "include"` and
  the route authenticates exactly the way every page in the app does —
  supabase.auth.getUser() against the cookie session. Nothing to store,
  nothing to leak, nothing to expire separately: signed in to MIDO XI
  in the browser means signed in in the extension.

  What that model buys must be paid for in CSRF care, because a
  cookie-authenticated endpoint trusts the browser, and the browser can
  be pointed at us by anyone. Hence the Origin gate below: a state-
  changing request is accepted only from the app itself or from an
  allowlisted chrome-extension:// origin. A cross-site <form> or fetch
  from a web page carries its own page's Origin and is refused before
  any handler logic runs.

  MIDO_EXTENSION_IDS pins which extensions count. The first version
  failed OPEN when it was unset — any chrome-extension:// origin got a
  credentialed pass, in production, on the strength of a docs checklist
  nobody enforces. Now it fails open only outside production: in a
  production build with the var missing, every extension origin is
  refused, and the capture API tells the extension why.
*/

const IS_PROD = process.env.NODE_ENV === "production";

const APP_ORIGINS = new Set(
  [
    process.env.NEXT_PUBLIC_APP_URL,
    // Local dev origins only exist off production — shipping them in a
    // production allowlist hands any local page a credentialed pass.
    ...(IS_PROD ? [] : ["http://localhost:3000", "http://localhost:3100"]),
  ]
    .filter((v): v is string => Boolean(v))
    .map((v) => {
      try {
        return new URL(v).origin;
      } catch {
        return "";
      }
    })
    .filter(Boolean),
);

function allowedExtensionIds(): string[] | null {
  const raw = process.env.MIDO_EXTENSION_IDS?.trim();
  // Unset: any extension origin in dev (unpacked ids change constantly),
  // NO extension origin in production. Fail closed where it matters.
  if (!raw) return IS_PROD ? [] : null;
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

/** Is this Origin allowed to speak to the extension API? */
export function originAllowed(origin: string | null): boolean {
  // No Origin header: not a browser cross-site request (curl, some
  // same-origin GETs). Nothing to CSRF — cookies without a browser
  // don't exist, and same-origin is the app itself.
  if (!origin) return true;
  if (APP_ORIGINS.has(origin)) return true;
  if (origin.startsWith("chrome-extension://")) {
    const ids = allowedExtensionIds();
    if (!ids) return true;
    return ids.includes(origin.slice("chrome-extension://".length));
  }
  return false;
}

/**
 * CORS headers for an allowed extension origin.
 *
 * Chrome exempts host-permitted extension fetches from CORS, so these
 * are belt-and-braces — but the belt costs three headers and keeps the
 * API honest if that exemption ever narrows. Never a wildcard: ACAO
 * with credentials must name the origin.
 */
export function corsHeaders(origin: string | null): Record<string, string> {
  // Any ALLOWED origin is reflected — extension origins for the popup,
  // and the app origins themselves so a localhost:3000 dev harness can
  // read responses from a dev server on 3100. Never a disallowed one.
  if (!origin || !originAllowed(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
}

export function extensionJson(
  request: Request,
  body: Record<string, unknown>,
  status = 200,
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: corsHeaders(request.headers.get("origin")),
  });
}

/** 403 for a disallowed Origin; null when the request may proceed. */
export function refuseBadOrigin(request: Request): NextResponse | null {
  const origin = request.headers.get("origin");
  if (originAllowed(origin)) return null;
  return NextResponse.json({ ok: false, error: "Origin not allowed." }, { status: 403 });
}

/** Shared OPTIONS preflight handler for the extension routes. */
export function preflight(request: Request): NextResponse {
  const origin = request.headers.get("origin");
  if (!originAllowed(origin)) return new NextResponse(null, { status: 403 });
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...corsHeaders(origin),
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "600",
    },
  });
}

/** Bounded JSON body read: null on bad JSON or a body past the cap. */
export async function readJsonBody(
  request: Request,
  maxBytes = 16_000,
): Promise<Record<string, unknown> | null> {
  try {
    const text = await request.text();
    if (text.length > maxBytes) return null;
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}
