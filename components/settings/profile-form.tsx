"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";
import { updateProfile, findClubs, findLeagues } from "@/app/app/settings/actions";
import { NameSuggest } from "./name-suggest";
import { transfermarktIssue } from "@/lib/data/clubs-types";
import type { ProfileFormInput, ProfileSettings } from "@/lib/data/profile";

const POSITIONS = ["", "GK","RB","RCB","LCB","LB","RWB","LWB","6","8","10","RW","LW","CF","ST"];
const FEET = ["Right", "Left", "Both"];

export function ProfileForm({ profile }: { profile: ProfileSettings }) {
  const router = useRouter();
  const [form, setForm] = useState<ProfileFormInput>({
    fullName: profile.fullName,
    knownAs: profile.knownAs,
    nationality: profile.nationality,
    foot: profile.foot,
    primaryPosition: profile.primaryPosition,
    secondaryPosition: profile.secondaryPosition,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    club: profile.club,
    league: profile.league,
    favoriteClub: profile.favoriteClub,
    squadNumber: profile.squadNumber,
    season: profile.season,
    level: profile.level,
    pitchIdentity: profile.pitchIdentity,
    teamSide: profile.teamSide,
    kitPrimary: profile.kitPrimary,
    kitSecondary: profile.kitSecondary,
    transfermarktUrl: profile.transfermarktUrl,
  });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);

  const set = (patch: Partial<ProfileFormInput>) => setForm((f) => ({ ...f, ...patch }));
  // Shown under the field as you type, rather than only on a failed save.
  const tmIssue = transfermarktIssue(form.transfermarktUrl);
  const numN = (v: string) => (v === "" ? null : Number(v));

  const save = async () => {
    setBusy(true);
    setError(null);
    const res = await updateProfile(form);
    setBusy(false);
    if (res.ok) {
      setDemo(Boolean(res.demo));
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2500);
    } else setError(res.error);
  };

  return (
    <div className="panel p-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <F label="Full name" span><input value={form.fullName} onChange={(e) => set({ fullName: e.target.value })} className={inp} /></F>
        <F label="Known as"><input value={form.knownAs} onChange={(e) => set({ knownAs: e.target.value })} className={inp} /></F>
        <F label="Nationality"><input value={form.nationality} onChange={(e) => set({ nationality: e.target.value })} className={inp} /></F>
        <F label="Preferred foot">
          <select value={form.foot} onChange={(e) => set({ foot: e.target.value })} className={inp}>
            {FEET.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </F>
        <F label="Level"><input value={form.level} onChange={(e) => set({ level: e.target.value })} className={inp} /></F>
        <F label="Primary position">
          <select value={form.primaryPosition} onChange={(e) => set({ primaryPosition: e.target.value })} className={inp}>
            {POSITIONS.map((p) => <option key={p} value={p}>{p || "—"}</option>)}
          </select>
        </F>
        <F label="Secondary position">
          <select value={form.secondaryPosition} onChange={(e) => set({ secondaryPosition: e.target.value })} className={inp}>
            {POSITIONS.map((p) => <option key={p} value={p}>{p || "—"}</option>)}
          </select>
        </F>
        <F label="Squad number"><input type="number" value={form.squadNumber ?? ""} onChange={(e) => set({ squadNumber: numN(e.target.value) })} className={inp} /></F>
        <F label="Height (cm)"><input type="number" value={form.heightCm ?? ""} onChange={(e) => set({ heightCm: numN(e.target.value) })} className={inp} /></F>
        <F label="Weight (kg)"><input type="number" value={form.weightKg ?? ""} onChange={(e) => set({ weightKg: numN(e.target.value) })} className={inp} /></F>
        <F label="Season"><input value={form.season} onChange={(e) => set({ season: e.target.value })} className={inp} /></F>
      </div>

      {/*
        Club and league are free text with suggestions, not a picker over an
        imported list. There is no free dataset that covers Sunday league or
        academy football, and refusing a club because it is missing from one
        would fail exactly the players this is for.
      */}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <NameSuggest
          label="Club"
          value={form.club}
          onChange={(club) => set({ club })}
          search={findClubs}
          placeholder="Sarisbury Spartans FC"
          hint="Type it however you say it. Anything is allowed."
        />
        <NameSuggest
          label="League"
          value={form.league}
          onChange={(league) => set({ league })}
          search={findLeagues}
          placeholder="Hampshire Sunday League Div 3"
        />
      </div>

      {/*
        Not fandom decoration. The club a player supports is the football
        they already watch every week — naming it lets the Match Center
        turn that watching into structured study with a focus question.
      */}
      <div className="mt-3">
        <NameSuggest
          label="Favorite club"
          value={form.favoriteClub}
          onChange={(favoriteClub) => set({ favoriteClub })}
          search={findClubs}
          placeholder="The club you watch every week"
          hint="MIDO turns their matches into watch studies for your goals."
        />
      </div>

      {/*
        Not vanity data. This is what lets a video read be about YOU rather than
        about the passage — no model picks a specific player out of amateur
        footage on its own, and MIDO marks anything it cannot settle as
        uncertain rather than guessing.
      */}
      <div className="mt-4 border-t border-line pt-4">
        <div className="label-tech mb-2">On-pitch identity</div>
        <p className="mb-3 text-xs leading-relaxed text-text-faint">
          This is what lets a film read be about YOU rather than about the passage. Kit and number
          matter most — MIDO identifies you before attributing anything, and says so when it cannot.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="label-tech mb-1 block">Usually</span>
            <select
              value={form.teamSide}
              onChange={(e) => set({ teamSide: e.target.value })}
              className={inp}
            >
              <option value="">—</option>
              <option value="home">Home team</option>
              <option value="away">Away team</option>
            </select>
          </label>
          <label className="block">
            <span className="label-tech mb-1 block">Shirt colour</span>
            <input
              value={form.kitPrimary}
              onChange={(e) => set({ kitPrimary: e.target.value })}
              placeholder="royal blue"
              maxLength={24}
              className={inp}
            />
          </label>
          <label className="block">
            <span className="label-tech mb-1 block">Shorts / second colour</span>
            <input
              value={form.kitSecondary}
              onChange={(e) => set({ kitSecondary: e.target.value })}
              placeholder="white"
              maxLength={24}
              className={inp}
            />
          </label>
        </div>
        <label className="mt-3 block">
          <span className="label-tech mb-1 block">How to spot you — the extra detail</span>
          <input
            value={form.pitchIdentity}
            onChange={(e) => set({ pitchIdentity: e.target.value })}
            placeholder="usually the highest central forward, black boots"
            maxLength={140}
            className={inp}
          />
        </label>
        <p className="mt-1.5 text-xs leading-relaxed text-text-faint">
          Your number and position come from the profile above. If a match used a different kit,
          you can say so on that video in the film room.
        </p>

        <label className="mt-4 block">
          <span className="label-tech mb-1 block">Transfermarkt (optional)</span>
          <input
            value={form.transfermarktUrl}
            onChange={(e) => set({ transfermarktUrl: e.target.value })}
            placeholder="https://www.transfermarkt.com/..."
            className={inp}
          />
        </label>
        <p className="mt-1.5 text-xs leading-relaxed text-text-faint">
          {tmIssue ?? "A link for anyone reading your profile or a report. MIDO does not read anything from it — Transfermarkt has no public API."}
        </p>
      </div>

      {error && <p className="mt-4 rounded-lg border border-correction/30 bg-correction/10 px-3 py-2 text-sm text-correction">{error}</p>}

      <div className="mt-5 flex items-center gap-3">
        <button onClick={save} disabled={busy || !form.fullName.trim() || Boolean(tmIssue)} className="flex h-10 items-center gap-2 rounded-lg bg-signal px-4 text-sm font-medium text-white transition-colors hover:bg-signal-deep disabled:opacity-60">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Save profile
        </button>
        {saved && <span className="text-sm text-positive">{demo ? "Saved (demo — not persisted)" : "Saved"}</span>}
      </div>
    </div>
  );
}

const inp = "h-10 w-full rounded-lg border border-line bg-ink-850 px-3 text-sm text-text-hi placeholder:text-text-faint focus:border-signal-line focus:outline-none";

function F({ label, span, children }: { label: string; span?: boolean; children: React.ReactNode }) {
  return (
    <label className={span ? "col-span-2 sm:col-span-1" : ""}>
      <span className="label-tech mb-1 block">{label}</span>
      {children}
    </label>
  );
}
