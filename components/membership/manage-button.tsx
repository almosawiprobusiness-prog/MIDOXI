"use client";

import { useState, useTransition } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { openBillingPortal } from "@/app/app/membership/actions";

export function ManageButton() {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function open() {
    setErr(null);
    start(async () => {
      const res = await openBillingPortal();
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      window.location.href = res.url;
    });
  }

  return (
    <div>
      <button
        onClick={open}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-lg border border-line bg-ink-850 px-3.5 py-2 text-sm font-medium text-text transition-colors hover:border-line-strong disabled:opacity-60"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
        Manage billing
      </button>
      {err && <p className="mt-1.5 text-[11px] text-review">{err}</p>}
    </div>
  );
}
