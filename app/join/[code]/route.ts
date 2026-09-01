import { NextResponse } from "next/server";
import { attributeReferral, recordVisit } from "@/lib/data/referrals";
import { REFERRAL_COOKIE, REFERRAL_COOKIE_DAYS } from "@/lib/data/referral-cookie";
import { isPlausibleReferralCode, normaliseReferralCode } from "@/lib/data/referral-types";
import { getAuthUser } from "@/lib/supabase/server";
import { env } from "@/lib/env";

/*
  Where a referral link lands.

  A route handler rather than a page, because setting a cookie is a thing only a
  route handler or a server action may do — a page that tries throws, and losing
  the attribution is the whole feature.

  It counts the click without recording anything about who clicked, then splits
  on whether anyone is signed in:

    SIGNED OUT  remember the code and send them to signup, where the account
                they are about to create claims it. Unchanged.

    SIGNED IN   they are not a signup and never will be, so sending them to a
                signup form was a dead end — which is exactly what this did
                until migration 0042, and it silently wasted every link shared
                with an existing free user. Attach the code to the account they
                already have and take them to Membership, where the
                subscription that pays both of them is one click away.

  The cookie holds six characters and nothing else. It is `lax` because the
  click that sets it arrives from wherever the link was shared, and it is not
  http-only so the signup form can show the visitor what they came in on.
*/

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/join/[code]">) {
  const { code } = await ctx.params;
  const clean = normaliseReferralCode(code);

  if (!isPlausibleReferralCode(clean)) {
    return NextResponse.redirect(new URL("/signup", env.appUrl));
  }

  // Never let a counter failure cost us the signup.
  await recordVisit(clean).catch(() => {});

  /*
    Signed in? Attach it here and now. Anything that goes wrong is reported to
    them on the far side rather than thrown — a referral link must never be
    able to break for the person who followed it in good faith.
  */
  const user = await getAuthUser().catch(() => null);
  if (user) {
    const outcome = await attributeReferral(clean).catch(() => null);
    const reason = outcome?.reason ?? "failed";
    const res = NextResponse.redirect(new URL(`/app/membership?referral=${reason}`, env.appUrl));
    // Spent either way: a code that was refused for this account will keep
    // being refused, and leaving it set would re-run on the next signup.
    res.cookies.delete(REFERRAL_COOKIE);
    return res;
  }

  const res = NextResponse.redirect(new URL(`/signup?ref=${clean}`, env.appUrl));
  res.cookies.set(REFERRAL_COOKIE, clean, {
    maxAge: REFERRAL_COOKIE_DAYS * 24 * 60 * 60,
    httpOnly: false,
    sameSite: "lax",
    path: "/",
  });
  return res;
}
