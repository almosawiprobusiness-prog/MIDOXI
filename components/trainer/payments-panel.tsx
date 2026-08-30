"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink, Link2, Loader2, Plus, Trash2 } from "lucide-react";
import {
  beginOnboarding,
  createProduct,
  deactivateProduct,
  makePaymentLink,
} from "@/app/app/payments/actions";
import type { TrainerProduct } from "@/lib/billing/connect";

/*
  The interactive half of the payments page. Server components render
  the states and the fee schedule; this handles the three things that
  need a click: starting onboarding, creating a product, and turning a
  product into a Checkout link the trainer copies and sends.

  The link is shown WITH the fee that was frozen into it — the number
  the trainer saw is the number Stripe will charge, and showing it at
  the moment of creation is what makes the schedule a promise.
*/

const money = (cents: number) => `$${(cents / 100).toFixed(2).replace(/\.00$/, "")}`;

export function OnboardingButton({ resume }: { resume?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async () => {
    setBusy(true);
    setError(null);
    const res = await beginOnboarding();
    if (res.ok && res.data) {
      window.location.href = res.data.url;
    } else {
      setError(res.ok ? "No URL returned." : res.error);
      setBusy(false);
    }
  };

  return (
    <div>
      <button
        onClick={go}
        disabled={busy}
        className="inline-flex h-10 items-center gap-2 rounded-lg bg-signal px-4 text-sm font-medium text-white transition-colors hover:bg-signal-deep disabled:opacity-50"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <ExternalLink className="size-4" />}
        {resume ? "Finish setup on Stripe" : "Set up payments"}
      </button>
      {error && <p className="mt-2 text-xs text-correction">{error}</p>}
    </div>
  );
}

export function ProductForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [dollars, setDollars] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = await createProduct({
      title,
      amountCents: Math.round(parseFloat(dollars || "0") * 100),
    });
    if (res.ok) {
      setTitle("");
      setDollars("");
      router.refresh();
    } else {
      setError(res.error);
    }
    setBusy(false);
  };

  const inp =
    "h-10 rounded-lg border border-line bg-ink-850 px-3 text-sm text-text-hi placeholder:text-text-faint focus:border-signal-line focus:outline-none";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. 6-session speed block"
          className={`${inp} min-w-0 flex-1`}
          maxLength={120}
        />
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-faint">$</span>
          <input
            value={dollars}
            onChange={(e) => setDollars(e.target.value.replace(/[^\d.]/g, ""))}
            placeholder="300"
            inputMode="decimal"
            className={`${inp} w-28 pl-7`}
          />
        </div>
        <button
          onClick={submit}
          disabled={busy || !title.trim() || !dollars}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-signal-line px-3.5 text-sm font-medium text-signal-bright transition-colors hover:bg-signal/10 disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Add
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-correction">{error}</p>}
    </div>
  );
}

export function ProductRow({ product, canCharge }: { product: TrainerProduct; canCharge: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"link" | "remove" | null>(null);
  const [link, setLink] = useState<{ url: string; feeCents: number; feeBps: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setBusy("link");
    setError(null);
    const res = await makePaymentLink(product.id);
    if (res.ok && res.data) setLink(res.data);
    else setError(res.ok ? "No link returned." : res.error);
    setBusy(null);
  };

  const remove = async () => {
    setBusy("remove");
    const res = await deactivateProduct(product.id);
    if (!res.ok) setError(res.error);
    router.refresh();
    setBusy(null);
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Could not copy — select the link text instead.");
    }
  };

  return (
    <div className="panel p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <span className="text-sm font-medium text-text-hi">{product.title}</span>
          <span className="data-mono ml-3 text-sm text-signal-bright">{money(product.amountCents)}</span>
        </div>
        <button
          onClick={generate}
          disabled={busy !== null || !canCharge}
          title={canCharge ? undefined : "Finish Stripe onboarding first"}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-signal px-3.5 text-sm font-medium text-white transition-colors hover:bg-signal-deep disabled:opacity-50"
        >
          {busy === "link" ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
          Payment link
        </button>
        <button
          onClick={remove}
          disabled={busy !== null}
          aria-label={`Remove ${product.title}`}
          className="inline-flex size-9 items-center justify-center rounded-lg border border-line text-text-faint transition-colors hover:border-correction/50 hover:text-correction disabled:opacity-50"
        >
          {busy === "remove" ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        </button>
      </div>

      {link && (
        <div className="mt-3 rounded-lg border border-signal-line/50 bg-signal/5 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate text-xs text-text">{link.url}</code>
            <button
              onClick={copy}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line px-2.5 text-xs text-text-dim transition-colors hover:border-signal-line hover:text-signal-bright"
            >
              {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-text-faint">
            Send it to your client. Platform fee frozen into this link:{" "}
            {money(link.feeCents)} ({link.feeBps / 100}%) — you receive{" "}
            {money(product.amountCents - link.feeCents)} minus Stripe&rsquo;s processing fee.
          </p>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-correction">{error}</p>}
    </div>
  );
}
