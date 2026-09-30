"use client";

// src/app/nex-native/_cover/layouts.tsx
//
// 10 Founder-sealed cover layouts composed from primitives.
// -------------------------------------------------------------------
// Every layout consumes the SAME primitives from ./primitives · every
// layout wraps under <CoverThemeSkin> · so the theme's visual DNA
// (wallpaper + accent + charm + motion + card shape) flows through
// unchanged. What varies per layout: information architecture only.
//
// Layouts:
//   1. cafe             · portrait-half hero · featured today · atmosphere
//   2. restaurant       · full-photo hero · menu sections · reserve
//   3. product          · product hero · 2-col grid · shipping
//   4. tradesperson     · portrait + badges · services · before/after
//   5. salon            · signature look · services · reviews
//   6. creator          · circular portrait · mixed grid · links
//   7. fashion          · full-viewport carousel · big cards · fit CTA
//   8. street_food      · dish hero · dish rows · running cart
//   9. premium_business · weighted name · services + case studies + team
//  10. personal_brand   · half-portrait · products + services + content
//
// The doctrine test: Pink Dream × any of these must LOOK like the
// same brand. Emerald City × any must LOOK like Emerald City. Never
// like a website template.

import * as React from "react";
// Client-safe constants file (no "server-only" import) so this
// "use client" module can safely resolve the shipping-scope label
// without dragging Supabase into the browser bundle.
import { NEX_SHIPPING_SCOPE_META } from "@/lib/nex-native/shipping-scope";
import {
  CoverIdentityBadge,
  CoverSecondaryCTA,
  CoverSectionHeading,
  CoverProductGrid,
  CoverProductCard,
  CoverIdentityRail,
} from "./primitives";
// Bridge 99 Stage 8 · every cover theme footer is now the Pink-Dream-style
// composer wired to POST /api/nex-native/first-message. Theme accent flows
// through via CSS vars so each theme paints the composer in its own colors.
import { CoverComposer } from "./_composer/CoverComposer";
// Category Tabs (2026-09-30) · CoverCatalog wraps CoverProductGrid with the
// one-word category tab bar. Drop-in replacement for the primary product grid
// in each layout. Restaurant keeps its secondary "Signature mains" cut as a
// plain CoverProductGrid so the layout's identity survives.
import { CoverCatalog } from "./CoverCatalog";
import type { MockCoverContent } from "./mock-data";

interface LayoutProps {
  content: MockCoverContent;
  themeId: string;
}

const chatHref = (ownerAccountId: string) =>
  `/nex-native/chat/peer/${ownerAccountId}`;

// ─── 1 · Café ─────────────────────────────────────────────────────────

export function LayoutCafe({ content, themeId }: LayoutProps): React.JSX.Element {
  return (
    <>
      <CoverPage>
        <CoverIdentityBadge
          portraitUrl={content.portraitUrl}
          name={content.businessName}
          subtitle={content.tagline}
          themeId={themeId}
          presenceOnline={content.presenceOnline}
          countryCode={content.countryCode ?? null}
        />
        <div style={{ marginTop: 26 }}>
          {/* Founder direction 2026-09-30 · default eyebrow is "Services"
              (renameable per-seller in a future settings surface) · title
              resolves from shipping-scope enum (Migration 108) to one of
              the six NEX_SHIPPING_SCOPE_META labels · falls back to
              "Local Delivery" when unset. sectionTitle wins if present. */}
          <CoverSectionHeading
            eyebrow={content.sectionEyebrow ?? "Services"}
            title={
              content.sectionTitle ??
              (content.shippingScope
                ? NEX_SHIPPING_SCOPE_META[content.shippingScope].label
                : "Local Delivery")
            }
          />
          {/* Founder direction 2026-09-30 · pass ALL products · the
              CoverCatalog now paginates at 4 per page with prev/next
              controls. Category filter narrows within the pagination. */}
          <CoverCatalog
            sections={content.sections}
            products={content.products}
            peerAccountId={content.ownerAccountId}
            columns={2}
          />
        </div>
        {/* Founder direction 2026-09-30 · replaced "today's atmosphere"
            quote with a Visit-Us panel · address is a Google Maps
            directions link (prefers lat/lng, falls back to text
            search) · hours of operation sit below. Seller edits the
            location via SellerLocationEditor on /manage/shop which
            persists lat/lng to nex_business.location_lat / _lng. */}
        <a
          href={
            content.locationLat != null && content.locationLng != null
              ? `https://www.google.com/maps/dir/?api=1&destination=${content.locationLat},${content.locationLng}`
              : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                  content.address,
                )}`
          }
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "block",
            marginTop: 20,
            padding: "16px 18px",
            borderRadius: 14,
            border: "1px dashed var(--nex-accent-soft)",
            background:
              "linear-gradient(180deg, var(--nex-accent-faint), rgba(3,8,20,0.35))",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 10,
              marginBottom: 6,
            }}
          >
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--nex-accent)",
                fontWeight: 700,
              }}
            >
              Visit Us
            </div>
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--nex-accent)",
                fontWeight: 700,
              }}
              aria-hidden
            >
              Directions ↗
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              fontFamily: "var(--nex-font-display)",
              fontSize: 15,
              lineHeight: 1.35,
              fontWeight: 600,
              color: "var(--nex-text)",
            }}
          >
            <span aria-hidden style={{ flex: "0 0 auto" }}>📍</span>
            <span style={{ flex: 1 }}>{content.address}</span>
          </div>
          <div
            style={{
              marginTop: 8,
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              color: "var(--nex-text-dim)",
            }}
          >
            <span aria-hidden>🕐</span>
            <span>{content.hours}</span>
          </div>
        </a>
        <CoverIdentityRail
          handle={content.handle}
          location={content.location}
          social={content.social}
          themeId={themeId}
        />
      </CoverPage>
      <CoverComposer
        ownerAccountId={content.ownerAccountId}
        ownerBusinessId={null}
        ownerDisplayName={content.businessName}
        infoTrayContent={{
          pages: content.infoPages ?? null,
          aboutUs: content.aboutUs ?? null,
          yearEstablished: content.yearEstablished ?? null,
          ownerName: content.ownerName ?? null,
          ownerPosition: content.ownerPosition ?? null,
          ownerAvatarUrl: content.ownerAvatarUrl ?? null,
          hours: content.hours,
          address: content.address,
          paymentMethodLabels: content.paymentMethodLabels ?? [],
          qrCodeImageUrl: content.qrCodeImageUrl ?? null,
          acceptsQrisDelivery: content.acceptsQrisDelivery ?? false,
          returnPolicyBody: content.returnPolicyBody ?? null,
          eventsBody: content.eventsBody ?? null,
          galleryUrls: content.galleryUrls ?? [],
          isVenue: content.isVenue ?? false,
        }}
      />
    </>
  );
}

// ─── 2 · Restaurant ─────────────────────────────────────────────────

export function LayoutRestaurant({ content, themeId }: LayoutProps): React.JSX.Element {
  return (
    <>
      <div
        style={{
          position: "relative",
          height: "68dvh",
          minHeight: 420,
          overflow: "hidden",
          borderBottom: "1px solid var(--nex-accent-soft)",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${content.portraitUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center 40%",
            filter: "saturate(1.05)",
            transform: "scale(1.05)",
            animation: "nex-cover-kenburns 24s ease-in-out infinite alternate",
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(3,8,20,0.15) 0%, rgba(3,8,20,0.5) 60%, rgba(3,8,20,0.94) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            padding: "24px 22px 28px",
            display: "grid",
            gap: 14,
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--nex-accent)",
              fontWeight: 700,
            }}
          >
            {content.location}
          </div>
          <div
            style={{
              fontFamily: "var(--nex-font-display)",
              fontSize: 40,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
              textShadow: "0 4px 22px rgba(0,0,0,0.6)",
            }}
          >
            {content.businessName}
          </div>
          <div style={{ fontSize: 14, color: "var(--nex-text-dim)" }}>
            {content.tagline}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <CoverSecondaryCTA href="#menu">🍽 See menu</CoverSecondaryCTA>
          </div>
        </div>
      </div>

      <CoverPage>
        <CoverSectionHeading eyebrow="Menu" title="Small plates" />
        <CoverCatalog
          sections={content.sections}
          products={content.products.slice(0, 2)}
          peerAccountId={content.ownerAccountId}
          columns={2}
        />
        <div style={{ marginTop: 26 }}>
          <CoverSectionHeading eyebrow="Menu" title="Signature mains" />
          <CoverProductGrid
            products={content.products.slice(2, 5)}
            peerAccountId={content.ownerAccountId}
            columns={1}
          />
        </div>
        <CoverIdentityRail
          handle={content.handle}
          location={content.location}
          social={content.social}
          themeId={themeId}
        />
      </CoverPage>
      <CoverComposer
        ownerAccountId={content.ownerAccountId}
        ownerBusinessId={null}
        ownerDisplayName={content.businessName}
        infoTrayContent={{
          pages: content.infoPages ?? null,
          aboutUs: content.aboutUs ?? null,
          yearEstablished: content.yearEstablished ?? null,
          ownerName: content.ownerName ?? null,
          ownerPosition: content.ownerPosition ?? null,
          ownerAvatarUrl: content.ownerAvatarUrl ?? null,
          hours: content.hours,
          address: content.address,
          paymentMethodLabels: content.paymentMethodLabels ?? [],
          qrCodeImageUrl: content.qrCodeImageUrl ?? null,
          acceptsQrisDelivery: content.acceptsQrisDelivery ?? false,
          returnPolicyBody: content.returnPolicyBody ?? null,
          eventsBody: content.eventsBody ?? null,
          galleryUrls: content.galleryUrls ?? [],
          isVenue: content.isVenue ?? false,
        }}
      />
    </>
  );
}

// ─── 3 · Product seller ─────────────────────────────────────────────

export function LayoutProduct({ content, themeId }: LayoutProps): React.JSX.Element {
  const hero = content.products[0]!;
  return (
    <>
      <CoverPage>
        <CoverIdentityBadge
          portraitUrl={content.portraitUrl}
          name={content.businessName}
          subtitle={content.tagline}
          themeId={themeId}
          size="compact"
          countryCode={content.countryCode ?? null}
        />
        <div style={{ marginTop: 20 }}>
          <CoverProductCard
            product={hero}
            peerAccountId={content.ownerAccountId}
            eyebrow="Featured"
          />
        </div>
        <div
          style={{
            marginTop: 14,
            display: "flex",
            gap: 8,
            fontSize: 12,
            color: "var(--nex-text-dim)",
            padding: "10px 14px",
            borderRadius: 10,
            background: "var(--nex-accent-faint)",
            border: "1px solid var(--nex-accent-soft)",
          }}
        >
          📦 {content.products.length} products live · 🚚 Ships from Ubud
        </div>
        <div style={{ marginTop: 28 }}>
          <CoverSectionHeading eyebrow="Shop" title="All products" />
          <CoverCatalog
            sections={content.sections}
            products={content.products.slice(1)}
            peerAccountId={content.ownerAccountId}
            columns={2}
          />
        </div>
        <CoverIdentityRail
          handle={content.handle}
          location={content.location}
          social={content.social}
          themeId={themeId}
        />
      </CoverPage>
      <CoverComposer
        ownerAccountId={content.ownerAccountId}
        ownerBusinessId={null}
        ownerDisplayName={content.businessName}
        infoTrayContent={{
          pages: content.infoPages ?? null,
          aboutUs: content.aboutUs ?? null,
          yearEstablished: content.yearEstablished ?? null,
          ownerName: content.ownerName ?? null,
          ownerPosition: content.ownerPosition ?? null,
          ownerAvatarUrl: content.ownerAvatarUrl ?? null,
          hours: content.hours,
          address: content.address,
          paymentMethodLabels: content.paymentMethodLabels ?? [],
          qrCodeImageUrl: content.qrCodeImageUrl ?? null,
          acceptsQrisDelivery: content.acceptsQrisDelivery ?? false,
          returnPolicyBody: content.returnPolicyBody ?? null,
          eventsBody: content.eventsBody ?? null,
          galleryUrls: content.galleryUrls ?? [],
          isVenue: content.isVenue ?? false,
        }}
      />
    </>
  );
}

// ─── 4 · Tradesperson ────────────────────────────────────────────────

export function LayoutTradesperson({ content, themeId }: LayoutProps): React.JSX.Element {
  return (
    <>
      <CoverPage>
        <CoverIdentityBadge
          portraitUrl={content.portraitUrl}
          name={content.businessName}
          subtitle={content.tagline}
          themeId={themeId}
          presenceOnline={content.presenceOnline}
          countryCode={content.countryCode ?? null}
        />
        <div
          style={{
            marginTop: 14,
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <TradeBadge label="12 yrs" />
          <TradeBadge label="6-mo warranty" />
          <TradeBadge label="SNI certified" />
        </div>
        <div style={{ marginTop: 26 }}>
          <CoverSectionHeading eyebrow="Services" title="What I do" />
          <ServiceList services={content.services} />
        </div>
        <div style={{ marginTop: 26 }}>
          <CoverSectionHeading eyebrow="Portfolio" title="Recent work" />
          <BeforeAfterStrip themeId={themeId} portraitUrl={content.portraitUrl} />
        </div>
        <CoverIdentityRail
          handle={content.handle}
          location={content.location}
          social={content.social}
          themeId={themeId}
        />
      </CoverPage>
      <CoverComposer
        ownerAccountId={content.ownerAccountId}
        ownerBusinessId={null}
        ownerDisplayName={content.businessName}
        infoTrayContent={{
          pages: content.infoPages ?? null,
          aboutUs: content.aboutUs ?? null,
          yearEstablished: content.yearEstablished ?? null,
          ownerName: content.ownerName ?? null,
          ownerPosition: content.ownerPosition ?? null,
          ownerAvatarUrl: content.ownerAvatarUrl ?? null,
          hours: content.hours,
          address: content.address,
          paymentMethodLabels: content.paymentMethodLabels ?? [],
          qrCodeImageUrl: content.qrCodeImageUrl ?? null,
          acceptsQrisDelivery: content.acceptsQrisDelivery ?? false,
          returnPolicyBody: content.returnPolicyBody ?? null,
          eventsBody: content.eventsBody ?? null,
          galleryUrls: content.galleryUrls ?? [],
          isVenue: content.isVenue ?? false,
        }}
      />
    </>
  );
}

// ─── 5 · Salon / Beauty ─────────────────────────────────────────────

export function LayoutSalon({ content, themeId }: LayoutProps): React.JSX.Element {
  return (
    <>
      <div
        style={{
          position: "relative",
          height: "60dvh",
          minHeight: 380,
          overflow: "hidden",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${content.portraitUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center 20%",
            filter: "saturate(1.1)",
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(3,8,20,0) 0%, rgba(3,8,20,0.35) 55%, rgba(3,8,20,0.95) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            padding: "22px 20px 26px",
          }}
        >
          <CoverIdentityBadge
            portraitUrl={null}
            name={content.businessName}
            subtitle={content.tagline}
            themeId={themeId}
            presenceOnline={content.presenceOnline}
            size="compact"
            countryCode={content.countryCode ?? null}
          />
        </div>
      </div>
      <CoverPage>
        <CoverSectionHeading eyebrow="Services" title="Menu of services" />
        <ServiceList services={content.services} />
        <div style={{ marginTop: 26 }}>
          <CoverSectionHeading eyebrow="Reviews" title="What clients say" />
          <ReviewList reviews={content.reviews} />
        </div>
        <CoverIdentityRail
          handle={content.handle}
          location={content.location}
          social={content.social}
          themeId={themeId}
        />
      </CoverPage>
      <CoverComposer
        ownerAccountId={content.ownerAccountId}
        ownerBusinessId={null}
        ownerDisplayName={content.businessName}
        infoTrayContent={{
          pages: content.infoPages ?? null,
          aboutUs: content.aboutUs ?? null,
          yearEstablished: content.yearEstablished ?? null,
          ownerName: content.ownerName ?? null,
          ownerPosition: content.ownerPosition ?? null,
          ownerAvatarUrl: content.ownerAvatarUrl ?? null,
          hours: content.hours,
          address: content.address,
          paymentMethodLabels: content.paymentMethodLabels ?? [],
          qrCodeImageUrl: content.qrCodeImageUrl ?? null,
          acceptsQrisDelivery: content.acceptsQrisDelivery ?? false,
          returnPolicyBody: content.returnPolicyBody ?? null,
          eventsBody: content.eventsBody ?? null,
          galleryUrls: content.galleryUrls ?? [],
          isVenue: content.isVenue ?? false,
        }}
      />
    </>
  );
}

// ─── 6 · Creator / Influencer ───────────────────────────────────────

export function LayoutCreator({ content, themeId }: LayoutProps): React.JSX.Element {
  return (
    <>
      <CoverPage>
        <div style={{ textAlign: "center", padding: "18px 0 4px" }}>
          <div
            style={{
              width: 108,
              height: 108,
              borderRadius: "50%",
              margin: "0 auto",
              backgroundImage: `url(${content.portraitUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center 25%",
              border: "3px solid var(--nex-accent)",
              boxShadow: "0 12px 32px rgba(0,0,0,0.5), 0 0 22px var(--nex-accent-glow)",
            }}
          />
          <div
            style={{
              marginTop: 14,
              fontFamily: "var(--nex-font-display)",
              fontSize: 22,
              fontWeight: 700,
            }}
          >
            {content.businessName}
          </div>
          <div style={{ marginTop: 4, fontSize: 13, color: "var(--nex-text-dim)" }}>
            {content.tagline}
          </div>
          <div style={{ marginTop: 12, display: "inline-flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
            <TradeBadge label="42k" small />
            <TradeBadge label="illustration" small />
            <TradeBadge label="commissions open" small />
          </div>
        </div>
        <div style={{ marginTop: 24 }}>
          <CoverSectionHeading eyebrow="Explore" title="Products + links" />
          <CoverCatalog
            sections={content.sections}
            products={content.products.slice(0, 6)}
            peerAccountId={content.ownerAccountId}
            columns={2}
          />
        </div>
        <CoverIdentityRail
          handle={content.handle}
          location={content.location}
          social={content.social}
          themeId={themeId}
        />
      </CoverPage>
      <CoverComposer
        ownerAccountId={content.ownerAccountId}
        ownerBusinessId={null}
        ownerDisplayName={content.businessName}
        infoTrayContent={{
          pages: content.infoPages ?? null,
          aboutUs: content.aboutUs ?? null,
          yearEstablished: content.yearEstablished ?? null,
          ownerName: content.ownerName ?? null,
          ownerPosition: content.ownerPosition ?? null,
          ownerAvatarUrl: content.ownerAvatarUrl ?? null,
          hours: content.hours,
          address: content.address,
          paymentMethodLabels: content.paymentMethodLabels ?? [],
          qrCodeImageUrl: content.qrCodeImageUrl ?? null,
          acceptsQrisDelivery: content.acceptsQrisDelivery ?? false,
          returnPolicyBody: content.returnPolicyBody ?? null,
          eventsBody: content.eventsBody ?? null,
          galleryUrls: content.galleryUrls ?? [],
          isVenue: content.isVenue ?? false,
        }}
      />
    </>
  );
}

// ─── 7 · Fashion Store ──────────────────────────────────────────────

export function LayoutFashion({ content, themeId }: LayoutProps): React.JSX.Element {
  return (
    <>
      <div
        style={{
          position: "relative",
          height: "88dvh",
          minHeight: 560,
          overflow: "hidden",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${content.portraitUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center 15%",
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(3,8,20,0.1) 0%, rgba(3,8,20,0.15) 60%, rgba(3,8,20,0.85) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 20,
            bottom: 24,
            right: 20,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--nex-accent)",
                fontWeight: 700,
              }}
            >
              new drop · sunset
            </div>
            <div
              style={{
                marginTop: 6,
                fontFamily: "var(--nex-font-display)",
                fontSize: 42,
                fontWeight: 700,
                letterSpacing: "-0.03em",
                lineHeight: 1,
                textShadow: "0 4px 22px rgba(0,0,0,0.6)",
              }}
            >
              {content.businessName}
            </div>
          </div>
        </div>
      </div>
      <CoverPage>
        <CoverCatalog
          sections={content.sections}
          products={content.products.slice(0, 3)}
          peerAccountId={content.ownerAccountId}
          columns={1}
        />
        <CoverIdentityRail
          handle={content.handle}
          location={content.location}
          social={content.social}
          themeId={themeId}
        />
      </CoverPage>
      <CoverComposer
        ownerAccountId={content.ownerAccountId}
        ownerBusinessId={null}
        ownerDisplayName={content.businessName}
        infoTrayContent={{
          pages: content.infoPages ?? null,
          aboutUs: content.aboutUs ?? null,
          yearEstablished: content.yearEstablished ?? null,
          ownerName: content.ownerName ?? null,
          ownerPosition: content.ownerPosition ?? null,
          ownerAvatarUrl: content.ownerAvatarUrl ?? null,
          hours: content.hours,
          address: content.address,
          paymentMethodLabels: content.paymentMethodLabels ?? [],
          qrCodeImageUrl: content.qrCodeImageUrl ?? null,
          acceptsQrisDelivery: content.acceptsQrisDelivery ?? false,
          returnPolicyBody: content.returnPolicyBody ?? null,
          eventsBody: content.eventsBody ?? null,
          galleryUrls: content.galleryUrls ?? [],
          isVenue: content.isVenue ?? false,
        }}
      />
    </>
  );
}

// ─── 8 · Street Food / Delivery ─────────────────────────────────────

export function LayoutStreetFood({ content, themeId }: LayoutProps): React.JSX.Element {
  return (
    <>
      <CoverPage>
        <CoverIdentityBadge
          portraitUrl={content.portraitUrl}
          name={content.businessName}
          subtitle={content.tagline}
          themeId={themeId}
          presenceOnline={content.presenceOnline}
          countryCode={content.countryCode ?? null}
        />
        <div
          style={{
            marginTop: 14,
            padding: "10px 14px",
            borderRadius: 10,
            background: "var(--nex-accent-faint)",
            border: "1px solid var(--nex-accent-soft)",
            fontSize: 12,
            color: "var(--nex-text)",
          }}
        >
          🚚 Delivery via Gojek COD · min Rp 15k · Ubud + Sanggingan
        </div>
        <div style={{ marginTop: 20 }}>
          <CoverSectionHeading eyebrow="Menu" title="Order now" />
          <div style={{ display: "grid", gap: 10 }}>
            {content.products.slice(0, 5).map((p) => (
              <DishRow key={p.id} product={p} peerAccountId={content.ownerAccountId} />
            ))}
          </div>
        </div>
        <CoverIdentityRail
          handle={content.handle}
          location={content.location}
          social={content.social}
          themeId={themeId}
        />
      </CoverPage>
      <CoverComposer
        ownerAccountId={content.ownerAccountId}
        ownerBusinessId={null}
        ownerDisplayName={content.businessName}
        infoTrayContent={{
          pages: content.infoPages ?? null,
          aboutUs: content.aboutUs ?? null,
          yearEstablished: content.yearEstablished ?? null,
          ownerName: content.ownerName ?? null,
          ownerPosition: content.ownerPosition ?? null,
          ownerAvatarUrl: content.ownerAvatarUrl ?? null,
          hours: content.hours,
          address: content.address,
          paymentMethodLabels: content.paymentMethodLabels ?? [],
          qrCodeImageUrl: content.qrCodeImageUrl ?? null,
          acceptsQrisDelivery: content.acceptsQrisDelivery ?? false,
          returnPolicyBody: content.returnPolicyBody ?? null,
          eventsBody: content.eventsBody ?? null,
          galleryUrls: content.galleryUrls ?? [],
          isVenue: content.isVenue ?? false,
        }}
      />
    </>
  );
}

// ─── 9 · Premium Business ───────────────────────────────────────────

export function LayoutPremiumBusiness({ content, themeId }: LayoutProps): React.JSX.Element {
  return (
    <>
      <CoverPage>
        <div style={{ padding: "18px 0" }}>
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--nex-accent)",
              fontWeight: 700,
            }}
          >
            {content.location}
          </div>
          <div
            style={{
              marginTop: 8,
              fontFamily: "var(--nex-font-display)",
              fontSize: 38,
              fontWeight: 800,
              letterSpacing: "-0.025em",
              lineHeight: 1.02,
            }}
          >
            {content.businessName}
          </div>
          <div style={{ marginTop: 10, fontSize: 15, color: "var(--nex-text-dim)", maxWidth: 480 }}>
            {content.tagline}
          </div>
          <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10 }}>
            <KpiTile label="Clients" value="120+" />
            <KpiTile label="Years" value="15" />
            <KpiTile label="Focus" value="B2B" />
          </div>
        </div>
        <div style={{ marginTop: 20 }}>
          <CoverSectionHeading eyebrow="Services" title="How we work" />
          <ServiceList services={content.services} />
        </div>
        <div style={{ marginTop: 26 }}>
          <CoverSectionHeading eyebrow="Case studies" title="Selected results" />
          <ReviewList reviews={content.reviews} />
        </div>
        <CoverIdentityRail
          handle={content.handle}
          location={content.location}
          social={content.social}
          themeId={themeId}
        />
      </CoverPage>
      <CoverComposer
        ownerAccountId={content.ownerAccountId}
        ownerBusinessId={null}
        ownerDisplayName={content.businessName}
        infoTrayContent={{
          pages: content.infoPages ?? null,
          aboutUs: content.aboutUs ?? null,
          yearEstablished: content.yearEstablished ?? null,
          ownerName: content.ownerName ?? null,
          ownerPosition: content.ownerPosition ?? null,
          ownerAvatarUrl: content.ownerAvatarUrl ?? null,
          hours: content.hours,
          address: content.address,
          paymentMethodLabels: content.paymentMethodLabels ?? [],
          qrCodeImageUrl: content.qrCodeImageUrl ?? null,
          acceptsQrisDelivery: content.acceptsQrisDelivery ?? false,
          returnPolicyBody: content.returnPolicyBody ?? null,
          eventsBody: content.eventsBody ?? null,
          galleryUrls: content.galleryUrls ?? [],
          isVenue: content.isVenue ?? false,
        }}
      />
    </>
  );
}

// ─── 10 · Personal Brand ────────────────────────────────────────────

export function LayoutPersonalBrand({ content, themeId }: LayoutProps): React.JSX.Element {
  return (
    <>
      <CoverPage>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          <div
            style={{
              width: 108,
              height: 132,
              borderRadius: 12,
              backgroundImage: `url(${content.portraitUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center 20%",
              border: "1px solid var(--nex-accent)",
              boxShadow: "0 12px 32px rgba(0,0,0,0.5), 0 0 20px var(--nex-accent-glow)",
              flexShrink: 0,
            }}
          />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontFamily: "var(--nex-font-display)",
                fontSize: 22,
                fontWeight: 700,
                lineHeight: 1.1,
              }}
            >
              {content.businessName}
            </div>
            <div style={{ marginTop: 6, fontSize: 13, color: "var(--nex-text-dim)", lineHeight: 1.4 }}>
              {content.tagline}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 8 }}>
          <QuickPill label="Products" />
          <QuickPill label="Services" />
          <QuickPill label="Reviews" />
          <QuickPill label="Blog" />
        </div>
        <div style={{ marginTop: 24 }}>
          <CoverSectionHeading eyebrow="Shop" title="Products" />
          <CoverCatalog
            sections={content.sections}
            products={content.products.slice(0, 4)}
            peerAccountId={content.ownerAccountId}
            columns={2}
          />
        </div>
        <div style={{ marginTop: 26 }}>
          <CoverSectionHeading eyebrow="Work with me" title="Services" />
          <ServiceList services={content.services} />
        </div>
        <div style={{ marginTop: 26 }}>
          <CoverSectionHeading eyebrow="Words" title="Testimonials" />
          <ReviewList reviews={content.reviews} />
        </div>
        <CoverIdentityRail
          handle={content.handle}
          location={content.location}
          social={content.social}
          themeId={themeId}
        />
      </CoverPage>
      <CoverComposer
        ownerAccountId={content.ownerAccountId}
        ownerBusinessId={null}
        ownerDisplayName={content.businessName}
        infoTrayContent={{
          pages: content.infoPages ?? null,
          aboutUs: content.aboutUs ?? null,
          yearEstablished: content.yearEstablished ?? null,
          ownerName: content.ownerName ?? null,
          ownerPosition: content.ownerPosition ?? null,
          ownerAvatarUrl: content.ownerAvatarUrl ?? null,
          hours: content.hours,
          address: content.address,
          paymentMethodLabels: content.paymentMethodLabels ?? [],
          qrCodeImageUrl: content.qrCodeImageUrl ?? null,
          acceptsQrisDelivery: content.acceptsQrisDelivery ?? false,
          returnPolicyBody: content.returnPolicyBody ?? null,
          eventsBody: content.eventsBody ?? null,
          galleryUrls: content.galleryUrls ?? [],
          isVenue: content.isVenue ?? false,
        }}
      />
    </>
  );
}

// ─── Shared layout primitives (local to this file) ──────────────────

function CoverPage({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div
      style={{
        position: "relative",
        maxWidth: 720,
        margin: "0 auto",
        // Founder direction 2026-09-30 (revised) · header must clear
        // the iPhone/Android earpiece / notch / dynamic island AND the
        // simulated 38px notch in the preview PhoneFrame. Real iOS
        // devices fire env(safe-area-inset-top) via viewportFit:cover
        // (set in src/app/nex-native/layout.tsx); the 44px fallback
        // matches the iOS status bar height + clears the sim notch.
        paddingTop:
          "max(env(safe-area-inset-top, 44px), 44px)",
        paddingRight: 20,
        paddingLeft: 20,
        paddingBottom: "calc(env(safe-area-inset-bottom, 0) + 96px)",
      }}
    >
      {children}
    </div>
  );
}

function TradeBadge({ label, small }: { label: string; small?: boolean }): React.JSX.Element {
  return (
    <span
      style={{
        padding: small ? "3px 8px" : "5px 10px",
        borderRadius: 999,
        fontSize: small ? 10 : 11,
        fontWeight: 600,
        letterSpacing: "0.04em",
        color: "var(--nex-accent)",
        background: "var(--nex-accent-faint)",
        border: "1px solid var(--nex-accent-soft)",
      }}
    >
      {label}
    </span>
  );
}

function KpiTile({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div
      style={{
        padding: "12px 10px",
        borderRadius: 12,
        background: "var(--nex-accent-faint)",
        border: "1px solid var(--nex-accent-soft)",
        textAlign: "center",
      }}
    >
      <div style={{ fontFamily: "var(--nex-font-display)", fontSize: 20, fontWeight: 700, color: "var(--nex-accent)" }}>
        {value}
      </div>
      <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--nex-text-dim)", marginTop: 4 }}>
        {label}
      </div>
    </div>
  );
}

function QuickPill({ label }: { label: string }): React.JSX.Element {
  return (
    <div
      style={{
        padding: "10px 6px",
        borderRadius: 10,
        background: "var(--nex-accent-faint)",
        border: "1px solid var(--nex-accent-soft)",
        textAlign: "center",
        fontSize: 11,
        fontWeight: 600,
        color: "var(--nex-text)",
      }}
    >
      {label}
    </div>
  );
}

function ServiceList({
  services,
}: {
  services: MockCoverContent["services"];
}): React.JSX.Element {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {services.map((s) => (
        <div
          key={s.id}
          style={{
            padding: "14px 16px",
            borderRadius: "var(--nex-card-radius)",
            border: "var(--nex-card-border)",
            background: "var(--nex-card-bg)",
            backdropFilter: "blur(10px)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <div style={{ fontFamily: "var(--nex-font-display)", fontSize: 15, fontWeight: 600 }}>
              {s.name}
            </div>
            <div style={{ fontSize: 12, color: "var(--nex-accent)", fontWeight: 700 }}>
              {s.fromPrice}
            </div>
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: "var(--nex-text-dim)", lineHeight: 1.4 }}>
            {s.description}
          </div>
        </div>
      ))}
    </div>
  );
}

function ReviewList({
  reviews,
}: {
  reviews: MockCoverContent["reviews"];
}): React.JSX.Element {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {reviews.map((r, i) => (
        <div
          key={i}
          style={{
            padding: "14px 16px",
            borderRadius: "var(--nex-card-radius)",
            border: "var(--nex-card-border)",
            background: "var(--nex-card-bg)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div style={{ fontSize: 12, color: "var(--nex-text-dim)" }}>{r.author}</div>
            <div style={{ color: "var(--nex-accent)", fontSize: 12 }}>{"★".repeat(r.stars)}</div>
          </div>
          <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.5 }}>"{r.body}"</div>
        </div>
      ))}
    </div>
  );
}

function BeforeAfterStrip({
  themeId,
  portraitUrl,
}: {
  themeId: string;
  portraitUrl: string;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 8,
        borderRadius: "var(--nex-card-radius)",
        overflow: "hidden",
        border: "var(--nex-card-border)",
        aspectRatio: "16 / 9",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "relative",
          backgroundImage: `url(${portraitUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "grayscale(0.6) brightness(0.7)",
        }}
      >
        <span style={badgeStyle}>Before</span>
      </div>
      <div
        aria-hidden
        style={{
          position: "relative",
          backgroundImage: `url(${portraitUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <span style={badgeStyle}>After</span>
      </div>
    </div>
  );
}

const badgeStyle: React.CSSProperties = {
  position: "absolute",
  top: 8,
  left: 8,
  padding: "2px 8px",
  borderRadius: 3,
  fontSize: 10,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  fontWeight: 700,
  color: "#fff",
  background: "var(--nex-accent)",
};

function DishRow({
  product,
  peerAccountId,
}: {
  product: import("./primitives").CoverProduct;
  peerAccountId: string;
}): React.JSX.Element {
  const soldOut = product.stock_status === "sold_out";
  const chatHref = `/nex-native/chat/peer/${peerAccountId}?product=${encodeURIComponent(product.id)}&auto=1`;
  const priceLabel = formatMoney(product.currency, product.price_pence);
  return (
    <a
      href={chatHref}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: 10,
        borderRadius: "var(--nex-card-radius)",
        border: "var(--nex-card-border)",
        background: "var(--nex-card-bg)",
        textDecoration: "none",
        color: "var(--nex-text)",
        opacity: soldOut ? 0.65 : 1,
      }}
    >
      <div
        aria-hidden
        style={{
          width: 62,
          height: 62,
          borderRadius: 10,
          flexShrink: 0,
          background: product.image_url
            ? `url(${product.image_url}) center/cover`
            : `linear-gradient(135deg, var(--nex-accent-faint), var(--nex-panel))`,
          border: "1px solid var(--nex-accent-soft)",
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{product.name}</div>
        <div style={{ marginTop: 2, fontSize: 12, color: "var(--nex-accent)", fontWeight: 700 }}>
          {priceLabel}
        </div>
      </div>
      <span
        style={{
          padding: "6px 10px",
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 700,
          color: "var(--nex-accent)",
          border: "1px solid var(--nex-accent-soft)",
        }}
      >
        {soldOut ? "sold out" : "+ Add"}
      </span>
    </a>
  );
}

function formatMoney(currency: string, minor: number): string {
  const c = currency.toUpperCase();
  if (c === "IDR") return `Rp ${Math.round(minor / 100).toLocaleString("id-ID")}`;
  const sym = c === "GBP" ? "£" : c === "USD" ? "$" : c === "EUR" ? "€" : `${c} `;
  return `${sym}${(minor / 100).toFixed(2)}`;
}

// ─── Layout registry ────────────────────────────────────────────────

export const COVER_LAYOUTS: Record<
  string,
  { label: string; Component: React.FC<LayoutProps> }
> = {
  cafe: { label: "Café", Component: LayoutCafe },
  restaurant: { label: "Modern Restaurant", Component: LayoutRestaurant },
  product: { label: "Product Seller", Component: LayoutProduct },
  tradesperson: { label: "Tradesperson", Component: LayoutTradesperson },
  salon: { label: "Beauty / Salon", Component: LayoutSalon },
  creator: { label: "Creator / Influencer", Component: LayoutCreator },
  fashion: { label: "Fashion Store", Component: LayoutFashion },
  street_food: { label: "Street Food / Delivery", Component: LayoutStreetFood },
  premium_business: { label: "Premium Business", Component: LayoutPremiumBusiness },
  personal_brand: { label: "Personal Brand", Component: LayoutPersonalBrand },
};

export type CoverLayoutId = keyof typeof COVER_LAYOUTS;
