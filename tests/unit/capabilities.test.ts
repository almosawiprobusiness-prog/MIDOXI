import { describe, it, expect } from "vitest";
import {
  CAPABILITIES,
  LIMITS,
  capabilitiesFor,
  findCapability,
  findLimit,
  freeCapabilities,
} from "../../lib/ai/capabilities";
import { parseIntent } from "../../lib/knowledge/intent";
import { ROLES, type RoleId } from "../../lib/roles/roles";

/*
  "The AI can build anything football-wise" is a claim, and this file is where
  it is held to account. Two things are pinned:

    1. Every capability points at a route that exists and is owned by a role.
    2. Every request either routes somewhere real or is refused with a reason.
       Nothing is silently dropped, and nothing MIDO cannot do is quietly
       routed into a tool that will improvise.
*/

const ALL_ROLES: RoleId[] = ["player", "coach", "trainer", "club"];

describe("the capability registry", () => {
  it("names a route for every builder", () => {
    for (const c of CAPABILITIES) {
      expect(c.href, c.id).toMatch(/^\/app\//);
      expect(c.builds.length, c.id).toBeGreaterThan(0);
      expect(c.produces.length, c.id).toBeGreaterThan(0);
    }
  });

  it("gives every builder at least one role that owns it", () => {
    for (const c of CAPABILITIES) {
      expect(c.roles.length, c.id).toBeGreaterThan(0);
      for (const r of c.roles) expect(ALL_ROLES, `${c.id} → ${r}`).toContain(r);
    }
  });

  it("routes every builder to a section that role can actually reach", () => {
    for (const c of CAPABILITIES) {
      for (const role of c.roles) {
        const reachable = [...ROLES[role].nav.map((n) => n.href), "/app/study", "/app/film-room"];
        const base = c.href.split("?")[0];
        const ok = reachable.some((h) => base === h || base.startsWith(h + "/"));
        expect(ok, `${c.id} is not reachable from the ${role} OS (${base})`).toBe(true);
      }
    }
  });

  it("gives every role something it can build for free", () => {
    for (const role of ALL_ROLES) {
      expect(freeCapabilities(role).length, role).toBeGreaterThan(0);
    }
  });

  it("gives every role a meaningful set of builders, not one token entry", () => {
    for (const role of ALL_ROLES) {
      expect(capabilitiesFor(role).length, role).toBeGreaterThanOrEqual(3);
    }
  });

  it("prefers the builder the asking role owns", () => {
    // Sessions belong to coaches and trainers; a club asking gets one too.
    expect(findCapability("build a pressing session", "coach")?.id).toBe("session");
    expect(findCapability("build a six-week speed block", "trainer")?.id).toBe("program");
  });

  it("routes its own examples", () => {
    for (const c of CAPABILITIES) {
      const hit = findCapability(c.example, c.roles[0]);
      expect(hit, `"${c.example}" routes nowhere`).not.toBeNull();
    }
  });
});

describe("the limits", () => {
  it("gives a reason for every refusal", () => {
    for (const l of LIMITS) {
      expect(l.why.length, l.asked).toBeGreaterThan(20);
    }
  });

  it("refuses measurement, because frames are not measurement", () => {
    expect(findLimit("how much distance did I cover")).not.toBeNull();
    expect(findLimit("what was my top speed")).not.toBeNull();
    expect(findLimit("show me a heatmap")).not.toBeNull();
  });

  it("refuses medical and nutrition judgements outright, with no 'would need'", () => {
    const medical = findLimit("is my hamstring strain healed, am i fit");
    expect(medical).not.toBeNull();
    expect(medical?.wouldNeed).toBeNull();
    expect(findLimit("give me a meal plan")?.wouldNeed).toBeNull();
  });

  it("refuses to judge whether someone will make it professionally", () => {
    expect(findLimit("will i make it as a pro")).not.toBeNull();
  });

  it("says what a data gap would need, where a vendor would close it", () => {
    expect(findLimit("what is my xg")?.wouldNeed).toBeTruthy();
    expect(findLimit("show me the league table")?.wouldNeed).toBeTruthy();
  });
});

describe("the command bar answers, or says why not", () => {
  it("refuses measurement rather than routing it into the film room", () => {
    const intent = parseIntent("how much distance did I cover in the video", "player");
    expect(intent?.kind).toBe("cannot");
    expect(intent?.hint.toLowerCase()).toContain("measure");
  });

  it("routes a request the fast patterns miss", () => {
    const intent = parseIntent("set up a 4-3-3 build-up shape", "coach");
    expect(intent?.kind).toBe("build");
    expect(intent?.href).toContain("/app/tactics");
  });

  it("carries the request across, so the builder opens with the brief", () => {
    const intent = parseIntent("write our playing identity", "club");
    expect(intent?.kind).toBe("build");
    expect(intent?.href).toContain("brief=");
  });

  it("still prefers a precise route over the registry", () => {
    // "Study Harry Kane" must open Kane, not the generic study builder.
    expect(parseIntent("Study Harry Kane", "player")?.kind).toBe("study-person");
  });

  it("checks the refusal before the builder, so a bad ask never gets improvised", () => {
    // Mentions film AND asks for a measurement. The refusal has to win.
    const intent = parseIntent("analyse this clip and tell me the sprint count", "coach");
    expect(intent?.kind).toBe("cannot");
  });
});
