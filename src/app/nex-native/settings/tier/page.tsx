// src/app/nex-native/settings/tier/page.tsx
//
// Customer-facing NEX plan surface · shows current tier + upgrade path.
// -------------------------------------------------------------------------
// Slice 5 of the sealed package doctrine build order (CLAUDE.md
// 2026-09-27). Every signed-in account can see:
//   · Current plan · Gratis / Bisnis / Pro
//   · Expiry (if Bisnis)
//   · Feature comparison side-by-side
//   · Upgrade CTA · Phase 1 = mailto to NEX Ops · Phase 2 = wallet
//
// Non-throwing surface. Gratis users see the whole page. Bisnis+ users
// see the current-plan card + "you're on Bisnis" state. No sales pressure.

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { effectiveTier } from "@/lib/nex-native/account-service";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { NexPageHeader } from "../../_page-header";
import type { NexAccountRow } from "@/lib/nex-native/types";
import { NEX_ACCOUNT_TIER_LABEL } from "@/lib/nex-native/types";
import { NEX_OFFICIAL_CHAT_HREF } from "@/lib/nex-native/nex-official";

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
  green: "#10b981",
};

// Bridge 31 · 2026-09-28 · retired NEX_OPS_EMAIL + NEX_OPS_WHATSAPP.
// Upgrade path now runs through the in-app NEX support chat (NEX1)
// instead of email / WhatsApp. See src/lib/nex-native/nex-official.ts.

// Feature rows for the comparison table. Left string is Gratis · right
// string is Bisnis. Order matches the sealed doctrine.
const COMPARISON: Array<{ feature: string; gratis: string; bisnis: string }> = [
  { feature: "Chat with anyone", gratis: "Unlimited", bisnis: "Unlimited" },
  { feature: "Products", gratis: "Up to 10 live/draft", bisnis: "Unlimited" },
  { feature: "Live posts", gratis: "3 per week", bisnis: "Unlimited" },
  { feature: "Email subscribers", gratis: "Up to 100", bisnis: "Unlimited" },
  { feature: "Analytics", gratis: "Last 7 days", bisnis: "Full history · CSV export" },
  { feature: "Businesses", gratis: "1", bisnis: "Up to 5" },
  { feature: "NEX Assistant AI", gratis: "20 replies / day", bisnis: "Unlimited" },
  { feature: "NEX Address", gratis: "Auto (nex-XXXXX.nex)", bisnis: "Your custom name.nex" },
  { feature: "Directory placement", gratis: "Standard", bisnis: "Featured chip · priority" },
  { feature: "Verified badge ✓", gratis: "—", bisnis: "After ID verification" },
  { feature: "Boosted messages", gratis: "—", bisnis: "20 / month included" },
  { feature: "Platform fee on sales", gratis: "Small platform fee (later)", bisnis: "0%" },
  { feature: "Support", gratis: "Community", bisnis: "Priority chat with NEX team" },
];

export default async function TierPage() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  // Read raw tier + expiry (session.account may be stale on some paths).
  const row = await nexSupabaseAdmin
    .from("nex_account")
    .select("tier, bisnis_expires_at, display_name, nex_handle")
    .eq("id", session.account.id)
    .maybeSingle();
  if (row.error || !row.data) redirect("/nex-native/home");
  const account = row.data as Pick<
    NexAccountRow,
    "tier" | "bisnis_expires_at" | "display_name" | "nex_handle"
  >;
  const effective = effectiveTier(account);
  const isBisnis = effective === "bisnis" || effective === "pro";
  const expires = account.bisnis_expires_at
    ? new Date(account.bisnis_expires_at)
    : null;
  const expiresLabel = expires
    ? expires.toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  // Bridge 31 · Chat with NEX takes over from mailto + WhatsApp · single
  // CTA that opens the peer chat surface against the seeded NEX1 support
  // account. Founder direction 2026-09-28.

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
          padding: "16px 20px 40px",
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
        <div style={{ position: "relative", maxWidth: 520, margin: "0 auto" }}>
          <NexPageHeader dataScope="settings-tier" />

          <h1
            style={{
              margin: "28px 0 6px",
              textAlign: "center",
              fontSize: 24,
              fontWeight: 500,
            }}
          >
            Your NEX plan
          </h1>
          <p
            style={{
              margin: "0 0 22px",
              textAlign: "center",
              fontSize: 13,
              color: NEX.textSecondary,
              lineHeight: 1.5,
            }}
          >
            Signed in as{" "}
            <span style={{ color: NEX.textPrimary }}>{account.display_name}</span>
            {account.nex_handle && (
              <>
                {" · "}
                <code style={{ fontFamily: "ui-monospace, monospace", color: NEX.cyan }}>
                  {account.nex_handle}.nex
                </code>
              </>
            )}
          </p>

          {/* Current plan card */}
          <section
            data-nex-tier-current
            data-nex-tier-current-value={effective}
            style={{
              padding: "18px 20px",
              background: NEX.panel,
              border: `1px solid ${isBisnis ? NEX.orange : NEX.cyanSoft}`,
              borderRadius: 14,
              marginBottom: 20,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "3px 10px",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: isBisnis ? NEX.orange : NEX.green,
                  border: `1px solid ${isBisnis ? NEX.orange : NEX.green}`,
                  borderRadius: 4,
                  lineHeight: 1.3,
                }}
              >
                {isBisnis ? "Active · Bisnis" : "Free forever"}
              </span>
              <span style={{ fontSize: 18, fontWeight: 500 }}>
                {NEX_ACCOUNT_TIER_LABEL[effective]}
              </span>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: NEX.textSecondary,
                lineHeight: 1.5,
              }}
            >
              {isBisnis ? (
                expiresLabel ? (
                  <>
                    Renews or lapses on{" "}
                    <span style={{ color: NEX.textPrimary }}>{expiresLabel}</span>. Every
                    feature below is yours until then.
                  </>
                ) : (
                  <>
                    Indefinite subscription (comp / partner). No renewal needed.
                  </>
                )
              ) : (
                <>
                  Everything on the left column of the table below is yours forever.
                  Upgrade to NEX Bisnis when your business outgrows the free caps.
                </>
              )}
            </p>
          </section>

          {/* Comparison table */}
          <section
            style={{
              padding: "6px 4px 16px",
              background: NEX.panel,
              border: `1px solid ${NEX.cyanSoft}`,
              borderRadius: 14,
              marginBottom: 20,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 1fr 1fr",
                padding: "10px 14px",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: NEX.textSecondary,
                borderBottom: `1px solid ${NEX.cyanFaint}`,
              }}
            >
              <span>Feature</span>
              <span style={{ textAlign: "center", color: NEX.green }}>
                Gratis
              </span>
              <span style={{ textAlign: "center", color: NEX.orange }}>
                Bisnis
              </span>
            </div>
            {COMPARISON.map((r, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.2fr 1fr 1fr",
                  padding: "10px 14px",
                  fontSize: 12,
                  color: NEX.textPrimary,
                  lineHeight: 1.4,
                  borderBottom:
                    i === COMPARISON.length - 1
                      ? "none"
                      : `1px solid ${NEX.cyanFaint}`,
                }}
              >
                <span style={{ color: NEX.textSecondary }}>{r.feature}</span>
                <span style={{ textAlign: "center" }}>{r.gratis}</span>
                <span style={{ textAlign: "center", color: isBisnis ? NEX.orange : NEX.textPrimary }}>
                  {r.bisnis}
                </span>
              </div>
            ))}
          </section>

          {/* Pricing + upgrade CTA (Gratis only) */}
          {!isBisnis && (
            <>
              <section
                style={{
                  padding: "18px 20px",
                  background: NEX.panel,
                  border: `1px solid ${NEX.orange}`,
                  borderRadius: 14,
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    fontWeight: 700,
                    color: NEX.orange,
                    marginBottom: 6,
                  }}
                >
                  NEX Bisnis
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 8,
                    flexWrap: "wrap",
                    marginBottom: 8,
                  }}
                >
                  <span style={{ fontSize: 26, fontWeight: 500 }}>IDR 99,000</span>
                  <span style={{ color: NEX.textSecondary, fontSize: 13 }}>/ month</span>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: NEX.textSecondary,
                    lineHeight: 1.5,
                  }}
                >
                  Or <strong style={{ color: NEX.textPrimary }}>IDR 990,000 / year</strong> — 12 months for the price of 10.
                </div>
                <div
                  style={{
                    marginTop: 10,
                    fontSize: 11,
                    color: NEX.textSecondary,
                    lineHeight: 1.5,
                  }}
                >
                  Phase 1 payment: bank transfer, activated by NEX team within 24
                  hours. GoPay · DANA · auto-renew coming soon.
                </div>
              </section>

              <Link
                href={NEX_OFFICIAL_CHAT_HREF}
                style={{
                  display: "inline-flex",
                  width: "100%",
                  minHeight: 56,
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                  padding: "12px 18px",
                  background: NEX.orange,
                  color: NEX.textPrimary,
                  border: "none",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  textDecoration: "none",
                  marginBottom: 10,
                }}
                data-nex-tier-upgrade-chat
              >
                <span>💬 Chat with NEX and upgrade today</span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 400,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    opacity: 0.9,
                  }}
                >
                  the world is waiting
                </span>
              </Link>
            </>
          )}

          {/* Bisnis-only: manage / thanks state */}
          {isBisnis && (
            <section
              style={{
                padding: "18px 20px",
                background: NEX.panel,
                border: `1px solid ${NEX.cyanSoft}`,
                borderRadius: 14,
                marginBottom: 16,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 22, marginBottom: 8 }}>🎉</div>
              <div
                style={{
                  fontSize: 13,
                  color: NEX.textPrimary,
                  lineHeight: 1.6,
                  marginBottom: 12,
                }}
              >
                You&rsquo;re on NEX Bisnis. Thank you for supporting the platform.
              </div>
              <a
                href={mailtoHref}
                style={{
                  display: "inline-flex",
                  minHeight: 40,
                  alignItems: "center",
                  padding: "10px 16px",
                  color: NEX.cyan,
                  border: `1px solid ${NEX.cyanSoft}`,
                  borderRadius: 6,
                  fontSize: 12,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  textDecoration: "none",
                }}
              >
                Message NEX team
              </a>
            </section>
          )}

          <p
            style={{
              marginTop: 22,
              textAlign: "center",
              fontSize: 11,
              color: NEX.textSecondary,
              lineHeight: 1.6,
            }}
          >
            NEX Chat, identity, and Directory listing are free forever regardless
            of plan.{" "}
            <Link href="/nex-native/settings" style={{ color: NEX.cyan }}>
              Back to settings
            </Link>
          </p>
        </div>
      </main>
    </>
  );
}
