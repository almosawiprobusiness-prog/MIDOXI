import { FEATURE_LABELS, type MeteredFeature } from "@/lib/billing/plans";
import type { FeatureUsage } from "@/lib/billing/membership";

const LABEL: Partial<Record<MeteredFeature, { label: string; hint: string }>> = Object.fromEntries(
  FEATURE_LABELS.map((f) => [f.key, { label: f.label, hint: f.hint }]),
);

export function UsageMeters({ usage, locked }: { usage: FeatureUsage[]; locked: boolean }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {usage.map((u) => {
        const meta = LABEL[u.feature];
        const pct = u.limit > 0 ? Math.min(100, Math.round((u.used / u.limit) * 100)) : 0;
        const near = pct >= 80;
        return (
          <div key={u.feature} className="min-w-0 panel p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-medium text-text-hi">{meta?.label ?? u.feature}</div>
                <div className="label-tech mt-0.5 truncate">{meta?.hint}</div>
              </div>
              <div className="data-mono shrink-0 text-sm text-text">
                {locked ? (
                  <span className="text-text-faint">Pro</span>
                ) : (
                  <>
                    <span className={near ? "text-review" : "text-text-hi"}>{u.used}</span>
                    <span className="text-text-faint"> / {u.limit}</span>
                  </>
                )}
              </div>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-800">
              <div
                className={`h-full rounded-full transition-all ${locked ? "bg-line" : near ? "bg-review" : "bg-signal"}`}
                style={{ width: locked ? "0%" : `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
