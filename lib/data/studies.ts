import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth/session";
import { getProfileSettings } from "./profile";
import { listGoals } from "./development";
import { person } from "@/lib/knowledge/people";
import { composeStudy, makeViewer } from "@/lib/ai/study-engine";
import type { RoleId } from "@/lib/roles/roles";
import type {
  ApplyPlan,
  MatchStudy,
  RenderedModule,
  StudyView,
  TrainingPlan,
} from "@/lib/knowledge/study-types";

/*
  Study persistence.

  A study is composed deterministically on every load (free, always available),
  then any previously generated or user-owned material is merged on top. That
  means a paid personalisation is bought once and read forever, and a study is
  never blank because Claude is unreachable.

  Demo mode keeps studies in a module-scoped store so the whole loop —
  start, personalise, take into training, complete — can be explored without a
  backend.
*/

export interface StudyRecord {
  id: string;
  subjectSlug: string;
  subjectName: string;
  subjectKind: "player" | "coach" | "concept";
  viewerRole: RoleId;
  headline: string;
  status: "active" | "completed" | "archived";
  completedModules: string[];
  source: "curated" | "ai" | "hybrid";
  createdAt: string;
}

export interface StudyTakeaway {
  id: string;
  studyId: string;
  kind: "note" | "training" | "goal" | "clip" | "quiz";
  body: string | null;
  linkedTable: string | null;
  linkedId: string | null;
  score: number | null;
  createdAt: string;
}

// ── demo store ───────────────────────────────────────────────

type ModuleBody = Record<string, unknown>;
/** studyId -> module key -> saved body */
type ModuleBag = Record<string, ModuleBody>;

interface DemoStudyDB {
  studies: StudyRecord[];
  modules: Record<string, ModuleBag>;
  takeaways: StudyTakeaway[];
  seq: number;
}

const g = globalThis as unknown as { __midoStudyDB?: DemoStudyDB };
const demoDB: DemoStudyDB = (g.__midoStudyDB ??= { studies: [], modules: {}, takeaways: [], seq: 1 });
const nextId = (p: string) => `${p}${demoDB.seq++}`;

// ── viewer context ───────────────────────────────────────────

export async function currentViewer() {
  const user = await getCurrentUser();
  const [profile, goals] = await Promise.all([getProfileSettings(), listGoals()]);
  return makeViewer({
    role: user?.role ?? "player",
    position: profile.primaryPosition || "",
    goals: goals.filter((gl) => gl.status !== "achieved").map((gl) => gl.title),
  });
}

// ── reads ────────────────────────────────────────────────────

export async function listStudies(): Promise<StudyRecord[]> {
  if (isDemoMode) return [...demoDB.studies].reverse();

  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase.from("studies").select("*").order("created_at", { ascending: false }).limit(50);
  return (data ?? []).map(rowToStudy);
}

function rowToStudy(r: Record<string, unknown>): StudyRecord {
  return {
    id: r.id as string,
    subjectSlug: r.subject_slug as string,
    subjectName: r.subject_name as string,
    subjectKind: (r.subject_kind as StudyRecord["subjectKind"]) ?? "player",
    viewerRole: (r.viewer_role as RoleId) ?? "player",
    headline: (r.headline as string) ?? "",
    status: (r.status as StudyRecord["status"]) ?? "active",
    completedModules: (r.completed_modules as string[]) ?? [],
    source: (r.source as StudyRecord["source"]) ?? "curated",
    createdAt: (r.created_at as string) ?? new Date().toISOString(),
  };
}

/** The study record for a subject, if this user has opened it before. */
export async function findStudy(subjectSlug: string, role: RoleId): Promise<StudyRecord | null> {
  if (isDemoMode) {
    return demoDB.studies.find((s) => s.subjectSlug === subjectSlug && s.viewerRole === role) ?? null;
  }
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("studies")
    .select("*")
    .eq("subject_slug", subjectSlug)
    .eq("viewer_role", role)
    .maybeSingle();
  return data ? rowToStudy(data) : null;
}

/** Saved module bodies for a study, keyed by module key. */
async function savedModules(studyId: string): Promise<ModuleBag> {
  if (isDemoMode) return demoDB.modules[studyId] ?? {};
  const supabase = await createClient();
  if (!supabase) return {};
  const { data } = await supabase.from("study_modules").select("key, body").eq("study_id", studyId);
  const out: ModuleBag = {};
  for (const row of data ?? []) out[row.key as string] = (row.body as Record<string, unknown>) ?? {};
  return out;
}

export interface StudyPage {
  view: StudyView;
  record: StudyRecord | null;
  takeaways: StudyTakeaway[];
}

/**
 * Compose the study for the current reader, merging any material previously
 * generated for them. Never calls the AI — generation is an explicit action.
 */
export async function getStudyPage(subjectSlug: string): Promise<StudyPage | null> {
  const subject = person(subjectSlug);
  if (!subject) return null;

  const viewer = await currentViewer();
  const base = composeStudy(subject, viewer);
  const record = await findStudy(subjectSlug, viewer.role);
  if (!record) return { view: base, record: null, takeaways: [] };

  const saved = await savedModules(record.id);
  const view = mergeSaved(base, saved);
  const takeaways = await listTakeaways(record.id);
  return { view, record, takeaways };
}

function mergeSaved(base: StudyView, saved: ModuleBag): StudyView {
  if (!Object.keys(saved).length) return base;

  const modules: RenderedModule[] = base.modules.map((m) => {
    const body = saved[m.key];
    if (!body || m.source === "curated") return m;
    return {
      ...m,
      source: "ai",
      summary: (body.summary as string) ?? m.summary,
      points: (body.points as RenderedModule["points"]) ?? m.points,
      watchFor: (body.watchFor as string[]) ?? m.watchFor,
    };
  });

  const match = saved.__match as unknown as MatchStudy | undefined;
  const training = saved.__training as unknown as TrainingPlan | undefined;
  const apply = saved.__apply as unknown as ApplyPlan | undefined;

  return {
    ...base,
    modules,
    matchStudy: match?.instruction ? { ...match, source: "ai" } : base.matchStudy,
    training: training?.blocks?.length ? { ...training, source: "ai" } : base.training,
    apply: apply?.points?.length ? { ...apply, source: "ai" } : base.apply,
    enhanced: true,
  };
}

export async function listTakeaways(studyId: string): Promise<StudyTakeaway[]> {
  if (isDemoMode) return demoDB.takeaways.filter((t) => t.studyId === studyId).reverse();
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("study_takeaways")
    .select("*")
    .eq("study_id", studyId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((t) => ({
    id: t.id as string,
    studyId: t.study_id as string,
    kind: t.kind as StudyTakeaway["kind"],
    body: (t.body as string) ?? null,
    linkedTable: (t.linked_table as string) ?? null,
    linkedId: (t.linked_id as string) ?? null,
    score: (t.score as number) ?? null,
    createdAt: (t.created_at as string) ?? new Date().toISOString(),
  }));
}

// ── writes ───────────────────────────────────────────────────

/** Create the study row for a subject if the reader has not opened it before. */
export async function ensureStudy(view: StudyView): Promise<StudyRecord | null> {
  const existing = await findStudy(view.subject.slug, view.viewer.role);
  if (existing) return existing;

  const base = {
    subject_slug: view.subject.slug,
    subject_name: view.subject.name,
    subject_kind: view.subject.kind,
    viewer_role: view.viewer.role,
    viewer_position: view.viewer.position || null,
    headline: view.subject.premise.slice(0, 240),
    source: view.enhanced ? "hybrid" : "curated",
  };

  if (isDemoMode) {
    const rec: StudyRecord = {
      id: nextId("st"),
      subjectSlug: view.subject.slug,
      subjectName: view.subject.name,
      subjectKind: view.subject.kind,
      viewerRole: view.viewer.role,
      headline: base.headline,
      status: "active",
      completedModules: [],
      source: base.source as StudyRecord["source"],
      createdAt: new Date().toISOString(),
    };
    demoDB.studies.push(rec);
    return rec;
  }

  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("studies").insert(base).select("*").maybeSingle();
  if (error || !data) return null;
  return rowToStudy(data);
}

/** Persist generated material so a metered generation is bought only once. */
export async function saveGenerated(studyId: string, view: StudyView): Promise<void> {
  const rows: { key: string; title: string; ordinal: number; body: ModuleBody }[] = [];

  view.modules.forEach((m, i) => {
    if (m.source !== "ai") return;
    rows.push({
      key: m.key,
      title: m.title,
      ordinal: i,
      body: { summary: m.summary, points: m.points, watchFor: m.watchFor ?? [] },
    });
  });
  if (view.matchStudy.source === "ai") {
    rows.push({ key: "__match", title: "Match study", ordinal: 90, body: { ...view.matchStudy } });
  }
  if (view.training.source === "ai") {
    rows.push({ key: "__training", title: "Take into training", ordinal: 91, body: { ...view.training } });
  }
  if (view.apply.source === "ai") {
    rows.push({ key: "__apply", title: "Apply to my game", ordinal: 92, body: { ...view.apply } });
  }
  if (!rows.length) return;

  if (isDemoMode) {
    const bag = (demoDB.modules[studyId] ??= {});
    for (const r of rows) bag[r.key] = r.body;
    const rec = demoDB.studies.find((s) => s.id === studyId);
    if (rec) rec.source = "hybrid";
    return;
  }

  const supabase = await createClient();
  if (!supabase) return;
  await supabase.from("study_modules").upsert(
    rows.map((r) => ({
      study_id: studyId,
      key: r.key,
      title: r.title,
      ordinal: r.ordinal,
      provenance: "analysis",
      body: r.body,
    })),
    { onConflict: "study_id,key" },
  );
  await supabase.from("studies").update({ source: "hybrid" }).eq("id", studyId);
}

export async function setModuleComplete(studyId: string, key: string, complete: boolean): Promise<string[]> {
  if (isDemoMode) {
    const rec = demoDB.studies.find((s) => s.id === studyId);
    if (!rec) return [];
    const set = new Set(rec.completedModules);
    if (complete) set.add(key);
    else set.delete(key);
    rec.completedModules = [...set];
    return rec.completedModules;
  }

  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase.from("studies").select("completed_modules").eq("id", studyId).maybeSingle();
  const set = new Set(((data?.completed_modules as string[]) ?? []) as string[]);
  if (complete) set.add(key);
  else set.delete(key);
  const next = [...set];
  await supabase.from("studies").update({ completed_modules: next }).eq("id", studyId);
  return next;
}

export async function addTakeaway(input: {
  studyId: string;
  kind: StudyTakeaway["kind"];
  body?: string;
  linkedTable?: string;
  linkedId?: string;
  score?: number;
}): Promise<void> {
  if (isDemoMode) {
    demoDB.takeaways.push({
      id: nextId("tk"),
      studyId: input.studyId,
      kind: input.kind,
      body: input.body ?? null,
      linkedTable: input.linkedTable ?? null,
      linkedId: input.linkedId ?? null,
      score: input.score ?? null,
      createdAt: new Date().toISOString(),
    });
    return;
  }
  const supabase = await createClient();
  if (!supabase) return;
  await supabase.from("study_takeaways").insert({
    study_id: input.studyId,
    kind: input.kind,
    body: input.body ?? null,
    linked_table: input.linkedTable ?? null,
    linked_id: input.linkedId ?? null,
    score: input.score ?? null,
  });
}
