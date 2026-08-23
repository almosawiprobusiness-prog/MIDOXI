/*
  The one thing a referral link leaves behind. Client-safe.

  Six characters, no identity, no tracking value on its own. Kept separate from
  `referral-types.ts` so the join route, the signup form and the onboarding step
  all agree on the name without pulling in the rest of the programme.

  Thirty days is long enough for someone to think about it over a season break
  and short enough that a code cannot follow a browser around forever.
*/

export const REFERRAL_COOKIE = "mido_ref";
export const REFERRAL_COOKIE_DAYS = 30;

/** Read the code from `document.cookie`. Returns null on the server. */
export function readReferralCookie(): string | null {
  if (typeof document === "undefined") return null;
  const hit = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${REFERRAL_COOKIE}=`));
  return hit ? decodeURIComponent(hit.slice(REFERRAL_COOKIE.length + 1)) : null;
}

/** Drop it once it has been used, so a second signup is not miscredited. */
export function clearReferralCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${REFERRAL_COOKIE}=; Max-Age=0; Path=/`;
}
