// src/app/nex-native/create-account/page.tsx
//
// NEX Create-Account · reference-image reproduction · sealed 2026-09-25.
// -------------------------------------------------------------------------
// Founder directive: reproduce the reference visual authority. Dark-navy
// premium NEX brand · cyan technical borders · orange CTA · minimal.
// NOT wrapped in NexNativeShell — the reference design does not include
// the HUD capabilities menu button. Renders with its own inline visual
// system so it doesn't inherit the cream+wave surface of other /nex-native
// pages.

import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { createNexAccountAction } from "../_actions";
import { NexPasswordField } from "./_password-field";
import { NexCreateSubmit } from "./_create-submit";
import { NexPhoneField } from "./_phone-field";

// Parse an ISO2 country hint from common geo/language headers so the
// first server render already shows the right country prefix. Client-side
// detection (navigator.language, Intl timezone) refines on hydration.
function readCountryHint(hdrs: Headers): string | undefined {
  const geo =
    hdrs.get("x-vercel-ip-country") ||
    hdrs.get("cf-ipcountry") ||
    hdrs.get("x-nex-ip-country");
  if (geo && /^[A-Za-z]{2}$/.test(geo)) return geo.toUpperCase();
  const al = hdrs.get("accept-language");
  if (al) {
    const m = al.match(/-([A-Za-z]{2})\b/);
    if (m) return m[1]!.toUpperCase();
  }
  return undefined;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ e?: string; m?: string }>;
}

// ─── NEX brand tokens · match the reference image ──────────────────────
const NEX = {
  bg: "#020914",
  panel: "#03101D",
  fieldBg: "#04101F",
  textPrimary: "#F2F5F8",
  textSecondary: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanFaint: "rgba(0, 175, 255, 0.18)",
  orange: "#FF7200",
};

export default async function CreateAccountPage({ searchParams }: PageProps) {
  const session = await resolveNexAppSessionFromContext();
  if (session) redirect("/nex-native/home");
  const params = await searchParams;
  const authError = params.e && params.m ? { code: params.e, message: params.m } : null;
  const initialIso2 = readCountryHint(await headers());

  return (
    <>
      {/* Isolate this surface from the global bg-brand-bg body and
          Tailwind neutrals · the reference design owns its own palette. */}
      <style>{`
        html, body { background: ${NEX.bg} !important; }
        [data-nex-create-account-root] * { box-sizing: border-box; }
        [data-nex-create-account-root] input:focus,
        [data-nex-create-account-root] button:focus-visible {
          outline: 2px solid ${NEX.cyan};
          outline-offset: 2px;
        }
        [data-nex-create-account-root] input::placeholder {
          color: ${NEX.textSecondary};
          opacity: 0.7;
        }
      `}</style>
      <main
        id="main"
        data-nex-create-account-root
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
        {/* Subtle technological atmosphere · single faint radial glow,
            no stars, no particles, no photograph. */}
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
          {/* 1 · BACK BUTTON */}
          <div style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 8px)" }}>
            <Link
              href="/nex-native"
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

          {/* 2 · NEX LOGO */}
          <div style={{ marginTop: 28, textAlign: "center" }}>
            <div
              style={{
                fontSize: 44,
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
            {/* 3 · NEX TAGLINE */}
            <p
              style={{
                marginTop: 8,
                fontSize: 12,
                letterSpacing: "0.06em",
                color: NEX.textSecondary,
              }}
            >
              Your world is waiting.
            </p>
          </div>

          {/* 4 · MAIN HEADING */}
          <header style={{ marginTop: 36, textAlign: "center" }}>
            <h1
              style={{
                margin: 0,
                fontSize: 26,
                fontWeight: 500,
                letterSpacing: "0.005em",
                color: NEX.textPrimary,
                lineHeight: 1.2,
              }}
            >
              Create your NEX account
            </h1>
            <p
              style={{
                marginTop: 10,
                fontSize: 13,
                color: NEX.textSecondary,
              }}
            >
              Your private space starts here.
            </p>
          </header>

          {authError && (
            <div
              role="status"
              style={{
                marginTop: 16,
                padding: "10px 14px",
                border: `1px solid ${NEX.orange}`,
                borderRadius: 8,
                color: NEX.textPrimary,
                fontSize: 12,
                background: "rgba(255,114,0,0.08)",
              }}
            >
              {authError.message}
            </div>
          )}

          {/* Form wraps everything so the Server Action fires from the
              button that visually sits BELOW the panel per the reference. */}
          <form
            action={createNexAccountAction}
            data-nex-create-account-form
          >
            {/* 5 · ACCOUNT FORM PANEL */}
            <div
              style={{
                marginTop: 22,
                background: NEX.panel,
                border: `1px solid ${NEX.cyanSoft}`,
                borderRadius: 12,
                padding: 18,
              }}
            >
              <Field label="Full name">
                <input
                  required
                  type="text"
                  name="full_name"
                  placeholder="Enter your name"
                  autoComplete="name"
                  style={inputStyle}
                />
              </Field>

              <Field label="Email address">
                <input
                  required
                  type="email"
                  name="email"
                  placeholder="Enter your email"
                  autoComplete="email"
                  style={inputStyle}
                />
              </Field>

              <NexPhoneField initialIso2={initialIso2} />

              <Field label="Password">
                <NexPasswordField
                  name="password"
                  placeholder="Create a password"
                  ariaLabel="Password"
                  minLength={6}
                />
              </Field>

              {/* 6 · SECURITY MESSAGE */}
              <div
                style={{
                  marginTop: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  color: NEX.textSecondary,
                  fontSize: 12,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
                </svg>
                <span>Private. Secure. Only you.</span>
              </div>
            </div>

            {/* 7 · CREATE ACCOUNT BUTTON · sits below the panel visually */}
            <div style={{ marginTop: 16 }}>
              <NexCreateSubmit />
            </div>
          </form>

          {/* 8 · OR DIVIDER */}
          <div
            style={{
              marginTop: 22,
              display: "grid",
              gridTemplateColumns: "1fr auto 1fr",
              alignItems: "center",
              gap: 12,
              color: NEX.cyan,
              fontSize: 12,
              letterSpacing: "0.14em",
            }}
          >
            <span style={{ height: 1, background: NEX.cyanFaint }} />
            <span>OR</span>
            <span style={{ height: 1, background: NEX.cyanFaint }} />
          </div>

          {/* 9 · CREATE WITH FACE */}
          <Link
            href="/nex-native/create-account/face"
            style={{
              marginTop: 18,
              display: "inline-flex",
              width: "100%",
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              padding: "12px 18px",
              background: NEX.panel,
              color: NEX.cyan,
              border: `1px solid ${NEX.cyanSoft}`,
              borderRadius: 8,
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: "0.16em",
            }}
          >
            <FaceScanIcon />
            CREATE WITH FACE
          </Link>

          {/* 10 · SIGN-IN AREA */}
          <p
            style={{
              marginTop: 24,
              textAlign: "center",
              fontSize: 13,
              color: NEX.textSecondary,
            }}
          >
            Already have an account?{" "}
            <Link
              href="/nex-native/sign-in"
              style={{ color: NEX.orange, textDecoration: "none", fontWeight: 500 }}
            >
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 48,
  padding: "12px 14px",
  background: NEX.fieldBg,
  color: NEX.textPrimary,
  border: `1px solid ${NEX.cyanSoft}`,
  borderRadius: 8,
  fontFamily: "inherit",
  fontSize: 14,
  letterSpacing: "0.01em",
  outline: "none",
};

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <span
        style={{
          display: "block",
          marginBottom: 6,
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.16em",
          color: NEX.cyan,
          textTransform: "uppercase",
        }}
      >
        {props.label}
      </span>
      {props.children}
    </label>
  );
}

function FaceScanIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 8V6a2 2 0 0 1 2-2h2" />
      <path d="M16 4h2a2 2 0 0 1 2 2v2" />
      <path d="M20 16v2a2 2 0 0 1-2 2h-2" />
      <path d="M8 20H6a2 2 0 0 1-2-2v-2" />
      <path d="M9 10h.01" />
      <path d="M15 10h.01" />
      <path d="M9.5 15c.5.5 1.5 1 2.5 1s2-.5 2.5-1" />
    </svg>
  );
}
