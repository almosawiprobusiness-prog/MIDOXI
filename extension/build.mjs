#!/usr/bin/env node
/*
  MIDO XI Capture — build.

  esbuild, three jobs: bundle popup.ts (which pulls the shared capture
  contract straight out of ../lib/data/capture-types.ts, so the
  extension and the API cannot disagree about what a capture is), copy
  the static surface (manifest, html, css, fonts, icons), and, with
  --zip, produce a store-uploadable archive.

  Deliberately not a framework: the popup is one screen with five
  states. A build that fits in a page keeps it auditable, which for an
  extension asking for host permissions is a feature.

  Usage:
    node build.mjs            one production build into dist/
    node build.mjs --watch    rebuild on change (load dist/ unpacked)
    node build.mjs --zip      build + mido-xi-capture-<version>.zip
    node build.mjs --store    Chrome Web Store build into dist-store/ + zip:
                              strips the dev "key" (the store assigns the
                              canonical id) and the localhost host_permissions
                              (a published build has no business on localhost)
*/
import { build, context } from "esbuild";
import { cp, mkdir, rm, readFile, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(root, "src");
const store = process.argv.includes("--store");
const dist = path.join(root, store ? "dist-store" : "dist");
const watch = process.argv.includes("--watch");
const zip = process.argv.includes("--zip") || store;

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const options = {
  entryPoints: [path.join(src, "popup.ts")],
  bundle: true,
  format: "iife",
  target: "chrome110",
  outdir: dist,
  sourcemap: watch ? "inline" : false,
  minify: !watch,
  logLevel: "info",
};

async function copyStatic() {
  for (const f of ["popup.html", "popup.css"]) {
    await cp(path.join(src, f), path.join(dist, f));
  }
  for (const dir of ["icons", "fonts"]) {
    await cp(path.join(src, dir), path.join(dist, dir), { recursive: true });
  }
  const manifest = JSON.parse(await readFile(path.join(src, "manifest.json"), "utf8"));
  if (store) {
    delete manifest.key;
    manifest.host_permissions = manifest.host_permissions.filter(
      (h) => !h.includes("localhost"),
    );
  }
  await writeFile(path.join(dist, "manifest.json"), JSON.stringify(manifest, null, 2));
}

if (watch) {
  const ctx = await context(options);
  await copyStatic();
  await ctx.watch();
  console.log("[mido-xi-capture] watching src/ — load the dist/ folder unpacked.");
} else {
  await build(options);
  await copyStatic();
  const manifest = JSON.parse(await readFile(path.join(src, "manifest.json"), "utf8"));
  console.log(`[mido-xi-capture] built v${manifest.version} → ${path.basename(dist)}/`);

  if (zip) {
    const out = path.join(root, `mido-xi-capture-${store ? "store-" : ""}${manifest.version}.zip`);
    await rm(out, { force: true });
    // PowerShell on Windows, zip elsewhere — no archiver dependency.
    if (process.platform === "win32") {
      execFileSync("powershell", [
        "-NoProfile",
        "-Command",
        `Compress-Archive -Path '${dist}\\*' -DestinationPath '${out}'`,
      ]);
    } else {
      execFileSync("zip", ["-r", out, "."], { cwd: dist });
    }
    console.log(`[mido-xi-capture] packaged → ${path.basename(out)}`);
  }
}
