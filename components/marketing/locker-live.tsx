"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView, useMotionValue, useReducedMotion } from "motion/react";

/*
  The pieces that make the Locker showcase feel alive rather than
  screenshotted: a readiness dial that counts itself up, an "Ask MIDO"
  chip that actually speaks (ElevenLabs voice, served from /public), a
  cursor-tracked spotlight on the command surface, and a fixture clock
  that is really ticking. All of it degrades to static, correct content
  under prefers-reduced-motion or with JS unavailable.
*/

/* ── Readiness dial ─────────────────────────────────────────── */

const DIAL_R = 54;
const DIAL_C = 2 * Math.PI * DIAL_R;

export function ReadinessDial({ value = 61 }: { value?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(reduced ? value : 0);
  const progress = useMotionValue(reduced ? value / 100 : 0);
  const arcRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    if (!inView || reduced) return;
    const controls = animate(progress, value / 100, {
      duration: 1.4,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => {
        setDisplay(Math.round(v * 100));
        if (arcRef.current) {
          arcRef.current.style.strokeDashoffset = String(DIAL_C * (1 - v * 0.75));
        }
      },
    });
    return () => controls.stop();
  }, [inView, reduced, progress, value]);

  return (
    <div ref={ref} className="relative size-36">
      <svg viewBox="0 0 128 128" className="size-full -rotate-[225deg]">
        {/* Track: 270° of arc, leaving a deliberate gap at the bottom. */}
        <circle
          cx="64"
          cy="64"
          r={DIAL_R}
          fill="none"
          stroke="var(--ink-700)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${DIAL_C * 0.75} ${DIAL_C}`}
        />
        <circle
          ref={arcRef}
          cx="64"
          cy="64"
          r={DIAL_R}
          fill="none"
          stroke="var(--signal)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={DIAL_C}
          strokeDashoffset={reduced ? DIAL_C * (1 - (value / 100) * 0.75) : DIAL_C}
          style={{ filter: "drop-shadow(0 0 6px rgba(123,97,255,0.55))" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="stat-figure text-5xl !text-signal-bright">{display}</span>
      </div>
    </div>
  );
}

/* ── Ask MIDO — the chip that speaks ────────────────────────── */

const TAKES = ["/mido-voice-1.mp3", "/mido-voice-2.mp3"];

export function AskMidoChip({ takes = TAKES }: { takes?: string[] }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [take, setTake] = useState(0);
  const [offline, setOffline] = useState(false);

  const fail = () => {
    setPlaying(false);
    // Honest feedback instead of a dead click if a voice file is absent.
    setOffline(true);
    setTimeout(() => setOffline(false), 1800);
  };

  const stop = () => {
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    setPlaying(false);
  };

  const play = async (src: string) => {
    // Preflight: a missing file leaves <audio> pending forever with no
    // error event, so check it exists before promising sound.
    try {
      const head = await fetch(src, { method: "HEAD" });
      if (!head.ok) return fail();
    } catch {
      return fail();
    }
    const a = new Audio(src);
    a.addEventListener("ended", () => setPlaying(false));
    a.addEventListener("error", fail);
    audioRef.current = a;
    void a.play().then(() => setPlaying(true)).catch(fail);
  };

  const toggle = () => {
    if (playing) return stop();
    void play(takes[take]);
  };

  const switchTake = (i: number) => {
    setTake(i);
    if (playing) {
      stop();
      void play(takes[i]);
    }
  };

  if (offline) {
    return (
      <span className="chip" role="status">
        Voice offline
      </span>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={playing}
        aria-label={playing ? "Stop MIDO's briefing" : "Hear MIDO's briefing"}
        className={`chip chip-signal cursor-pointer transition-shadow ${
          playing ? "shadow-[0_0_24px_rgba(123,97,255,0.35)]" : "hover:shadow-[0_0_16px_rgba(123,97,255,0.25)]"
        }`}
      >
        {playing ? (
          <span className="flex items-end gap-[2.5px]" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className="w-[2.5px] rounded-full bg-signal-bright"
                style={{
                  animation: `mido-eq 0.8s ease-in-out ${i * 0.12}s infinite alternate`,
                  height: 10,
                }}
              />
            ))}
          </span>
        ) : (
          <span aria-hidden className="grid size-3 place-items-center">
            <span className="ml-0.5 block size-0 border-y-[4px] border-l-[6px] border-y-transparent border-l-signal-bright" />
          </span>
        )}
        Ask MIDO
      </button>

      {/* Take switcher — two voices of the same briefing. */}
      <span className="data-mono flex items-center gap-1.5 text-[10px]" role="group" aria-label="Voice take">
        {takes.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => switchTake(i)}
            aria-pressed={take === i}
            aria-label={`Voice take ${i + 1}`}
            className={`cursor-pointer transition-colors ${
              take === i ? "text-signal-bright" : "text-text-faint hover:text-text-dim"
            }`}
          >
            0{i + 1}
          </button>
        ))}
      </span>
    </span>
  );
}

/* ── Cursor spotlight for the command surface ───────────────── */

export function Spotlight({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      className={className}
      onMouseMove={(e) => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--spot-x", `${e.clientX - r.left}px`);
        el.style.setProperty("--spot-y", `${e.clientY - r.top}px`);
        el.style.setProperty("--spot-o", "1");
      }}
      onMouseLeave={() => ref.current?.style.setProperty("--spot-o", "0")}
    >
      {children}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: "var(--spot-o, 0)" as unknown as number,
          background:
            "radial-gradient(340px circle at var(--spot-x, 50%) var(--spot-y, 50%), rgba(123,97,255,0.09), transparent 70%)",
        }}
      />
    </div>
  );
}

/* ── Fixture clock — actually ticking ───────────────────────── */

export function FixtureClock() {
  // The mock fixture is always three days out, so the copy above it
  // ("Next match / 03 days") stays true no matter when you visit.
  const [target] = useState(() => Date.now() + 3 * 24 * 3600 * 1000);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    // Deferred first tick: keeps SSR and first client paint identical,
    // without a synchronous setState inside the effect.
    const first = setTimeout(() => setNow(Date.now()), 50);
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  // Server render + first client paint agree (placeholder), then it ticks.
  if (now === null) {
    return <p className="data-mono mt-2 text-xs text-text-faint">T-minus 72:00:00</p>;
  }

  const s = Math.max(0, Math.floor((target - now) / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  const hh = pad(Math.floor(s / 3600));
  const mm = pad(Math.floor((s % 3600) / 60));
  const ss = pad(s % 60);

  return (
    <p className="data-mono mt-2 text-xs text-text-faint">
      T-minus {hh}:{mm}:<span className="text-signal-bright">{ss}</span>
    </p>
  );
}
