"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Plus } from "lucide-react";
import { MIN_CLUB_QUERY, isNewName } from "@/lib/data/clubs-types";
import type { ClubHit } from "@/lib/data/clubs";
import { cn } from "@/lib/utils";

/*
  A text box that offers what other players have already typed.

  This is deliberately NOT a picker over an imported dataset. There is no free
  list of the world's football clubs, and the paid ones are professional-only —
  which would mean telling a Sunday-league player their club does not exist.
  Anything can be typed here; the suggestions are a convenience, never a
  constraint.

  The list fills from use: the first player to name a club creates it, and
  everyone after them is offered it. So the two states worth showing clearly
  are "we know this one" and "you'll be the first" — the second is the normal
  case early on, and it should read as fine rather than as a warning.
*/

export function NameSuggest({
  value,
  onChange,
  search,
  label,
  placeholder,
  hint,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  /** Server action returning matches for a prefix. */
  search: (query: string) => Promise<ClubHit[]>;
  label: string;
  placeholder?: string;
  hint?: string;
  className?: string;
}) {
  const [options, setOptions] = useState<ClubHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Debounced, and every in-flight result is discarded if the text moved on —
  // otherwise a slow response for "nor" can overwrite the list for "northg".
  useEffect(() => {
    const q = value.trim();
    let live = true;
    // Everything happens inside the timer, including clearing. Setting state
    // synchronously in an effect body makes React render twice for every
    // keystroke, and here it would also flash an empty list between letters.
    const t = setTimeout(() => {
      if (!live) return;
      if (!touched || q.length < MIN_CLUB_QUERY) {
        setOptions([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      void search(q).then((hits) => {
        // Discarded if the text has moved on — otherwise a slow answer for
        // "nor" overwrites the list for "northg".
        if (!live) return;
        setOptions(hits);
        setLoading(false);
      });
    }, 180);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [value, search, touched]);

  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);

  const exact = options.some((o) => o.name.toLowerCase() === value.trim().toLowerCase());
  const isNew = touched && value.trim().length >= MIN_CLUB_QUERY && !loading && isNewName(value, options);
  const showList = open && (options.length > 0 || isNew);

  return (
    <div ref={box} className={cn("relative", className)}>
      <label className="block">
        <span className="label-tech mb-1 block">{label}</span>
        <input
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            setTouched(true);
            setOpen(true);
            onChange(e.target.value);
          }}
          onFocus={() => setOpen(true)}
          autoComplete="off"
          className="h-10 w-full rounded-lg border border-line bg-ink-850 px-3 text-sm text-text-hi placeholder:text-text-faint focus:border-signal-line focus:outline-none"
        />
      </label>

      {loading && (
        <Loader2 className="absolute right-3 top-[34px] size-4 animate-spin text-text-faint" />
      )}
      {!loading && exact && (
        <Check className="absolute right-3 top-[34px] size-4 text-positive" />
      )}

      {showList && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-line bg-ink-900 shadow-xl shadow-black/40">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                onChange(o.name);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-ink-850"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-text-hi">{o.name}</span>
                {o.league && <span className="block truncate text-[11px] text-text-faint">{o.league}</span>}
              </span>
              {o.uses > 1 && (
                <span className="data-mono shrink-0 text-[10px] text-text-faint">{o.uses}</span>
              )}
            </button>
          ))}

          {isNew && (
            <div className="flex items-start gap-2 border-t border-line px-3 py-2 text-[11px] leading-relaxed text-text-faint">
              <Plus className="mt-0.5 size-3 shrink-0" />
              <span>
                Nobody has named <span className="text-text-dim">{value.trim()}</span> yet. Save your
                profile and it will be offered to the next player who starts typing it.
              </span>
            </div>
          )}
        </div>
      )}

      {hint && <p className="mt-1 text-[11px] leading-relaxed text-text-faint">{hint}</p>}
    </div>
  );
}
