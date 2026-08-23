"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Gift, Loader2 } from "lucide-react";
import { redeemMonths } from "@/app/app/referrals/actions";

/*
  Spending months.

  The whole card is a client component rather than just its button, and that is
  the point: the moment the months are spent, `available` becomes 0. If the
  server-rendered card owned the visibility, it would unmount on refresh and
  take its own confirmation down in the same frame it appeared — the user would
  click, and the screen would simply lose a panel.

  So the card owns its lifecycle: it shows the offer, then the result.
*/

export function RedeemCard({ available }: { available: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (available <= 0 && !msg) return null;

  const go = () =>
    start(async () => {
      const res = await redeemMonths();
      setMsg(res.ok ? { ok: true, text: res.message } : { ok: false, text: res.error });
      if (res.ok) router.refresh();
    });

  const done = msg?.ok === true;

  return (
    <div className="panel-raised mt-3 flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {done ? (
          <Check className="mt-0.5 size-5 shrink-0 text-positive" />
        ) : (
          <Gift className="mt-0.5 size-5 shrink-0 text-positive" />
        )}
        <div className="min-w-0">
          {done ? (
            <>
              <p className="text-sm font-medium text-text-hi">Applied</p>
              <p className="text-sm text-text-dim">{msg?.text}</p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-text-hi">
                {available === 1 ? "One free month waiting" : `${available} free months waiting`}
              </p>
              <p className="text-sm text-text-dim">
                Applied on top of any Pro time you already have, so nothing is wasted.
              </p>
              {msg && !msg.ok && <p className="mt-2 text-sm text-correction">{msg.text}</p>}
            </>
          )}
        </div>
      </div>

      {!done && available > 0 && (
        <button
          onClick={go}
          disabled={pending}
          className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-signal px-4 font-medium text-white transition-colors hover:bg-signal-deep disabled:opacity-60"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Gift className="size-4" />}
          {available === 1 ? "Use my free month" : `Use my ${available} free months`}
        </button>
      )}
    </div>
  );
}
