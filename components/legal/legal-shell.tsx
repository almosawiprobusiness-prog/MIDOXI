import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
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
