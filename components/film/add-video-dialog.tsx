"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { X, Loader2, Plus, Link2, Upload, FileVideo } from "lucide-react";
import { addVideo, createUploadedVideo } from "@/app/app/film-room/actions";
import { videoUrlKind, LONG_FOOTAGE_ADVICE, UPLOAD_MAX_BYTES, UPLOAD_MAX_MB } from "@/lib/data/film-types";
import { createClient } from "@/lib/supabase/client";
import { env, isDemoMode } from "@/lib/env";


function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const vid = document.createElement("video");
    vid.preload = "metadata";
    vid.onloadedmetadata = () => {
      const d = Number.isFinite(vid.duration) ? Math.round(vid.duration) : null;
      URL.revokeObjectURL(vid.src);
      resolve(d);
    };
    vid.onerror = () => resolve(null);
    vid.src = URL.createObjectURL(file);
  });
}

export function AddVideoDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"upload" | "url">(isDemoMode ? "url" : "upload");
  const [error, setError] = useState<string | null>(null);

  // url import
  const [urlTitle, setUrlTitle] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  // upload
  const [file, setFile] = useState<File | null>(null);
  const [upTitle, setUpTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);

  const reset = () => {
    setError(null); setUrl(""); setUrlTitle(""); setFile(null); setUpTitle("");
    setUploading(false); setProgress(0);
  };
  const close = () => { setOpen(false); reset(); };

  /*
    Honest about what the link is. This said "Direct video" for anything
    that was not YouTube — including a page on a streaming site, which is
    the single most likely thing a footballer pastes here. It sounded
    like confirmation, and the result was a black player with a 0:00
    timeline and nothing explaining why.
  */
  const detected = url.trim() ? videoUrlKind(url) : null;
  const urlUsable = detected !== null && detected.kind !== "unsupported";

  const submitUrl = async () => {
    setBusy(true); setError(null);
    const res = await addVideo({ title: urlTitle, url });
    if (res.ok) { close(); if (res.id) router.push(`/app/film-room/${res.id}`); else router.refresh(); }
    else { setError(res.error); setBusy(false); }
  };

  const onPick = (f: File | null) => {
    setError(null);
    if (!f) return;
    /*
      The old wording here — "Paste a URL for larger footage" — sent
      people straight to the failure this dialog now prevents: they went
      and pasted the page their match was streaming on. Name the thing
      that actually works instead.
    */
    if (f.size > UPLOAD_MAX_BYTES) { setError(`That file is ${(f.size / 1048576).toFixed(0)} MB — over the ${UPLOAD_MAX_MB} MB limit. ${LONG_FOOTAGE_ADVICE}`); return; }
    setFile(f);
    if (!upTitle) setUpTitle(f.name.replace(/\.[^.]+$/, ""));
  };

  const submitUpload = async () => {
    if (!file || !upTitle.trim()) return;
    const supabase = createClient();
    if (!supabase) { setError("Uploads need Supabase connected."); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError("Your session expired — sign in again."); return; }

    setUploading(true); setError(null); setProgress(0);
    try {
      const durationSeconds = await readDuration(file);
      const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
      const path = `${session.user.id}/${crypto.randomUUID()}.${ext}`;

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${env.supabaseUrl}/storage/v1/object/videos/${path}`);
        xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
        xhr.setRequestHeader("apikey", env.supabaseAnonKey);
        xhr.setRequestHeader("x-upsert", "true");
        if (file.type) xhr.setRequestHeader("Content-Type", file.type);
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100)); };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.send(file);
      });

      const res = await createUploadedVideo({ title: upTitle, storagePath: path, durationSeconds });
      if (res.ok && res.id) { close(); router.push(`/app/film-room/${res.id}`); }
      else setError(res.ok ? "Uploaded, but saving the record failed." : res.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="flex h-9 items-center gap-2 rounded-lg bg-signal px-3.5 text-sm font-medium text-white transition-colors hover:bg-signal-deep">
        <Plus className="size-4" /> Add video
      </button>

      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 py-[12vh]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !uploading && close()} />
            <motion.div role="dialog" aria-modal="true" aria-label="Add video" className="panel-raised relative w-full max-w-md p-5 shadow-2xl shadow-black/50" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="label-tech">Add video</div>
                  <h3 className="font-display text-lg font-semibold text-text-hi">Bring footage in</h3>
                </div>
                <button onClick={close} className="text-text-faint hover:text-text" aria-label="Close"><X className="size-5" /></button>
              </div>

              {/* Tabs */}
              <div className="mb-4 flex rounded-lg border border-line bg-ink-850 p-1">
                <button onClick={() => setTab("upload")} className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-sm transition-colors ${tab === "upload" ? "bg-signal/15 text-signal-bright" : "text-text-dim"}`}>
                  <Upload className="size-4" /> Upload file
                </button>
                <button onClick={() => setTab("url")} className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-sm transition-colors ${tab === "url" ? "bg-signal/15 text-signal-bright" : "text-text-dim"}`}>
                  <Link2 className="size-4" /> Paste URL
                </button>
              </div>

              {tab === "upload" ? (
                <div>
                  {isDemoMode && (
                    <p className="mb-3 rounded-lg border border-review/30 bg-review/10 px-3 py-2 text-xs text-review">Demo mode — connect Supabase to upload files. Use Paste URL for now.</p>
                  )}
                  <label className="block">
                    <span className="label-tech mb-1 block">Title</span>
                    <input value={upTitle} onChange={(e) => setUpTitle(e.target.value)} className={inp} placeholder="e.g. Match vs Riverside" />
                  </label>

                  <input ref={fileInput} type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={(e) => onPick(e.target.files?.[0] ?? null)} />

                  {!file ? (
                    <button onClick={() => fileInput.current?.click()} disabled={isDemoMode} className="mt-3 flex w-full flex-col items-center gap-2 rounded-lg border border-dashed border-line-strong bg-ink-925 py-8 text-text-dim transition-colors hover:border-signal-line hover:text-text disabled:opacity-50">
                      <Upload className="size-6" />
                      <span className="text-sm">Choose a video file</span>
                      <span className="text-[11px] text-text-faint">MP4 / WebM / MOV · up to {UPLOAD_MAX_MB} MB</span>
                    </button>
                  ) : (
                    <div className="mt-3 rounded-lg border border-line bg-ink-850 p-3">
                      <div className="flex items-center gap-2.5">
                        <FileVideo className="size-5 shrink-0 text-signal-bright" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm text-text-hi">{file.name}</div>
                          <div className="label-tech">{(file.size / 1048576).toFixed(1)} MB</div>
                        </div>
                        {!uploading && (
                          <button onClick={() => setFile(null)} className="text-text-faint hover:text-text" aria-label="Remove file"><X className="size-4" /></button>
                        )}
                      </div>
                      {uploading && (
                        <div className="mt-3">
                          <div className="h-1.5 overflow-hidden rounded-full bg-ink-700">
                            <div className="h-full rounded-full bg-signal transition-[width] duration-200" style={{ width: `${progress}%` }} />
                          </div>
                          <div className="mt-1 flex justify-between text-[11px] text-text-dim">
                            <span>Uploading…</span><span className="data-mono">{progress}%</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {error && <p className="mt-3 rounded-lg border border-correction/30 bg-correction/10 px-3 py-2 text-sm text-correction">{error}</p>}

                  <div className="mt-5 flex items-center gap-3">
                    <button onClick={close} disabled={uploading} className="h-11 rounded-lg border border-line px-4 text-sm text-text-dim transition-colors hover:text-text-hi disabled:opacity-50">Cancel</button>
                    <button onClick={submitUpload} disabled={uploading || !file || !upTitle.trim() || isDemoMode} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-signal font-medium text-white transition-colors hover:bg-signal-deep disabled:opacity-50">
                      {uploading ? <><Loader2 className="size-4 animate-spin" /> {progress}%</> : <><Upload className="size-4" /> Upload</>}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block">
                    <span className="label-tech mb-1 block">Title</span>
                    <input value={urlTitle} onChange={(e) => setUrlTitle(e.target.value)} className={inp} placeholder="e.g. Blindside movement analysis" />
                  </label>
                  <label className="mt-3 block">
                    <span className="label-tech mb-1 flex items-center gap-1.5"><Link2 className="size-3.5" /> Video URL</span>
                    <input value={url} onChange={(e) => setUrl(e.target.value)} className={inp} placeholder="YouTube link or direct .mp4 URL" />
                    {detected?.kind === "youtube" && (
                      <span className="mt-1 block text-xs text-signal-bright">Detected: YouTube</span>
                    )}
                    {detected?.kind === "direct" && (
                      <span className="mt-1 block text-xs text-signal-bright">Detected: direct video file</span>
                    )}
                    {detected?.kind === "hls" && (
                      <span className="mt-1 block text-xs text-signal-bright">Detected: HLS stream</span>
                    )}
                    {detected?.kind === "page" && (
                      <span className="mt-1 block text-xs leading-relaxed text-signal-bright">
                        Detected: a page on {detected.host}. MIDO will embed the site&rsquo;s own
                        player — if the site allows it, which is checked when you add it.
                      </span>
                    )}
                    {detected?.kind === "unsupported" && (
                      <span className="mt-1 block text-xs leading-relaxed text-review">
                        {detected.reason} {LONG_FOOTAGE_ADVICE}
                      </span>
                    )}
                  </label>

                  {error && <p className="mt-3 rounded-lg border border-correction/30 bg-correction/10 px-3 py-2 text-sm text-correction">{error}</p>}

                  <div className="mt-5 flex items-center gap-3">
                    <button onClick={close} className="h-11 rounded-lg border border-line px-4 text-sm text-text-dim transition-colors hover:text-text-hi">Cancel</button>
                    <button onClick={submitUrl} disabled={busy || !urlTitle.trim() || !urlUsable} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-signal font-medium text-white transition-colors hover:bg-signal-deep disabled:opacity-50">
                      {busy ? <Loader2 className="size-4 animate-spin" /> : <><Plus className="size-4" /> Add video</>}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

const inp = "h-10 w-full rounded-lg border border-line bg-ink-850 px-3 text-sm text-text-hi placeholder:text-text-faint focus:border-signal-line focus:outline-none";
