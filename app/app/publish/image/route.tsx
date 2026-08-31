import { readFile } from "node:fs/promises";
import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { buildTemplateData } from "@/lib/publish/data";
import {
  PUBLISH_INK,
  PUBLISH_PANEL,
  PUBLISH_LINE,
  PUBLISH_HI,
  PUBLISH_DIM,
  accentValue,
} from "@/lib/publish/palette";
import {
  formatDims,
  type PublishTemplate,
  type PublishFormat,
  type MatchCardData,
  type TrainingCardData,
  type DevelopmentCardData,
  type SeasonCardData,
  type PublishIdentity,
} from "@/lib/publish/types";

/*
  MIDO PUBLISH — the renderer.

  One route, four templates, three formats, rendered with ImageResponse
  (already in Next — no new dependency, exactly as the report engine
  doc planned for social graphics). The route is OWNER-ONLY: it renders
  the signed-in user's own record and nothing takes an id, so there is
  no other player's card to request. The preview the player sees IS the
  artifact — same pixels, no hidden fields.

  Visual rules from the directive: professional football media in
  MIDO's own language. Black, graphite, off-white, one restrained
  accent, large intentional type, a small MIDO XI signature. No neon,
  no sparkles, no invented scores.
*/

/*
  The palette comes from lib/publish/palette.ts — the same literal
  values the rest of the product's tokens carry, so a published card
  matches the app that produced it. The accent alone is per-request:
  the player's chosen colour, from the same vetted list.
*/
const INK = PUBLISH_INK;
const PANEL = PUBLISH_PANEL;
const LINE = PUBLISH_LINE;
const HI = PUBLISH_HI;
const DIM = PUBLISH_DIM;

/*
  Big Shoulders is the display voice of the whole design system, and
  its absence here was the documented gap that made every card fall
  back to a default face. Read once from disk beside this file — the
  `import.meta.url` form is what Next traces into the deployed
  function — and cached for the process's life.
*/
let fontData: ArrayBuffer | null = null;
async function displayFont(): Promise<ArrayBuffer | null> {
  if (fontData) return fontData;
  try {
    const buf = await readFile(new URL("./big-shoulders-700.ttf", import.meta.url));
    fontData = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  } catch {
    fontData = null; // fall back to the bundled default rather than failing the card
  }
  return fontData;
}

export async function GET(req: Request) {
  if (!isDemoMode) {
    const supabase = await createClient();
    const user = supabase ? (await supabase.auth.getUser()).data.user : null;
    if (!user) return new Response("Sign in to publish.", { status: 401 });
  }

  const url = new URL(req.url);
  const template = (url.searchParams.get("template") ?? "match") as PublishTemplate;
  const format = (url.searchParams.get("format") ?? "portrait") as PublishFormat;
  // The player's chosen accent — resolved against the vetted list, so an
  // arbitrary query value can never paint an unreadable card.
  const a = accentValue(url.searchParams.get("accent"));
  if (!["match", "training", "development", "season"].includes(template)) {
    return new Response("Unknown template.", { status: 400 });
  }

  const data = await buildTemplateData(template);
  if (!data) {
    return new Response("Nothing on the record for this card yet.", { status: 404 });
  }

  const { width, height } = formatDims(format);
  // Everything scales off the shorter edge so the formats share
  // one visual system rather than four hand-tuned ones.
  const s = Math.min(width, height) / 1080;

  // The export funnel's terminal event. The preview <img> also hits this
  // route, so "exported" here means "rendered a card" — the honest,
  // available signal without client beacons; downloads are a superset.
  const { track } = await import("@/lib/analytics/track");
  await track("publish_exported", { template, format });

  const display = await displayFont();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: INK,
          color: HI,
          padding: 64 * s,
          fontFamily: "sans-serif",
        }}
      >
        <Header identity={data.identity} s={s} a={a} />
        <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: "center" }}>
          {template === "match" && <MatchBody d={data as MatchCardData} s={s} a={a} />}
          {template === "training" && <TrainingBody d={data as TrainingCardData} s={s} a={a} />}
          {template === "development" && <DevelopmentBody d={data as DevelopmentCardData} s={s} a={a} />}
          {template === "season" && <SeasonBody d={data as SeasonCardData} s={s} a={a} />}
        </div>
        <Footer s={s} />
      </div>
    ),
    {
      width,
      height,
      fonts: display
        ? [{ name: "Big Shoulders", data: display, weight: 700 as const, style: "normal" as const }]
        : undefined,
    },
  );
}

/** The display voice, where the card speaks loudest. Condensed, tall, MIDO. */
const DISPLAY = "'Big Shoulders', sans-serif";

/*
  The header is the player's brand, not MIDO's: photo, name in the
  display voice, position · club, and their number in their accent.
  MIDO's own mark lives quietly in the footer.
*/
function Header({ identity, s, a }: { identity: PublishIdentity; s: number; a: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 24 * s }}>
        {identity.avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={identity.avatarUrl}
            alt=""
            width={92 * s}
            height={92 * s}
            style={{
              width: 92 * s,
              height: 92 * s,
              borderRadius: "50%",
              objectFit: "cover",
              border: `${Math.max(1, 3 * s)}px solid ${LINE}`,
            }}
          />
        )}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 48 * s,
              fontFamily: DISPLAY,
              fontWeight: 700,
              letterSpacing: 0.5 * s,
              display: "flex",
            }}
          >
            {identity.name.toUpperCase()}
          </div>
          <div style={{ fontSize: 22 * s, color: DIM, marginTop: 6 * s, letterSpacing: 2 * s, display: "flex" }}>
            {[identity.position, identity.club].filter(Boolean).join(" · ").toUpperCase()}
          </div>
        </div>
      </div>
      {identity.squadNumber != null && (
        <div
          style={{
            fontSize: 72 * s,
            fontFamily: DISPLAY,
            fontWeight: 700,
            color: a,
            display: "flex",
          }}
        >
          {identity.squadNumber}
        </div>
      )}
    </div>
  );
}

function Footer({ s }: { s: number }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderTop: `${Math.max(1, 2 * s)}px solid ${LINE}`,
        paddingTop: 20 * s,
      }}
    >
      <div style={{ fontSize: 20 * s, letterSpacing: 4 * s, color: DIM, fontFamily: DISPLAY, display: "flex" }}>
        MIDO XI
      </div>
      <div style={{ fontSize: 18 * s, color: DIM, display: "flex" }}>mido11.com</div>
    </div>
  );
}

function Stat({ label, value, s, a, accent }: { label: string; value: string; s: number; a: string; accent?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: PANEL,
        border: `${Math.max(1, 2 * s)}px solid ${LINE}`,
        borderRadius: 16 * s,
        padding: `${20 * s}px ${28 * s}px`,
        flexGrow: 1,
      }}
    >
      <div style={{ fontSize: 64 * s, fontWeight: 700, color: accent ? a : HI, display: "flex" }}>
        {value}
      </div>
      <div style={{ fontSize: 18 * s, letterSpacing: 2 * s, color: DIM, marginTop: 4 * s, display: "flex" }}>
        {label.toUpperCase()}
      </div>
    </div>
  );
}

function MatchBody({ d, s, a }: { d: MatchCardData; s: number; a: string }) {
  const result = d.goalsFor > d.goalsAgainst ? "WIN" : d.goalsFor < d.goalsAgainst ? "LOSS" : "DRAW";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 * s }}>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 22 * s, letterSpacing: 3 * s, color: a, display: "flex" }}>
          FULL TIME · {d.competition.toUpperCase()}
        </div>
        <div style={{ fontSize: 58 * s, fontFamily: DISPLAY, fontWeight: 700, marginTop: 8 * s, display: "flex" }}>
          {d.home ? "vs" : "at"} {d.opponent}
        </div>
        <div style={{ fontSize: 104 * s, fontFamily: DISPLAY, fontWeight: 700, display: "flex", alignItems: "baseline", gap: 20 * s }}>
          {d.goalsFor}–{d.goalsAgainst}
          <span style={{ fontSize: 30 * s, color: DIM }}>{result}</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 20 * s }}>
        <Stat label="Minutes" value={String(d.minutes)} s={s} a={a} />
        <Stat label="Goals" value={String(d.goals)} s={s} a={a} accent={d.goals > 0} />
        <Stat label="Assists" value={String(d.assists)} s={s} a={a} accent={d.assists > 0} />
        {d.rating != null && <Stat label="Rating" value={d.rating.toFixed(1)} s={s} a={a} />}
      </div>
    </div>
  );
}

function TrainingBody({ d, s, a }: { d: TrainingCardData; s: number; a: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 * s }}>
      <div style={{ fontSize: 22 * s, letterSpacing: 3 * s, color: a, display: "flex" }}>
        TRAINING COMPLETE
      </div>
      <div style={{ fontSize: 56 * s, fontFamily: DISPLAY, fontWeight: 700, display: "flex" }}>{d.title.toUpperCase()}</div>
      {d.objective && (
        <div style={{ fontSize: 26 * s, color: DIM, display: "flex" }}>{d.objective}</div>
      )}
      <div style={{ display: "flex", gap: 20 * s }}>
        {d.durationMin != null && <Stat label="Minutes" value={String(d.durationMin)} s={s} a={a} />}
        {d.rpe != null && <Stat label="RPE" value={`${d.rpe}/10`} s={s} a={a} accent />}
        <Stat label="Session" value={d.kind.toUpperCase()} s={s} a={a} />
      </div>
      {d.blocks.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 * s }}>
          {d.blocks.map((b, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 24 * s }}>
              <span style={{ display: "flex" }}>
                {String(i + 1).padStart(2, "0")} {b.name}
              </span>
              <span style={{ color: DIM, display: "flex" }}>{b.work}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DevelopmentBody({ d, s, a }: { d: DevelopmentCardData; s: number; a: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 * s }}>
      <div style={{ fontSize: 22 * s, letterSpacing: 3 * s, color: a, display: "flex" }}>
        DEVELOPMENT · IN PROGRESS
      </div>
      {d.goals.map((g, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", gap: 10 * s }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ fontSize: 44 * s, fontFamily: DISPLAY, fontWeight: 700, display: "flex" }}>{g.title.toUpperCase()}</div>
            <div style={{ fontSize: 24 * s, color: DIM, display: "flex" }}>
              {g.evidence} pieces of evidence
            </div>
          </div>
          <div
            style={{
              display: "flex",
              height: 14 * s,
              background: PANEL,
              borderRadius: 8 * s,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                width: `${Math.min(100, Math.max(2, g.progress))}%`,
                background: a,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function SeasonBody({ d, s, a }: { d: SeasonCardData; s: number; a: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 * s }}>
      <div style={{ fontSize: 22 * s, letterSpacing: 3 * s, color: a, display: "flex" }}>
        SEASON SNAPSHOT
      </div>
      <div style={{ fontSize: 76 * s, fontFamily: DISPLAY, fontWeight: 700, display: "flex", gap: 24 * s, alignItems: "baseline" }}>
        {d.record.W}W {d.record.D}D {d.record.L}L
        <span style={{ fontSize: 28 * s, color: DIM }}>{d.matches} matches</span>
      </div>
      <div style={{ display: "flex", gap: 20 * s }}>
        <Stat label="Minutes" value={String(d.minutes)} s={s} a={a} />
        <Stat label="Goals" value={String(d.goals)} s={s} a={a} accent={d.goals > 0} />
        <Stat label="Assists" value={String(d.assists)} s={s} a={a} accent={d.assists > 0} />
      </div>
    </div>
  );
}
