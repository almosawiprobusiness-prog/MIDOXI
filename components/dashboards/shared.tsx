import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { roleDef, type RoleId } from "@/lib/roles/roles";

/* Furniture shared by the four role dashboards. */

export function DashboardHero({
  role,
  identity,
  title,
  line,
}: {
  role: RoleId;
  /** Second element of the eyebrow — team, practice, club. */
  identity: string;
  title: string;
  line: React.ReactNode;
}) {
  const def = roleDef(role);
  return (
    <header className="mb-8">
      <div className="rise-in label-tech flex items-center gap-3">
        <span>{def.label}</span>
        <span className="h-px w-6 bg-line-strong" />
        <span className="truncate text-text">{identity}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <h1
          className="rise-in font-display text-4xl font-bold uppercase tracking-tight text-text-hi md:text-5xl"
          style={{ animationDelay: "60ms" }}
        >
          {title}
        </h1>
        <p className="rise-in max-w-md text-sm text-text-dim" style={{ animationDelay: "120ms" }}>
          {line}
        </p>
      </div>
    </header>
  );
}

/** Honest label for demonstration datasets (spec 40/41). */
export function DemoNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-8 flex items-center justify-center gap-2 text-center text-[11px] text-text-faint">
      <span className="size-1.5 shrink-0 rounded-full bg-review" />
      {children}
    </p>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="panel flex flex-col items-center gap-3 p-8 text-center">
      <span className="grid size-11 place-items-center rounded-lg border border-line bg-ink-850 text-text-faint">
        <Icon className="size-5" />
      </span>
      <div>
        <h3 className="font-display text-base font-semibold text-text-hi">{title}</h3>
        <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-text-dim">{body}</p>
      </div>
      {action && (
        <Link
          href={action.href}
          className="group mt-1 flex items-center gap-1.5 rounded-lg border border-signal-line bg-signal/10 px-3 py-2 text-sm font-medium text-signal-bright transition-colors hover:bg-signal/20"
        >
          {action.label}
          <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      )}
    </div>
  );
}

/** The role's primary verbs, rendered as a strip. */
export function QuickActions({ role }: { role: RoleId }) {
  const def = roleDef(role);
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {def.quickActions.map((a) => {
        const Icon = a.icon;
        return (
          <Link
            key={a.href + a.label}
            href={a.href}
            className="group panel flex items-center gap-3 p-3.5 transition-colors hover:border-signal-line"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-ink-850 text-signal-bright">
              <Icon className="size-4" />
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-text-hi">{a.label}</span>
            <ArrowUpRight className="size-4 shrink-0 text-text-faint transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        );
      })}
    </div>
  );
}
