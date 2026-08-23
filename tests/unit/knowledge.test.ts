import { describe, it, expect } from "vitest";
import { CONCEPTS, CONCEPT_EDGES, concept } from "../../lib/knowledge/concepts";
import { PEOPLE, findPerson } from "../../lib/knowledge/people";
import { connectionsFor, relevantConcepts, searchKnowledge, peopleForConcept } from "../../lib/knowledge/graph";
import { positionGroup } from "../../lib/knowledge/types";

/*
  The knowledge graph is curated content, so these tests are integrity tests:
  a dangling slug would silently produce an empty study module, which is exactly
  the kind of quiet failure the product must not ship.
*/

const SLUGS = new Set(CONCEPTS.map((c) => c.slug));

describe("concept catalogue", () => {
  it("has unique slugs", () => {
    expect(SLUGS.size).toBe(CONCEPTS.length);
  });

  it("gives every concept teachable material", () => {
    for (const c of CONCEPTS) {
      expect(c.definition.length, c.slug).toBeGreaterThan(20);
      expect(c.why.length, c.slug).toBeGreaterThan(20);
      expect(c.looksLike.length, c.slug).toBeGreaterThanOrEqual(2);
      expect(c.cues.length, c.slug).toBeGreaterThanOrEqual(2);
      expect(c.trains.length, c.slug).toBeGreaterThanOrEqual(1);
      expect(c.positions.length, c.slug).toBeGreaterThanOrEqual(1);
    }
  });

  it("has no dangling edges", () => {
    for (const e of CONCEPT_EDGES) {
      expect(SLUGS.has(e.from), `edge from ${e.from}`).toBe(true);
      expect(SLUGS.has(e.to), `edge to ${e.to}`).toBe(true);
    }
  });

  it("walks edges in both directions", () => {
    const conns = connectionsFor("scanning");
    expect(conns.length).toBeGreaterThan(0);
    expect(conns.some((c) => c.direction === "in")).toBe(true);
  });
});

describe("people catalogue", () => {
  it("has unique slugs and verified records", () => {
    const slugs = new Set(PEOPLE.map((p) => p.slug));
    expect(slugs.size).toBe(PEOPLE.length);
    for (const p of PEOPLE) {
      expect(p.verified.length, p.slug).toBeGreaterThanOrEqual(3);
      expect(p.modules.length, p.slug).toBeGreaterThanOrEqual(4);
      expect(p.embodies.length, p.slug).toBeGreaterThanOrEqual(4);
    }
  });

  it("only references concepts that exist", () => {
    for (const p of PEOPLE) {
      for (const slug of p.embodies) {
        expect(SLUGS.has(slug), `${p.slug} embodies ${slug}`).toBe(true);
      }
      for (const m of p.modules) {
        expect(m.concepts.length, `${p.slug}/${m.key}`).toBeGreaterThanOrEqual(1);
        for (const slug of m.concepts) {
          expect(SLUGS.has(slug), `${p.slug}/${m.key} -> ${slug}`).toBe(true);
        }
      }
    }
  });

  it("only curates modules the person actually has", () => {
    for (const p of PEOPLE) {
      const keys = new Set(p.modules.map((m) => m.key));
      for (const key of Object.keys(p.curated ?? {})) {
        expect(keys.has(key), `${p.slug} curated ${key}`).toBe(true);
      }
    }
  });

  it("resolves people by full name, surname and slug", () => {
    expect(findPerson("Harry Kane")?.slug).toBe("harry-kane");
    expect(findPerson("kane")?.slug).toBe("harry-kane");
    expect(findPerson("harry-kane")?.slug).toBe("harry-kane");
    expect(findPerson("Pep Guardiola")?.kind).toBe("coach");
    expect(findPerson("nobody at all")).toBeNull();
  });
});

describe("graph queries", () => {
  it("maps position strings to groups", () => {
    expect(positionGroup("CF")).toBe("CF");
    expect(positionGroup("ST")).toBe("CF");
    expect(positionGroup("6")).toBe("DM");
    expect(positionGroup("RCB")).toBe("CB");
    expect(positionGroup("LWB")).toBe("FB");
    expect(positionGroup("")).toBe("CF");
  });

  it("narrows a study to the reader's position, but never to nothing", () => {
    const kane = PEOPLE.find((p) => p.slug === "harry-kane")!;
    const forStriker = relevantConcepts(kane, "CF");
    const forKeeper = relevantConcepts(kane, "GK");
    expect(forStriker.length).toBeGreaterThan(0);
    // No overlap with a goalkeeper, so it falls back to the subject's spine.
    expect(forKeeper.length).toBeGreaterThan(0);
  });

  it("finds who to watch for a concept", () => {
    const people = peopleForConcept("positional-play");
    expect(people.map((p) => p.slug)).toContain("pep-guardiola");
  });

  it("searches people and concepts together", () => {
    const hits = searchKnowledge("pressing");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.kind === "concept")).toBe(true);
    expect(concept("pressing-triggers")).not.toBeNull();
  });
});
