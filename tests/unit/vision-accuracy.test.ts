import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { identityLevelFrom, IDENTITY_META } from "@/lib/video/provider";
import { composePitchIdentity, kitColorIssue, KIT_COLORS } from "@/lib/data/pitch-identity";
import { PROMPT_MANIFEST } from "@/lib/ai/prompts";

/*
  The vision accuracy pass — the rules the benchmark bought.

  These pin the parts that must not drift: the identity-level derivation
  (false attribution is the worst failure the feature has), the prompt-v2
  clauses that measurably eliminated it, the model defaults the benchmark
  selected, and the version bookkeeping that makes future comparison
  possible.
*/

const nativeVideoSrc = () =>
  readFileSync(join(process.cwd(), "lib", "video", "native-video.ts"), "utf8");
const geminiSrc = () => readFileSync(join(process.cwd(), "lib", "video", "gemini.ts"), "utf8");

describe("identity level", () => {
  it("is none when no identity was given, whatever the model claims", () => {
    expect(
      identityLevelFrom({ basis: "squad-number", squadNumberLegible: true, couldMatchOthers: 0 }, false).level,
    ).toBe("none");
  });

  it("is none when the model's basis is none", () => {
    expect(identityLevelFrom({ basis: "none", couldMatchOthers: 0 }, true).level).toBe("none");
  });

  it("high needs a legible number AND exactly one match", () => {
    expect(
      identityLevelFrom({ basis: "squad-number", squadNumberLegible: true, couldMatchOthers: 0 }, true).level,
    ).toBe("high");
    // A claimed squad-number basis with an ILLEGIBLE number is the overclaim
    // the benchmark caught (config F on the goal-mouth clip) — never high.
    expect(
      identityLevelFrom({ basis: "squad-number", squadNumberLegible: false, couldMatchOthers: 0 }, true).level,
    ).toBe("moderate");
  });

  it("kit-and-role with few lookalikes is moderate; with many it is low", () => {
    expect(identityLevelFrom({ basis: "kit-and-role", couldMatchOthers: 2 }, true).level).toBe("moderate");
    expect(identityLevelFrom({ basis: "kit-and-role", couldMatchOthers: 9 }, true).level).toBe("low");
  });

  it("survives garbage from the model", () => {
    const out = identityLevelFrom({ basis: "trust-me", couldMatchOthers: "many" }, true);
    expect(out.level).toBe("none");
    expect(out.couldMatchOthers).toBe(0);
  });

  it("every level has UI copy", () => {
    for (const level of ["high", "moderate", "low", "none"] as const) {
      expect(IDENTITY_META[level].label.length).toBeGreaterThan(0);
      expect(IDENTITY_META[level].hint.length).toBeGreaterThan(10);
    }
  });
});

describe("pitch identity composition", () => {
  it("composes the full structured line", () => {
    expect(
      composePitchIdentity({
        teamSide: "home",
        kitPrimary: "royal blue",
        kitSecondary: "white",
        squadNumber: 10,
        position: "ST",
        note: "black boots",
      }),
    ).toBe("home team, royal blue and white kit, number 10, plays ST. black boots");
  });

  it("partial parts still compose", () => {
    expect(composePitchIdentity({ kitPrimary: "red", squadNumber: 7 })).toBe("red kit, number 7");
    expect(composePitchIdentity({ note: "the tall keeper" })).toBe("the tall keeper");
  });

  it("empty means empty — never an empty description", () => {
    expect(composePitchIdentity({})).toBe("");
    expect(composePitchIdentity({ teamSide: "neither" })).toBe("");
  });

  it("kit colours are sane", () => {
    expect(KIT_COLORS).toContain("royal blue");
    expect(kitColorIssue("a very long descriptive paragraph of colour")).not.toBeNull();
    expect(kitColorIssue("navy")).toBeNull();
  });
});

describe("prompt v2 — the clauses the benchmark bought", () => {
  const src = nativeVideoSrc();

  it("carries the referee/kit-mismatch abstention rule", () => {
    expect(src).toContain("a referee is never the viewer");
    expect(src).toContain("matches no outfield player");
  });

  it("forbids second-person prose without an identification", () => {
    expect(src).toMatch(/When basis is "none", never write "you"/);
  });

  it("carries the outcome discipline rule", () => {
    expect(src).toContain("An invented save is as wrong as an invented goal");
  });

  it("carries the scanning restraint rule", () => {
    expect(src).toContain("Do not turn ordinary glances into tactical scanning");
  });

  it("refuses to carry identity across a scene cut", () => {
    expect(src).toContain("NEVER carry the viewer's identity across a cut");
  });
});

describe("versioning that makes later comparison possible", () => {
  it("VIDEO_PROMPT_VERSION matches the manifest", () => {
    const m = nativeVideoSrc().match(/export const VIDEO_PROMPT_VERSION = (\d+)/);
    expect(m).not.toBeNull();
    const entry = PROMPT_MANIFEST.find((p) => p.def.name === "video_read");
    expect(entry?.def.version).toBe(Number(m![1]));
  });

  it("the default models are the benchmark's choices", () => {
    const src = geminiSrc();
    // The old default (gemini-3.6-flash) 500s on YouTube via Vertex — a fresh
    // deploy without the env pin must not resurrect it.
    expect(src).toContain('env.geminiVideoModel || "gemini-3.7-flash"');
    expect(src).toContain('env.geminiVideoModelDeep || "gemini-2.5-pro"');
    expect(src).not.toContain('|| "gemini-3.6-flash"');
  });
});

describe("frames lane discipline", () => {
  const src = readFileSync(join(process.cwd(), "lib", "video", "frame-reader.ts"), "utf8");

  it("sends the viewer identity it used to drop", () => {
    expect(src).toContain("onThePitch");
  });

  it("requires confidence and aboutViewer from the model", () => {
    expect(src).toMatch(/required: \["atSeconds", "title", "body", "confidence", "aboutViewer"\]/);
  });

  it("caps viewer claims — stills can never fully verify identity", () => {
    expect(src).toContain('identityGiven ? "inferred" : "uncertain"');
  });
});
