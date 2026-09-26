// src/app/nex-native/create-account/face/page.tsx
//
// NEX face sign-in surface.
// -------------------------------------------------------------------------
// Same dark-navy visual authority as /nex-native/create-account. Owns the
// framing (back button, NEX wordmark, headline) and delegates the actual
// interactive scan to <FaceScanClient>, which handles:
//   · round blue rim (SVG)
//   · pixel-head silhouette (idle)
//   · vertical scan line (always)
//   · live camera preview (during scan)
//   · WebAuthn ceremony via @simplewebauthn/browser
//
// The surface auto-selects mode based on session:
//   · signed-in    → "enroll" · adds a face credential to the account
//   · signed-out   → "assert" · signs the user in with an existing face

import Link from "next/link";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { listCredentialsForAccount } from "@/lib/nex-native/webauthn-service";
import { FaceScanClient } from "./_face-scan-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "#020914",
  panel: "#03101D",
  textPrimary: "#F2F5F8",
  textSecondary: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  orange: "#FF7200",
};

export default async function FacePage() {
  const session = await resolveNexAppSessionFromContext();
  const mode: "enroll" | "assert" = session ? "enroll" : "assert";

  // For enroll mode, tell the visitor whether they've already enrolled.
  let alreadyEnrolled = false;
  if (session) {
    try {
      const list = await listCredentialsForAccount(session.account.id);
      alreadyEnrolled = list.length > 0;
    } catch { /* non-fatal */ }
  }

  const headline =
    mode === "enroll"
      ? alreadyEnrolled
        ? "Add another face"
        : "Enrol your face"
      : "Sign in with your face";
  const subtitle =
    mode === "enroll"
      ? alreadyEnrolled
        ? "You already have face sign-in on this account · adding another device works too."
        : "Your device stores the biometric · NEX only remembers that you passed."
      : "Look at the camera · your device confirms it&rsquo;s you.";

  return (
    <>
      <style>{`
        html, body { background: ${NEX.bg} !important; }
      `}</style>
      <main
        style={{
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.textPrimary,
          fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          padding: "16px 20px 32px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(60% 40% at 50% 0%, rgba(0,175,255,0.09), transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div style={{ position: "relative", maxWidth: 420, margin: "0 auto" }}>
          {/* Back button */}
          <div style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 8px)" }}>
            <Link
              href={mode === "enroll" ? "/nex-native/settings/profile" : "/nex-native/create-account"}
              aria-label="Back"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 40,
                height: 40,
                borderRadius: "50%",
                border: `1px solid ${NEX.cyanSoft}`,
                background: "transparent",
                color: NEX.cyan,
                textDecoration: "none",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </Link>
          </div>

          {/* NEX wordmark */}
          <div style={{ marginTop: 20, textAlign: "center" }}>
            <div
              style={{
                fontSize: 40,
                lineHeight: 1,
                letterSpacing: "0.08em",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "baseline",
                gap: 2,
              }}
              aria-label="NEX"
            >
              <span style={{ color: NEX.textPrimary }}>NE</span>
              <span style={{ color: NEX.orange }}>X</span>
            </div>
            <p
              style={{
                marginTop: 8,
                fontSize: 12,
                letterSpacing: "0.06em",
                color: NEX.textSecondary,
              }}
            >
              Face sign-in
            </p>
          </div>

          {/* Headline */}
          <header style={{ marginTop: 24, textAlign: "center" }}>
            <h1
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 500,
                letterSpacing: "0.005em",
                lineHeight: 1.3,
              }}
            >
              {headline}
            </h1>
            <p
              style={{
                marginTop: 10,
                fontSize: 13,
                color: NEX.textSecondary,
                lineHeight: 1.5,
              }}
              dangerouslySetInnerHTML={{ __html: subtitle }}
            />
          </header>

          {/* Interactive scan · client component */}
          <FaceScanClient mode={mode} />

          {/* Secondary action · sign-out visitors get a full-width
              "Password sign in" button parallel to the "Scan face" one;
              signed-in enrollers get a plain "Skip for now" link. */}
          {mode === "assert" ? (
            <Link
              href="/nex-native/sign-in"
              style={{
                marginTop: 14,
                display: "inline-flex",
                width: "100%",
                minHeight: 48,
                alignItems: "center",
                justifyContent: "center",
                background: "transparent",
                color: NEX.cyan,
                border: `1px solid ${NEX.cyanSoft}`,
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                letterSpacing: "0.06em",
                textDecoration: "none",
              }}
              data-nex-face-password-signin
            >
              Password sign in
            </Link>
          ) : (
            <p
              style={{
                marginTop: 22,
                textAlign: "center",
                fontSize: 13,
                color: NEX.textSecondary,
              }}
            >
              <Link
                href="/nex-native/settings/profile"
                style={{ color: NEX.textSecondary, textDecoration: "underline" }}
              >
                Skip for now
              </Link>
            </p>
          )}
        </div>
      </main>
    </>
  );
}
