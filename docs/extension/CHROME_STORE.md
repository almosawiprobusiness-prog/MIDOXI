# MIDO XI Capture — Chrome Web Store readiness

Everything needed to publish, prepared in advance. **Nothing here has been
submitted — publishing is an owner action.**

## Listing

**Title:** MIDO XI Capture — Football Video Notes

**Short description (≤132 chars):**
Save timestamped football observations while watching YouTube. Search, revisit
and export your moments — free, no account needed.

**Long description:**

> Anyone serious about football is already watching it — and noticing things. A
> striker delaying his run. A midfielder scanning before the ball arrives. A
> back line stepping a beat too late. MIDO XI Capture lets you save exactly
> those moments without leaving the video.
>
> Watching on YouTube, press Alt+Shift+M or click the extension. It already
> knows the video and the exact second. Write what you noticed, tag a football
> category — movement, scanning, pressing, finishing — and save. You're back
> watching in seconds.
>
> Everything you capture lives in My Moments: search it, filter it by category,
> reopen the exact timestamp, copy a formatted note, or export your whole
> library as Markdown. Your notes are stored on your device and belong to you.
> No account required.
>
> For players on MIDO XI, the Player OS: connect your account and your moments
> become development evidence — linked to your goals, surfaced in your Film
> Room and studies, with your existing local library importable in one click.
>
> For players, coaches, analysts, scouts and anyone who studies the game.
> YouTube only in this version.

**Category:** Productivity (or Sports). **Language:** English.

Store copy naturally covers what people actually search — football analysis,
soccer tactics notes, YouTube timestamp notes, video study, coaching notes —
without keyword stuffing: the phrases above appear once each, in sentences.

## Single purpose statement

Capture a timestamped observation from the YouTube video the user is watching
and save it to the user's local library or, if connected, their MIDO XI account.

## Permissions justification

| Permission | Why |
|---|---|
| `activeTab` | Read the YouTube tab's URL and player state only when the user invokes the extension |
| `scripting` | One injected read of the video's current time/title/channel at invocation |
| `storage` | Environment setting, unsent draft, failed captures awaiting retry |
| Host `mido-xi.vercel.app` | Send captures to the user's MIDO XI account using their existing session |
| Host `localhost:3000/3100` | Development against a local server — **remove both for the store build** |

No remote code. No content scripts. No youtube.com permission.

## Privacy disclosure (store form)

- Collects: user activity? **No.** Website content? **Only** the invoked YouTube
  video's title/channel/time, sent solely to the user's own MIDO XI account.
- Full text: `docs/extension/PRIVACY.md` — publish at a URL (e.g.
  `https://mido-xi.vercel.app/privacy`) and link it in the listing.

## Assets required

- Icons: 128×128 already in `extension/src/icons/icon-128.png` (store requires 128)
- Screenshots: 1280×800 or 640×400, 1–5 of: capture popup over a YouTube video,
  the SAVED state, Saved Moments in the Film Room, a goal's Study Moments
- Optional promo tiles: 440×280 (small), 1400×560 (marquee)

## Publish steps (owner)

1. In `extension/src/manifest.json`: **remove the localhost host_permissions**, and
   **remove the `"key"` field** (the store assigns the canonical id — or keep the
   dev key workflow and upload the matching .pem if a preserved id is wanted).
2. `npm run package` → upload `mido-xi-capture-<version>.zip` to the
   [developer dashboard](https://chrome.google.com/webstore/devconsole) ($5
   one-time registration).
3. After review, note the **published extension id** and set it as
   `MIDO_EXTENSION_IDS` in the Vercel project env, then redeploy.
4. Fill the privacy form per above; submit for review (typically 1–3 days).

## Testing instructions for reviewers

> Sign up at https://mido-xi.vercel.app (free). Open any YouTube video, click the
> extension, type an observation, Save to MIDO. Open MIDO XI → Film Room to see
> the saved moment; "Watch moment" reopens the video at the captured second.
