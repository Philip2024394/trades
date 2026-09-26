// src/app/nex-native/create-account/face/page.tsx
//
// NEX face enrolment · post-signup convenience offer.
// -------------------------------------------------------------------------
// This page is reached AFTER account creation. It is not a sign-in
// surface. Signed-out visitors are bounced to /nex-native/sign-in so
// they never see the enrolment prompt before they have an account.
//
// The page presents a deliberate two-button consent:
//   · Scan face and remember me   (primary orange · full ceremony)
//   · I'll use password           (secondary outlined · skip → inbox)
//
// Face sign-in is a *fast return* affordance. The OS platform
// authenticator remembers the biometric; NEX only stores the opaque
// credential material returned by WebAuthn.

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { listCredentialsForAccount } from "@/lib/nex-native/webauthn-service";
import { FaceScanClient } from "./_face-scan-client";
import { NexPageHeader } from "../../_page-header";

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

export default async function FaceEnrolPage() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    // Face enrolment is only meaningful for an authenticated NEX
    // account. Signed-out visitors go to the sign-in surface.
    redirect("/nex-native/sign-in");
  }

  // Detect a repeat visitor who has already enrolled on some device.
  let alreadyEnrolled = false;
  try {
    const list = await listCredentialsForAccount(session.account.id);
    alreadyEnrolled = list.length > 0;
  } catch { /* non-fatal */ }

  const headline = alreadyEnrolled
    ? "Add another device for fast sign-in"
    : "Fast sign-in next time?";
  const subtitle = alreadyEnrolled
    ? "You already have face sign-in on another device. Add this one to sign in from it the same way."
    : "NEX can remember you on this device. Next time you sign in, look at the camera instead of typing your password.";

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
          {/* Shared header · NEX brand (left) · search + gear (right) */}
          <NexPageHeader dataScope="create-account-face" />

          <p
            style={{
              marginTop: 20,
              textAlign: "center",
              fontSize: 12,
              letterSpacing: "0.06em",
              color: NEX.textSecondary,
            }}
          >
            One quick option.
          </p>

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
            >
              {subtitle}
            </p>
          </header>

          {/* Interactive scan · client component · primary orange button
              lives inside it labelled "Scan face and remember me" */}
          <FaceScanClient />

          {/* Secondary action · explicit consent to use password only */}
          <Link
            href="/nex-native/home"
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
            data-nex-face-decline
          >
            I&rsquo;ll use password
          </Link>

          <p
            style={{
              marginTop: 18,
              textAlign: "center",
              fontSize: 11,
              color: NEX.textSecondary,
              lineHeight: 1.5,
            }}
          >
            Your face never leaves this device. NEX stores only the encrypted
            confirmation that your device recognises you. You can turn it off
            in settings any time.
          </p>
        </div>
      </main>
    </>
  );
}
