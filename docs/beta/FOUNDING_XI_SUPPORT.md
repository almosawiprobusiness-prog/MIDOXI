# Founding XI — Support Process

Eleven players you know by name. The process is sized for that:
personal, fast, and honest about what broke.

## How problems reach us

1. **In-product**: the feedback button (topbar) → "Something's broken".
   Rows land in `beta_feedback` (kind = `problem`). Check it **daily**
   during the beta:
   ```sql
   select created_at, u.email, subject, body
   from beta_feedback f join auth.users u on u.id = f.user_id
   where kind = 'problem' order by created_at desc;
   ```
2. **Directly**: founders should also have your personal channel
   (WhatsApp/text). In-product is for "remembered while using it";
   direct is for "I'm blocked right now".
3. **Silently**: `[client-error]` lines in the Vercel function logs —
   client-side crashes relay there with route + digest, no player
   content. Check when investigating anything.

## Severity — three levels only

| Level | Meaning | Response |
|---|---|---|
| **S1** | A player cannot use the product, or data/privacy is at risk | Same day. Message the player personally. Everything else stops |
| **S2** | A feature is broken but the loop works around it | Within 2–3 days; goes on the known-issues list immediately |
| **S3** | Rough edge, confusion, idea | Weekly batch with the metrics review |

## Talking to players

- Acknowledge within a day, even without a fix: *"Seen it, it's real,
  working on it."*
- When fixed, tell the person who reported it **first**.
- Never pretend something works. "Film analysis is struggling with long
  clips — use 30–60s for now" beats silence every time. The product's
  honesty rule applies to us, not only to the UI.

## Emergency disable

AI and video features gate server-side, so problems can be switched off
without a deploy:

- **All AI generation**: remove/blank `ANTHROPIC_API_KEY` in Vercel env
  and redeploy (or set the monthly budget to 0 in the budget table).
  Every AI surface already degrades to its honest note — this path is
  tested behavior, not hope.
- **A runaway spend**: the monthly budget cap in `withinAiBudget`
  already hard-stops generation; lower it live in the table.
- **Recommendations misbehaving**: they fail soft by design — if the
  panel must be hidden entirely, comment the `<NextBestAction …>` line
  in `components/dashboards/player-locker.tsx` (one-line change; the
  Briefing takes over the whole slot automatically because suppression
  is driven by what the panel surfaced).

## Rollback

- **App**: Vercel → previous deployment → promote. Zero-risk, seconds.
- **Migrations 0031/0032/0033**: additive tables only; every consumer
  fails soft. Emergency rollback is dropping the tables
  (`APPLY_MIGRATIONS.md` has the statements) — the product returns to
  its pre-migration behavior.

## Known issues (keep this list honest and current)

| Issue | Severity | Status |
|---|---|---|
| Day counting uses UTC calendar days — evening users several hours from UTC can see day-boundary labels flip early | S3 | Accepted for beta; proper fix needs player timezone on profile |
| WHOOP integration unverifiable (no device) | S3 | Feature-flagged surface; not offered as working |
| Empty-state sequencing on some panels is "nothing yet" without a next step | S3 | On the quality-debt list |
