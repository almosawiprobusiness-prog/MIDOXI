# MIDO XI Capture — Privacy

The extension does one thing: saves a moment you noticed in a YouTube football
video — to this device for free, or to your own MIDO XI account if you connect
one. It collects what that requires and nothing else.

## Free mode (no account)

- **Your captures are stored on this device only** (browser extension storage).
  MIDO XI does not receive them — not the note, not the video, not the fact
  that you captured. A local save makes zero network requests.
- The only network call in free mode is a status check to MIDO XI asking "is
  this browser signed in?" so the extension knows which mode to show. It
  carries no capture data. Signed out, it answers no, and everything still works.
- Your notes are yours: search them, edit them, export them all as Markdown or
  JSON at any time, delete them one by one (with undo) or clear the library
  (with explicit confirmation). No lock-in, no export tax.

## Connected mode (MIDO XI account)

- Captures you save with **Save to MIDO**, and local moments you explicitly
  choose to **Import**, are transmitted to your MIDO XI account. Nothing
  uploads automatically — importing your local library is always a button you
  press, and your local copies remain on this device afterwards.
- Your active development goals are retrieved so a capture can be connected to
  one.
- Signing out never touches your local library.

## What the extension reads

Only when you click it (or press its shortcut), and only from the tab you are
on: the tab's URL (is this a YouTube video, and which), and the video's current
playback time, title and channel — read once from the live page at that moment.
It has **no youtube.com permission and no content script**: it cannot observe
your browsing, your other tabs, your history, or any page you did not invoke
it on.

## What it stores locally

Your capture library, your current unsent draft (cleared on save; discarded
after 7 days), your environment setting, and small UI flags. No tokens, no
passwords, no history of pages visited.

## What it does NOT do

- No browsing history, no unrelated tabs or page content, no keystroke telemetry
- No third-party analytics, no tracking pixels, no ads
- No requests to any host except MIDO XI (fonts ship inside the extension; the
  video thumbnail is loaded from YouTube's image CDN for display only)
- No audio storage — optional voice input uses the browser's speech-to-text and
  keeps only the resulting text
- **No observation text in analytics, ever.** Product analytics (recorded
  server-side, connected mode only) contain counts, categories and flags —
  never what you wrote. Free-mode usage is not tracked at all.

## Data ownership and deletion

Local captures live and die on this device, on your command. Captures saved to
MIDO XI are rows in your account — covered by the same row-level security as
the rest of your football record, included in your account export, deleted with
your account.
