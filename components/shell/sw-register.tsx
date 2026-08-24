"use client";

import { useEffect } from "react";

/**
 * Registers `public/sw.js`. Silent on failure — an unregistered service
 * worker just means no install prompt and no offline icons, not a broken
 * product, so this never surfaces an error to anyone.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
