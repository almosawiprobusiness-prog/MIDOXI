import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";

/*
  Where a trainer's payment link lands after Stripe Checkout — the one
  public page in the money flow. It states the outcome and nothing
  else: the payer may have no MIDO XI account, so there is nothing to
  link into and no data to show. The receipt comes from Stripe.
*/

export const metadata = { title: "Payment — MIDO XI" };

export default async function PayDonePage({
  searchParams,
}: {
  searchParams: Promise<{ cancelled?: string }>;
}) {
  const { cancelled } = await searchParams;
  const wasCancelled = cancelled === "1";

  return (
    <div className="grid min-h-screen place-items-center bg-ink-950 px-4">
      <div className="panel-raised w-full max-w-md p-8 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-xl border border-line bg-ink-850">
          {wasCancelled ? (
            <XCircle className="size-6 text-review" />
          ) : (
            <CheckCircle2 className="size-6 text-positive" />
          )}
        </span>
        <h1 className="mt-4 font-display text-2xl font-bold uppercase tracking-tight text-text-hi">
          {wasCancelled ? "Payment cancelled" : "Payment received"}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-text-dim">
          {wasCancelled
            ? "Nothing was charged. The payment link still works if you change your mind."
            : "Your trainer has been paid — Stripe emails your receipt. You can close this page."}
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-10 items-center rounded-lg border border-line px-4 text-sm text-text-dim transition-colors hover:border-signal-line hover:text-signal-bright"
        >
          MIDO XI
        </Link>
      </div>
    </div>
  );
}
