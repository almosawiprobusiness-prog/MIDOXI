# MIDO XI Capture — Privacy

The extension exists to do one thing: save a moment you noticed in a YouTube
football video into your own MIDO XI account. It collects what that requires and
nothing else.

## What the extension reads

Only when you click the extension (or press its shortcut), and only from the tab
you are on:

- The tab's URL — to know whether it is a YouTube video and which one
- The video's current playback time, title, and channel name — read once from the
  live page at that moment
- Nothing is read before you click; nothing keeps watching after

The extension has **no youtube.com permission** and **no content script**. It
cannot observe your browsing, your other tabs, your history, or YouTube pages you
did not invoke it on.

## What it stores locally (chrome.storage.local, this device only)

- Your environment choice (production vs localhost — a developer setting)
- Your current unsent draft (observation text, selected goal/category), kept so a
  closed popup does not lose your writing; cleared when the capture saves
- Failed captures awaiting retry (max 5), including their observation text;
  removed once saved
- Nothing else. No history of saved captures, no tokens, no passwords.

## What it sends to MIDO XI (and nowhere else)

On save, to your configured MIDO XI server only:

- Video id, URL, title, channel, thumbnail URL, timestamp
- Your observation text
- The goal/category you chose, and a random idempotency key

Requests carry your existing MIDO XI session cookie so the server knows the
capture is yours. The extension never sees or stores your password or any token.

## What it does NOT do

- No browsing history, no tabs other than the one you invoked it on
- No tracking pixels, no third-party analytics, no ads
- No requests to any host except MIDO XI (fonts are bundled inside the extension;
  the video thumbnail is loaded from YouTube's image CDN for display only)
- No audio storage: the optional voice input uses the browser's speech-to-text and
  keeps only the resulting text
- Product analytics (how many captures happen) are recorded **server-side** by
  MIDO XI and never contain the text of your observation

## Data ownership and deletion

Captures are rows in your MIDO XI account, protected by the same row-level
security as the rest of your football record, included in your account data
export, and deleted with your account.
