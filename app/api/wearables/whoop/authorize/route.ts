import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { env, hasWhoop } from "@/lib/env";
import { whoopAuthorizeUrl } from "@/lib/health/whoop";

export const dynamic = "force-dynamic";

/*
  Start the WHOOP handshake.

  The `state` parameter is the CSRF defence for OAuth, and it only works
  if it is checked. A random value goes into an httpOnly cookie and into
  the URL; the callback refuses anything where the two do not match.
  Without it, an attacker can walk a signed-in player through a callback
  carrying the attacker's authorization code and quietly attach their own
  WHOOP account to the player's profile.

  Ten minutes is deliberately short. This cookie is only alive for the
  round trip to WHOOP and back.
*/
export async function GET() {
  if (!hasWhoop) {
    return NextResponse.redirect(`${env.appUrl}/app/recovery?whoop=unconfigured`);
  }

  const supabase = await createClient();
  if (!supabase) return NextResponse.redirect(`${env.appUrl}/login`);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${env.appUrl}/login`);

  const state = crypto.randomUUID();
  const jar = await cookies();
  jar.set("whoop_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.appUrl.startsWith("https://"),
    path: "/",
    maxAge: 600,
  });

  return NextResponse.redirect(whoopAuthorizeUrl(state));
}
