"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X, Plus, Trash2, Loader2, AlertCircle, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/*
  Coach OS form furniture.

  The coach surfaces are form-heavy — squad, sessions, blocks, scouting. These
  are the shared pieces so every dialog behaves and reads identically.
*/

export function Modal({
  open,
  onClose,
  eyebrow,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 py-[7vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cn(
              "panel-raised relative w-full p-5 shadow-2xl shadow-black/50",
              wide ? "max-w-2xl" : "max-w-lg",
            )}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="label-tech">{eyebrow}</div>
                <h3 className="font-display text-lg font-semibold text-text-hi">{title}</h3>
              </div>
              <button onClick={onClose} className="text-text-faint hover:text-text" aria-label="Close">
                <X className="size-5" />
              </button>
            </div>
            {children}
            {footer && <div className="mt-5">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Field({
  label,
  span,
  hint,
  children,
}: {
  label: string;
  span?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("block", span && "col-span-2")}>
      <span className="label-tech mb-1 block">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-text-faint">{hint}</span>}
    </label>
  );
}

const inputCls =
  "h-10 w-full rounded-lg border border-line bg-ink-850 px-3 text-sm text-text-hi placeholder:text-text-faint focus:border-signal-line focus:outline-none";

export function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={inputCls}
    />
  );
}

export function NumberInput({
  value,
  onChange,
  placeholder,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="number"
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      className={inputCls}
    />
  );
}

export function TextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full resize-y rounded-lg border border-line bg-ink-850 px-3 py-2 text-sm leading-relaxed text-text-hi placeholder:text-text-faint focus:border-signal-line focus:outline-none"
    />
  );
}

export function SelectInput<T extends string>({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="h-10 w-full rounded-lg border border-line bg-ink-850 px-3 text-sm text-text-hi focus:border-signal-line focus:outline-none"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Pills for a small enum — phases, statuses, arrow kinds. */
export function ChipPicker<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; color?: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className="rounded-lg border px-2.5 py-1.5 text-xs transition-colors"
            style={
              active
                ? {
                    borderColor: o.color ?? "var(--signal-line)",
                    color: o.color ?? "var(--signal-bright)",
                    background: "var(--signal-wash)",
                  }
                : { borderColor: "var(--line-strong)", color: "var(--text-dim)" }
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Editable list of short lines — coaching points, observations, weaknesses. */
export function ListEditor({
  items,
  onChange,
  placeholder,
  color,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  color?: string;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...items, v]);
    setDraft("");
  };

  return (
    <div>
      {items.length > 0 && (
        <ul className="mb-2 space-y-1.5">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 rounded-lg border border-line bg-ink-850 px-3 py-2">
              <span
                className="mt-1.5 size-1.5 shrink-0 rounded-full"
                style={{ background: color ?? "var(--signal)" }}
              />
              <span className="min-w-0 flex-1 text-sm leading-relaxed text-text">{item}</span>
              <button
                type="button"
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                aria-label="Remove"
                className="shrink-0 text-text-faint transition-colors hover:text-correction"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className={inputCls}
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          aria-label="Add"
          className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-line text-text-dim transition-colors hover:border-signal-line hover:text-signal-bright disabled:opacity-40"
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function FormError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-correction/30 bg-correction/10 px-3 py-2 text-xs leading-relaxed text-correction">
      <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
      {error}
    </p>
  );
}

export function FormNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-line bg-ink-850 px-3 py-2 text-xs leading-relaxed text-text-dim">
      <Check className="mt-0.5 size-3.5 shrink-0 text-positive" />
      {message}
    </p>
  );
}

export function SubmitRow({
  onCancel,
  onSubmit,
  busy,
  label = "Save",
  disabled,
}: {
  onCancel: () => void;
  onSubmit: () => void;
  busy: boolean;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onCancel}
        className="h-10 rounded-lg border border-line px-4 text-sm text-text-dim transition-colors hover:text-text-hi"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onSubmit}
        disabled={busy || disabled}
        className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-signal text-sm font-medium text-white transition-colors hover:bg-signal-deep disabled:opacity-50"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : null}
        {label}
      </button>
    </div>
  );
}

/** Two-step delete: no dialog, no accidental data loss. */
export function ConfirmDelete({
  onConfirm,
  label = "Delete",
  compact,
}: {
  onConfirm: () => Promise<unknown>;
  label?: string;
  compact?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        aria-label={label}
        className={cn(
          "flex items-center justify-center gap-1.5 rounded-lg border border-line text-text-faint transition-colors hover:border-correction/40 hover:text-correction",
          compact ? "size-8" : "h-10 px-3 text-sm",
        )}
      >
        <Trash2 className="size-3.5" />
        {!compact && label}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={async () => {
          setBusy(true);
          await onConfirm();
          setBusy(false);
        }}
        className={cn(
          "flex items-center gap-1.5 rounded-lg border border-correction/40 bg-correction/10 text-correction transition-colors hover:bg-correction/20",
          compact ? "h-8 px-2 text-xs" : "h-10 px-3 text-sm",
        )}
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
        Confirm
      </button>
      <button
        type="button"
        onClick={() => setArmed(false)}
        className={cn(
          "rounded-lg border border-line text-text-dim transition-colors hover:text-text",
          compact ? "h-8 px-2 text-xs" : "h-10 px-3 text-sm",
        )}
      >
        Cancel
      </button>
    </div>
  );
}
