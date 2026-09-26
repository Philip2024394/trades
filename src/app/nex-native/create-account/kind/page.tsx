// src/app/nex-native/create-account/kind/page.tsx
//
// Bridge 2 · "What best describes what you do?"
// -------------------------------------------------------------------------
// Progressive-disclosure step that runs immediately after a new NEX account
// is provisioned by createNexAccountAction. Owns the same premium dark-navy
// visual authority as the create-account page so the flow feels continuous.
//
// Doctrine:
//   · Six-answer set matches nex_account_profile.kind CHECK (migration 042)
//   · Populates nex_account_profile.kind via setProfileKindAction
//   · Does NOT force any further fields · everything else is deferred to
//     /nex-native/settings/profile
//   · If the caller has no session, redirect to the inbox where the sign-in
//     form lives (never leave them on a dead-end)
//   · If the caller already answered kind before, we still let them pick
//     again · this route is idempotent · re-answer overwrites

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as accountProfileService from "@/lib/nex-native/account-profile-service";
import { setProfileKindAction } from "../../_actions";
import { NEX_ACCOUNT_KINDS, NEX_ACCOUNT_KIND_LABEL, type NexAccountKind } from "@/lib/nex-native/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ e?: string; m?: string }>;
}

// ─── NEX brand tokens · match /create-account so the flow feels continuous ─
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

export default async function KindPage({ searchParams }: PageProps) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect("/nex-native/conversations");
  }

  const params = await searchParams;
  const banner = params.e && params.m ? { code: params.e, message: params.m } : null;

  // If the caller already picked a kind, use it as the initial radio state
  // so they can see + change it. Missing profile row → no default selected.
  const existing = await accountProfileService.getProfileByAccountId(session.account.id);
  const current = existing?.kind ?? null;

  return (
    <>
      <style>{`
        html, body { background: ${NEX.bg} !important; }
        [data-nex-kind-root] * { box-sizing: border-box; }
        [data-nex-kind-root] input:focus + label,
        [data-nex-kind-root] button:focus-visible {
          outline: 2px solid ${NEX.cyan};
          outline-offset: 2px;
        }
      `}</style>
      <main
        data-nex-kind-root
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

        <div style={{ position: "relative", maxWidth: 480, margin: "0 auto" }}>
          {/* Header echoes the create-account visual authority */}
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
              One quick question.
            </p>
          </div>

          <header style={{ marginTop: 36, textAlign: "center" }}>
            <h1
              style={{
                margin: 0,
                fontSize: 24,
                fontWeight: 500,
                letterSpacing: "0.005em",
                lineHeight: 1.25,
              }}
            >
              What best describes what you do?
            </h1>
            <p
              style={{
                marginTop: 10,
                fontSize: 13,
                color: NEX.textSecondary,
              }}
            >
              Choose one · you can change it any time in your NEX profile.
            </p>
          </header>

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
            >
              {banner.message}
            </div>
          )}

          <form action={setProfileKindAction} data-nex-kind-form>
            <div
              style={{
                marginTop: 22,
                background: NEX.panel,
                border: `1px solid ${NEX.cyanSoft}`,
                borderRadius: 12,
                padding: 14,
                display: "grid",
                gap: 10,
              }}
            >
              {NEX_ACCOUNT_KINDS.map((k) => (
                <KindOption
                  key={k}
                  value={k}
                  label={NEX_ACCOUNT_KIND_LABEL[k]}
                  defaultChecked={current === k}
                />
              ))}
            </div>

            <button
              type="submit"
              style={{
                marginTop: 18,
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
              data-nex-kind-submit
            >
              Continue
            </button>

            <p
              style={{
                marginTop: 18,
                textAlign: "center",
                fontSize: 12,
                color: NEX.textSecondary,
              }}
            >
              <Link
                href="/nex-native/conversations"
                style={{ color: NEX.textSecondary, textDecoration: "underline" }}
              >
                Skip for now
              </Link>
            </p>
          </form>
        </div>
      </main>
    </>
  );
}

function KindOption(props: { value: NexAccountKind; label: string; defaultChecked: boolean }) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        border: `1px solid ${NEX.cyanFaint}`,
        borderRadius: 8,
        background: NEX.fieldBg,
        cursor: "pointer",
        fontSize: 14,
      }}
      data-nex-kind-option={props.value}
    >
      <input
        type="radio"
        name="kind"
        value={props.value}
        defaultChecked={props.defaultChecked}
        required
        style={{
          appearance: "auto",
          accentColor: NEX.cyan,
          width: 18,
          height: 18,
          margin: 0,
        }}
      />
      <span>{props.label}</span>
    </label>
  );
}
