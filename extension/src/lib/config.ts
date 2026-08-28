/*
  Environments, in one place.

  The extension speaks to exactly one MIDO XI origin at a time. Which
  one is a stored choice, not a build flag, so a single dist/ can be
  pointed at localhost while developing and back at production without
  rebuilding. Every origin listed here must also appear in
  manifest.json host_permissions — that pairing is what makes the
  cookie-authenticated fetches work at all.
*/

export type EnvName = "production" | "local";

export const ENVIRONMENTS: Record<EnvName, { base: string; label: string }> = {
  production: { base: "https://mido-xi.vercel.app", label: "MIDO XI" },
  local: { base: "http://localhost:3100", label: "localhost:3100" },
};

export const DEFAULT_ENV: EnvName = "production";

export async function activeEnv(): Promise<EnvName> {
  try {
    const { env } = await chrome.storage.local.get("env");
    return env === "local" ? "local" : DEFAULT_ENV;
  } catch {
    return DEFAULT_ENV;
  }
}

export async function setActiveEnv(env: EnvName): Promise<void> {
  try {
    await chrome.storage.local.set({ env });
  } catch {
    // Storage failing must not break the popup; the default env stands.
  }
}

export async function apiBase(): Promise<string> {
  return ENVIRONMENTS[await activeEnv()].base;
}

export const EXTENSION_VERSION = chrome.runtime.getManifest().version;
