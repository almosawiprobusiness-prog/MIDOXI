import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="pitch-grid absolute inset-0 opacity-60" aria-hidden />
      <div className="field-glow absolute inset-0" aria-hidden />
      <div className="relative w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-1.5">
          <span className="font-display text-2xl font-bold tracking-tight text-text-hi">MIDO</span>
          <span className="font-display text-2xl font-bold tracking-tight text-signal">XI</span>
        </Link>
        <div className="panel-raised p-6 shadow-2xl shadow-black/40">{children}</div>
      </div>
    </div>
  );
}
