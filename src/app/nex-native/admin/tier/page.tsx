// src/app/nex-native/admin/tier/page.tsx
//
// Dev-admin-only surface to manually promote an account to Bisnis.
// -------------------------------------------------------------------------
// Phase 1 of the Indonesia payment flow: customer messages NEX ops with
// their bank-transfer receipt, ops person signs in as dev-admin, opens
// this page, types the customer's email + picks tier + months, submits.
//
// Two gates before rendering:
//   · env NEX_ALLOW_DEV_ADMIN=1 (never enabled in production)
//   · caller's session is the provisioned dev-admin@nex-native.local
//
// Any other visitor is silently redirected to /home.

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { adminSetAccountTierAction } from "../../_actions";
import {
  NEX_ACCOUNT_TIERS,
  NEX_ACCOUNT_TIER_LABEL,
} from "@/lib/nex-native/types";

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
  orange: "#FF7200",
};

async function isDevAdmin(): Promise<boolean> {
  if (process.env.NEX_ALLOW_DEV_ADMIN !== "1") return false;
  const session = await resolveNexAppSessionFromContext();
  if (!session?.account.supabase_user_id) return false;
  const auth = await nexSupabaseAdmin.auth.admin.getUserById(
    session.account.supabase_user_id,
  );
  if (auth.error || !auth.data.user) return false;
  return (auth.data.user.email ?? "").toLowerCase() === "dev-admin@nex-native.local";
}

export default async function AdminTierPage({ searchParams }: PageProps) {
  const ok = await isDevAdmin();
  if (!ok) redirect("/nex-native/home");

  const params = await searchParams;
  const banner = params.e && params.m ? { code: params.e, message: params.m } : null;
  const isSuccess = banner?.code === "tier_set";

  return (
    <>
      <style>{`html, body { background: ${NEX.bg} !important; }`}</style>
      <main
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
              "radial-gradient(60% 40% at 50% 0%, rgba(255,114,0,0.06), transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative", maxWidth: 480, margin: "0 auto" }}>
          <header
            style={{
              paddingTop: "max(env(safe-area-inset-top, 0px), 8px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <Link
              href="/nex-native/home"
              aria-label="Home"
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
            <span
              style={{
                fontSize: 11,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: NEX.orange,
                fontWeight: 600,
              }}
            >
              Dev Admin · Tier
            </span>
            <span style={{ width: 40 }} />
          </header>

          <h1
            style={{
              margin: "28px 0 6px",
              textAlign: "center",
              fontSize: 22,
              fontWeight: 500,
            }}
          >
            Set account tier
          </h1>
          <p
            style={{
              margin: "0 0 24px",
              textAlign: "center",
              fontSize: 12,
              color: NEX.textSecondary,
              lineHeight: 1.5,
            }}
          >
            Phase 1 · manual promotion after bank-transfer verification.
            <br />
            Type the customer&rsquo;s email, pick the tier + months, submit.
          </p>

          {banner && (
            <div
              role="status"
              style={{
                marginBottom: 18,
                padding: "10px 14px",
                border: `1px solid ${isSuccess ? "#10b981" : NEX.orange}`,
                borderRadius: 8,
                color: NEX.textPrimary,
                fontSize: 12,
                background: isSuccess
                  ? "rgba(16, 185, 129, 0.08)"
                  : "rgba(255,114,0,0.08)",
                lineHeight: 1.5,
              }}
              data-nex-admin-tier-banner={banner.code}
            >
              <strong style={{ color: isSuccess ? "#10b981" : NEX.orange }}>
                {isSuccess ? "OK · " : "Error · "}
              </strong>
              {banner.message}
            </div>
          )}

          <form
            action={adminSetAccountTierAction}
            data-nex-admin-tier-form
            style={{
              background: NEX.panel,
              border: `1px solid ${NEX.cyanSoft}`,
              borderRadius: 12,
              padding: 18,
            }}
          >
            <Label>Customer email</Label>
            <input
              required
              type="email"
              name="email"
              placeholder="customer@example.com"
              autoComplete="off"
              style={inputStyle}
              data-nex-admin-tier-email
            />

            <Label>Tier</Label>
            <div style={{ display: "grid", gap: 6, marginBottom: 14 }}>
              {NEX_ACCOUNT_TIERS.map((t) => (
                <label
                  key={t}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 8,
                    background: NEX.fieldBg,
                    border: `1px solid ${NEX.cyanSoft}`,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="tier"
                    value={t}
                    defaultChecked={t === "bisnis"}
                    required
                    style={{ accentColor: NEX.orange }}
                  />
                  <span>{NEX_ACCOUNT_TIER_LABEL[t]}</span>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontFamily: "ui-monospace, monospace",
                      color: NEX.textSecondary,
                      fontSize: 11,
                    }}
                  >
                    {t}
                  </span>
                </label>
              ))}
            </div>

            <Label>Months (0 = indefinite)</Label>
            <input
              required
              type="number"
              name="months"
              min="0"
              max="120"
              defaultValue="1"
              style={inputStyle}
              data-nex-admin-tier-months
            />

            <button
              type="submit"
              style={{
                marginTop: 6,
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
              data-nex-admin-tier-submit
            >
              APPLY TIER
            </button>
          </form>

          <p
            style={{
              marginTop: 22,
              textAlign: "center",
              fontSize: 11,
              color: NEX.textSecondary,
              lineHeight: 1.6,
            }}
          >
            To downgrade an account back to Gratis, submit with tier = gratis.
            Bisnis + months=0 means indefinite (comp / partner / lifetime).
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
  marginBottom: 14,
  background: NEX.fieldBg,
  color: NEX.textPrimary,
  border: `1px solid ${NEX.cyanSoft}`,
  borderRadius: 8,
  fontFamily: "inherit",
  fontSize: 14,
  outline: "none",
};

function Label(props: { children: React.ReactNode }) {
  return (
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
      {props.children}
    </span>
  );
}
