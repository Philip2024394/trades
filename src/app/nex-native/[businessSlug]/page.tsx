// src/app/nex-native/[businessSlug]/page.tsx
//
// NEX Shop · public visitor landing for a seller's business.
// ----------------------------------------------------------
// This is what a visitor sees when they follow a philip.nex or
// aisha-vintage-cameras.nex link from an Instagram bio / QR code /
// share URL. Founder direction 2026-09-27: "highest quality possible
// shop page for sellers".
//
// Aesthetic:
//   · Dark navy #020914 canvas · matches the NEX Chat identity
//   · Serif display for the business name + product headlines ·
//     editorial, magazine-quality read
//   · Rich full-bleed hero with the seller's photo · cinematic
//   · 1-column product feed with big photos (up to 640px wide) ·
//     each item reads as its own editorial spread, not a table row
//   · Chat CTA anchored to the bottom as the primary conversion ·
//     the whole page funnels toward "start the conversation"
//
// Zero legacy chrome: no SKU column, no idempotency inputs, no
// inline order forms · commerce happens inside chat per doctrine.

import type * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import * as businessService from "@/lib/nex-native/business-service";
import * as productService from "@/lib/nex-native/product-service";
import * as sellerResponsivenessService from "@/lib/nex-native/seller-responsiveness-service";
import { HeroSidePanel } from "./_hero-side-panel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
  cyanSoft: "rgba(0,175,255,0.6)",
  orange: "#FF7800",
  orangeSoft: "rgba(255,120,0,0.65)",
  green: "#16D66B",
  amber: "#F59E0B",
};

const SERIF =
  "'Cormorant Garamond', 'EB Garamond', 'Playfair Display', Georgia, serif";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export default async function Page({
  params,
}: {
  params: Promise<{ businessSlug: string }>;
}) {
  const { businessSlug } = await params;
  const business = await businessService.getBusinessBySlug(businessSlug);
  if (!business) notFound();

  const products = await productService.listProductsByBusiness(
    business.id,
    "live",
  );

  const chatHref = `/nex-native/chat/peer/${business.owner_account_id}`;

  // Bridge 13 · resolve the seller's activity status so the hero
  // can carry an honest badge (active / slow / away / archived).
  // Reads existing columns · auto-archives crossings for 30+ days.
  const activity = await sellerResponsivenessService.resolveActivity({
    business_id: business.id,
    last_seller_activity_at: business.last_seller_activity_at,
    is_away: business.is_away,
    away_until: business.away_until ?? null,
    away_message: business.away_message ?? null,
    archived_at: business.archived_at ?? null,
  });

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily: SANS,
      }}
    >
      {/* --- TOP HEADER · NEX brand + home + settings ----------------
          Transparent · no container · floats directly over the hero
          photograph. The wordmark carries a subtle text-shadow and
          the icon buttons carry their own orange fill so nothing
          needs an outer shell for legibility. */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          padding:
            "calc(env(safe-area-inset-top, 0) + 12px) 14px 8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "transparent",
        }}
      >
        {/* Brand · NE (white) + X (orange) · matches the create-account
            wordmark exactly · sans + letterSpacing 0.08em. Soft text
            shadow so it stays legible over any hero photo without
            needing a container behind it. */}
        <Link
          href="/nex-native"
          aria-label="NEX home"
          style={{
            display: "inline-flex",
            alignItems: "baseline",
            gap: 2,
            textDecoration: "none",
            fontFamily: SANS,
            fontSize: 22,
            lineHeight: 1,
            fontWeight: 600,
            letterSpacing: "0.08em",
            padding: "6px 4px",
            textShadow: "0 2px 12px rgba(0,0,0,0.75)",
          }}
        >
          <span style={{ color: "#F2F5F8" }}>NE</span>
          <span style={{ color: "#FF7200" }}>X</span>
        </Link>

        {/* Right cluster · home + settings */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <HeaderIconLink
            href="/nex-native/home"
            ariaLabel="Home"
            title="Home"
          >
            <HomeIcon />
          </HeaderIconLink>
          <HeaderIconLink
            href="/nex-native/settings"
            ariaLabel="Settings"
            title="Settings"
          >
            <SettingsIcon />
          </HeaderIconLink>
        </div>
      </header>

      {/* --- HERO ---------------------------------------------------- */}
      <section
        style={{
          position: "relative",
          width: "100%",
          minHeight: "min(78vh, 720px)",
          overflow: "hidden",
          marginTop: -64, // header floats over the hero
        }}
      >
        {/* Cover photograph · falls back to a moody gradient when the
            seller hasn't uploaded a logo/cover yet. */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: business.logo_url
              ? `url(${business.logo_url})`
              : `linear-gradient(135deg, #063B67 0%, #05101f 60%, #020914 100%)`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "saturate(1.05)",
          }}
        />
        {/* Editorial scrim · dark at bottom so text stays legible */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(2,9,20,0.15) 0%, rgba(2,9,20,0.55) 45%, rgba(2,9,20,0.95) 100%)",
          }}
        />

        {/* Content column · centered · caps at 720 so lines don't
            sprawl on desktop */}
        <div
          style={{
            position: "relative",
            maxWidth: 720,
            margin: "0 auto",
            padding:
              "calc(env(safe-area-inset-top, 0) + 32px) 24px 40px",
            minHeight: "inherit",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: NEX.cyan,
              fontWeight: 700,
              marginBottom: 16,
            }}
          >
            {business.slug}.nex
          </div>
          <h1
            style={{
              margin: 0,
              fontFamily: SERIF,
              fontWeight: 500,
              fontSize: "clamp(38px, 8vw, 68px)",
              lineHeight: 1.02,
              letterSpacing: "-0.015em",
              marginBottom: 12,
              textShadow: "0 2px 24px rgba(0,0,0,0.6)",
            }}
          >
            {business.display_name}
          </h1>
          {/* Bridge 13 · activity badge · green/amber/purple/gray
              signal computed from last_seller_activity_at */}
          <ActivityBadge activity={activity} />
          {business.description && (
            <p
              style={{
                margin: 0,
                fontSize: 15,
                lineHeight: 1.55,
                color: "rgba(244,247,252,0.85)",
                maxWidth: 520,
                textShadow: "0 1px 12px rgba(0,0,0,0.5)",
              }}
            >
              {business.description}
            </p>
          )}
          {/* Two reach bullets · migration 060 · shows visitors at a
              glance whether this seller ships to their region. */}
          <ul
            style={{
              margin: "18px 0 0",
              padding: 0,
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              maxWidth: 520,
            }}
          >
            <ReachBullet
              label="Ships to local buyers"
              on={
                business.market_reach === "both" ||
                business.market_reach === "local_only"
              }
            />
            <ReachBullet
              label="Ships internationally (export)"
              on={
                business.market_reach === "both" ||
                business.market_reach === "export_only"
              }
            />
          </ul>
        </div>
        {/* Right-side vertical rail · About / Order / SafeTrade ·
            each opens a full-screen overlay with the relevant info. */}
        <HeroSidePanel
          businessName={business.display_name}
          businessDescription={business.description ?? null}
          address={business.address ?? null}
          acceptsCod={!!business.accepts_cod}
          acceptsPickup={!!business.accepts_pickup}
          paymentInstructions={business.payment_instructions ?? null}
          marketReach={business.market_reach ?? "both"}
          sellerDetails={{
            yearEstablished: business.year_established ?? null,
            staffCount: business.staff_count ?? null,
            samplesAvailable: !!business.samples_available,
            acceptsOem: !!business.accepts_oem,
            minOrderQuantity: business.min_order_quantity ?? null,
            localPostageIncluded: !!business.local_postage_included,
            sellerKind: business.seller_kind ?? "private",
            languages: business.languages ?? ["id"],
            additionalDetails: business.additional_details ?? null,
          }}
        />
      </section>

      {/* --- PRODUCTS ------------------------------------------------ */}
      {products.length > 0 && (
        <section
          id="products"
          style={{
            maxWidth: 720,
            margin: "0 auto",
            padding: "40px 20px 20px",
          }}
        >
          <SectionHeading
            eyebrow="The Collection"
            title="Currently available"
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            {products.map((p) => (
              <ProductSpread
                key={p.id}
                name={p.name}
                description={p.description ?? null}
                price={formatPrice(p.price_pence, p.currency)}
                imageUrl={p.image_url ?? null}
                tags={p.tags ?? []}
                stockStatus={p.stock_status}
                chatHref={chatHref}
                detailHref={`/nex-native/${business.slug}/${p.id}`}
              />
            ))}
          </div>
        </section>
      )}

      {products.length === 0 && (
        <section
          style={{
            maxWidth: 720,
            margin: "0 auto",
            padding: "60px 20px",
            textAlign: "center",
            color: NEX.textDim,
            fontSize: 14,
          }}
        >
          Aisha hasn&apos;t listed anything yet. The conversation is
          still open · say hi above.
        </section>
      )}

      {/* --- CONTACT + SOCIALS --------------------------------------- */}
      {(business.address ||
        business.public_phone ||
        business.public_email ||
        business.instagram_handle ||
        business.facebook_handle ||
        business.tiktok_handle) && (
        <section
          style={{
            maxWidth: 720,
            margin: "0 auto",
            padding: "40px 20px 24px",
          }}
        >
          <SectionHeading eyebrow="Reach out" title="Find the seller" />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              padding: 20,
              background: NEX.panelSoft,
              border: `1px solid ${NEX.border}`,
              borderRadius: 16,
            }}
          >
            {business.address && (
              <ContactRow label="Location" value={business.address} />
            )}
            {business.public_phone && (
              <ContactRow
                label="Phone"
                value={business.public_phone}
                href={`tel:${business.public_phone}`}
              />
            )}
            {business.public_email && (
              <ContactRow
                label="Email"
                value={business.public_email}
                href={`mailto:${business.public_email}`}
              />
            )}
            {(business.instagram_handle ||
              business.facebook_handle ||
              business.tiktok_handle ||
              business.linkedin_handle ||
              business.x_handle) && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  marginTop: 4,
                }}
              >
                {business.instagram_handle && (
                  <SocialPill
                    href={`https://instagram.com/${business.instagram_handle}`}
                    label={`@${business.instagram_handle}`}
                  />
                )}
                {business.facebook_handle && (
                  <SocialPill
                    href={`https://facebook.com/${business.facebook_handle}`}
                    label={`/${business.facebook_handle}`}
                  />
                )}
                {business.tiktok_handle && (
                  <SocialPill
                    href={`https://tiktok.com/@${business.tiktok_handle}`}
                    label={`TikTok · @${business.tiktok_handle}`}
                  />
                )}
                {business.linkedin_handle && (
                  <SocialPill
                    href={`https://linkedin.com/${business.linkedin_handle}`}
                    label={`LinkedIn · /${business.linkedin_handle}`}
                  />
                )}
                {business.x_handle && (
                  <SocialPill
                    href={`https://x.com/${business.x_handle}`}
                    label={`X · @${business.x_handle}`}
                  />
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* --- FOOTER -------------------------------------------------- */}
      <footer
        style={{
          padding: "32px 20px calc(env(safe-area-inset-bottom, 0) + 32px)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            color: NEX.textMute,
            fontWeight: 700,
          }}
        >
          Powered by NEX
        </div>
        <div
          style={{
            fontSize: 11,
            color: NEX.textMute,
            marginTop: 8,
          }}
        >
          <Link
            href="/nex-native/about"
            style={{ color: NEX.cyan, textDecoration: "none" }}
          >
            What is NEX?
          </Link>
        </div>
      </footer>
    </div>
  );
}

/* --------------------------------------------------------------------- *
 * Building blocks                                                       *
 * --------------------------------------------------------------------- */

function SectionHeading({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.24em",
          textTransform: "uppercase",
          color: NEX.cyan,
          fontWeight: 700,
          marginBottom: 6,
        }}
      >
        {eyebrow}
      </div>
      <h2
        style={{
          margin: 0,
          fontFamily: SERIF,
          fontWeight: 500,
          fontSize: 28,
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </h2>
    </div>
  );
}

function ContactRow({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  const valueEl = href ? (
    <a
      href={href}
      style={{
        color: NEX.text,
        textDecoration: "none",
        borderBottom: `1px solid ${NEX.borderStrong}`,
      }}
    >
      {value}
    </a>
  ) : (
    <span style={{ color: NEX.text }}>{value}</span>
  );
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "80px 1fr",
        gap: 12,
        alignItems: "start",
        fontSize: 13,
      }}
    >
      <div
        style={{
          color: NEX.textMute,
          fontSize: 10,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          paddingTop: 2,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{valueEl}</div>
    </div>
  );
}

function SocialPill({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 12px",
        borderRadius: 999,
        border: `1px solid ${NEX.borderStrong}`,
        background: "rgba(0,175,255,0.08)",
        color: NEX.cyan,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.02em",
        textDecoration: "none",
      }}
    >
      {label}
    </a>
  );
}

function ProductSpread({
  name,
  description,
  price,
  imageUrl,
  tags,
  stockStatus,
  chatHref,
  detailHref,
}: {
  name: string;
  description: string | null;
  price: string;
  imageUrl: string | null;
  tags: string[];
  stockStatus: string | null;
  chatHref: string;
  detailHref: string;
}) {
  return (
    <article
      style={{
        borderRadius: 20,
        overflow: "hidden",
        background: NEX.panelSoft,
        border: `1px solid ${NEX.border}`,
        boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
      }}
    >
      {/* Hero photo · 3:2 aspect · bottom corners rounded so the
          image reads as its own self-contained photo, with the meta
          block sitting below it in the card. */}
      <div
        style={{
          width: "100%",
          aspectRatio: "3 / 2",
          background: "#050f1e",
          overflow: "hidden",
          position: "relative",
          borderRadius: "0 0 18px 18px",
        }}
      >
        {imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={imageUrl}
            alt={name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          <div
            aria-hidden
            style={{
              display: "grid",
              placeItems: "center",
              width: "100%",
              height: "100%",
              color: NEX.textMute,
              fontSize: 56,
            }}
          >
            🛍️
          </div>
        )}
        {stockStatus && stockStatus !== "in_stock" && (
          <div
            style={{
              position: "absolute",
              top: 14,
              left: 14,
              padding: "4px 10px",
              borderRadius: 999,
              background: "rgba(2,9,20,0.75)",
              border: `1px solid ${
                stockStatus === "sold_out"
                  ? "rgba(255,120,120,0.5)"
                  : NEX.borderStrong
              }`,
              color:
                stockStatus === "sold_out"
                  ? "#FF7A85"
                  : stockStatus === "low_stock"
                    ? NEX.amber
                    : NEX.cyan,
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 700,
              backdropFilter: "blur(6px)",
            }}
          >
            {stockStatus === "sold_out"
              ? "Sold out"
              : stockStatus === "low_stock"
                ? "Low stock"
                : stockStatus === "made_to_order"
                  ? "Made to order"
                  : stockStatus.replace(/_/g, " ")}
          </div>
        )}
        {/* Price overlay · lower-right corner of the image · compact
            pill so it lands as a signature not a banner. */}
        <div
          style={{
            position: "absolute",
            right: 12,
            bottom: 12,
            padding: "4px 9px",
            borderRadius: 8,
            background:
              "linear-gradient(180deg, rgba(2,9,20,0.75) 0%, rgba(2,9,20,0.9) 100%)",
            border: `1px solid ${NEX.orangeSoft}`,
            color: NEX.orange,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.01em",
            fontFamily: SANS,
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
          }}
        >
          {price}
        </div>
      </div>

      {/* Meta · name lives under the image now (its own row), then
          tags, then description, then the CTAs. */}
      <div style={{ padding: "18px 22px 22px" }}>
        <h3
          style={{
            margin: 0,
            fontFamily: SERIF,
            fontWeight: 500,
            fontSize: 26,
            letterSpacing: "-0.01em",
            lineHeight: 1.1,
            marginBottom: 10,
          }}
        >
          {name}
        </h3>
        {tags.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              marginBottom: 14,
            }}
          >
            {tags.slice(0, 5).map((tag) => (
              <span
                key={tag}
                style={{
                  padding: "3px 10px",
                  borderRadius: 999,
                  border: `1px solid ${NEX.borderStrong}`,
                  background: "rgba(0,175,255,0.08)",
                  color: NEX.cyan,
                  fontSize: 10,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        {description && (
          <p
            style={{
              margin: 0,
              fontSize: 14,
              lineHeight: 1.6,
              color: "rgba(244,247,252,0.85)",
              marginBottom: 18,
              whiteSpace: "pre-wrap",
            }}
          >
            {description}
          </p>
        )}
        {/* Two CTAs · Order Now (primary orange, goes to chat) +
            More Details (secondary cyan, opens the full product page) */}
        <div style={{ display: "flex", gap: 10 }}>
          <Link
            href={chatHref}
            style={{
              flex: 1,
              padding: "12px 14px",
              borderRadius: 12,
              background: NEX.orange,
              color: "#0B0F1A",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              textDecoration: "none",
              textAlign: "center",
              boxShadow: "0 8px 20px rgba(255,120,0,0.35)",
            }}
          >
            Order Now
          </Link>
          <Link
            href={detailHref}
            style={{
              flex: 1,
              padding: "12px 14px",
              borderRadius: 12,
              background: "rgba(0,175,255,0.16)",
              border: `1px solid ${NEX.cyanSoft}`,
              color: NEX.text,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              textDecoration: "none",
              textAlign: "center",
            }}
          >
            More Details
          </Link>
        </div>
      </div>
    </article>
  );
}

function formatPrice(pence: number, currency: string): string {
  const majors = Math.round(pence / 100);
  const withCommas = majors.toLocaleString();
  if (currency === "IDR") return `Rp ${withCommas}`;
  if (currency === "GBP") return `£${(pence / 100).toFixed(2)}`;
  if (currency === "USD") return `$${(pence / 100).toFixed(2)}`;
  return `${currency} ${withCommas}`;
}

function ActivityBadge({
  activity,
}: {
  activity: import("@/lib/nex-native/seller-responsiveness-service").SellerActivityBundle;
}) {
  const palette = ACTIVITY_PALETTE[activity.status];
  const text = activity.detail || activity.label;
  return (
    <div
      role="status"
      aria-label={`Seller status · ${activity.label} · ${activity.detail}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        marginTop: 6,
        marginBottom: 14,
        fontSize: 12,
        color: palette.detail,
        letterSpacing: "0.02em",
        textShadow: "0 1px 8px rgba(0,0,0,0.55)",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: palette.dot,
          boxShadow:
            activity.status === "active"
              ? `0 0 0 3px ${palette.dot}22`
              : "none",
        }}
      />
      <span>{text}</span>
    </div>
  );
}

const ACTIVITY_PALETTE: Record<
  "active" | "slow" | "away" | "archived",
  {
    bg: string;
    border: string;
    text: string;
    dot: string;
    detail: string;
  }
> = {
  active: {
    bg: "rgba(22,214,107,0.14)",
    border: "rgba(22,214,107,0.5)",
    text: "#B8F1CC",
    dot: "#16D66B",
    detail: "rgba(184,241,204,0.85)",
  },
  slow: {
    bg: "rgba(245,158,11,0.14)",
    border: "rgba(245,158,11,0.5)",
    text: "#FCD9A8",
    dot: "#F59E0B",
    detail: "rgba(252,217,168,0.85)",
  },
  away: {
    bg: "rgba(163,132,255,0.16)",
    border: "rgba(163,132,255,0.5)",
    text: "#DDD4FF",
    dot: "#A384FF",
    detail: "rgba(221,212,255,0.85)",
  },
  archived: {
    bg: "rgba(139,169,209,0.12)",
    border: "rgba(139,169,209,0.35)",
    text: "#B8C6DA",
    dot: "#8BA9D1",
    detail: "rgba(184,198,218,0.85)",
  },
};

function ReachBullet({ label, on }: { label: string; on: boolean }) {
  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 13,
        color: on ? "rgba(244,247,252,0.94)" : "rgba(139,169,209,0.55)",
        textDecoration: on ? "none" : "line-through",
        textShadow: on ? "0 1px 10px rgba(0,0,0,0.5)" : undefined,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: on ? "#16D66B" : "rgba(255,255,255,0.12)",
          color: on ? "#0B0F1A" : "rgba(255,255,255,0.6)",
          display: "grid",
          placeItems: "center",
          fontSize: 11,
          fontWeight: 800,
          flexShrink: 0,
          boxShadow: on ? "0 4px 10px rgba(22,214,107,0.35)" : "none",
        }}
      >
        {on ? "✓" : "×"}
      </span>
      <span>{label}</span>
    </li>
  );
}

function HeaderIconLink({
  href,
  ariaLabel,
  title,
  children,
}: {
  href: string;
  ariaLabel: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      title={title}
      style={{
        width: 32,
        height: 32,
        borderRadius: "50%",
        background: "#0B0F1A",
        border: "1px solid rgba(255,255,255,0.18)",
        color: "#FFFFFF",
        display: "grid",
        placeItems: "center",
        textDecoration: "none",
        boxShadow:
          "0 4px 12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)",
      }}
    >
      {children}
    </Link>
  );
}

function HomeIcon() {
  return (
    <svg
      width={15}
      height={15}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 12l9-9 9 9" />
      <path d="M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg
      width={15}
      height={15}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z" />
    </svg>
  );
}
