import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DevelopmentCategory, ClipSentiment } from "@/lib/types";

export function SectionHeader({
  label,
  index,
  action,
}: {
  label: string;
  index?: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        {index && (
          <span className="data-mono text-[11px] text-signal">{index}</span>
        )}
        <h2 className="label-tech !text-text-dim">{label}</h2>
      </div>
      {action && (
        <Link
          href={action.href}
          className="group flex items-center gap-1 text-[11px] text-text-faint transition-colors hover:text-text"
        >
          {action.label}
          <ArrowUpRight className="size-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      )}
    </div>
  );
}

export const categoryStyle: Record<
  DevelopmentCategory,
  { label: string; color: string }
> = {
  technical: { label: "Technical", color: "var(--signal-bright)" },
  tactical: { label: "Tactical", color: "var(--info)" },
  physical: { label: "Physical", color: "var(--positive)" },
  mental: { label: "Mental", color: "var(--review)" },
  positional: { label: "Positional", color: "#c58bff" },
};

export const sentimentStyle: Record<
  ClipSentiment,
  { label: string; color: string; wash: string }
> = {
  positive: {
    label: "Positive",
    color: "var(--positive)",
    wash: "var(--positive-wash)",
  },
  review: { label: "Review", color: "var(--review)", wash: "var(--review-wash)" },
  correction: {
    label: "Correction",
    color: "var(--correction)",
    wash: "var(--correction-wash)",
  },
};

export function Meter({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 flex-1 rounded-full",
            i < value ? "bg-signal" : "bg-ink-700"
          )}
        />
      ))}
    </div>
  );
}
