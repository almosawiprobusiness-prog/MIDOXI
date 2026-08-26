"use client";

import { useEffect } from "react";

/*
  Last-resort boundary — catches errors in the root layout itself, so it must
  render its own <html>/<body>. Kept dependency-free and inline-styled because
  the app shell (and its CSS variables) may be exactly what failed.
*/
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error.digest ?? "", error.message);
    // Relay to the server log — the browser console is invisible to us.
    fetch("/api/client-error", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        boundary: "global",
        path: window.location.pathname,
        digest: error.digest ?? "",
        message: error.message,
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#08090b",
          color: "#e7e9ee",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem", maxWidth: 420 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>MIDO XI hit a fatal error</h1>
          <p style={{ color: "#9aa0aa", fontSize: 14, marginTop: 8 }}>
            The application shell failed to load. Reloading usually fixes it.
          </p>
          {error.digest && (
            <p style={{ color: "#6b7180", fontSize: 11, marginTop: 12, fontFamily: "monospace" }}>ref {error.digest}</p>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: 24,
              padding: "8px 18px",
              borderRadius: 8,
              border: "none",
              background: "#7b61ff",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
