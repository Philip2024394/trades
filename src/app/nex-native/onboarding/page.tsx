// src/app/nex-native/onboarding/page.tsx
//
// Merchant self-service onboarding · one business + one initial product.
// Rebuilt Bridge 16f · 2026-09-28 · full NEX dark-navy identity to match
// the shop landing, packages, terms, and safe-trade surfaces. Adds a
// business-category dropdown so the seller declares vertical up front.
//
// Server Component. Reads the caller's session · reads any existing
// business owned by this account · renders either:
//   · "You already have a business" card (pilot bound to one per user)
//   · A form that posts to createBusinessAction (Server Action)
//
// Every value comes from the authoritative NEX Supabase via
// src/lib/nex-native/*. No mock row · no fabricated slug.

import type * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import { effectiveTier } from "@/lib/nex-native/account-service";
import type { NexAccountRow } from "@/lib/nex-native/types";
import { createBusinessAction, signOutAction } from "../_actions";
import { NEX_BUSINESS_CATEGORIES } from "@/lib/nex-native/site-templates";

/** Small helper so the JSX below stays readable. */
function effectiveTierValue(account: NexAccountRow): "gratis" | "bisnis" | "pro" {
  return effectiveTier({
    tier: account.tier,
    bisnis_expires_at: account.bisnis_expires_at,
    themes_trial_used_at: account.themes_trial_used_at ?? null,
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "#020914",
  panel: "#050f1e",
  panelSoft: "rgba(6, 15, 28, 0.72)",
  border: "rgba(139, 169, 209, 0.14)",
  borderStrong: "rgba(139, 169, 209, 0.24)",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0,175,255,0.5)",
  orange: "#FF7200",
  orangeSoft: "rgba(255,114,0,0.6)",
  green: "#16D66B",
  red: "#FF3355",
};

const SERIF =
  "'Cormorant Garamond', 'EB Garamond', 'Playfair Display', Georgia, serif";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

interface PageProps {
  searchParams: Promise<{ e?: string; m?: string }>;
}

export default async function Page({ searchParams }: PageProps) {
  const sp = await searchParams;
  // Bridge 55 · Phase 1 launch gate · seller onboarding hidden by
  // default. Admins can reach it with ?commerce=1.
  const { commerceEnabledForRequest } = await import(
    "@/lib/nex-native/launch-flags"
  );
  if (!commerceEnabledForRequest(sp)) {
    redirect("/nex-native/home");
  }
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");
  const banner =
    sp.e && sp.m ? { code: sp.e, message: sp.m } : null;

  const existing = await businessService.listBusinessesByOwner(
    session.account.id,
  );
  const owned = existing[0] ?? null;

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily: SANS,
        paddingBottom: 80,
      }}
    >
      {/* --- Top bar --------------------------------------------------- */}
      <header
        style={{
          padding: "calc(env(safe-area-inset-top, 0) + 14px) 20px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${NEX.border}`,
        }}
      >
        <Link
          href="/nex-native/home"
          style={{
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textDecoration: "none",
            fontFamily: SANS,
          }}
        >
          <span style={{ color: "#F2F5F8" }}>NE</span>
          <span style={{ color: "#FF7200" }}>X</span>
        </Link>
        <form action={signOutAction}>
          <button
            type="submit"
            style={{
              fontSize: 11,
              color: NEX.textDim,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontWeight: 700,
              fontFamily: "inherit",
            }}
          >
            Sign out
          </button>
        </form>
      </header>

      <main style={{ maxWidth: 560, margin: "0 auto", padding: "40px 20px" }}>
        {/* --- Hero ----------------------------------------------------- */}
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.32em",
              textTransform: "uppercase",
              color: NEX.cyan,
              fontWeight: 700,
              marginBottom: 10,
            }}
          >
            NEX Onboarding
          </div>
          <h1
            style={{
              margin: 0,
              fontFamily: SERIF,
              fontSize: 44,
              lineHeight: 1.05,
              letterSpacing: "-0.015em",
              fontWeight: 500,
              marginBottom: 10,
            }}
          >
            Open your NEX shop.
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              lineHeight: 1.65,
              color: NEX.textDim,
            }}
          >
            Signed in as{" "}
            <b style={{ color: NEX.text }}>
              {session.account.display_name}
            </b>
            {session.account.nex_handle && (
              <>
                {" · "}
                <Link
                  href={`/nex-native/u/${session.account.nex_handle}`}
                  style={{
                    color: NEX.cyan,
                    textDecoration: "none",
                    fontFamily:
                      "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
                  }}
                >
                  {session.account.nex_handle}
                </Link>
              </>
            )}
          </p>
        </div>

        {banner && <Banner code={banner.code} message={banner.message} />}

        {owned ? (
          <ExistingShopCard owned={owned} />
        ) : (
          <CreateShopForm
            viewerTier={effectiveTierValue(session.account)}
          />
        )}
      </main>
    </div>
  );
}

/* --------------------------------------------------------------------- *
 * Existing shop · read-only summary + link to manage / open              *
 * --------------------------------------------------------------------- */

function ExistingShopCard({
  owned,
}: {
  owned: import("@/lib/nex-native/types").NexBusinessRow;
}) {
  return (
    <section
      style={{
        padding: "24px 22px",
        borderRadius: 18,
        background: NEX.panelSoft,
        border: `1px solid ${NEX.borderStrong}`,
        boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.28em",
          textTransform: "uppercase",
          color: NEX.green,
          fontWeight: 700,
          marginBottom: 6,
        }}
      >
        Your shop is live
      </div>
      <h2
        style={{
          margin: 0,
          fontFamily: SERIF,
          fontSize: 30,
          lineHeight: 1.15,
          letterSpacing: "-0.01em",
          fontWeight: 500,
          marginBottom: 6,
        }}
      >
        {owned.display_name}
      </h2>
      <div
        style={{
          fontSize: 12,
          color: NEX.cyan,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          fontWeight: 700,
          marginBottom: 18,
        }}
      >
        {owned.slug}.nex
      </div>
      <p
        style={{
          margin: "0 0 22px",
          fontSize: 13,
          lineHeight: 1.6,
          color: NEX.textDim,
        }}
      >
        The pilot allows one shop per account. Manage it below · your
        public NEX opens for buyers at{" "}
        <b style={{ color: NEX.text }}>/nex-native/{owned.slug}</b>.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Link href={`/nex-native/${owned.slug}`} style={primaryButton()}>
          Open your NEX ↗
        </Link>
        <Link href="/nex-native/manage" style={secondaryButton()}>
          Manage
        </Link>
        <Link href="/nex-native/manage/shop" style={secondaryButton()}>
          Shop settings
        </Link>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------- *
 * Create form                                                           *
 * --------------------------------------------------------------------- */

function CreateShopForm({
  viewerTier,
}: {
  viewerTier: "gratis" | "bisnis" | "pro";
}) {
  const isBisnis = viewerTier === "bisnis" || viewerTier === "pro";
  return (
    <section
      style={{
        padding: "24px 22px",
        borderRadius: 18,
        background: NEX.panelSoft,
        border: `1px solid ${NEX.border}`,
        boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.28em",
          textTransform: "uppercase",
          color: NEX.orange,
          fontWeight: 700,
          marginBottom: 6,
        }}
      >
        Create your NEX
      </div>
      <h2
        style={{
          margin: 0,
          fontFamily: SERIF,
          fontSize: 26,
          lineHeight: 1.2,
          letterSpacing: "-0.008em",
          fontWeight: 500,
          marginBottom: 10,
        }}
      >
        A few fields · you&apos;re live.
      </h2>
      <p
        style={{
          margin: "0 0 20px",
          fontSize: 13,
          lineHeight: 1.6,
          color: NEX.textDim,
        }}
      >
        Your <b style={{ color: NEX.text }}>slug</b> becomes your
        permanent public address:{" "}
        <b style={{ color: NEX.cyan, fontFamily: "ui-monospace, monospace" }}>
          &lt;slug&gt;.nex
        </b>
        . Everything else can be edited later.
      </p>

      <form
        action={createBusinessAction}
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
      >
        <FormRow label="Business name" hint="Shown big on your shop hero">
          <input
            required
            type="text"
            name="display_name"
            maxLength={200}
            placeholder="e.g. Aisha Vintage Cameras"
            style={inputStyle}
          />
        </FormRow>

        {/* Slug-A · sealed 2026-09-30 · Bisnis-only custom .nex names.
            Gratis sellers see a locked preview + upgrade CTA · the
            actual slug is auto-generated shop-<6chars> in the server
            action, ignoring whatever the (hidden) input holds. */}
        {isBisnis ? (
          <FormRow
            label="Your .nex name · public address"
            hint="Lowercase letters, digits, hyphens · permanent · this becomes your public URL"
          >
            <input
              required
              type="text"
              name="slug"
              minLength={1}
              maxLength={64}
              pattern="^[a-z0-9]([-a-z0-9]{0,62}[a-z0-9])?$"
              placeholder="e.g. myshop"
              style={{
                ...inputStyle,
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
              }}
            />
          </FormRow>
        ) : (
          <div
            style={{
              padding: "14px 16px",
              borderRadius: 12,
              background: "rgba(255,120,0,0.08)",
              border: "1px dashed rgba(255,120,0,0.42)",
              display: "grid",
              gap: 8,
            }}
          >
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: NEX.orange,
                fontWeight: 700,
              }}
            >
              .nex name · Bisnis feature
            </div>
            <div
              style={{
                fontSize: 13,
                color: NEX.text,
                lineHeight: 1.55,
              }}
            >
              You&apos;re on <b style={{ color: NEX.orange }}>Gratis</b>. Your
              NEX name will be auto-generated (e.g.{" "}
              <span
                style={{
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
                  color: NEX.cyan,
                }}
              >
                shop-a3f8kx.nex
              </span>
              ).
            </div>
            <div style={{ fontSize: 12, color: NEX.textDim, lineHeight: 1.55 }}>
              Upgrade to <b style={{ color: NEX.text }}>Bisnis</b> to pick a
              custom name like{" "}
              <span
                style={{
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
                  color: NEX.text,
                }}
              >
                myshop.nex
              </span>{" "}
              — plus unlimited products, verified ✓, priority Directory, and
              full analytics.
            </div>
            <Link
              href="/nex-native/settings/tier"
              style={{
                display: "inline-flex",
                alignItems: "center",
                alignSelf: "flex-start",
                padding: "8px 14px",
                borderRadius: 999,
                background: NEX.orange,
                color: "#0B0F1A",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                textDecoration: "none",
              }}
            >
              Upgrade to Bisnis →
            </Link>
            {/* Hidden field so the form still submits · the action
                ignores this and auto-generates the slug server-side. */}
            <input type="hidden" name="slug" value="__auto__" />
          </div>
        )}

        <FormRow
          label="Category"
          hint="Sets your Directory facet and unlocks category tools (menus for restaurants, etc.)"
        >
          <select
            name="business_category"
            defaultValue=""
            style={{
              ...inputStyle,
              appearance: "auto",
              cursor: "pointer",
            }}
          >
            <option value="">— Choose your vertical —</option>
            {NEX_BUSINESS_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {formatCategoryLabel(c)}
              </option>
            ))}
          </select>
        </FormRow>

        <FormRow
          label="City / neighbourhood"
          hint="Shown on your About page · optional"
        >
          <input
            type="text"
            name="city"
            maxLength={80}
            placeholder="e.g. Jakarta Selatan, Bandung, Ubud"
            style={inputStyle}
          />
        </FormRow>

        <FormRow
          label="Opening hours"
          hint="Free-text · buyers see exactly what you type · optional"
        >
          <input
            type="text"
            name="hours_display"
            maxLength={200}
            placeholder="e.g. Mon-Sat 9am-6pm · closed Sunday"
            style={inputStyle}
          />
        </FormRow>

        <FormRow
          label="First product name"
          hint="You can add more later from /manage"
        >
          <input
            required
            type="text"
            name="product_name"
            maxLength={200}
            placeholder="e.g. Leica M3 · 1954"
            style={inputStyle}
          />
        </FormRow>

        <FormRow
          label="Price (GBP)"
          hint="Stored as integer pence · GBP for the pilot"
        >
          <input
            required
            type="number"
            name="product_price_gbp"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            placeholder="e.g. 24.50"
            style={inputStyle}
          />
        </FormRow>

        <button type="submit" style={primaryButton({ marginTop: 6 })}>
          Open your NEX shop
        </button>
      </form>
    </section>
  );
}

/* --------------------------------------------------------------------- *
 * Sub-components                                                        *
 * --------------------------------------------------------------------- */

function FormRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        style={{
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: NEX.textMute,
          fontWeight: 700,
        }}
      >
        {label}
      </span>
      {children}
      {hint && (
        <span
          style={{ fontSize: 11, color: NEX.textMute, lineHeight: 1.5 }}
        >
          {hint}
        </span>
      )}
    </label>
  );
}

function Banner({ code, message }: { code: string; message: string }) {
  const isError =
    !code.endsWith("_ok") &&
    !code.startsWith("theme_") &&
    code !== "email_confirmation_required";
  return (
    <div
      role="status"
      style={{
        padding: "12px 14px",
        borderRadius: 12,
        background: isError
          ? "rgba(255,51,85,0.10)"
          : "rgba(22,214,107,0.10)",
        border: `1px solid ${
          isError ? "rgba(255,51,85,0.35)" : "rgba(22,214,107,0.35)"
        }`,
        color: isError ? "#FFB4C0" : "#B8F1CC",
        fontSize: 13,
        marginBottom: 18,
      }}
    >
      {message}
    </div>
  );
}

/* --------------------------------------------------------------------- *
 * Styles                                                                *
 * --------------------------------------------------------------------- */

const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 44,
  padding: "12px 14px",
  borderRadius: 12,
  background: "rgba(0,0,0,0.35)",
  border: `1px solid ${NEX.borderStrong}`,
  color: NEX.text,
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
};

function primaryButton(
  extra: React.CSSProperties = {},
): React.CSSProperties {
  return {
    display: "block",
    padding: "14px 18px",
    borderRadius: 12,
    background: "linear-gradient(180deg, #FF9033 0%, #FF7200 100%)",
    border: `1px solid ${NEX.orangeSoft}`,
    color: "#0B0F1A",
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    textDecoration: "none",
    textAlign: "center",
    cursor: "pointer",
    fontFamily: "inherit",
    boxShadow:
      "0 12px 30px rgba(255,114,0,0.35), inset 0 1px 0 rgba(255,255,255,0.28)",
    ...extra,
  };
}

function secondaryButton(): React.CSSProperties {
  return {
    display: "block",
    padding: "12px 18px",
    borderRadius: 12,
    background: "rgba(0,175,255,0.10)",
    border: `1px solid ${NEX.cyanSoft}`,
    color: NEX.text,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    textDecoration: "none",
    textAlign: "center",
    fontFamily: "inherit",
  };
}

function formatCategoryLabel(slug: string): string {
  return slug
    .split("-")
    .map((w) => (w.length > 0 ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}
