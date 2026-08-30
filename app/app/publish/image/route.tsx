import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { buildTemplateData } from "@/lib/publish/data";
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

const INK = "#0b0b0e";
const PANEL = "#141419";
const LINE = "#26262e";
const HI = "#f2f0ea";
const DIM = "#9b98a6";
const SIGNAL = "#8b7bff";

export async function GET(req: Request) {
  if (!isDemoMode) {
    const supabase = await createClient();
    const user = supabase ? (await supabase.auth.getUser()).data.user : null;
    if (!user) return new Response("Sign in to publish.", { status: 401 });
  }

  const url = new URL(req.url);
  const template = (url.searchParams.get("template") ?? "match") as PublishTemplate;
  const format = (url.searchParams.get("format") ?? "square") as PublishFormat;
  if (!["match", "training", "development", "season"].includes(template)) {
    return new Response("Unknown template.", { status: 400 });
  }

  const data = await buildTemplateData(template);
  if (!data) {
    return new Response("Nothing on the record for this card yet.", { status: 404 });
  }

  const { width, height } = formatDims(format);
  // Everything scales off the shorter edge so the three formats share
  // one visual system rather than three hand-tuned ones.
  const s = Math.min(width, height) / 1080;

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
        <Header identity={data.identity} s={s} />
        <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: "center" }}>
          {template === "match" && <MatchBody d={data as MatchCardData} s={s} />}
          {template === "training" && <TrainingBody d={data as TrainingCardData} s={s} />}
          {template === "development" && <DevelopmentBody d={data as DevelopmentCardData} s={s} />}
          {template === "season" && <SeasonBody d={data as SeasonCardData} s={s} />}
        </div>
        <Footer s={s} />
      </div>
    ),
    { width, height },
  );
}

function Header({ identity, s }: { identity: PublishIdentity; s: number }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 44 * s, fontWeight: 700, letterSpacing: -1 * s, display: "flex" }}>
          {identity.name.toUpperCase()}
        </div>
        <div style={{ fontSize: 22 * s, color: DIM, marginTop: 6 * s, display: "flex" }}>
          {[identity.position, identity.club].filter(Boolean).join(" · ")}
        </div>
      </div>
      {identity.squadNumber != null && (
        <div
          style={{
            fontSize: 60 * s,
            fontWeight: 700,
            color: SIGNAL,
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
      <div style={{ fontSize: 20 * s, letterSpacing: 4 * s, color: DIM, display: "flex" }}>
        MIDO XI
      </div>
      <div style={{ fontSize: 18 * s, color: DIM, display: "flex" }}>PLAYER OS</div>
    </div>
  );
}

function Stat({ label, value, s, accent }: { label: string; value: string; s: number; accent?: boolean }) {
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
      <div style={{ fontSize: 64 * s, fontWeight: 700, color: accent ? SIGNAL : HI, display: "flex" }}>
        {value}
      </div>
      <div style={{ fontSize: 18 * s, letterSpacing: 2 * s, color: DIM, marginTop: 4 * s, display: "flex" }}>
        {label.toUpperCase()}
      </div>
    </div>
  );
}

function MatchBody({ d, s }: { d: MatchCardData; s: number }) {
  const result = d.goalsFor > d.goalsAgainst ? "WIN" : d.goalsFor < d.goalsAgainst ? "LOSS" : "DRAW";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 * s }}>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 22 * s, letterSpacing: 3 * s, color: SIGNAL, display: "flex" }}>
          FULL TIME · {d.competition.toUpperCase()}
        </div>
        <div style={{ fontSize: 54 * s, fontWeight: 700, marginTop: 8 * s, display: "flex" }}>
          {d.home ? "vs" : "at"} {d.opponent}
        </div>
        <div style={{ fontSize: 96 * s, fontWeight: 700, display: "flex", alignItems: "baseline", gap: 20 * s }}>
          {d.goalsFor}–{d.goalsAgainst}
          <span style={{ fontSize: 30 * s, color: DIM }}>{result}</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 20 * s }}>
        <Stat label="Minutes" value={String(d.minutes)} s={s} />
        <Stat label="Goals" value={String(d.goals)} s={s} accent={d.goals > 0} />
        <Stat label="Assists" value={String(d.assists)} s={s} accent={d.assists > 0} />
        {d.rating != null && <Stat label="Rating" value={d.rating.toFixed(1)} s={s} />}
      </div>
    </div>
  );
}

function TrainingBody({ d, s }: { d: TrainingCardData; s: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 * s }}>
      <div style={{ fontSize: 22 * s, letterSpacing: 3 * s, color: SIGNAL, display: "flex" }}>
        TRAINING COMPLETE
      </div>
      <div style={{ fontSize: 50 * s, fontWeight: 700, display: "flex" }}>{d.title}</div>
      {d.objective && (
        <div style={{ fontSize: 26 * s, color: DIM, display: "flex" }}>{d.objective}</div>
      )}
      <div style={{ display: "flex", gap: 20 * s }}>
        {d.durationMin != null && <Stat label="Minutes" value={String(d.durationMin)} s={s} />}
        {d.rpe != null && <Stat label="RPE" value={`${d.rpe}/10`} s={s} accent />}
        <Stat label="Session" value={d.kind.toUpperCase()} s={s} />
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

function DevelopmentBody({ d, s }: { d: DevelopmentCardData; s: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 * s }}>
      <div style={{ fontSize: 22 * s, letterSpacing: 3 * s, color: SIGNAL, display: "flex" }}>
        DEVELOPMENT · IN PROGRESS
      </div>
      {d.goals.map((g, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", gap: 10 * s }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ fontSize: 40 * s, fontWeight: 700, display: "flex" }}>{g.title}</div>
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
                background: SIGNAL,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function SeasonBody({ d, s }: { d: SeasonCardData; s: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 * s }}>
      <div style={{ fontSize: 22 * s, letterSpacing: 3 * s, color: SIGNAL, display: "flex" }}>
        SEASON SNAPSHOT
      </div>
      <div style={{ fontSize: 70 * s, fontWeight: 700, display: "flex", gap: 24 * s, alignItems: "baseline" }}>
        {d.record.W}W {d.record.D}D {d.record.L}L
        <span style={{ fontSize: 28 * s, color: DIM }}>{d.matches} matches</span>
      </div>
      <div style={{ display: "flex", gap: 20 * s }}>
        <Stat label="Minutes" value={String(d.minutes)} s={s} />
        <Stat label="Goals" value={String(d.goals)} s={s} accent={d.goals > 0} />
        <Stat label="Assists" value={String(d.assists)} s={s} accent={d.assists > 0} />
      </div>
    </div>
  );
}
