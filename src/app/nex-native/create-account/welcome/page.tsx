// src/app/nex-native/create-account/welcome/page.tsx
//
// Post-signup "Add to home screen" landing.
// -------------------------------------------------------------------------
// Bridge 42 · 2026-09-28. Founder direction: after a user creates an
// account (and is already signed in by createNexAccountAction), the
// only thing they see is an invite to add NEX to their home screen.
// Whichever CTA they pick lands them on /nex-native/chat — the
// contacts hub — where the real product starts.
//
// The page assumes:
//   · Session already exists (createNexAccountAction runs supabase.auth.signUp
//     with an immediate session · redirects here).
//   · Signed-in cookie persists across sessions until the user hits
//     sign out · standard Supabase behaviour, no code change needed.
//
// Failure modes:
//   · Unauthenticated visitor lands here → redirect to /sign-in. Not
//     a common path, but stops the page from rendering as a marketing
//     landing to strangers.

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { NexPageHeader } from "../../_page-header";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "#020914",
  panel: "#03101D",
  fieldBg: "#04101F",
  textPrimary: "#F2F5F8",
  textSecondary: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanFaint: "rgba(0, 175, 255, 0.12)",
  orange: "#FF7200",
};

const CONTACTS_HREF = "/nex-native/chat";

export default async function WelcomePage() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const firstName =
    session.account.display_name.split(/\s+/)[0] ?? session.account.display_name;

  return (
    <>
      <style>{`html, body { background: ${NEX.bg} !important; }`}</style>
      <main
        data-nex-welcome-root
        style={{
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.textPrimary,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          padding: "16px 20px 40px",
          position: "relative",
          overflowX: "hidden",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(60% 40% at 50% 0%, rgba(0,175,255,0.10), transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative", maxWidth: 460, margin: "0 auto" }}>
          <NexPageHeader dataScope="welcome" />

          <section style={{ marginTop: 36, textAlign: "center" }}>
            <div
              aria-hidden
              style={{
                fontSize: 42,
                lineHeight: 1,
                marginBottom: 16,
              }}
            >
              🎉
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: 26,
                fontWeight: 600,
                letterSpacing: "-0.01em",
                color: NEX.textPrimary,
              }}
            >
              Welcome to NEX, {firstName}
            </h1>
            <p
              style={{
                marginTop: 10,
                marginBottom: 0,
                fontSize: 14,
                lineHeight: 1.5,
                color: NEX.textSecondary,
                maxWidth: 380,
                marginLeft: "auto",
                marginRight: "auto",
              }}
            >
              You're signed in and ready. One last step so NEX opens
              like an app on your device.
            </p>
          </section>

          {/* Add to home screen · primary panel */}
          <section
            style={{
              marginTop: 28,
              padding: 20,
              background: NEX.panel,
              border: `1px solid ${NEX.cyanSoft}`,
              borderRadius: 16,
              boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <div
                aria-hidden
                style={{
                  flexShrink: 0,
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: NEX.cyanFaint,
                  color: NEX.cyan,
                  display: "grid",
                  placeItems: "center",
                  fontSize: 22,
                }}
              >
                📱
              </div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 600,
                  color: NEX.textPrimary,
                }}
              >
                Add NEX to your home screen
              </h2>
            </div>

            <p
              style={{
                margin: "0 0 14px",
                fontSize: 13,
                lineHeight: 1.55,
                color: NEX.textSecondary,
              }}
            >
              Get one-tap access to NEX just like a native app · faster
              open, full-screen chat, works even when your browser is
              closed.
            </p>

            {/* Platform hints · iOS Safari + Android Chrome. Two
                subtle rows the user can skim. */}
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: "none",
                display: "grid",
                gap: 8,
              }}
            >
              <PlatformHint
                icon="🍎"
                label="iPhone · Safari"
                text={`Tap Share → "Add to Home Screen"`}
              />
              <PlatformHint
                icon="🤖"
                label="Android · Chrome"
                text={`Tap ⋮ → "Add to Home screen"`}
              />
            </ul>
          </section>

          {/* Continue · single CTA that lands on contacts */}
          <Link
            href={CONTACTS_HREF}
            data-nex-welcome-continue
            style={{
              display: "inline-flex",
              width: "100%",
              minHeight: 56,
              marginTop: 20,
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              padding: "14px 20px",
              background: NEX.orange,
              color: "#0B0F1A",
              border: "none",
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              textDecoration: "none",
              boxShadow: "0 12px 26px rgba(255,114,0,0.35)",
            }}
          >
            Continue to your contacts →
          </Link>

          <p
            style={{
              marginTop: 14,
              fontSize: 11,
              color: NEX.textSecondary,
              opacity: 0.7,
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            You'll stay signed in on this device until you sign out.
          </p>
        </div>
      </main>
    </>
  );
}

function PlatformHint(props: { icon: string; label: string; text: string }) {
  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 12px",
        borderRadius: 10,
        background: NEX.fieldBg,
        border: `1px solid ${NEX.cyanFaint}`,
      }}
    >
      <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>
        {props.icon}
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.10em",
            textTransform: "uppercase",
            fontWeight: 700,
            color: NEX.cyan,
            opacity: 0.85,
          }}
        >
          {props.label}
        </div>
        <div
          style={{
            marginTop: 1,
            fontSize: 12,
            color: NEX.textPrimary,
            lineHeight: 1.35,
          }}
        >
          {props.text}
        </div>
      </div>
    </li>
  );
}
