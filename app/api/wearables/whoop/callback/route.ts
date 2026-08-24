import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { env, hasWhoop } from "@/lib/env";
import { exchangeCode, saveConnection, syncWhoop, whoopProfile } from "@/lib/health/whoop";

export const dynamic = "force-dynamic";

/*
  Come back from WHOOP.

  Everything is checked before the code is spent:

    · the player is signed in — a connection has to belong to somebody;
    · `state` matches the cookie set at the start, which is what stops an
      attacker attaching THEIR WHOOP account to a signed-in player's
      profile by walking them through a prepared callback;
    · the cookie is cleared either way, so a state value is good once.

  Errors come back as a short code in the URL rather than a stack trace
  on a blank page. The Recovery page turns each one into a sentence.
*/
function back(reason: string) {
  return NextResponse.redirect(`${env.appUrl}/app/recovery?whoop=${reason}`);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jar = await cookies();
  const expected = jar.get("whoop_state")?.value ?? null;
  // Single-use, whatever happens next.
  jar.delete("whoop_state");

  if (!hasWhoop) return back("unconfigured");

  // WHOOP sends this when somebody presses Cancel on the consent screen.
  const denied = searchParams.get("error");
  if (denied) return back("denied");

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  if (!code || !state) return back("incomplete");
  if (!expected || state !== expected) return back("state");

  const supabase = await createClient();
  if (!supabase) return NextResponse.redirect(`${env.appUrl}/login`);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${env.appUrl}/login`);

  try {
    const token = await exchangeCode(code);
    const connectionId = await saveConnection(user.id, "whoop", token, null);
    if (!connectionId) return back("save");

    /*
      Record who WHOOP thinks this is, so a later reconnect updates the
      same row. Not fatal if it fails — the connection is already usable
      and refusing it over a missing display detail would be silly.
    */
    try {
      const profile = await whoopProfile(connectionId);
      if (profile?.user_id) {
        const { createAdminClient } = await import("@/lib/supabase/server");
        const admin = createAdminClient();
        await admin
          ?.from("provider_connections")
          .update({ external_user_id: String(profile.user_id) })
          .eq("id", connectionId);
      }
    } catch {
      // Deliberately swallowed; see above.
    }

    // Sync immediately. A freshly connected wearable that shows an empty
    // page until some later job runs reads as broken.
    const result = await syncWhoop(user.id, connectionId, 30);
    return back(result.ok ? "connected" : "syncfailed");
  } catch {
    // The message may carry the authorization code; it does not go in a URL.
    return back("failed");
  }
}
