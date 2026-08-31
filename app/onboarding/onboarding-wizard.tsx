"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AvatarUpload } from "@/components/settings/avatar-upload";
import { ArrowRight, ArrowLeft, Check, Loader2, Plus, X } from "lucide-react";
import { completeOnboarding, type OnboardingPayload } from "./actions";
import { ROLES, roleDef, type RoleId } from "@/lib/roles/roles";

const POSITIONS = ["GK","RB","RCB","LCB","LB","RWB","LWB","6","8","10","RW","LW","CF","ST"];
const FEET = ["Right", "Left", "Both"] as const;
const COACH_ROLES = ["Head Coach","Assistant Coach","Analyst","Individual Development","Strength & Conditioning","Goalkeeper Coach"];
const TRAINER_SPECIALISMS = ["Speed & power","Strength","Return to play","Youth athletic development","Conditioning","Movement & mobility"];
const CLUB_LEVELS = ["Grassroots","Academy","Semi-professional","Professional","University / College"];

const GOAL_SUGGESTIONS: { title: string; category: string }[] = [
  { title: "Near-post finishing", category: "technical" },
  { title: "Pressing triggers", category: "tactical" },
  { title: "Blindside movement", category: "positional" },
  { title: "First touch", category: "technical" },
  { title: "Weak foot", category: "technical" },
  { title: "Acceleration", category: "physical" },
  { title: "Scanning", category: "mental" },
  { title: "Decision making", category: "mental" },
  { title: "Aerial ability", category: "physical" },
  { title: "Positioning", category: "tactical" },
];

const TOTAL_STEPS = 4;

export function OnboardingWizard({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [role, setRole] = useState<RoleId | null>(null);
  const [form, setForm] = useState<OnboardingPayload>({
    role: "player",
    fullName: initialName,
    knownAs: initialName.split(" ")[0] ?? initialName,
    foot: "Right",
    season: "2026 / 27",
    goals: [],
  });
  const [goals, setGoals] = useState<{ title: string; category: string }[]>([]);
  const [customGoal, setCustomGoal] = useState("");

  const set = (patch: Partial<OnboardingPayload>) => setForm((f) => ({ ...f, ...patch }));

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const pickRole = (r: RoleId) => {
    setRole(r);
    set({ role: r });
    setStep(1);
  };

  const toggleGoal = (g: { title: string; category: string }) => {
    setGoals((prev) => {
      const exists = prev.find((x) => x.title === g.title);
      if (exists) return prev.filter((x) => x.title !== g.title);
      if (prev.length >= 5) return prev;
      return [...prev, g];
    });
  };

  const addCustomGoal = () => {
    const t = customGoal.trim();
    if (!t || goals.length >= 5) return;
    setGoals((p) => [...p, { title: t, category: "technical" }]);
    setCustomGoal("");
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = await completeOnboarding({ ...form, goals });
    if (res.ok) {
      router.push("/app");
      router.refresh();
    } else {
      setError(res.error);
      setBusy(false);
    }
  };

  const def = role ? roleDef(role) : null;

  return (
    <div>
      {/* Progress */}
      <div className="mb-6 flex items-center gap-2">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? "bg-signal" : "bg-ink-700"}`}
          />
        ))}
      </div>

      <div key={step} className="rise-in">
        {/* ── STEP 0 — which operating system ── */}
        {step === 0 && (
          <Section
            label="Step 01 · Select role"
            title="How will you use MIDO XI?"
            sub="MIDO XI changes shape around who you are — navigation, dashboard and intelligence all follow this choice. You can add another role later."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.values(ROLES).map((r) => {
                const Icon = r.icon;
                return (
                  <RoleCard
                    key={r.id}
                    icon={<Icon className="size-6" />}
                    title={r.label}
                    body={r.tagline}
                    onClick={() => pickRole(r.id)}
                  />
                );
              })}
            </div>
          </Section>
        )}

        {/* ── STEP 1 — identity ── */}
        {step === 1 && role === "player" && (
          <Section label="Step 02 · Football profile" title="Your football identity">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Full name" value={form.fullName} onChange={(v) => set({ fullName: v })} span />
              <Input label="Known as" value={form.knownAs} onChange={(v) => set({ knownAs: v })} />
              <Input label="Nationality" value={form.nationality ?? ""} onChange={(v) => set({ nationality: v })} />
              <Input label="Date of birth" type="date" value={form.dateOfBirth ?? ""} onChange={(v) => set({ dateOfBirth: v })} />
              <Select label="Preferred foot" value={form.foot ?? "Right"} options={FEET} onChange={(v) => set({ foot: v as OnboardingPayload["foot"] })} />
              <Input label="Height (cm)" type="number" value={form.heightCm?.toString() ?? ""} onChange={(v) => set({ heightCm: Number(v) || undefined })} />
              <Input label="Weight (kg)" type="number" value={form.weightKg?.toString() ?? ""} onChange={(v) => set({ weightKg: Number(v) || undefined })} />
              <Select label="Primary position" value={form.primaryPosition ?? ""} options={POSITIONS} onChange={(v) => set({ primaryPosition: v })} placeholder="Select" />
              <Select label="Secondary position" value={form.secondaryPosition ?? ""} options={POSITIONS} onChange={(v) => set({ secondaryPosition: v })} placeholder="Optional" />
              <Input label="Current club" value={form.club ?? ""} onChange={(v) => set({ club: v })} />
              <Input label="League" value={form.league ?? ""} onChange={(v) => set({ league: v })} />
              <Input label="Squad number" type="number" value={form.squadNumber?.toString() ?? ""} onChange={(v) => set({ squadNumber: Number(v) || undefined })} />
              <Input label="Season" value={form.season ?? ""} onChange={(v) => set({ season: v })} />
            </div>
            <NavRow onBack={back} onNext={next} nextDisabled={!form.fullName || !form.primaryPosition} />
          </Section>
        )}

        {step === 1 && role === "coach" && (
          <Section label="Step 02 · Coach profile" title="Your coaching identity">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Full name" value={form.fullName} onChange={(v) => set({ fullName: v })} span />
              <Input label="Club" value={form.club ?? ""} onChange={(v) => set({ club: v })} />
              <Input label="Team" value={form.team ?? ""} onChange={(v) => set({ team: v })} />
              <Select label="Role" value={form.coachingRole ?? ""} options={COACH_ROLES} onChange={(v) => set({ coachingRole: v })} placeholder="Select" span />
              <Input label="Level" value={form.level ?? ""} onChange={(v) => set({ level: v })} />
              <Input label="Season" value={form.season ?? ""} onChange={(v) => set({ season: v })} />
            </div>
            <NavRow onBack={back} onNext={next} nextDisabled={!form.fullName} />
          </Section>
        )}

        {step === 1 && role === "trainer" && (
          <Section label="Step 02 · Trainer profile" title="Your performance practice">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Full name" value={form.fullName} onChange={(v) => set({ fullName: v })} span />
              <Input label="Practice / club" value={form.practice ?? ""} onChange={(v) => set({ practice: v })} span />
              <Select label="Specialism" value={form.specialism ?? ""} options={TRAINER_SPECIALISMS} onChange={(v) => set({ specialism: v })} placeholder="Select" span />
              <Input label="Athletes you manage" type="number" value={form.athleteCapacity?.toString() ?? ""} onChange={(v) => set({ athleteCapacity: Number(v) || undefined })} />
              <Input label="Level" value={form.level ?? ""} onChange={(v) => set({ level: v })} />
            </div>
            <NavRow onBack={back} onNext={next} nextDisabled={!form.fullName} />
          </Section>
        )}

        {step === 1 && role === "club" && (
          <Section label="Step 02 · Club profile" title="Your organization">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Your name" value={form.fullName} onChange={(v) => set({ fullName: v })} span />
              <Input label="Club name" value={form.clubName ?? ""} onChange={(v) => set({ clubName: v })} span />
              <Select label="Level" value={form.level ?? ""} options={CLUB_LEVELS} onChange={(v) => set({ level: v })} placeholder="Select" />
              <Input label="Country" value={form.country ?? ""} onChange={(v) => set({ country: v })} />
              <Input
                label="Age groups (comma-separated)"
                value={(form.ageGroups ?? []).join(", ")}
                onChange={(v) => set({ ageGroups: v.split(",").map((s) => s.trim()).filter(Boolean) })}
                span
              />
            </div>
            <NavRow onBack={back} onNext={next} nextDisabled={!form.fullName || !form.clubName} />
          </Section>
        )}

        {/* ── STEP 2 — what you are working on ── */}
        {step === 2 && role === "player" && (
          <Section label="Step 03 · Development goals" title="What are you working on?">
            <p className="-mt-2 mb-4 text-sm text-text-dim">Choose up to 5. You can change these anytime.</p>
            <div className="flex flex-wrap gap-2">
              {GOAL_SUGGESTIONS.map((g) => {
                const active = goals.some((x) => x.title === g.title);
                return (
                  <button
                    key={g.title}
                    onClick={() => toggleGoal(g)}
                    className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                      active
                        ? "border-signal-line bg-signal/10 text-signal-bright"
                        : "border-line text-text-dim hover:border-line-strong hover:text-text"
                    }`}
                  >
                    {g.title}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex gap-2">
              <input
                value={customGoal}
                onChange={(e) => setCustomGoal(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCustomGoal()}
                placeholder="Add your own…"
                className="h-10 flex-1 rounded-lg border border-line bg-ink-850 px-3 text-sm text-text-hi placeholder:text-text-faint focus:border-signal-line focus:outline-none"
              />
              <button
                onClick={addCustomGoal}
                disabled={!customGoal.trim() || goals.length >= 5}
                className="flex size-10 items-center justify-center rounded-lg border border-line text-text-dim transition-colors hover:border-signal-line hover:text-signal-bright disabled:opacity-40"
              >
                <Plus className="size-4" />
              </button>
            </div>

            {goals.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {goals.map((g) => (
                  <span key={g.title} className="chip chip-signal !normal-case">
                    {g.title}
                    <button onClick={() => toggleGoal(g)} className="ml-1 text-signal-bright/70 hover:text-signal-bright">
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <NavRow onBack={back} onNext={next} label="Review" />
          </Section>
        )}

        {step === 2 && role === "coach" && (
          <Section label="Step 03 · Coaching focus" title="How does your team play?">
            <div className="space-y-3">
              <Input label="Coaching focus" value={form.focus ?? ""} onChange={(v) => set({ focus: v })} span />
              <Input
                label="Preferred formations (comma-separated)"
                value={(form.formations ?? []).join(", ")}
                onChange={(v) => set({ formations: v.split(",").map((s) => s.trim()).filter(Boolean) })}
                span
              />
            </div>
            <NavRow onBack={back} onNext={next} label="Review" />
          </Section>
        )}

        {step === 2 && role === "trainer" && (
          <Section label="Step 03 · Programming focus" title="What do you develop?">
            <div className="space-y-3">
              <Input label="Primary focus" value={form.focus ?? ""} onChange={(v) => set({ focus: v })} span />
              <Input
                label="Qualifications (comma-separated)"
                value={(form.qualifications ?? []).join(", ")}
                onChange={(v) => set({ qualifications: v.split(",").map((s) => s.trim()).filter(Boolean) })}
                span
              />
            </div>
            <NavRow onBack={back} onNext={next} label="Review" />
          </Section>
        )}

        {step === 2 && role === "club" && (
          <Section label="Step 03 · Methodology" title="How does the club play?">
            <p className="-mt-2 mb-4 text-sm text-text-dim">
              One line to start. You will write the full methodology — how we play, train and develop —
              inside the club workspace.
            </p>
            <Input label="Playing identity" value={form.focus ?? ""} onChange={(v) => set({ focus: v })} span />
            <NavRow onBack={back} onNext={next} label="Review" />
          </Section>
        )}

        {/* ── STEP 3 — complete ── */}
        {step === 3 && def && (
          <Section label="Step 04 · Complete" title="You&rsquo;re set">
            {/*
              The photo, offered at the door but never demanded — a face
              makes every post, comment and profile feel like a person,
              and skipping it costs nothing (initials carry the account
              until Settings). The uploader saves immediately, so there
              is no extra state to carry through submit.
            */}
            <div className="panel mb-4 p-4">
              <div className="label-tech mb-3">Profile photo — optional</div>
              <AvatarUpload url="" name={form.knownAs || form.fullName || "M"} />
            </div>
            <div className="panel p-4">
              <div className="flex items-center gap-3">
                <div className="grid size-11 place-items-center rounded-lg bg-gradient-to-br from-signal to-signal-deep font-display text-lg font-bold text-white">
                  {(form.knownAs || form.fullName || "M").slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <div className="font-display text-base font-semibold text-text-hi">
                    {form.knownAs || form.fullName}
                  </div>
                  <div className="label-tech">
                    {role === "player" && `${form.primaryPosition ?? ""} · ${form.club || "—"}`}
                    {role === "coach" && `${form.coachingRole ?? "Coach"} · ${form.club || "—"}`}
                    {role === "trainer" && `${form.specialism ?? "Trainer"} · ${form.practice || "—"}`}
                    {role === "club" && `${form.clubName || "Club"} · ${form.level || "—"}`}
                  </div>
                </div>
                <span className="chip chip-signal ml-auto">{def.label} OS</span>
              </div>
              {role === "player" && goals.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
                  {goals.map((g) => (
                    <span key={g.title} className="chip">{g.title}</span>
                  ))}
                </div>
              )}
              <p className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-text-dim">
                {def.question}
              </p>
            </div>

            {error && (
              <p className="mt-3 rounded-lg border border-correction/30 bg-correction/10 px-3 py-2 text-sm text-correction">
                {error}
              </p>
            )}

            <div className="mt-5 flex items-center gap-3">
              <button
                onClick={back}
                className="flex h-11 items-center gap-2 rounded-lg border border-line px-4 text-sm text-text-dim transition-colors hover:text-text-hi"
              >
                <ArrowLeft className="size-4" /> Back
              </button>
              <button
                onClick={submit}
                disabled={busy}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-signal font-medium text-white transition-colors hover:bg-signal-deep disabled:opacity-60"
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    <Check className="size-4" /> Enter {def.terminology.home}
                  </>
                )}
              </button>
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

/* ---------- small building blocks ---------- */

function Section({
  label,
  title,
  sub,
  children,
}: {
  label: string;
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-4 text-center">
        <div className="label-tech">{label}</div>
        <h1 className="mt-1 font-display text-xl font-semibold text-text-hi">{title}</h1>
        {sub && <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-text-dim">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

function RoleCard({
  icon,
  title,
  body,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group panel flex flex-col items-start p-5 text-left transition-colors hover:border-signal-line hover:bg-signal/5"
    >
      <span className="grid size-11 place-items-center rounded-lg border border-line bg-ink-850 text-signal-bright">
        {icon}
      </span>
      <h3 className="mt-3 font-display text-lg font-semibold text-text-hi">{title}</h3>
      <p className="mt-1 text-sm text-text-dim">{body}</p>
      <span className="mt-3 flex items-center gap-1 text-xs text-text-faint transition-colors group-hover:text-signal-bright">
        Choose <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}

function Input({
  label, value, onChange, type = "text", span = false,
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string; span?: boolean;
}) {
  return (
    <label className={span ? "col-span-2 block" : "block"}>
      <span className="label-tech mb-1 block">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-lg border border-line bg-ink-850 px-3 text-sm text-text-hi placeholder:text-text-faint focus:border-signal-line focus:outline-none"
      />
    </label>
  );
}

function Select({
  label, value, options, onChange, placeholder, span = false,
}: {
  label: string; value: string; options: readonly string[]; onChange: (v: string) => void; placeholder?: string; span?: boolean;
}) {
  return (
    <label className={span ? "col-span-2 block" : "block"}>
      <span className="label-tech mb-1 block">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-lg border border-line bg-ink-850 px-3 text-sm text-text-hi focus:border-signal-line focus:outline-none"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

function NavRow({
  onBack,
  onNext,
  nextDisabled,
  label = "Continue",
}: {
  onBack: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  label?: string;
}) {
  return (
    <div className="mt-6 flex items-center gap-3">
      <button
        onClick={onBack}
        className="flex h-11 items-center gap-2 rounded-lg border border-line px-4 text-sm text-text-dim transition-colors hover:text-text-hi"
      >
        <ArrowLeft className="size-4" /> Back
      </button>
      <button
        onClick={onNext}
        disabled={nextDisabled}
        className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-signal font-medium text-white transition-colors hover:bg-signal-deep disabled:opacity-40"
      >
        {label} <ArrowRight className="size-4" />
      </button>
    </div>
  );
}
