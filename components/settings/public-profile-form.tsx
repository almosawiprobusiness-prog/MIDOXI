"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, AtSign } from "lucide-react";
import { updatePublicProfile } from "@/app/app/settings/actions";
import type { ProfileSettings, PublicProfileInput } from "@/lib/data/profile";

export function PublicProfileForm({ profile }: { profile: ProfileSettings }) {
  const router = useRouter();
  const [form, setForm] = useState<PublicProfileInput>({
    handle: profile.handle,
    playStyle: profile.playStyle,
    favoritePlayers: profile.favoritePlayers,
    strengths: profile.strengths,
    achievements: profile.achievements,
    socials: profile.socials ?? {},
  });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [demo, setDemo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<PublicProfileInput>) => setForm((f) => ({ ...f, ...patch }));
  const setSocial = (k: "instagram" | "twitter" | "youtube", v: string) => setForm((f) => ({ ...f, socials: { ...f.socials, [k]: v } }));
  const list = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);

  const save = async () => {
    setBusy(true); setError(null);
    const res = await updatePublicProfile(form);
    setBusy(false);
    if (res.ok) { setDemo(Boolean(res.demo)); setSaved(true); router.refresh(); setTimeout(() => setSaved(false), 2500); }
    else setError(res.error);
  };

  return (
    <div className="panel p-5">
      <label className="block">
        <span className="label-tech mb-1 block">Handle (your public @username)</span>
        <div className="flex h-10 items-center gap-2 rounded-lg border border-line bg-ink-850 px-3 focus-within:border-signal-line">
          <AtSign className="size-4 text-text-faint" />
          <input value={form.handle} onChange={(e) => set({ handle: e.target.value })} placeholder="mido9" className="h-full flex-1 bg-transparent text-sm text-text-hi placeholder:text-text-faint focus:outline-none" />
        </div>
      </label>

      <label className="mt-3 block">
        <span className="label-tech mb-1 block">Playing style</span>
        <textarea value={form.playStyle} onChange={(e) => set({ playStyle: e.target.value })} rows={2} placeholder="How would you describe your game?" className={`${inp} h-auto resize-y py-2`} />
      </label>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label-tech mb-1 block">Favourite players (comma-separated)</span>
          <input value={form.favoritePlayers.join(", ")} onChange={(e) => set({ favoritePlayers: list(e.target.value) })} className={inp} placeholder="Haaland, Kane" />
        </label>
        <label className="block">
          <span className="label-tech mb-1 block">Strengths (comma-separated)</span>
          <input value={form.strengths.join(", ")} onChange={(e) => set({ strengths: list(e.target.value) })} className={inp} placeholder="Movement, Finishing" />
        </label>
      </div>

      <label className="mt-3 block">
        <span className="label-tech mb-1 block">Achievements</span>
        <input value={form.achievements} onChange={(e) => set({ achievements: e.target.value })} className={inp} placeholder="Honours, milestones…" />
      </label>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="label-tech mb-1 block">Instagram</span>
          <input value={form.socials.instagram ?? ""} onChange={(e) => setSocial("instagram", e.target.value)} className={inp} placeholder="@handle" />
        </label>
        <label className="block">
          <span className="label-tech mb-1 block">X / Twitter</span>
          <input value={form.socials.twitter ?? ""} onChange={(e) => setSocial("twitter", e.target.value)} className={inp} placeholder="@handle" />
        </label>
        <label className="block">
          <span className="label-tech mb-1 block">YouTube</span>
          <input value={form.socials.youtube ?? ""} onChange={(e) => setSocial("youtube", e.target.value)} className={inp} placeholder="channel" />
        </label>
      </div>

      {error && <p className="mt-4 rounded-lg border border-correction/30 bg-correction/10 px-3 py-2 text-sm text-correction">{error}</p>}

      <div className="mt-5 flex items-center gap-3">
        <button onClick={save} disabled={busy} className="flex h-10 items-center gap-2 rounded-lg bg-signal px-4 text-sm font-medium text-white transition-colors hover:bg-signal-deep disabled:opacity-60">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Save public profile
        </button>
        {saved && <span className="text-sm text-positive">{demo ? "Saved (demo)" : "Saved"}</span>}
      </div>
      <p className="mt-2 text-[11px] text-text-faint">Shown on your public profile and next to your community posts (only when your profile is public).</p>
    </div>
  );
}

const inp = "h-10 w-full rounded-lg border border-line bg-ink-850 px-3 text-sm text-text-hi placeholder:text-text-faint focus:border-signal-line focus:outline-none";
