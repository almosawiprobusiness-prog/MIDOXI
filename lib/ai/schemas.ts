import { z } from "zod";

/*
  THE AI BOUNDARY SCHEMAS — Zod at the seam where model output enters
  the product.

  `generateJson` relies on the provider's json_schema enforcement plus a
  `JSON.parse(text) as T` cast. The API keeps that promise almost
  always; "almost" is the problem, because the one malformed payload a
  month lands in a typed variable and detonates three calls later. Each
  engine also hand-clamps its payload — that stays: Zod is the SHAPE
  gate (is this the object we asked for), clamps remain the SANITY gate
  (is 400 minutes a real session).

  Only objects built or rebuilt in this phase get schemas — retrofitting
  every working engine would be churn without a bug to point at. New AI
  surfaces validate from birth.
*/

/** Every value a generated session block may cite comes from the context. */
export const sessionBlockSchema = z.object({
  name: z.string().min(1).max(200),
  detail: z.string().min(1).max(600),
  work: z.string().min(1).max(200),
  sourceKey: z.string().min(1).max(120),
  why: z.string().max(400).catch(""),
});

export const SESSION_KIND_VALUES = [
  "team",
  "individual",
  "gym",
  "conditioning",
  "speed",
  "recovery",
  "mobility",
  "film",
  "tactical",
  "technical",
] as const;

export const sessionPayloadSchema = z.object({
  title: z.string().min(1).max(200),
  kind: z.enum(SESSION_KIND_VALUES).catch("individual"),
  durationMin: z.number().finite(),
  objective: z.string().min(1).max(500),
  blocks: z.array(sessionBlockSchema).max(12),
});

export type SessionPayload = z.infer<typeof sessionPayloadSchema>;

/** A one-or-two-cue match focus. The cap is the product, not a limit. */
export const matchFocusSchema = z.object({
  cues: z.array(z.string().min(3).max(160)).min(1).max(2),
  because: z.string().min(1).max(300),
});

export type MatchFocusPayload = z.infer<typeof matchFocusSchema>;

/**
 * Validate a parsed AI payload. Null means the model answered with
 * something that is not the object we asked for — callers treat it
 * exactly like a failed call (fall back to the composed path).
 *
 * No repair pass: the payload arrived through json_schema enforcement
 * AND JSON.parse already; anything failing Zod after both of those is
 * wrong in a way worth refusing, not patching.
 */
export function validateAi<T>(schema: z.ZodType<T>, data: unknown): T | null {
  const res = schema.safeParse(data);
  return res.success ? res.data : null;
}
