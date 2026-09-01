/*
  The pitch itself — markings only, no football on it.

  Server-safe (no "use client", no hooks), so a read-only board renders
  on the server with zero JavaScript. The editor mounts the same
  component, which is the point: the surface a coach draws on and the
  surface a player later sees are the same surface, drawn by the same
  code. Before this, the editor and the card thumbnail each drew their
  own pitch from copied numbers.
*/

import { pitchView } from "@/lib/tactics/geometry";
import type { PitchSpec } from "@/lib/tactics/types";

const LINE = "rgba(255,255,255,0.22)";
const FAINT = "rgba(255,255,255,0.12)";
export const PITCH_GREEN = "#0c1a12";

/**
 * Markings for one surface.
 *
 * Each is drawn for its own aspect (see PITCH_VIEW), so the penalty area
 * fills the frame when that is what the coach chose rather than being a
 * small box floating in a full pitch.
 */
export function PitchMarkings({ pitch }: { pitch: PitchSpec }) {
  const v = pitchView(pitch.type);
  const { w, h } = v;

  if (pitch.type === "blank") {
    return (
      <g stroke={FAINT} strokeWidth="0.5" fill="none">
        <rect x="3" y="3" width={w - 6} height={h - 6} strokeDasharray="3 3" />
      </g>
    );
  }

  if (pitch.type === "grid") {
    /* A training square with thirds marked — enough to place a rondo or a
       small-sided game without pretending it is a pitch. */
    return (
      <g stroke={LINE} strokeWidth="0.5" fill="none">
        <rect x="3" y="3" width={w - 6} height={h - 6} />
        <line x1="3" y1={h / 3} x2={w - 3} y2={h / 3} stroke={FAINT} strokeDasharray="2 3" />
        <line x1="3" y1={(h / 3) * 2} x2={w - 3} y2={(h / 3) * 2} stroke={FAINT} strokeDasharray="2 3" />
        <line x1={w / 3} y1="3" x2={w / 3} y2={h - 3} stroke={FAINT} strokeDasharray="2 3" />
        <line x1={(w / 3) * 2} y1="3" x2={(w / 3) * 2} y2={h - 3} stroke={FAINT} strokeDasharray="2 3" />
      </g>
    );
  }

  if (pitch.type === "penalty-area") {
    /* The box, filling the frame: the surface finishing and set-piece work
       actually happens on. Goal at the top, attacking upwards as always. */
    return (
      <g stroke={LINE} strokeWidth="0.5" fill="none">
        <rect x="3" y="3" width={w - 6} height={h - 6} />
        <rect x="8" y="3" width={w - 16} height={h * 0.62} />
        <rect x="30" y="3" width={40} height={h * 0.24} />
        <line x1="36" y1="3" x2="64" y2="3" stroke="var(--text-hi)" strokeWidth="1" />
        <circle cx={w / 2} cy={h * 0.42} r="0.9" fill={LINE} />
        <path d={`M 30 ${h * 0.62} A 22 14 0 0 0 70 ${h * 0.62}`} />
      </g>
    );
  }

  if (pitch.type === "final-third" || pitch.type === "half") {
    /* One attacking end. The halfway line is the bottom edge, so the
       coach is looking at exactly the third or half they chose. */
    const boxH = pitch.type === "half" ? 23 : 27;
    return (
      <g stroke={LINE} strokeWidth="0.5" fill="none">
        <rect x="3" y="3" width={w - 6} height={h - 6} />
        <rect x="21" y="3" width="58" height={boxH} />
        <rect x="37" y="3" width="26" height={boxH * 0.36} />
        <line x1="40" y1="3" x2="60" y2="3" stroke="var(--text-hi)" strokeWidth="1" />
        <circle cx={w / 2} cy={boxH * 0.72} r="0.8" fill={LINE} />
        <path d={`M 34 ${boxH} A 16 10 0 0 0 66 ${boxH}`} />
        {/* the halfway line, at the bottom of the view */}
        <line x1="3" y1={h - 3} x2={w - 3} y2={h - 3} strokeDasharray="4 3" stroke={FAINT} />
      </g>
    );
  }

  /* full — unchanged from migration 0006, to the number. */
  return (
    <g stroke={LINE} strokeWidth="0.5" fill="none">
      <rect x="3" y="3" width={w - 6} height={h - 6} />
      <line x1="3" y1={h / 2} x2={w - 3} y2={h / 2} />
      <circle cx={w / 2} cy={h / 2} r="12" />
      <circle cx={w / 2} cy={h / 2} r="0.8" fill={LINE} />
      {/* our end (bottom) */}
      <rect x="21" y="3" width="58" height="23" />
      <rect x="37" y="3" width="26" height="8" />
      <circle cx={w / 2} cy="18" r="0.8" fill={LINE} />
      {/* attacking end (top) */}
      <rect x="21" y={h - 26} width="58" height="23" />
      <rect x="37" y={h - 11} width="26" height="8" />
      <circle cx={w / 2} cy={h - 18} r="0.8" fill={LINE} />
    </g>
  );
}

/** The grass plus its markings, sized for the surface. */
export function PitchSurface({ pitch }: { pitch: PitchSpec }) {
  const v = pitchView(pitch.type);
  return (
    <>
      <rect x="0" y="0" width={v.w} height={v.h} fill={PITCH_GREEN} />
      <PitchMarkings pitch={pitch} />
    </>
  );
}
