"use client";

import { useEffect } from "react";

// Top-level error boundary — catches errors thrown in the root layout
// itself (where the normal error.tsx can't render because layout never
// mounted). Must render its own <html> and <body>.
export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="en-GB">
      <body style={{ margin: 0, background: "#000", color: "#f5f5f5", fontFamily: "-apple-system, system-ui, sans-serif" }}>
        <main style={{ display: "grid", placeItems: "center", minHeight: "100vh", padding: 16 }}>
          <div style={{ maxWidth: 420, padding: 24, border: "1px solid #2a2a2a", borderRadius: 16, background: "#0f0f0f", textAlign: "center" }}>
            <p style={{ color: "#FFB300", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", margin: 0 }}>
              Something went very wrong
            </p>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: "12px 0 0" }}>The site failed to load</h1>
            <p style={{ fontSize: 14, color: "#a3a3a3", marginTop: 8 }}>
              We've logged the issue. Please try again or email us if it keeps happening.
            </p>
            {error.digest && (
              <p style={{ fontFamily: "monospace", fontSize: 11, color: "#a3a3a3", marginTop: 8 }}>
                Ref: {error.digest}
              </p>
            )}
            <button
              type="button"
              onClick={reset}
              style={{
                marginTop: 20,
                height: 48,
                padding: "0 20px",
                borderRadius: 999,
                background: "#FFB300",
                color: "#000",
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                border: "none",
                cursor: "pointer"
              }}
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
