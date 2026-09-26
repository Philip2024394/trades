// src/app/nex-native/sign-in/page.tsx
//
// NEX sign-in surface · dark-navy visual authority.
// -------------------------------------------------------------------------
// Same premium NEX brand as /nex-native/create-account and
// /nex-native/create-account/face. Three ways in:
//   · Email + password (primary form → signInAction)
//   · Sign in with face  (secondary button → /nex-native/create-account/face)
//   · Create account link (bottom → /nex-native/create-account)
//
// Signed-in visitors are redirected to their inbox so this page is
// unauth-only.

import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { signInAction, signInAsDevAdminAction } from "../_actions";
import { SignInFaceButton } from "./_face-button";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ e?: string; m?: string }>;
}

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

export default async function SignInPage({ searchParams }: PageProps) {
  const session = await resolveNexAppSessionFromContext();
  if (session) redirect("/nex-native/home");

  const params = await searchParams;
  const banner = params.e && params.m ? { code: params.e, message: params.m } : null;

  // Only render the SIGN IN WITH FACE button on devices where enrolment
  // happened. The cookie carries no PII · it's a boolean device hint
  // set by /api/nex-native/auth/webauthn/enroll-finish.
  const jar = await cookies();
  const hasFaceOnDevice = jar.get("nex-has-face")?.value === "1";

  return (
    <>
      <style>{`
        html, body { background: ${NEX.bg} !important; }
        [data-nex-sign-in-root] * { box-sizing: border-box; }
        [data-nex-sign-in-root] input:focus,
        [data-nex-sign-in-root] button:focus-visible {
          outline: 2px solid ${NEX.cyan};
          outline-offset: 2px;
        }
        [data-nex-sign-in-root] input::placeholder {
          color: ${NEX.textSecondary};
          opacity: 0.7;
        }
      `}</style>
      <main
        id="main"
        data-nex-sign-in-root
        style={{
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.textPrimary,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
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
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
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
            <p
              style={{
                marginTop: 8,
                fontSize: 12,
                letterSpacing: "0.06em",
                color: NEX.textSecondary,
              }}
            >
              Welcome back.
            </p>
          </div>

          {/* 3 · HEADLINE */}
          <header style={{ marginTop: 32, textAlign: "center" }}>
            <h1
              style={{
                margin: 0,
                fontSize: 26,
                fontWeight: 500,
                letterSpacing: "0.005em",
                lineHeight: 1.2,
              }}
            >
              Sign in to your NEX
            </h1>
            <p
              style={{
                marginTop: 10,
                fontSize: 13,
                color: NEX.textSecondary,
              }}
            >
              Your conversations are waiting.
            </p>
          </header>

          {/* 4 · ERROR BANNER (from signInAction failure) */}
          {banner && (
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
              data-nex-sign-in-banner={banner.code}
            >
              {banner.message}
            </div>
          )}

          {/* 5 · SIGN-IN FORM PANEL */}
          <form action={signInAction} data-nex-sign-in-form>
            <div
              style={{
                marginTop: 22,
                background: NEX.panel,
                border: `1px solid ${NEX.cyanSoft}`,
                borderRadius: 12,
                padding: 18,
              }}
            >
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

              <Field label="Password">
                <input
                  required
                  type="password"
                  name="password"
                  minLength={6}
                  placeholder="Your password"
                  autoComplete="current-password"
                  style={inputStyle}
                />
              </Field>
            </div>

            {/* 6 · PRIMARY BUTTON */}
            <button
              type="submit"
              style={{
                marginTop: 16,
                width: "100%",
                minHeight: 48,
                background: NEX.orange,
                color: NEX.textPrimary,
                border: "none",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: "0.06em",
                cursor: "pointer",
              }}
              data-nex-sign-in-submit
            >
              Sign in
            </button>
          </form>

          {/* 7 · OR DIVIDER + FACE BUTTON · only rendered on devices where
               enrolment already happened (nex-has-face cookie). New devices
               and never-enrolled users get password-only, no dead button. */}
          {hasFaceOnDevice && (
            <>
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

              <SignInFaceButton />
            </>
          )}

          {/* 9 · CREATE ACCOUNT LINK */}
          <p
            style={{
              marginTop: 24,
              textAlign: "center",
              fontSize: 13,
              color: NEX.textSecondary,
            }}
          >
            No account yet?{" "}
            <Link
              href="/nex-native/create-account"
              style={{
                color: NEX.orange,
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              Create one
            </Link>
          </p>

          {/* Dev-admin bypass · gated by NEX_ALLOW_DEV_ADMIN=1 in
              .env.local · never exposed in production · one-click
              sign-in as the provisioned dev-admin@nex-native.local */}
          {process.env.NEX_ALLOW_DEV_ADMIN === "1" && (
            <form
              action={signInAsDevAdminAction}
              style={{
                marginTop: 28,
                padding: 12,
                border: `1px dashed ${NEX.orange}`,
                borderRadius: 8,
                background: "rgba(255,114,0,0.05)",
              }}
            >
              <p
                style={{
                  margin: "0 0 8px",
                  fontSize: 11,
                  color: NEX.textSecondary,
                  lineHeight: 1.4,
                }}
              >
                <strong style={{ color: NEX.orange }}>Dev mode</strong> · one-click
                sign-in as{" "}
                <code style={{ fontFamily: "ui-monospace, monospace" }}>
                  dev-admin@nex-native.local
                </code>
                . Disabled in production.
              </p>
              <button
                type="submit"
                style={{
                  width: "100%",
                  minHeight: 40,
                  background: "transparent",
                  color: NEX.orange,
                  border: `1px solid ${NEX.orange}`,
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 500,
                  letterSpacing: "0.08em",
                  cursor: "pointer",
                }}
                data-nex-sign-in-dev-admin
              >
                SIGN IN AS DEV ADMIN
              </button>
            </form>
          )}
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

// FaceScanIcon moved into _face-button.tsx alongside the button that uses it.
