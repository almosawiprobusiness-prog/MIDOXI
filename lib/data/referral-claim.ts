import "server-only";
import { cookies } from "next/headers";
import { attributeReferral } from "./referrals";
import { REFERRAL_COOKIE } from "./referral-cookie";
import { isPlausibleReferralCode, normaliseReferralCode } from "./referral-types";

/*
  Turning a remembered code into an attributed referral.

  This runs at onboarding rather than at signup, for one reason: attribution
  needs `auth.uid()`, and with email confirmation on there is a window where the
  account exists and nobody is signed in. Onboarding is the first moment the new
  account is definitely both real and authenticated.

  It is safe to call on every onboarding load — the database refuses a second
  attribution for an account that already has one — and it never throws, because
  a referral that fails to attach must not block someone from finishing their
  profile.
*/
export async function claimReferralFromCookie(): Promise<{ claimed: boolean }> {
  try {
    const jar = await cookies();
    const raw = jar.get(REFERRAL_COOKIE)?.value;
    if (!raw) return { claimed: false };

    const code = normaliseReferralCode(raw);
    if (!isPlausibleReferralCode(code)) return { claimed: false };

    const res = await attributeReferral(code);
    // Spent either way: a code that was refused is a code that will keep being
    // refused, and leaving it set would re-run this on every page load.
    jar.delete(REFERRAL_COOKIE);
    return { claimed: res.ok };
  } catch {
    return { claimed: false };
  }
}
