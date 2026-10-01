// src/app/nex-native/affiliate/marketplace/page.tsx
//
// NEX Affiliate Marketplace · sealed 2026-10-01.
// -----------------------------------------------------------------------------
// Server Component. Lists sellers who've opted into the NEX Resellers
// programme as landscape cards. The affiliate's currently-promoted
// sellers surface in a HERO AREA at the top (always first) with a
// "Cancel affiliate link" button; everyone else sits below under
// "Available sellers" with "Promote this seller."
//
// Each card shows:
//   · logo + up to 4 product-image thumbnails
//   · display name + city
//   · short description
//   · [Open shop ↗] link
//   · [Promote] or [Cancel affiliate link] CTA
//
// Clicking a seller's slug opens their public cover page in a new tab
// so the affiliate can preview the shop before committing.

import type * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { isAffiliateAccount } from "@/lib/nex-native/affiliate-service";
import {
  listActivePromotions,
  listResellerEnabledBusinesses,
  getResellerBusinessesByIds,
  listProductThumbnailsForBusiness,
  type NexResellerBusiness,
} from "@/lib/nex-native/affiliate-marketplace-service";
import {
  cancelPromotionAction,
  promoteSellerAction,
} from "../../_actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "#020914",
  panel: "rgba(6,15,28,0.72)",
  border: "rgba(139,169,209,0.14)",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  cyan: "#009FEF",
  cyanSoft: "rgba(0,159,239,0.5)",
  green: "#8FFF6E",
  red: "#FF5A5A",
  orange: "#FF7200",
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
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const amAffiliate = await isAffiliateAccount(session.account.id);
  if (!amAffiliate) {
    redirect("/nex-native/affiliate/join?from=marketplace");
  }

  const [activePromos, allOptedIn] = await Promise.all([
    listActivePromotions(session.account.id),
    listResellerEnabledBusinesses(60),
  ]);

  const promotedBusinessIds = new Set(activePromos.map((p) => p.business_id));
  const promotedBusinesses = await getResellerBusinessesByIds([
    ...promotedBusinessIds,
  ]);
  // Order active promotions to match the start_at order (most recent first)
  const promotedOrdered = activePromos
    .map((p) => promotedBusinesses.find((b) => b.id === p.business_id))
    .filter((b): b is NexResellerBusiness => !!b);

  // Available = opted-in sellers MINUS the ones already promoted.
  const availableBusinesses = allOptedIn.filter(
    (b) => !promotedBusinessIds.has(b.id),
  );

  // Hydrate product thumbnails for every card we'll render (parallel).
  const allCards = [...promotedOrdered, ...availableBusinesses];
  const thumbnailLists = await Promise.all(
    allCards.map((b) => listProductThumbnailsForBusiness(b.id, 4)),
  );
  const thumbnailByBusinessId = new Map<string, string[]>();
  allCards.forEach((b, i) => thumbnailByBusinessId.set(b.id, thumbnailLists[i]));

  const banner =
    sp.e === "promoted"
      ? { tone: "success" as const, text: "You now promote this seller." }
      : sp.e === "cancelled"
        ? { tone: "info" as const, text: "Promotion cancelled." }
        : sp.e === "promote_failed"
          ? {
              tone: "error" as const,
              text: `Could not start promotion · ${sp.m ?? ""}`,
            }
          : sp.e === "cancel_failed"
            ? {
                tone: "error" as const,
                text: `Could not cancel · ${sp.m ?? ""}`,
              }
            : null;

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
      {/* Top chrome · matches Seller Central · NEX wordmark + home */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          padding:
            "calc(env(safe-area-inset-top, 0) + 12px) 18px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "rgba(2,9,20,0.78)",
          backdropFilter: "blur(14px) saturate(1.2)",
          WebkitBackdropFilter: "blur(14px) saturate(1.2)",
          borderBottom: `1px solid ${NEX.border}`,
        }}
      >
        <Link
          href="/nex-native/affiliate"
          aria-label="Affiliate dashboard"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 2,
            textDecoration: "none",
            fontFamily: SANS,
            lineHeight: 1,
          }}
        >
          <span
            style={{
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "0.08em",
            }}
          >
            <span style={{ color: "#F2F5F8" }}>NE</span>
            <span style={{ color: NEX.orange }}>X</span>
          </span>
          <span
            style={{
              fontSize: 9,
              letterSpacing: "0.26em",
              textTransform: "uppercase",
              color: NEX.textMute,
              fontWeight: 600,
            }}
          >
            Affiliate Marketplace
          </span>
        </Link>
        <Link
          href="/nex-native/home"
          aria-label="Home"
          style={{
            width: 36,
            height: 36,
            display: "grid",
            placeItems: "center",
            borderRadius: "50%",
            color: "rgba(255,255,255,0.55)",
            textDecoration: "none",
          }}
        >
          <svg
            width={20}
            height={20}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M3 11l9-8 9 8" />
            <path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10" />
          </svg>
        </Link>
      </header>

      <main
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "32px 20px 40px",
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            color: NEX.cyan,
            fontWeight: 700,
            marginBottom: 10,
          }}
        >
          Affiliate Marketplace
        </div>
        <h1
          style={{
            margin: "0 0 10px",
            fontFamily: SERIF,
            fontSize: 30,
            lineHeight: 1.1,
            letterSpacing: "-0.012em",
            fontWeight: 500,
          }}
        >
          Pick who you promote.
        </h1>
        <p
          style={{
            margin: "0 0 24px",
            fontSize: 14,
            lineHeight: 1.6,
            color: NEX.textDim,
          }}
        >
          Every seller on this page has joined the NEX Resellers
          programme. Promote one and <b>all of their live products</b>{" "}
          appear in your affiliate shop — you earn{" "}
          <b style={{ color: NEX.green }}>7%</b> commission on every
          qualifying sale (plus 3% on anyone you've recruited into
          NEX).
        </p>

        {banner && (
          <div
            style={{
              marginBottom: 20,
              padding: "10px 14px",
              borderRadius: 10,
              background:
                banner.tone === "success"
                  ? "rgba(143,255,110,0.1)"
                  : banner.tone === "error"
                    ? "rgba(255,90,90,0.08)"
                    : "rgba(0,159,239,0.08)",
              border:
                banner.tone === "success"
                  ? "1px solid rgba(143,255,110,0.4)"
                  : banner.tone === "error"
                    ? "1px solid rgba(255,90,90,0.4)"
                    : "1px solid rgba(0,159,239,0.4)",
              fontSize: 12,
              color: NEX.text,
            }}
          >
            {banner.text}
          </div>
        )}

        {/* HERO AREA · currently-promoted sellers (always first) */}
        {promotedOrdered.length > 0 && (
          <section style={{ marginBottom: 32 }}>
            <SectionHeader
              label="You promote"
              count={promotedOrdered.length}
              accent={NEX.green}
            />
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              {promotedOrdered.map((b) => (
                <SellerCard
                  key={b.id}
                  business={b}
                  thumbnails={thumbnailByBusinessId.get(b.id) ?? []}
                  mode="promoting"
                />
              ))}
            </div>
          </section>
        )}

        {/* Available sellers (opted-in, not yet promoted by viewer) */}
        <section>
          <SectionHeader
            label="Available sellers"
            count={availableBusinesses.length}
            accent={NEX.cyan}
          />
          {availableBusinesses.length === 0 ? (
            <div
              style={{
                padding: "20px",
                borderRadius: 12,
                background: NEX.panel,
                border: `1px solid ${NEX.border}`,
                fontSize: 13,
                color: NEX.textDim,
                textAlign: "center",
              }}
            >
              {promotedOrdered.length > 0
                ? "You're already promoting every seller currently in the programme. Check back soon."
                : "No sellers in the marketplace yet. Check back soon."}
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              {availableBusinesses.map((b) => (
                <SellerCard
                  key={b.id}
                  business={b}
                  thumbnails={thumbnailByBusinessId.get(b.id) ?? []}
                  mode="available"
                />
              ))}
            </div>
          )}
        </section>

        <div
          style={{
            marginTop: 40,
            padding: "14px 18px",
            borderRadius: 12,
            background: "rgba(2,9,20,0.75)",
            border: "1px solid rgba(0,159,239,0.3)",
            fontSize: 12,
            color: NEX.textDim,
            lineHeight: 1.55,
          }}
        >
          NEX records affiliate activity and provides the evidence used
          to settle commission with sellers. NEX does not hold affiliate
          funds — the seller pays commission directly when an order
          ships and payment clears.
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section header · "YOU PROMOTE · 2" or "AVAILABLE SELLERS · 14"
// ---------------------------------------------------------------------------
function SectionHeader({
  label,
  count,
  accent,
}: {
  label: string;
  count: number;
  accent: string;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 14,
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: "0.26em",
          textTransform: "uppercase",
          color: accent,
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      <div
        style={{
          padding: "2px 10px",
          borderRadius: 999,
          background: `${accent}22`,
          color: accent,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
        }}
      >
        {count}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Landscape SellerCard · thumbnail row + metadata + action CTA
// ---------------------------------------------------------------------------
function SellerCard({
  business,
  thumbnails,
  mode,
}: {
  business: NexResellerBusiness;
  thumbnails: string[];
  mode: "promoting" | "available";
}): React.JSX.Element {
  const isPromoting = mode === "promoting";
  // Up to 5 thumbnails: logo first, then up to 4 live product images.
  const strip: Array<{ url: string | null; kind: "logo" | "product" }> = [
    { url: business.logo_url, kind: "logo" },
  ];
  thumbnails.slice(0, 4).forEach((u) =>
    strip.push({ url: u, kind: "product" }),
  );

  return (
    <div
      style={{
        padding: 14,
        borderRadius: 16,
        background: isPromoting
          ? "linear-gradient(180deg, rgba(143,255,110,0.1) 0%, rgba(143,255,110,0.04) 100%)"
          : "linear-gradient(180deg, rgba(0,159,239,0.14) 0%, rgba(0,159,239,0.06) 100%)",
        border: isPromoting
          ? `1px solid ${NEX.green}66`
          : `1px solid ${NEX.cyanSoft}`,
      }}
    >
      {/* Thumbnail row · up to 5 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 6,
          marginBottom: 12,
        }}
      >
        {strip.slice(0, 5).map((item, i) => (
          <div
            key={i}
            style={{
              aspectRatio: "1 / 1",
              borderRadius: 10,
              background: item.url
                ? `url(${item.url}) center/cover no-repeat`
                : "rgba(0,0,0,0.4)",
              border:
                i === 0 && isPromoting
                  ? `2px solid ${NEX.green}`
                  : i === 0
                    ? `2px solid ${NEX.cyan}`
                    : `1px solid rgba(255,255,255,0.08)`,
              display: "grid",
              placeItems: "center",
              color: "rgba(255,255,255,0.3)",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            {!item.url && (item.kind === "logo" ? "logo" : "—")}
          </div>
        ))}
        {/* Fill remaining slots when fewer than 5 */}
        {Array.from({ length: Math.max(0, 5 - strip.length) }).map((_, i) => (
          <div
            key={`empty-${i}`}
            style={{
              aspectRatio: "1 / 1",
              borderRadius: 10,
              background: "rgba(0,0,0,0.25)",
              border: "1px dashed rgba(255,255,255,0.08)",
            }}
          />
        ))}
      </div>

      {/* Identity row */}
      <div style={{ marginBottom: 10 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 8,
            marginBottom: 4,
          }}
        >
          <div
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: NEX.text,
              letterSpacing: "0.01em",
            }}
          >
            {business.display_name}
          </div>
          <div
            style={{
              fontSize: 11,
              color: NEX.cyan,
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
            }}
          >
            {business.slug}.nex
          </div>
        </div>
        {business.city && (
          <div
            style={{
              fontSize: 12,
              color: NEX.textDim,
              marginBottom: 4,
            }}
          >
            📍 {business.city}
          </div>
        )}
        {business.description && (
          <div
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: "#B4BAC3",
              lineHeight: 1.5,
              textShadow:
                "0 0 2px rgba(0,0,0,0.9), 0 1px 2px rgba(0,0,0,0.5)",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {business.description}
          </div>
        )}
      </div>

      {/* Action row · Open shop + Promote / Cancel */}
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "stretch",
        }}
      >
        <Link
          href={`/nex-native/${business.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            flex: 1,
            padding: "10px 16px",
            borderRadius: 999,
            background: "transparent",
            border: `1px solid ${NEX.cyanSoft}`,
            color: NEX.cyan,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            textDecoration: "none",
            textAlign: "center",
            fontFamily: SANS,
          }}
        >
          Open shop ↗
        </Link>
        {isPromoting ? (
          <form
            action={cancelPromotionAction}
            style={{ flex: 1, display: "flex" }}
          >
            <input type="hidden" name="business_id" value={business.id} />
            <button
              type="submit"
              style={{
                flex: 1,
                padding: "10px 16px",
                borderRadius: 999,
                background:
                  "linear-gradient(180deg, #B91C1C 0%, #7F1414 100%)",
                border: "1px solid rgba(255,90,90,0.5)",
                color: "#FFEDED",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
                fontFamily: SANS,
              }}
            >
              Cancel affiliate link
            </button>
          </form>
        ) : (
          <form
            action={promoteSellerAction}
            style={{ flex: 1, display: "flex" }}
          >
            <input type="hidden" name="business_id" value={business.id} />
            <button
              type="submit"
              style={{
                flex: 1,
                padding: "10px 16px",
                borderRadius: 999,
                background: `linear-gradient(180deg, ${NEX.cyan} 0%, #0073b8 100%)`,
                border: "none",
                color: "#FFF",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                cursor: "pointer",
                boxShadow: "0 6px 16px rgba(0,159,239,0.3)",
                fontFamily: SANS,
              }}
            >
              Promote this seller
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
