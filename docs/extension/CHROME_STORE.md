# MIDO XI Capture — Chrome Web Store readiness

Everything needed to publish, prepared in advance. **Nothing here has been
submitted — publishing is an owner action.**

## Listing

**Title:** MIDO XI Capture

**Short description (≤132 chars):**
Save football moments from YouTube directly to your MIDO XI Player OS — the
timestamp, what you noticed, and the goal it feeds.

**Long description:**

> A serious footballer is already watching football. MIDO XI Capture makes the
> noticing count.
>
> Watching a video on YouTube, you spot something — a striker delaying his run, a
> midfielder scanning before the ball arrives. Click MIDO XI Capture (or press
> Alt+Shift+M). The extension already knows the video and the exact second. Write
> what you noticed, optionally connect it to one of your MIDO XI development
> goals and a football category, and save. You are back watching in seconds.
>
> Inside MIDO XI, every captured moment appears in your Film Room and on the
> development goal it feeds — with a link that reopens the video at the exact
> timestamp. Your study becomes development evidence.
>
> Requires a MIDO XI account. YouTube only in this version.

**Category:** Productivity (or Sports). **Language:** English.

## Single purpose statement

Capture a timestamped observation from the YouTube video the user is watching and
save it to the user's MIDO XI account.

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
