/*
  MIDO PUBLISH — the palette, as literals.

  `ImageResponse` renders in an isolated context that cannot read CSS
  custom properties, so the artifact renderer cannot use the tokens in
  `app/globals.css` directly. These are those tokens' VALUES, copied —
  which means globals.css is still the single source of design truth
  and this file is its shadow. If a colour changes there, change it
  here, or published cards drift away from the product that made them
  (which is exactly what had happened before this file existed).
*/

export const PUBLISH_INK = "#08090b"; // --ink-950
export const PUBLISH_PANEL = "#111419"; // --ink-850
export const PUBLISH_LINE = "#232830"; // --line at 11% on ink, flattened — hairlines can't be alpha here
export const PUBLISH_HI = "#f3f5f8"; // --text-hi
export const PUBLISH_TEXT = "#c4cbd4"; // --text
export const PUBLISH_DIM = "#838d99"; // --text-dim
export const PUBLISH_SIGNAL = "#7b61ff"; // --signal
export const PUBLISH_POSITIVE = "#57d996"; // --positive

/*
  Personal accents a player may choose for their own artifacts.
  A short, deliberate list — every one reads on the ink background —
  rather than a colour picker that can produce an unreadable card.
  The key is stored/passed around; the value is what renders.
*/
export const PUBLISH_ACCENTS: { key: string; label: string; value: string }[] = [
  { key: "signal", label: "MIDO violet", value: PUBLISH_SIGNAL },
  { key: "emerald", label: "Emerald", value: "#34d399" },
  { key: "gold", label: "Gold", value: "#e7b54c" },
  { key: "crimson", label: "Crimson", value: "#f0655f" },
  { key: "ice", label: "Ice blue", value: "#7cc7ff" },
  { key: "white", label: "White heat", value: "#f3f5f8" },
];

export function accentValue(key: string | null | undefined): string {
  return PUBLISH_ACCENTS.find((a) => a.key === key)?.value ?? PUBLISH_SIGNAL;
}
