import { NextResponse } from "next/server";
import { recordVisit } from "@/lib/data/referrals";
import { REFERRAL_COOKIE, REFERRAL_COOKIE_DAYS } from "@/lib/data/referral-cookie";
import { isPlausibleReferralCode, normaliseReferralCode } from "@/lib/data/referral-types";
import { env } from "@/lib/env";

/*
  Where a referral link lands.

  A route handler rather than a page, because setting a cookie is a thing only a
  route handler or a server action may do — a page that tries throws, and losing
  the attribution is the whole feature.

  It does three things and then gets out of the way: counts the click without
  recording anything about who clicked, remembers the code for the signup that
  may follow, and redirects to the page the visitor actually came to see.

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

  const res = NextResponse.redirect(new URL(`/signup?ref=${clean}`, env.appUrl));
  res.cookies.set(REFERRAL_COOKIE, clean, {
    maxAge: REFERRAL_COOKIE_DAYS * 24 * 60 * 60,
    httpOnly: false,
    sameSite: "lax",
    path: "/",
  });
  return res;
}
