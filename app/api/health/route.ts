import { NextResponse } from "next/server";
import { features, isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";

/*
  Health / readiness probe. Public, no secrets. Reports which subsystems are
  wired and whether the database answers. Used by deploy checks and the smoke
  test. Never returns key material — only booleans.
*/

export const dynamic = "force-dynamic";

export async function GET() {
  let db: "ok" | "down" | "n/a" = "n/a";
  if (isSupabaseConfigured) {
    try {
      const admin = createAdminClient();
      if (admin) {
        const { error } = await admin.from("subscription_plans").select("id").limit(1);
        db = error ? "down" : "ok";
      } else {
        db = "n/a"; // service key not present — can't probe past RLS
      }
    } catch {
      db = "down";
    }
  }

  const healthy = !isSupabaseConfigured || db !== "down";

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      mode: isSupabaseConfigured ? "live" : "demo",
      db,
      features: {
        auth: features.auth,
        database: features.database,
        ai: features.ai,
        youtube: features.youtube,
        billing: features.billing,
        email: features.email,
      },
      time: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 },
  );
}
