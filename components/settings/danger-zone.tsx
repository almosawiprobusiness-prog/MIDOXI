"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Download, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { deleteAccount } from "@/app/app/settings/actions";

export function DangerZone() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const doDelete = async () => {
    setBusy(true);
    setNote(null);
    const res = await deleteAccount();
    // Real mode redirects; demo returns a result.
    if (res.ok && res.demo) {
      setBusy(false);
      setOpen(false);
      setNote("Demo mode — nothing to delete. With Supabase connected this permanently removes your account.");
    } else if (!res.ok) {
      setBusy(false);
      setNote(res.error);
    } else {
      router.push("/");
    }
  };

  return (
    <div className="panel border-correction/20 p-5">
      <div className="flex items-center gap-2">
        <AlertTriangle className="size-4 text-correction" />
        <span className="label-tech !text-correction">Data</span>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-medium text-text-hi">Export your data</div>
          <p className="text-sm text-text-dim">Download everything you&rsquo;ve logged as JSON.</p>
        </div>
        <a
          href="/api/export"
          className="flex h-10 items-center justify-center gap-2 rounded-lg border border-line px-4 text-sm text-text transition-colors hover:border-signal-line hover:text-signal-bright"
        >
          <Download className="size-4" /> Export
        </a>
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-medium text-text-hi">Delete account</div>
          <p className="text-sm text-text-dim">Permanently removes your profile, data and uploads.</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="flex h-10 items-center justify-center gap-2 rounded-lg border border-correction/30 px-4 text-sm text-correction transition-colors hover:bg-correction/10"
        >
          <Trash2 className="size-4" /> Delete account
        </button>
      </div>

      {note && <p className="mt-3 text-sm text-review">{note}</p>}

      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <motion.div role="dialog" aria-modal="true" className="panel-raised relative w-full max-w-sm p-5 text-center shadow-2xl shadow-black/50" initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }} transition={{ duration: 0.18 }}>
              <span className="mx-auto grid size-11 place-items-center rounded-full bg-correction/10 text-correction"><Trash2 className="size-5" /></span>
              <h3 className="mt-3 font-display text-lg font-semibold text-text-hi">Delete your account?</h3>
              <p className="mt-1.5 text-sm text-text-dim">This can&rsquo;t be undone. Type <span className="text-text-hi">DELETE</span> to confirm.</p>
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                className="mt-4 h-10 w-full rounded-lg border border-line bg-ink-850 px-3 text-center text-sm text-text-hi placeholder:text-text-faint focus:border-correction focus:outline-none"
              />
              <div className="mt-4 flex gap-3">
                <button onClick={() => setOpen(false)} className="h-11 flex-1 rounded-lg border border-line text-sm text-text transition-colors hover:text-text-hi">Cancel</button>
                <button
                  onClick={doDelete}
                  disabled={busy || confirmText !== "DELETE"}
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-correction font-medium text-white transition-colors hover:brightness-110 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : "Delete forever"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
