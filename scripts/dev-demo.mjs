#!/usr/bin/env node
/*
  Run the dev server in DEMO MODE, whatever is in .env.local.

  MIDO XI degrades to seed data when no Supabase keys are present (see
  lib/env.ts). This script blanks the backend keys for one process so the whole
  product — all four role operating systems, the Study Engine, the loop — can be
  explored and reviewed without signing in.

  Usage: npm run dev:demo
*/
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const BLANK = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const env = { ...process.env, NEXT_PUBLIC_APP_URL: "http://localhost:3100" };
for (const key of BLANK) env[key] = "";

// Run the Next binary through this Node process — no shell, so it behaves the
// same on Windows and POSIX.
const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");

const child = spawn(process.execPath, [nextBin, "dev", "--port", process.env.PORT ?? "3100"], {
  stdio: "inherit",
  env,
});

child.on("exit", (code) => process.exit(code ?? 0));
