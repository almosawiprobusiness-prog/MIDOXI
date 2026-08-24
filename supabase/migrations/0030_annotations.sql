-- ============================================================
-- MIDO XI — 0030: drawing on the film
--
-- Telestration: freeze a frame, circle the space behind the
-- fullback, draw the run. Every video tool a coach has used
-- has this, and the film room having clipping and AI reading
-- but no pen is the gap that reads as unfinished.
--
-- SHAPES, NOT PICTURES. The obvious implementation flattens the
-- frame and the drawing into a PNG and stores that. This stores
-- the shapes instead — a few hundred bytes of JSON against a few
-- hundred kilobytes of image — for three reasons that matter more
-- than the size:
--
--   · The video is already there. Re-drawing over the real frame
--     at playback size is sharper at every resolution than a
--     flattened bitmap scaled to fit.
--   · An annotation stays editable. A coach can move an arrow a
--     year later; a PNG can only be replaced.
--   · Storage on this project caps a single file at 50 MB and the
--     whole bucket well below what a season of stills would need.
--     Vectors cost effectively nothing.
--
-- COORDINATES ARE NORMALISED 0..1, never pixels. The same
-- annotation is viewed on a phone and a laptop, and a circle
-- recorded at 1280px that redraws at 390px has to land on the
-- same blade of grass. Pixels would put it somewhere else.
--
-- Safe to re-run.
-- ============================================================

create table if not exists video_annotations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  video_id uuid not null references videos(id) on delete cascade,

  /*
    The moment being drawn on. Not a clip reference: a coach marks up
    a frame long before deciding whether it is worth keeping as a
    clip, and forcing a clip first would make the pen the second step
    of a two-step job.
  */
  at_seconds numeric not null check (at_seconds >= 0),

  /*
    The drawing. An array of shapes, each `{ t, c, w, ... }` where `t`
    is pen | arrow | ellipse, `c` is a colour token and `w` a stroke
    width. See lib/data/annotation-types.ts — that file is the schema,
    and it validates before anything is written.
  */
  shapes jsonb not null default '[]'::jsonb,

  -- What the drawing is pointing at, in words. A circle with no
  -- sentence is a mark somebody has to interpret later.
  note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- A drawing with nothing in it is a row nobody meant to make.
  constraint video_annotations_not_empty check (jsonb_array_length(shapes) > 0)
);

create index if not exists video_annotations_video_idx
  on video_annotations (video_id, at_seconds);

alter table video_annotations enable row level security;

/*
  Owner-only, matching how a clip behaves before any sharing is
  applied. Somebody else's film is not somebody else's to draw on,
  and a coach seeing a player's annotations follows whatever
  sharing `clips` grows — this table should not invent its own
  visibility rule ahead of that.
*/
drop policy if exists video_annotations_owner on video_annotations;
create policy video_annotations_owner on video_annotations for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- anon, public AND authenticated, then grant back exactly what is
-- needed. The trap 0011, 0017, 0019, 0003, 0024 and 0027 each fell
-- into, avoided by naming all three every time.
revoke all on video_annotations from anon, public, authenticated;
grant select, insert, update, delete on video_annotations to authenticated;

comment on table video_annotations is
  'Telestration as vector shapes, not flattened images: re-drawn over the real frame so it stays sharp at any size and editable forever. Coordinates are normalised 0..1 so a mark made on a laptop lands in the same place on a phone.';

notify pgrst, 'reload schema';
