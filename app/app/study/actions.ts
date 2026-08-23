"use server";

import { revalidatePath } from "next/cache";
import { getStudyPage, ensureStudy, saveGenerated, setModuleComplete, addTakeaway } from "@/lib/data/studies";
import { enhanceStudy } from "@/lib/ai/study-engine";
import { createTraining } from "@/app/app/training/actions";
import { createGoal } from "@/app/app/development/actions";

/*
  The Study loop, as server actions.

  Study -> Train -> Apply -> Review is only real if the buttons write real rows.
  "Take into training" creates an actual training session. "Apply to my game"
  creates an actual development goal. Both are recorded as takeaways so the
  study remembers what came out of it.
*/

export type StudyResult =
  | { ok: true; id?: string; message?: string }
  | { ok: false; error: string };

/** The metered Claude pass. Buys once, saves, and is free to read afterwards. */
export async function personaliseStudy(slug: string): Promise<StudyResult> {
  const page = await getStudyPage(slug);
  if (!page) return { ok: false, error: "That study does not exist yet." };

  const record = page.record ?? (await ensureStudy(page.view));
  const { view, enhanced, note } = await enhanceStudy(page.view, slug);
  if (!enhanced) return { ok: false, error: note ?? "MIDO could not personalise this study right now." };

  if (record) await saveGenerated(record.id, view);
  revalidatePath(`/app/study/${slug}`);
  return { ok: true, id: record?.id, message: "Study personalised to your position and goals." };
}

export async function toggleModule(slug: string, key: string, complete: boolean): Promise<StudyResult> {
  const page = await getStudyPage(slug);
  if (!page) return { ok: false, error: "Study not found." };
  const record = page.record ?? (await ensureStudy(page.view));
  if (!record) return { ok: false, error: "Could not save progress." };
  await setModuleComplete(record.id, key, complete);
  revalidatePath(`/app/study/${slug}`);
  return { ok: true };
}

/** Turns the study's session plan into a real training session. */
export async function takeIntoTraining(slug: string): Promise<StudyResult> {
  const page = await getStudyPage(slug);
  if (!page) return { ok: false, error: "Study not found." };
  const record = page.record ?? (await ensureStudy(page.view));

  const plan = page.view.training;
  // Default to tomorrow morning — a session you plan is a session you schedule.
  const when = new Date(Date.now() + 864e5);
  when.setHours(10, 0, 0, 0);
  const scheduledAt = new Date(when.getTime() - when.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  const objective = [
    plan.objective,
    ...plan.blocks.map((b, i) => `${i + 1}. ${b.name.replace(/^\d+\.\s*/, "")} — ${b.detail} (${b.work})`),
  ].join("\n");

  const res = await createTraining({
    kind: plan.kind,
    title: plan.title,
    scheduledAt,
    durationMin: plan.durationMin,
    objective,
  });
  if (!res.ok) return { ok: false, error: res.error };

  if (record) {
    await addTakeaway({
      studyId: record.id,
      kind: "training",
      body: plan.title,
      linkedTable: "training_sessions",
      linkedId: res.id,
    });
  }

  revalidatePath(`/app/study/${slug}`);
  revalidatePath("/app/training");
  return { ok: true, id: res.id, message: "Session added to your training." };
}

/** Turns the study's takeaway into a real development goal. */
export async function applyToMyGame(slug: string): Promise<StudyResult> {
  const page = await getStudyPage(slug);
  if (!page) return { ok: false, error: "Study not found." };
  const record = page.record ?? (await ensureStudy(page.view));

  const goal = page.view.apply.goal;
  const res = await createGoal({
    category: goal.category,
    title: goal.title,
    why: goal.why,
    status: "active",
    progress: 0,
  });
  if (!res.ok) return { ok: false, error: res.error };

  if (record) {
    await addTakeaway({
      studyId: record.id,
      kind: "goal",
      body: goal.title,
      linkedTable: "development_goals",
      linkedId: res.id,
    });
  }

  revalidatePath(`/app/study/${slug}`);
  revalidatePath("/app/development");
  return { ok: true, id: res.id, message: "Development goal created." };
}

export async function saveNote(slug: string, body: string): Promise<StudyResult> {
  const text = body.trim();
  if (!text) return { ok: false, error: "Write something first." };
  const page = await getStudyPage(slug);
  if (!page) return { ok: false, error: "Study not found." };
  const record = page.record ?? (await ensureStudy(page.view));
  if (!record) return { ok: false, error: "Could not save the note." };
  await addTakeaway({ studyId: record.id, kind: "note", body: text });
  revalidatePath(`/app/study/${slug}`);
  return { ok: true, message: "Observation saved." };
}

export async function saveQuizScore(slug: string, score: number, total: number): Promise<StudyResult> {
  const page = await getStudyPage(slug);
  if (!page) return { ok: false, error: "Study not found." };
  const record = page.record ?? (await ensureStudy(page.view));
  if (!record) return { ok: false, error: "Could not save the result." };
  await addTakeaway({
    studyId: record.id,
    kind: "quiz",
    body: `${score}/${total}`,
    score: total ? Math.round((score / total) * 100) : 0,
  });
  revalidatePath(`/app/study/${slug}`);
  return { ok: true };
}
