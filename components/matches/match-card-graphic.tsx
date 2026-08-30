"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Share2, ImageIcon } from "lucide-react";
import { createPost } from "@/app/app/community/feed-actions";
import type { Match } from "@/lib/types";

/*
  The match card — performance leaves the app, drawn from the record.

  Everything on the card is a fact the player logged: clubs, score,
  competition, date, their own minutes/goals/assists/rating. Nothing is
  generated and nothing is estimated; a card of invented numbers would
  be marketing against the product's own spine.

  Privacy defaults to NOTHING personal: the player's name is off until
  they switch it on, the same rule reports follow. Rendered on a canvas
  at 1080×1350 (portrait, the shape feeds crop least) using the fonts
  the page has already loaded; downloaded as a PNG or shared through
  the same confirmed createPost door as everything else.
*/

const W = 1080;
const H = 1350;

function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function drawCard(
  canvas: HTMLCanvasElement,
  match: Match,
  ownClub: string,
  playerName: string | null,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const ink = cssVar("--ink-950", "#08090b");
  const signal = cssVar("--signal", "#7b61ff");
  const display = `"Big Shoulders", "Big Shoulders Display", sans-serif`;
  const sans = `"Inter", "Space Grotesk", system-ui, sans-serif`;

  canvas.width = W;
  canvas.height = H;

  // Ground
  ctx.fillStyle = ink;
  ctx.fillRect(0, 0, W, H);

  // Signal wash from the top — the product's own gradient language.
  const wash = ctx.createLinearGradient(0, 0, 0, H * 0.6);
  wash.addColorStop(0, `${signal}26`);
  wash.addColorStop(1, "transparent");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, W, H * 0.6);

  // Pitch grid, faint.
  ctx.strokeStyle = "rgba(255,255,255,0.045)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 90) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y <= H; y += 90) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // Signal line across the top.
  ctx.fillStyle = signal;
  ctx.fillRect(0, 0, W, 10);

  const homeName = match.home ? ownClub : match.opponent;
  const awayName = match.home ? match.opponent : ownClub;
  const homeScore = match.home ? match.goalsFor : match.goalsAgainst;
  const awayScore = match.home ? match.goalsAgainst : match.goalsFor;

  // Eyebrow: competition · date
  const dateLabel = new Date(match.date).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = `600 30px ${sans}`;
  ctx.textAlign = "center";
  ctx.fillText((match.competition || "Match").toUpperCase() + "  ·  " + dateLabel, W / 2, 150);

  // Clubs
  ctx.fillStyle = "#f5f5f7";
  ctx.font = `700 72px ${display}`;
  ctx.fillText(homeName.toUpperCase(), W / 2, 320);
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.font = `600 40px ${display}`;
  ctx.fillText("VS", W / 2, 400);
  ctx.fillStyle = "#f5f5f7";
  ctx.font = `700 72px ${display}`;
  ctx.fillText(awayName.toUpperCase(), W / 2, 490);

  // Score
  ctx.fillStyle = signal;
  ctx.font = `800 220px ${display}`;
  ctx.fillText(`${homeScore}–${awayScore}`, W / 2, 740);

  // Player line (opt-in) + stat band
  let statTop = 850;
  if (playerName) {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = `700 44px ${display}`;
    ctx.fillText(playerName.toUpperCase(), W / 2, statTop);
    statTop += 60;
  }

  const stats: [string, string][] = [
    ["MIN", String(match.minutes)],
    ["GOALS", String(match.goals)],
    ["ASSISTS", String(match.assists)],
    ...(match.rating > 0 ? ([["RATING", match.rating.toFixed(1)]] as [string, string][]) : []),
  ];
  const cell = W / stats.length;
  stats.forEach(([label, value], i) => {
    const cx = cell * i + cell / 2;
    ctx.fillStyle = "#f5f5f7";
    ctx.font = `800 96px ${display}`;
    ctx.fillText(value, cx, statTop + 140);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = `600 28px ${sans}`;
    ctx.fillText(label, cx, statTop + 190);
  });

  // Divider + mark
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(120, H - 170, W - 240, 2);
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.font = `700 40px ${display}`;
  ctx.fillText("MIDO XI", W / 2, H - 95);
}

export function MatchCardGraphic({ match, ownClub, knownAs }: {
  match: Match;
  ownClub: string;
  /** Offered as an opt-in toggle; never rendered until switched on. */
  knownAs: string;
}) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showName, setShowName] = useState(false);
  const [busy, setBusy] = useState<"share" | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const render = useCallback(() => {
    if (!canvasRef.current) return;
    drawCard(canvasRef.current, match, ownClub, showName && knownAs ? knownAs : null);
  }, [match, ownClub, showName, knownAs]);

  useEffect(() => {
    // Redraw once the display font arrives, or the card rasterises in a fallback face.
    render();
    document.fonts?.ready?.then(render).catch(() => {});
  }, [render]);

  const download = () => {
    const url = canvasRef.current?.toDataURL("image/png");
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `mido-xi-match-${match.opponentShort.toLowerCase() || "card"}.png`;
    a.click();
  };

  const share = async () => {
    const url = canvasRef.current?.toDataURL("image/jpeg", 0.9);
    if (!url) return;
    setBusy("share");
    setNote(null);
    const res = await createPost({
      caption: `${match.home ? "vs" : "Away to"} ${match.opponent} — ${match.goalsFor}–${match.goalsAgainst}.`,
      media: url,
      mediaWidth: W,
      mediaHeight: H,
      tags: ["match"],
      visibility: "followers",
    });
    setBusy(null);
    setNote(res.ok ? "Shared with your followers." : res.error);
    if (res.ok) router.refresh();
  };

  return (
    <section className="mt-4 panel p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ImageIcon className="size-4 text-signal-bright" />
          <span className="label-tech">Match card</span>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-text-dim">
          <input
            type="checkbox"
            checked={showName}
            onChange={(e) => setShowName(e.target.checked)}
            className="accent-[var(--signal)]"
          />
          Show my name
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
        <canvas
          ref={canvasRef}
          className="w-full max-w-[220px] rounded-lg border border-line"
          aria-label="Match card preview"
        />
        <div className="min-w-0">
          <p className="text-sm leading-relaxed text-text-dim">
            Every number on it comes from your match log — nothing estimated, nothing
            generated. Your name stays off until you switch it on.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={download}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-line px-3.5 text-sm text-text-dim transition-colors hover:border-signal-line hover:text-signal-bright"
            >
              <Download className="size-4" /> Download PNG
            </button>
            <button
              onClick={share}
              disabled={busy === "share"}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-signal px-3.5 text-sm font-medium text-white transition-colors hover:bg-signal-deep disabled:opacity-50"
            >
              {busy === "share" ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />}
              Share to community
            </button>
          </div>
          {note && <p className="mt-2 text-xs text-text-dim">{note}</p>}
        </div>
      </div>
    </section>
  );
}
