# Social + Identity + Film Refinement — 30 Aug

The owner's directive: Community returns as a first-class player
surface (reversing the 30 Aug cut via its own stated re-entry clause),
designed in Framer before implementation; profile photos and football
identity; MIDO Publish upgraded toward "the player's personal football
media department"; freeze-frame drawing always available with clean +
branded export and a door to the community.

## Framer as design authority

Designed in the owner's Framer project **Contextual Influence**
(MIDOXI folder), by the "Design Football OS" agent thread, across
three iterations with critique between each:

- `/community` — editorial header (MIDO XI / PLAYER NETWORK ·
  COMMUNITY), Following/Discover, quiet ALL/TRAINING/MATCH/FILM/STUDY
  filter row, media-first feed with four distinct post treatments
  (film review kicker, training complete, match in the positive
  green, study as a quote card), avatar-led identity lines with an
  initials fallback, text action row APPRECIATE·COMMENT·SAVE·SHARE,
  desktop context rail that never competes, "SHOW THE WORK." editorial
  empty state, phone frame with pinned CREATE, post detail with a
  flat football comment thread.
- `/profile-social` — identity band (portrait, display-voice name,
  ST · CLUB · #9 mono caps, bio, MY GAME strip as the emotional
  center), quiet counts, tabs POSTS/FILM/TRAINING/MATCHES backed by
  content, media grid with quote tiles; composer overlay (six kind
  chips → FROM MIDO auto-populated content → visual → thought →
  post/share).

## What shipped

- `0040_post_saves.sql` — private `post_saves` (owner-only RLS, no
  counts anywhere) + `community_posts.kind`.
- Feed: saves, kinds, kind filter, saved view, edit-own-caption,
  delete removes the storage object too.
- Shared `<Avatar>` primitive (`components/ui/avatar.tsx`); optional
  photo upload in onboarding step 4.
- Publish: palette now mirrors globals.css via `lib/publish/palette.ts`,
  Big Shoulders loaded into ImageResponse, portrait 1080×1350 first,
  player accent picker (vetted list), avatar + number in the header,
  mido11.com footer.
- Film: tools grew line / player marker / text cue / eraser / redo;
  `exportMidoFrame` (branded 1080×1350) beside the clean export;
  "Post to community" sends the board straight to the feed as a film
  post.

## Deliberately not done

- Comment-likes and replies-to-replies (flat thread is the design).
- Coach/trainer handles for `/app/community/[handle]` (player-only
  today; the route resolves players only).
- New Publish templates beyond the four (matchday/fixture data does
  not exist as a first-class record yet; film frames cannot reach the
  server renderer). Quality over quantity, per the directive.
