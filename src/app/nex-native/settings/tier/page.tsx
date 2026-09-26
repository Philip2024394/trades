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

const NEX_OPS_EMAIL = process.env.NEX_OPS_EMAIL ?? "ops@nex.example.com";
const NEX_OPS_WHATSAPP = process.env.NEX_OPS_WHATSAPP ?? ""; // e.g. "+628123456789"

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

  // Compose the upgrade mailto so ops receive a clean intent
  const mailtoSubject = encodeURIComponent(
    `NEX Bisnis upgrade · ${account.display_name} (${account.nex_handle ?? session.account.id.slice(0, 8)})`,
  );
  const mailtoBody = encodeURIComponent(
    `Hi NEX team,\n\nI'd like to upgrade my account to NEX Bisnis.\n\nAccount: ${account.display_name}\nNEX handle: ${account.nex_handle ?? "(unassigned)"}\nEmail: (my sign-in email)\n\nPlan: (please pick) monthly IDR 99,000 · annual IDR 990,000\n\nPayment: bank transfer receipt attached / to follow.\n\nThanks.`,
  );
  const mailtoHref = `mailto:${NEX_OPS_EMAIL}?subject=${mailtoSubject}&body=${mailtoBody}`;

  const whatsappHref = NEX_OPS_WHATSAPP
    ? `https://wa.me/${NEX_OPS_WHATSAPP.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
        `Halo NEX team, saya ingin upgrade ke NEX Bisnis. Akun: ${account.display_name} · handle: ${account.nex_handle ?? ""}.`,
      )}`
    : null;

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

              <a
                href={mailtoHref}
                style={{
                  display: "inline-flex",
                  width: "100%",
                  minHeight: 52,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  padding: "14px 18px",
                  background: NEX.orange,
                  color: NEX.textPrimary,
                  border: "none",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  textDecoration: "none",
                  marginBottom: 10,
                }}
                data-nex-tier-upgrade-email
              >
                📧 EMAIL NEX TO UPGRADE
              </a>

              {whatsappHref && (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    width: "100%",
                    minHeight: 48,
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    padding: "12px 18px",
                    background: NEX.panel,
                    color: NEX.green,
                    border: `1px solid ${NEX.green}`,
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 500,
                    letterSpacing: "0.06em",
                    textDecoration: "none",
                  }}
                  data-nex-tier-upgrade-whatsapp
                >
                  💬 WHATSAPP NEX TO UPGRADE
                </a>
              )}
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
