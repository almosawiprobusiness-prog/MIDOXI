import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/*
  The four documents cross-link, rather than each being reachable only
  from a single footer entry on the landing page. A policy page nobody
  can find except by guessing its URL is dead navigation with a legal
  document's name on it.
*/
const DOCS = [
  { key: "privacy", href: "/privacy", label: "Privacy" },
  { key: "terms", href: "/terms", label: "Terms" },
  { key: "guidelines", href: "/community-guidelines", label: "Community Guidelines" },
] as const;

export function LegalShell({
  title,
  updated,
  active,
  children,
}: {
  title: string;
  updated: string;
  active: (typeof DOCS)[number]["key"];
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen">
      <div className="pitch-grid absolute inset-0 opacity-40" aria-hidden />
      <div className="relative mx-auto max-w-2xl px-5 py-12">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-text-dim transition-colors hover:text-text-hi"
        >
          <ArrowLeft className="size-4" />
          MIDO XI
        </Link>
        <h1 className="font-display text-3xl font-bold tracking-tight text-text-hi">{title}</h1>
        <p className="label-tech mt-2">Last updated · {updated}</p>

        <nav className="mt-5 flex flex-wrap gap-2">
          {DOCS.map((d) => (
            <Link
              key={d.href}
              href={d.href}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                d.key === active
                  ? "border-signal-line bg-signal/10 text-signal-bright"
                  : "border-line text-text-dim hover:border-signal-line hover:text-text-hi",
              )}
            >
              {d.label}
            </Link>
          ))}
        </nav>

        <div className="legal-prose mt-8 space-y-6 text-sm leading-relaxed text-text">
          {children}
        </div>
      </div>
    </div>
  );
}

export function LegalSection({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 font-display text-lg font-semibold text-text-hi">{heading}</h2>
      <div className="space-y-2 text-text-dim">{children}</div>
    </section>
  );
}
