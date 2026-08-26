# The Real-Account Test

**Who runs this:** you. Creating accounts, receiving verification
email, and entering payment details are yours by definition — I can't
and shouldn't do any of the three. This script turns the whole release
validation into roughly **45 minutes at a keyboard**, in order, with a
checkbox per claim. Everything here maps 1:1 onto the release blockers
in `PLAYER_OS_BETA_GATE.md`.

**Do this AFTER applying the migrations** (`APPLY_MIGRATIONS.md`), on
the deployed app (or `npm run dev` with the real `.env.local`).

Use a throwaway-able email you control (Gmail `+beta1` aliases work:
`you+beta1@gmail.com`, `you+beta2@gmail.com`).

---

## A · Signup and first contact (5 min)

- [ ] Sign up as `you+beta1`. Verification email arrives and the link
      works.
- [ ] You land in onboarding, see the **Founding XI** note, and complete
      it as a **player** (position CF or your own, one development
      goal).
- [ ] The Locker renders with **no fake data anywhere** — no invented
      matches, no readiness you never gave. The Next panel should show
      its honest onboarding state or a goal-based suggestion.
- [ ] Log out. Log back in. Everything above persisted.
- [ ] Trigger "Forgot password" once and complete it.

## B · The core loop (15 min)

Do these in order — the order is itself the test of the loop:

- [ ] **Check in** (energy/sleep/soreness/mental). Refresh: readiness
      shows on the Locker.
- [ ] **Add your next real fixture** to the Calendar (kind: match). The
      Locker's next-match panel and the Match Center must show the SAME
      day count.
- [ ] **Log a played match** (last weekend's, real numbers).
- [ ] **Complete its review** — fill "what moment should I study?".
- [ ] Open the **Film Room**: your review's study-moment appears under
      "From your match reviews".
- [ ] Open the **Locker**: the Next panel should now reflect the record
      (e.g. review done → no review nag; fixture near → preparation).
- [ ] Press **Not now** on the top recommendation. Refresh. It must NOT
      lead the panel again today.
- [ ] Press **Done** on another. Refresh. Same.
- [ ] **Study** one person free; **Mark studied** on two modules.
- [ ] **Log a training session**. Timeline shows all of the above in
      order, with goal threads ("→ your goal") on linked entries.
- [ ] **Memory**: add one "Working on" line. Log out, log in — still
      there.
- [ ] In Supabase SQL editor:
      `select type, count(*) from mido_events group by 1;`
      — you should see rows for goal, match, review, study, training,
      check-in.

## C · Video, including failure (10 min)

- [ ] Upload a **30–60s real football clip** (mp4, landscape). It
      stores, shows a thumbnail, and plays.
- [ ] Run the AI analysis on it (this is also the paid-AI + budget-path
      test). Observations appear with confidence labels, or it refuses
      in plain words. **No infinite spinner, no invented analysis.**
- [ ] Rate the analysis with the 👍/👎 that appears under it.
- [ ] Try a **phone video (.mov, vertical)** — plays or fails with a
      readable message.
- [ ] Try a **wrong file** (a PDF renamed or just a PDF) — refused with
      a readable message, not accepted-then-broken.
- [ ] Kill the network mid-upload (toggle Wi-Fi) — the UI must come
      back with an error, not hang forever.

## D · Privacy — the two-account test (5 min)

- [ ] Sign up `you+beta2` in a second browser/profile as a player.
- [ ] From beta2, try to reach beta1's data: a match URL you copied from
      beta1 (`/app/matches/<id>`), a video URL, the timeline. Every one
      must show not-found/empty — **never beta1's content**.
- [ ] Beta2's Locker, Film Room, and Performance are empty — no bleed.

## E · Billing, in test mode (5 min)

- [ ] With **Stripe in test mode**, upgrade beta1 (card `4242 4242 4242
      4242`, any future date/CVC).
- [ ] Entitlement flips (Personalise with MIDO / AI drafting available).
- [ ] Refresh; log out and in — **still entitled**.
- [ ] Cancel from the billing portal — entitlement ends at the stated
      time, app reflects it.
- [ ] Abandon one checkout halfway — nothing is granted; no stuck state.
- [ ] Failed-payment card `4000 0000 0000 0002` — a readable failure,
      no entitlement.

## F · Deletion — the last thing you test (5 min)

Run this on **beta2**, after D and E, so the account has data worth
deleting:

- [ ] Settings → delete account. It signs you out.
- [ ] Login as beta2 fails ("invalid credentials").
- [ ] In Supabase SQL editor, with beta2's old user id:
      ```sql
      select 'matches', count(*) from matches where user_id = '<id>'
      union all select 'events', count(*) from mido_events where actor_user_id = '<id>'
      union all select 'recs', count(*) from mido_recommendations where user_id = '<id>'
      union all select 'analytics', count(*) from product_analytics where user_id = '<id>';
      ```
      All zeros.
- [ ] Storage → `videos` bucket: beta2's uploads are gone.

**What deletion deliberately retains** (documented, not hidden): other
people's records that referenced the account keep working with the
reference nulled — a club's staff roster, the other side of a
connection, notification actors. Nothing that was *yours* survives;
what survives was never yours.

## G · Mobile pass (5 min)

On an actual phone (or 375px devtools) with beta1: Locker → check-in →
study → log a match → Next panel buttons. Everything reachable with a
thumb, nothing overflowing sideways.

---

**When every box is ticked, the gate's twelve release blockers are all
green and the Founding XI can be invited.** Anything that fails: note
which box, and hand it back to me — the failure line is designed to be
enough to debug from.
