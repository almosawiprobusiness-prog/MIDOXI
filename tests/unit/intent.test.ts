import { describe, it, expect } from "vitest";
import { parseIntent } from "../../lib/knowledge/intent";

/*
  The command bar routes work into modules. If classification drifts, "Study
  Harry Kane" silently becomes a search box — so the routes are pinned here.
*/

describe("command intent", () => {
  it("routes a known person straight to their study", () => {
    const i = parseIntent("Study Harry Kane");
    expect(i?.kind).toBe("study-person");
    expect(i?.href).toBe("/app/study/harry-kane");
  });

  it("accepts other phrasings of the study command", () => {
    expect(parseIntent("teach me about Rodri")?.href).toBe("/app/study/rodri");
    expect(parseIntent("break down Pep Guardiola")?.href).toBe("/app/study/pep-guardiola");
    expect(parseIntent("analyse Virgil van Dijk")?.href).toBe("/app/study/virgil-van-dijk");
  });

  it("routes a known concept to the concept page", () => {
    const i = parseIntent("study pressing triggers");
    expect(i?.kind).toBe("study-concept");
    expect(i?.href).toBe("/app/study/concept/pressing-triggers");
  });

  it("keeps an unknown subject honest rather than inventing a study", () => {
    const i = parseIntent("study my neighbour");
    expect(i?.kind).toBe("study-open");
    expect(i?.href).toContain("/app/study?q=");
    expect(i?.hint.toLowerCase()).toContain("not in the curated library");
  });

  it("routes session briefs into training with the brief attached", () => {
    const i = parseIntent("Build me a striker session");
    expect(i?.kind).toBe("build-session");
    expect(i?.href.startsWith("/app/training?brief=")).toBe(true);
  });

  it("routes match, development and film requests", () => {
    expect(parseIntent("review my last match")?.kind).toBe("review-match");
    expect(parseIntent("what should I improve this week?")?.kind).toBe("development");
    expect(parseIntent("upload a clip")?.kind).toBe("clip");
    expect(parseIntent("log a match")?.kind).toBe("log-match");
  });

  it("returns null when there is nothing to route", () => {
    expect(parseIntent("")).toBeNull();
    expect(parseIntent("hello")).toBeNull();
  });

  it("adapts the hint to the active role", () => {
    const coach = parseIntent("create a session about pressing", "coach");
    const player = parseIntent("create a session about pressing", "player");
    expect(coach?.hint).not.toBe(player?.hint);
    expect(coach?.hint).toContain("training module");
  });
});
