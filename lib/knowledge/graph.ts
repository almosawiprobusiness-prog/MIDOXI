import { CONCEPTS, CONCEPT_EDGES, concept } from "./concepts";
import { PEOPLE, person } from "./people";
import type { FootballConcept, FootballPerson, KnowledgeEdge, PositionGroup } from "./types";

/*
  Graph traversal.

  MIDO uses these to explain *connections* — why studying Kane leads to
  scanning, why scanning leads to decision speed, why a compact block is the
  problem that dropping between the lines solves. The relationships are
  curated; this file only walks them.
*/

export interface Connection {
  edge: KnowledgeEdge;
  concept: FootballConcept;
  /** Direction relative to the concept the walk started from. */
  direction: "out" | "in";
}

/** Every curated relationship touching a concept. */
export function connectionsFor(slug: string): Connection[] {
  const out: Connection[] = [];
  for (const edge of CONCEPT_EDGES) {
    if (edge.from === slug) {
      const c = concept(edge.to);
      if (c) out.push({ edge, concept: c, direction: "out" });
    } else if (edge.to === slug) {
      const c = concept(edge.from);
      if (c) out.push({ edge, concept: c, direction: "in" });
    }
  }
  return out;
}

/** Concepts one hop away, deduplicated. */
export function relatedConcepts(slug: string, limit = 6): FootballConcept[] {
  const seen = new Set<string>([slug]);
  const result: FootballConcept[] = [];
  for (const c of connectionsFor(slug)) {
    if (seen.has(c.concept.slug)) continue;
    seen.add(c.concept.slug);
    result.push(c.concept);
    if (result.length >= limit) break;
  }
  return result;
}

/** People whose game embodies a concept — "who should I watch for this?" */
export function peopleForConcept(slug: string): FootballPerson[] {
  return PEOPLE.filter((p) => p.embodies.includes(slug));
}

export function conceptsForPosition(group: PositionGroup): FootballConcept[] {
  return CONCEPTS.filter((c) => c.positions.includes(group));
}

export function peopleForPosition(group: PositionGroup): FootballPerson[] {
  return PEOPLE.filter((p) => p.positions.includes(group));
}

/**
 * The concepts a study should emphasise for a given reader: the intersection of
 * what the subject embodies and what the reader's position actually needs,
 * falling back to the subject's own spine when there is no overlap.
 */
export function relevantConcepts(subject: FootballPerson, group: PositionGroup): FootballConcept[] {
  const spine = subject.embodies.map((s) => concept(s)).filter((c): c is FootballConcept => Boolean(c));
  const relevant = spine.filter((c) => c.positions.includes(group));
  return relevant.length ? relevant : spine;
}

export interface KnowledgeHit {
  kind: "person" | "concept";
  slug: string;
  title: string;
  subtitle: string;
  href: string;
  score: number;
}

/** Ranked search across the whole graph — powers universal search. */
export function searchKnowledge(query: string, limit = 8): KnowledgeHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/).filter(Boolean);
  const hits: KnowledgeHit[] = [];

  const score = (haystack: string, weightExact: number) => {
    const hay = haystack.toLowerCase();
    let s = 0;
    if (hay.includes(q)) s += weightExact;
    for (const t of terms) if (t.length > 2 && hay.includes(t)) s += 1;
    return s;
  };

  for (const p of PEOPLE) {
    const s = score(`${p.name} ${p.descriptor} ${p.premise}`, 6) + score(p.name, 4);
    if (s > 0) {
      hits.push({
        kind: "person",
        slug: p.slug,
        title: p.name,
        subtitle: p.descriptor,
        href: `/app/study/${p.slug}`,
        score: s,
      });
    }
  }

  for (const c of CONCEPTS) {
    const s = score(`${c.name} ${c.definition} ${c.why}`, 5) + score(c.name, 4);
    if (s > 0) {
      hits.push({
        kind: "concept",
        slug: c.slug,
        title: c.name,
        subtitle: `${c.area} · ${c.definition}`,
        href: `/app/study/concept/${c.slug}`,
        score: s,
      });
    }
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

export { CONCEPTS, CONCEPT_EDGES, concept, PEOPLE, person };
