"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Mic, Square, Undo2, X } from "lucide-react";
import { listenForMatch, saveVoiceMatch, voiceAvailability } from "@/app/app/matches/voice-actions";
import {
  MAX_RECORDING_SECONDS,
  MIN_RECORDING_SECONDS,
  clockLabel,
  draftIssue,
  draftSummary,
  pickAudioType,
  readDraft,
  type VoiceDraft,
} from "@/lib/ai/voice-match-types";
import { FormError } from "@/components/forms/ui";
import { cn } from "@/lib/utils";

/*
  Log a match by saying what happened.

  The form this replaces has thirteen fields and gets filled in approximately
  never, because it is asked for at the worst possible moment — after playing,
  on a phone, on the way home. Ninety seconds of talking is a different
  proposition entirely.

  Two things this screen refuses to do:

  · It never saves what it heard. MIDO fills the form, the player reads it and
    presses save. Speech recognition mishears numbers more than anything —
    "sixty eight" and "seventy eight" differ by one consonant — and the whole
    value of the record is that it is true.

  · It never shows a blank where it did not hear something. Missing fields are
    listed separately and named, because an empty number input looks identical
    to a zero and means the opposite.
*/

export function VoiceLog() {
  const router = useRouter();
  const [status, setStatus] = useState<{ available: boolean; reason: string | null } | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [draft, setDraft] = useState<VoiceDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<BlobPart[]>([]);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    void voiceAvailability().then(setStatus);
    return () => {
      if (ticker.current) clearInterval(ticker.current);
      recorder.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const stop = () => {
    recorder.current?.stop();
    setRecording(false);
    if (ticker.current) clearInterval(ticker.current);
  };

  const begin = async () => {
    setError(null);
    setDraft(null);

    const type = pickAudioType((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t));
    if (!type) {
      setError("This browser cannot record audio. The match form below still works.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("MIDO needs permission to use the microphone. The match form below still works.");
      return;
    }

    chunks.current = [];
    const rec = new MediaRecorder(stream, { mimeType: type });
    recorder.current = rec;

    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.current.push(e.data);
    };

    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks.current, { type });
      const elapsed = seconds;

      if (blob.size < 1000 || elapsed < MIN_RECORDING_SECONDS) {
        setError("That was too short for MIDO to hear anything. Try again and say what happened.");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = String(reader.result ?? "");
        start(async () => {
          const res = await listenForMatch(dataUrl);
          if (res.ok) setDraft(res.draft);
          else setError(res.error);
        });
      };
      reader.readAsDataURL(blob);
    };

    rec.start();
    setRecording(true);
    setSeconds(0);
    ticker.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_RECORDING_SECONDS) stop();
        return s + 1;
      });
    }, 1000);
  };

  // Unavailable — say why, once, and get out of the way of the form below.
  if (status && !status.available) {
    return (
      <div className="panel mb-4 flex items-start gap-3 p-4">
        <Mic className="mt-0.5 size-4 shrink-0 text-text-faint" />
        <p className="text-xs leading-relaxed text-text-dim">{status.reason}</p>
      </div>
    );
  }

  if (draft) {
    return (
      <DraftReview
        draft={draft}
        onChange={setDraft}
        onCancel={() => setDraft(null)}
        onSaved={() => {
          setDraft(null);
          router.refresh();
        }}
      />
    );
  }

  const busy = pending;

  return (
    <div className="panel mb-4 p-5">
      <div className="flex flex-wrap items-center gap-4">
        <button
          onClick={recording ? stop : begin}
          disabled={busy || !status}
          className={cn(
            "grid size-14 shrink-0 place-items-center rounded-full border transition-colors disabled:opacity-50",
            recording
              ? "border-correction/40 bg-correction/15 text-correction"
              : "border-signal-line bg-signal/10 text-signal-bright hover:bg-signal/20",
          )}
          aria-label={recording ? "Stop recording" : "Record a match report"}
        >
          {busy ? (
            <Loader2 className="size-6 animate-spin" />
          ) : recording ? (
            <Square className="size-5 fill-current" />
          ) : (
            <Mic className="size-6" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-text-hi">
            {recording ? "Listening…" : busy ? "Working out what you said…" : "Log it by talking"}
          </h3>
          <p className="mt-0.5 text-xs leading-relaxed text-text-dim">
            {recording ? (
              <>
                <span className="data-mono text-text">{clockLabel(seconds)}</span> · say the
                opponent, the score, how long you played and anything else. Press stop when done.
              </>
            ) : busy ? (
              "MIDO fills the form in — you check it before anything is saved."
            ) : (
              "“Away to Halton, we won 2–1, I played 68 minutes at right eight and got the assist.” MIDO fills the form in for you to check."
            )}
          </p>
        </div>

        {recording && (
          <span className="data-mono shrink-0 text-xs text-text-faint">
            {clockLabel(MAX_RECORDING_SECONDS - seconds)} left
          </span>
        )}
      </div>

      <FormError error={error} />
    </div>
  );
}

function DraftReview({
  draft,
  onChange,
  onCancel,
  onSaved,
}: {
  draft: VoiceDraft;
  onChange: (d: VoiceDraft) => void;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { heard, missed } = readDraft(draft);
  const issue = draftIssue(draft);

  const save = () =>
    start(async () => {
      const res = await saveVoiceMatch(draft);
      if (res.ok) onSaved();
      else setError(res.error);
    });

  return (
    <div className="panel mb-4 overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <Mic className="size-4 text-signal-bright" />
        <h3 className="text-sm font-medium text-text-hi">Check this before it is saved</h3>
        <span className="ml-auto text-xs text-text-faint">{draftSummary(draft)}</span>
      </div>

      {/* What MIDO heard, verbatim — the check on mishearing. */}
      {draft.transcript && (
        <p className="border-b border-line bg-ink-850 px-4 py-3 text-xs leading-relaxed text-text-dim">
          <span className="text-text-faint">Heard:</span> “{draft.transcript}”
        </p>
      )}

      <div className="grid gap-x-6 gap-y-2 p-4 sm:grid-cols-2">
        {heard.map((f) => (
          <div key={f.key} className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-text-dim">{f.label}</span>
            <span className="text-right text-text-hi">{f.display}</span>
          </div>
        ))}
      </div>

      {/*
        Named, not blank. An empty number input and a zero look the same and
        mean the opposite, so what MIDO did not hear is said out loud.
      */}
      {missed.length > 0 && (
        <div className="border-t border-line px-4 py-3">
          <p className="text-xs leading-relaxed text-text-faint">
            <span className="text-text-dim">Not mentioned:</span>{" "}
            {missed.map((f) => f.label.toLowerCase()).join(", ")}. These stay empty rather than
            being guessed — add them after saving if they matter.
          </p>
        </div>
      )}

      {issue && (
        <div className="border-t border-line px-4 py-3">
          <label className="block">
            <span className="label-tech mb-1 block">Opponent</span>
            <input
              value={draft.opponent ?? ""}
              onChange={(e) => onChange({ ...draft, opponent: e.target.value })}
              placeholder="Who did you play?"
              autoFocus
              className="h-10 w-full rounded-lg border border-line bg-ink-850 px-3 text-sm text-text-hi placeholder:text-text-faint focus:border-signal-line focus:outline-none"
            />
          </label>
          <p className="mt-1.5 text-xs text-text-faint">{issue}</p>
        </div>
      )}

      {draft.notes && (
        <p className="border-t border-line px-4 py-3 text-xs leading-relaxed text-text-dim">
          <span className="text-text-faint">You also said:</span> {draft.notes}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
        <button
          onClick={save}
          disabled={pending || Boolean(issue)}
          className="flex h-10 items-center gap-2 rounded-lg border border-signal-line bg-signal/10 px-4 text-sm font-medium text-signal-bright transition-colors hover:bg-signal/20 disabled:opacity-50"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          Save this match
        </button>
        <button
          onClick={onCancel}
          className="flex h-10 items-center gap-2 rounded-lg border border-line px-3 text-sm text-text-dim transition-colors hover:text-text"
        >
          <Undo2 className="size-4" />
          Record again
        </button>
        <button
          onClick={onCancel}
          aria-label="Discard"
          className="ml-auto text-text-faint transition-colors hover:text-correction"
        >
          <X className="size-4" />
        </button>
      </div>

      <FormError error={error} />
    </div>
  );
}
