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
import { terminologyForContent } from "./mock-data";

interface LayoutProps {
  content: MockCoverContent;
  themeId: string;
}

const chatHref = (ownerAccountId: string) =>
  `/nex-native/chat/peer/${ownerAccountId}`;

// ─── 1 · Café ─────────────────────────────────────────────────────────

export function LayoutCafe({ content, themeId }: LayoutProps): React.JSX.Element {
  const t = terminologyForContent(content);
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
              {t.section_location_label}
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
          hoursByDay: content.hoursByDay ?? null,
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

// ─── 15 · Café · Round Products ──────────────────────────────────────
// Founder direction 2026-09-30 · exact clone of Template 01 (Café)
// with one deliberate difference · product cards render as ROUND
// circles with the product name centred below and a magnifier button
// on the rim (50% in / 50% out). Every other block identical.

export function LayoutCafeRound({ content, themeId }: LayoutProps): React.JSX.Element {
  const t = terminologyForContent(content);
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
          <CoverSectionHeading
            eyebrow={content.sectionEyebrow ?? "Services"}
            title={
              content.sectionTitle ??
              (content.shippingScope
                ? NEX_SHIPPING_SCOPE_META[content.shippingScope].label
                : "Local Delivery")
            }
          />
          <CoverCatalog
            sections={content.sections}
            products={content.products}
            peerAccountId={content.ownerAccountId}
            variant="round"
          />
        </div>
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
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
            <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--nex-accent)", fontWeight: 700 }}>{t.section_location_label}</div>
            <div aria-hidden style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--nex-accent)", fontWeight: 700 }}>Directions ↗</div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontFamily: "var(--nex-font-display)", fontSize: 15, lineHeight: 1.35, fontWeight: 600, color: "var(--nex-text)" }}>
            <span aria-hidden style={{ flex: "0 0 auto" }}>📍</span>
            <span style={{ flex: 1 }}>{content.address}</span>
          </div>
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--nex-text-dim)" }}>
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
          hoursByDay: content.hoursByDay ?? null,
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

// ─── 16 · Product Seller · Round Products ────────────────────────────
// Founder direction 2026-09-30 · exact clone of Template 03 (Product
// Seller) with one deliberate difference · product cards render as
// ROUND circles. Everything else identical.

export function LayoutProductRound({ content, themeId }: LayoutProps): React.JSX.Element {
  const t = terminologyForContent(content);
  return (
    <>
      <CoverPage>
        <CoverIdentityBadge
          portraitUrl={content.portraitUrl}
          name={content.businessName}
          subtitle={content.tagline}
          themeId={themeId}
          size="compact"
          presenceOnline={content.presenceOnline}
          countryCode={content.countryCode ?? null}
        />
        <div style={{ marginTop: 20 }}>
          <WhoWeAreCollapsible
            title={t.section_about_label}
            body={content.aboutUs ?? content.tagline ?? ""}
            hoursLabel={formatTodayHoursLabel(
              content.hoursByDay,
              content.hours,
            )}
          />
        </div>
        <div style={{ marginTop: 20 }}>
          <CoverSectionHeading
            eyebrow="Shop"
            title={t.catalog_heading}
            rightSlot={
              <div
                aria-label={`${content.products.length} products live`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--nex-accent)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>📦</span>
                <span>{content.products.length} products live</span>
              </div>
            }
          />
          <CoverCatalog
            sections={content.sections}
            products={content.products}
            peerAccountId={content.ownerAccountId}
            variant="round"
          />
        </div>
        {content.infoPages?.delivery_details && (
          <section style={{ marginTop: 20 }}>
            <div style={{ fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--nex-accent)", fontWeight: 700, marginBottom: 4 }}>Dispatch Times</div>
            <div style={{ fontSize: 14, lineHeight: 1.5, color: "var(--nex-text, #F2F5F8)", whiteSpace: "normal" }}>{content.infoPages.delivery_details}</div>
          </section>
        )}
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
          hoursByDay: content.hoursByDay ?? null,
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

// ─── 17 · Product Seller Landscape · Round Products ──────────────────
// Founder direction 2026-09-30 · exact clone of Template 11 (Product
// Seller · Landscape) with the CoverCatalog variant flipped to
// "round". Note · because Template 11 differs from Template 03 only
// in the variant flag, this template renders identically to
// Template 16 when both are set to variant="round". Kept as a
// separate entry per founder request so admins can pick either
// clone lineage on /manage/shop.

export function LayoutProductLandscapeRound({ content, themeId }: LayoutProps): React.JSX.Element {
  return <LayoutProductRound content={content} themeId={themeId} />;
}

// ─── 12 · Café · Landscape ───────────────────────────────────────────
// Founder direction 2026-09-30 · exact clone of Template 01 (Café) with
// a single deliberate difference · products render as landscape rows
// (image left · meta right · 6 per page) instead of the 4-per-page
// portrait grid. Every other block (identity, Visit Us, hours,
// identity rail, composer + info tray) is identical so a café seller
// can switch layouts without losing any of their configured data.

export function LayoutCafeLandscape({ content, themeId }: LayoutProps): React.JSX.Element {
  const t = terminologyForContent(content);
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
          <CoverSectionHeading
            eyebrow={content.sectionEyebrow ?? "Services"}
            title={
              content.sectionTitle ??
              (content.shippingScope
                ? NEX_SHIPPING_SCOPE_META[content.shippingScope].label
                : "Local Delivery")
            }
          />
          <CoverCatalog
            sections={content.sections}
            products={content.products}
            peerAccountId={content.ownerAccountId}
            variant="landscape"
          />
        </div>
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
              {t.section_location_label}
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
          hoursByDay: content.hoursByDay ?? null,
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
  const t = terminologyForContent(content);
  return (
    <>
      <CoverPage>
        <CoverIdentityBadge
          portraitUrl={content.portraitUrl}
          name={content.businessName}
          subtitle={content.tagline}
          themeId={themeId}
          size="compact"
          presenceOnline={content.presenceOnline}
          countryCode={content.countryCode ?? null}
        />
        <div style={{ marginTop: 20 }}>
          <WhoWeAreCollapsible
            title={t.section_about_label}
            body={content.aboutUs ?? content.tagline ?? ""}
            hoursLabel={formatTodayHoursLabel(
              content.hoursByDay,
              content.hours,
            )}
          />
        </div>
        <div style={{ marginTop: 20 }}>
          {/* Founder direction 2026-09-30 · products-live count moves
              from the standalone stats strip to the right side of the
              All products heading · reads as a live badge on the
              section header. */}
          <CoverSectionHeading
            eyebrow="Shop"
            title={t.catalog_heading}
            rightSlot={
              <div
                aria-label={`${content.products.length} products live`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--nex-accent)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {/* Founder direction 2026-09-30 · 3D emoji glyph (renders
                    as a dimensional colour icon on iOS / Android / modern
                    browsers) instead of the flat stroke SVG. Same badge
                    layout · just swaps line-art for the platform's
                    native colour icon. */}
                <span
                  aria-hidden
                  style={{ fontSize: 16, lineHeight: 1 }}
                >
                  📦
                </span>
                <span>{content.products.length} products live</span>
              </div>
            }
          />
          <CoverCatalog
            sections={content.sections}
            products={content.products}
            peerAccountId={content.ownerAccountId}
            columns={2}
          />
        </div>
        {/* Founder direction 2026-09-30 · Dispatch Times block sits
            below the pagination row · reads from the same
            info_pages.delivery_details field that feeds the Info Tray
            Delivery panel · one source, two surfaces. Auto-hides when
            the seller hasn't set delivery details. */}
        {content.infoPages?.delivery_details && (
          <section style={{ marginTop: 20 }}>
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "var(--nex-accent)",
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              Dispatch Times
            </div>
            <div
              style={{
                fontSize: 14,
                lineHeight: 1.5,
                color: "var(--nex-text, #F2F5F8)",
                whiteSpace: "normal",
              }}
            >
              {content.infoPages.delivery_details}
            </div>
          </section>
        )}
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
          hoursByDay: content.hoursByDay ?? null,
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

// ─── 11 · Product Seller · Landscape ─────────────────────────────────
// Founder direction 2026-09-30 · exact clone of Template 03 (Product
// Seller) with a single deliberate difference · products render as
// landscape rows (image left · meta right · 6 per page) instead of
// the 4-per-page portrait grid. Every other block (identity badge,
// Who-We-Are, All-products header, pagination, Dispatch Times,
// identity rail, composer + info tray) is identical so a seller can
// switch layouts without losing any of their configured data.

export function LayoutProductLandscape({ content, themeId }: LayoutProps): React.JSX.Element {
  const t = terminologyForContent(content);
  return (
    <>
      <CoverPage>
        <CoverIdentityBadge
          portraitUrl={content.portraitUrl}
          name={content.businessName}
          subtitle={content.tagline}
          themeId={themeId}
          size="compact"
          presenceOnline={content.presenceOnline}
          countryCode={content.countryCode ?? null}
        />
        <div style={{ marginTop: 20 }}>
          <WhoWeAreCollapsible
            title={t.section_about_label}
            body={content.aboutUs ?? content.tagline ?? ""}
            hoursLabel={formatTodayHoursLabel(
              content.hoursByDay,
              content.hours,
            )}
          />
        </div>
        <div style={{ marginTop: 20 }}>
          <CoverSectionHeading
            eyebrow="Shop"
            title={t.catalog_heading}
            rightSlot={
              <div
                aria-label={`${content.products.length} products live`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--nex-accent)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                <span
                  aria-hidden
                  style={{ fontSize: 16, lineHeight: 1 }}
                >
                  📦
                </span>
                <span>{content.products.length} products live</span>
              </div>
            }
          />
          <CoverCatalog
            sections={content.sections}
            products={content.products}
            peerAccountId={content.ownerAccountId}
            variant="landscape"
          />
        </div>
        {content.infoPages?.delivery_details && (
          <section style={{ marginTop: 20 }}>
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "var(--nex-accent)",
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              Dispatch Times
            </div>
            <div
              style={{
                fontSize: 14,
                lineHeight: 1.5,
                color: "var(--nex-text, #F2F5F8)",
                whiteSpace: "normal",
              }}
            >
              {content.infoPages.delivery_details}
            </div>
          </section>
        )}
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
          hoursByDay: content.hoursByDay ?? null,
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
  const t = terminologyForContent(content);
  return (
    <>
      <CoverPage>
        {/* Founder direction 2026-09-30 · replaced the custom rectangular
            portrait + inline text with the shared CoverIdentityBadge so
            Personal Brand carries the same round portrait, green ping
            ring, green ONLINE NOW marker, and country flag as Templates
            01 (Café) and 03 (Product Seller). ONE NEX IDENTITY doctrine
            · every template presents the same identity signature. */}
        <CoverIdentityBadge
          portraitUrl={content.portraitUrl}
          name={content.businessName}
          subtitle={content.tagline}
          themeId={themeId}
          presenceOnline={content.presenceOnline}
          countryCode={content.countryCode ?? null}
        />
        {/* Founder direction 2026-09-30 · "Our Journey" · 7-line story
            block · reuses the WhoWeAreCollapsible primitive with a
            custom eyebrow. Body pulls from content.aboutUs (falls back
            to tagline). Buyers who want the full story tap the +
            button to open the About Us panel in the info tray. */}
        <div style={{ marginTop: 20 }}>
          <WhoWeAreCollapsible
            title={t.section_about_label}
            body={content.aboutUs ?? content.tagline ?? ""}
          />
        </div>
        {/* Founder direction 2026-09-30 · Personal Brand tab system.
            Replaces the standalone Shop/Products/Services/Testimonials
            sections + static QuickPill row. Four top-level tabs govern
            the middle of the page. Products tab exposes four sub-tabs
            (Products / Images / Sizes / Ordering) so buyers can browse
            the shop from multiple angles without leaving the cover. */}
        <div style={{ marginTop: 22 }}>
          <PersonalBrandTabs
            products={content.products}
            peerAccountId={content.ownerAccountId}
            orderingCopy={content.infoPages?.delivery_details ?? null}
            galleryImages={content.galleryImages}
            productsFooter={
              // Founder direction 2026-09-30 · Visit Us renders ONLY
              // when the Products tab is active · slotted inside the
              // tabs component via the productsFooter prop. Same
              // block Template 01 Café uses.
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
                    {t.section_location_label}
                  </div>
                  <div
                    aria-hidden
                    style={{
                      fontSize: 10,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--nex-accent)",
                      fontWeight: 700,
                    }}
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
                  <span>
                    {formatTodayHoursLabel(content.hoursByDay, content.hours) ??
                      content.hours ??
                      "Hours to be confirmed"}
                  </span>
                </div>
              </a>
            }
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
          hoursByDay: content.hoursByDay ?? null,
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

/**
 * WhoWeAreCollapsible · Template 03 header block. Renders the seller's
 * About-Us story (from content.aboutUs) inside a themed rounded panel.
 * The body is clamped to 7 lines by default · a right-side chevron
 * toggles the full text open. Chevron auto-hides when the body is
 * short enough to render fully at the initial cap.
 *
 * Founder direction 2026-09-30 · Template 03 replaces the "Featured"
 * product-hero card with this "Who We Are" block. Body text pulls from
 * the same nex_business.description column that feeds the Info Tray
 * About Us panel · authoring the story once fills both surfaces.
 */
/** Convert 24-hour "HH:MM" to a compact 12-hour label ("7am", "9:30pm").
 *  Founder direction 2026-09-30 · lowercase am/pm · no space between
 *  number and suffix · omit the ":00" on the hour · so "07:00" reads
 *  as "7am" and "07:30" reads as "7:30am". */
function formatTime12(hhmm: string | null | undefined): string | null {
  if (!hhmm) return null;
  const parts = hhmm.split(":");
  const h = Number(parts[0]);
  const m = Number(parts[1] ?? "0");
  if (!Number.isFinite(h) || h < 0 || h > 23) return null;
  const ampm = h >= 12 ? "pm" : "am";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m > 0 ? `${hour12}:${String(m).padStart(2, "0")}${ampm}` : `${hour12}${ampm}`;
}

/** Compact "9am - 10pm" style label for TODAY, derived from a
 *  WeeklyHours structure. Falls back to the seller's free-text
 *  content.hours string when hoursByDay isn't populated · returns
 *  null when today is closed. */
function formatTodayHoursLabel(
  hoursByDay:
    | {
        mon?: { open?: string | null; close?: string | null; closed?: boolean };
        tue?: { open?: string | null; close?: string | null; closed?: boolean };
        wed?: { open?: string | null; close?: string | null; closed?: boolean };
        thu?: { open?: string | null; close?: string | null; closed?: boolean };
        fri?: { open?: string | null; close?: string | null; closed?: boolean };
        sat?: { open?: string | null; close?: string | null; closed?: boolean };
        sun?: { open?: string | null; close?: string | null; closed?: boolean };
      }
    | null
    | undefined,
  fallbackText: string | null | undefined,
): string | null {
  if (hoursByDay) {
    const keys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
    const today = hoursByDay[keys[new Date().getDay()]];
    if (today) {
      if (today.closed === true) return "Closed today";
      const open = formatTime12(today.open);
      const close = formatTime12(today.close);
      if (open && close) return `${open} - ${close}`;
    }
  }
  const raw = (fallbackText ?? "").trim();
  return raw.length > 0 ? raw : null;
}

function WhoWeAreCollapsible({
  body,
  hoursLabel,
  title = "Who We Are",
}: {
  body: string;
  hoursLabel?: string | null;
  /** Founder direction 2026-09-30 · optional header override. Default
   *  "Who We Are" (used by Templates 03 + 11 for Product Sellers) ·
   *  Template 10 Personal Brand overrides to "Our Journey". Same
   *  visual · same 7-line clip · only the eyebrow text differs. */
  title?: string;
}): React.JSX.Element | null {
  const trimmed = body.trim();
  if (trimmed.length === 0) return null;
  // Founder direction 2026-09-30 (final) · 7-line hard clip, no
  // chevron. The cover is a SCAN surface · the Info Tray About Us
  // panel is the READ-the-full-story surface. Buyers who want the
  // whole thing tap the + button. Sellers writing longer stories
  // get clipped with an ellipsis · that's the intended discipline.
  return (
    <section>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 4,
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--nex-accent)",
            fontWeight: 700,
          }}
        >
          {title}
        </div>
        {hoursLabel && (
          <div
            aria-label={`Today's hours ${hoursLabel}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              fontWeight: 700,
              color: "var(--nex-accent)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {/* Founder direction 2026-09-30 · 3D emoji clock (renders
                as a dimensional colour icon on iOS / Android / modern
                browsers) instead of the flat stroke SVG. Matches the
                📦 badge pattern in the All products heading. */}
            <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>
              🕐
            </span>
            <span>{hoursLabel}</span>
          </div>
        )}
      </div>
      <div
        style={{
          fontSize: 14,
          lineHeight: 1.5,
          color: "var(--nex-text, #F2F5F8)",
          whiteSpace: "normal",
          display: "-webkit-box",
          WebkitLineClamp: 7,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {trimmed}
      </div>
    </section>
  );
}

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

// ─── 13 · Personal Brand · Landscape ─────────────────────────────────
// Founder direction 2026-09-30 · exact clone of Template 10 (Personal
// Brand) with a single deliberate difference · product cards in the
// Products tab render as landscape rows (image left · meta right · 6
// per page) instead of the 2-column portrait grid. Every other block
// (identity, Our Journey, tabs, Images, Sizes, Ordering, Visit Us,
// identity rail, composer + info tray) is identical.

export function LayoutPersonalBrandLandscape({
  content,
  themeId,
}: LayoutProps): React.JSX.Element {
  const t = terminologyForContent(content);
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
        <div style={{ marginTop: 20 }}>
          <WhoWeAreCollapsible
            title={t.section_about_label}
            body={content.aboutUs ?? content.tagline ?? ""}
          />
        </div>
        <div style={{ marginTop: 22 }}>
          <PersonalBrandTabs
            products={content.products}
            peerAccountId={content.ownerAccountId}
            orderingCopy={content.infoPages?.delivery_details ?? null}
            galleryImages={content.galleryImages}
            productsVariant="landscape"
            productsFooter={
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
                    {t.section_location_label}
                  </div>
                  <div
                    aria-hidden
                    style={{
                      fontSize: 10,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--nex-accent)",
                      fontWeight: 700,
                    }}
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
                  <span>
                    {formatTodayHoursLabel(content.hoursByDay, content.hours) ??
                      content.hours ??
                      "Hours to be confirmed"}
                  </span>
                </div>
              </a>
            }
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
          hoursByDay: content.hoursByDay ?? null,
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

// ─── 14 · Personal Brand · Round Products ────────────────────────────
// Founder direction 2026-09-30 · exact clone of Template 13 (Personal
// Brand · Landscape) with a single deliberate difference · product
// cards in the Products tab render as ROUND circles with the product
// name centred below and a small magnifier button on the image rim.
// Every other block (identity, Our Journey, tabs, Images, Sizes,
// Ordering, Visit Us, identity rail, composer + info tray) is identical.

export function LayoutPersonalBrandRound({
  content,
  themeId,
}: LayoutProps): React.JSX.Element {
  const t = terminologyForContent(content);
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
        <div style={{ marginTop: 20 }}>
          <WhoWeAreCollapsible
            title={t.section_about_label}
            body={content.aboutUs ?? content.tagline ?? ""}
          />
        </div>
        <div style={{ marginTop: 22 }}>
          <PersonalBrandTabs
            products={content.products}
            peerAccountId={content.ownerAccountId}
            orderingCopy={content.infoPages?.delivery_details ?? null}
            galleryImages={content.galleryImages}
            productsVariant="round"
            productsFooter={
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
                    {t.section_location_label}
                  </div>
                  <div
                    aria-hidden
                    style={{
                      fontSize: 10,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--nex-accent)",
                      fontWeight: 700,
                    }}
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
                  <span>
                    {formatTodayHoursLabel(content.hoursByDay, content.hours) ??
                      content.hours ??
                      "Hours to be confirmed"}
                  </span>
                </div>
              </a>
            }
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
          hoursByDay: content.hoursByDay ?? null,
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

// ─── Personal Brand · tabbed content ─────────────────────────────────
// Founder direction 2026-09-30 · Template 10 organises its middle
// content into four flat tabs · Products · Images · Sizes · Ordering.
// Buyers can look at the shop from multiple angles without leaving
// the cover. No nested sub-tabs · one level of navigation only.

type PersonalBrandTab = "products" | "images" | "sizes" | "ordering";

function PersonalBrandTabs({
  products,
  peerAccountId,
  orderingCopy,
  productsFooter,
  productsVariant = "grid",
  galleryImages,
}: {
  products: MockCoverContent["products"];
  peerAccountId: string;
  orderingCopy: string | null;
  /** Founder direction 2026-09-30 · rendered ONLY when the Products
   *  tab is active, below the paginated grid. Used by Template 10 to
   *  slot the Visit Us block under the products pagination without
   *  it appearing on the Images / Sizes / Ordering tabs. */
  productsFooter?: React.ReactNode;
  /** Founder direction 2026-09-30 · "landscape" flips the CoverCatalog
   *  cards to a single-column landscape list (Template 13) · "round"
   *  flips them to a 3-column round-image grid (Template 14). */
  productsVariant?: "grid" | "landscape" | "round";
  /** Bridge Gallery-C · real seller-uploaded gallery images from
   *  nex_gallery_image (Migration 111). When empty the Images tab
   *  renders 18 IMAGE HERE placeholder tiles. */
  galleryImages?: MockCoverContent["galleryImages"];
}): React.JSX.Element {
  const [tab, setTab] = React.useState<PersonalBrandTab>("products");
  const realGalleryImages = galleryImages ?? [];

  const tabs: { id: PersonalBrandTab; label: string }[] = [
    { id: "products", label: "Products" },
    { id: "images", label: "Images" },
    { id: "sizes", label: "Sizes" },
    { id: "ordering", label: "Ordering" },
  ];

  return (
    <div>
      {/* Four flat tabs · pill buttons · active fills with accent */}
      <div
        role="tablist"
        aria-label="Personal brand sections"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 6,
          marginBottom: 16,
        }}
      >
        {tabs.map((t) => {
          const isActive = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setTab(t.id)}
              style={{
                appearance: "none",
                padding: "9px 6px",
                borderRadius: 10,
                border: isActive
                  ? "1px solid var(--nex-accent)"
                  : "1px solid var(--nex-accent-soft)",
                background: isActive
                  ? "var(--nex-accent)"
                  : "var(--nex-accent-faint)",
                color: isActive ? "#03101D" : "var(--nex-text)",
                fontFamily: "var(--nex-font-body, inherit)",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.02em",
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "products" && (
        // Founder direction 2026-09-30 · Products tab under Personal
        // Brand uses CoverCatalog so it inherits the pagination row
        // (page numbers + prev / next arrow buttons). No sections
        // passed so the category-tab bar auto-hides · we deliberately
        // stripped Meal/Snack/Drinks tabs from this template earlier.
        <>
          <CoverCatalog
            sections={[]}
            products={products}
            peerAccountId={peerAccountId}
            columns={2}
            pageSize={6}
            variant={productsVariant}
          />
          {productsFooter}
        </>
      )}
      {tab === "images" && (
        <ImagePlaceholderGallery
          totalTiles={18}
          realImages={realGalleryImages}
        />
      )}
      {tab === "sizes" && <SizesPanel />}
      {tab === "ordering" && <OrderingPanel body={orderingCopy} />}
    </div>
  );
}

/**
 * ImagePlaceholderGallery · Founder direction 2026-09-30 (revised) ·
 * 3x3 grid with ‹ prev · next › pagination + tap-to-open lightbox.
 *
 * Bridge Gallery-C · when `realImages` is non-empty the tiles render
 * SELLER-UPLOADED photography with real captions + long descriptions
 * from nex_gallery_image (Migration 111). When `realImages` is empty
 * (previews without a business AND real businesses that haven't
 * uploaded yet) the grid falls back to `totalTiles` IMAGE HERE
 * placeholder tiles so the surface shape reads clearly.
 */
function ImagePlaceholderGallery({
  totalTiles,
  realImages = [],
}: {
  totalTiles: number;
  realImages?: NonNullable<MockCoverContent["galleryImages"]>;
}): React.JSX.Element {
  const hasReal = realImages.length > 0;
  const PAGE = 9;
  const [page, setPage] = React.useState(0);
  const [lightboxIndex, setLightboxIndex] = React.useState<number | null>(
    null,
  );
  // Real gallery drives pagination when present · falls back to
  // placeholder tile count otherwise. Never fewer than 1 page so the
  // component always renders something.
  const totalItems = hasReal ? realImages.length : totalTiles;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * PAGE;
  const visibleCount = Math.min(PAGE, totalItems - start);
  const canPrev = safePage > 0;
  const canNext = safePage < totalPages - 1;

  const nameFor = (i: number) =>
    hasReal
      ? realImages[i]?.caption?.trim() || `Image ${String(i + 1).padStart(2, "0")}`
      : `Photo ${String(i + 1).padStart(2, "0")}`;
  const skuFor = (i: number) =>
    hasReal
      ? realImages[i]?.id?.slice(0, 8) ?? ""
      : `MDL-${String.fromCharCode(65 + Math.floor(i / 10))}-${String(
          (i % 10) + 1,
        ).padStart(3, "0")}`;

  // Fallback captions + long descriptions when no real gallery images
  // exist. Real seller data supersedes these via the realImages prop.
  const placeholderCaptions = Array.from(
    { length: 18 },
    (_, i) => `Photo caption ${String(i + 1).padStart(2, "0")}`,
  );
  const placeholderLongDescriptions = Array.from(
    { length: 18 },
    (_, i) =>
      `This is where the full description for photo ${String(i + 1).padStart(
        2,
        "0",
      )} lives · sellers write what the image shows, why it matters, and any context a buyer might want. Talk about the process, the people, the place, the material · whatever the picture actually captures. Keep it a paragraph or two so it reads calmly on a phone screen. The lightbox clamps at seven lines so long copy never pushes the surface off-screen · buyers who want more tap the composer to ask directly. This whole block is placeholder text so the founder sees the SHAPE of the long-description slot before real sellers author their own words.`,
  );

  const captionFor = (i: number) =>
    hasReal
      ? realImages[i]?.caption?.trim() || placeholderCaptions[i % 18]
      : placeholderCaptions[i % 18];
  const descriptionFor = (i: number) =>
    hasReal
      ? realImages[i]?.longDescription?.trim() ||
        placeholderLongDescriptions[i % 18]
      : placeholderLongDescriptions[i % 18];
  const imageUrlFor = (i: number) =>
    hasReal ? realImages[i]?.imageUrl : null;

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 8,
        }}
      >
        {Array.from({ length: visibleCount }).map((_, i) => {
          const globalIndex = start + i;
          const realUrl = imageUrlFor(globalIndex);
          return (
            <div
              key={`tile-${globalIndex}`}
              style={{ display: "grid", gap: 6 }}
            >
              <button
                type="button"
                aria-label={`Open ${nameFor(globalIndex)}`}
                onClick={() => setLightboxIndex(globalIndex)}
                style={{
                  appearance: "none",
                  padding: 0,
                  aspectRatio: "1 / 1",
                  width: "100%",
                  borderRadius: 10,
                  border: "1px solid var(--nex-accent-soft)",
                  background: "#0a1120",
                  backgroundImage: realUrl ? `url(${realUrl})` : undefined,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  display: "grid",
                  placeItems: "center",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
                  position: "relative",
                  overflow: "hidden",
                  cursor: "pointer",
                  transition: "transform 180ms ease, box-shadow 180ms ease",
                }}
              >
                {!realUrl && (
                  <>
                    <svg
                      aria-hidden
                      width="100%"
                      height="100%"
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                      style={{
                        position: "absolute",
                        inset: 0,
                        opacity: 0.22,
                      }}
                    >
                      <line
                        x1="0"
                        y1="0"
                        x2="100"
                        y2="100"
                        stroke="currentColor"
                        strokeWidth="0.6"
                        vectorEffect="non-scaling-stroke"
                      />
                      <line
                        x1="100"
                        y1="0"
                        x2="0"
                        y2="100"
                        stroke="currentColor"
                        strokeWidth="0.6"
                        vectorEffect="non-scaling-stroke"
                      />
                    </svg>
                    <span
                      style={{
                        position: "relative",
                        fontSize: 9,
                        fontWeight: 800,
                        letterSpacing: "0.14em",
                        color: "var(--nex-text-dim)",
                        textAlign: "center",
                        padding: "2px 6px",
                        background: "#03101D",
                        borderRadius: 4,
                      }}
                    >
                      IMAGE HERE
                    </span>
                  </>
                )}
              </button>
              {/* Founder direction 2026-09-30 · description caption
                  under each tile · varied mock text per index so the
                  founder sees the varying-length layout. Tap the tile
                  to open the lightbox with a 7-line long description. */}
              <div
                style={{
                  fontSize: 10,
                  lineHeight: 1.35,
                  color: "var(--nex-text-dim)",
                  textAlign: "center",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  wordBreak: "break-word",
                  minHeight: 26,
                }}
              >
                {captionFor(globalIndex)}
              </div>
            </div>
          );
        })}
        {/* Balance the last row when the final page is short. */}
        {Array.from({ length: PAGE - visibleCount }).map((_, i) => (
          <div
            key={`empty-${i}`}
            aria-hidden
            style={{ display: "grid", gap: 6 }}
          >
            <div
              style={{
                aspectRatio: "1 / 1",
                borderRadius: 10,
                border: "1px dashed var(--nex-accent-soft)",
                opacity: 0.25,
              }}
            />
            <div style={{ minHeight: 26 }} />
          </div>
        ))}
      </div>
      {totalPages > 1 && (
        <div
          style={{
            marginTop: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
          }}
        >
          <GalleryArrow
            direction="prev"
            disabled={!canPrev}
            onClick={() => canPrev && setPage(safePage - 1)}
          />
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--nex-text-dim)",
              fontVariantNumeric: "tabular-nums",
              minWidth: 40,
              textAlign: "center",
            }}
          >
            {safePage + 1} / {totalPages}
          </div>
          <GalleryArrow
            direction="next"
            disabled={!canNext}
            onClick={() => canNext && setPage(safePage + 1)}
          />
        </div>
      )}

      {lightboxIndex !== null && (
        <ImagePlaceholderLightbox
          name={nameFor(lightboxIndex)}
          sku={skuFor(lightboxIndex)}
          description={descriptionFor(lightboxIndex)}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}

/**
 * ImagePlaceholderLightbox · fullscreen overlay opened when the buyer
 * taps an image tile. Founder direction 2026-09-30 · shows the
 * enlarged placeholder tile plus the mock product name and SKU/model
 * above it. Tap the backdrop or the × to close.
 */
function ImagePlaceholderLightbox({
  name,
  sku,
  description,
  onClose,
}: {
  name: string;
  sku: string;
  description: string;
  onClose: () => void;
}): React.JSX.Element {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={name}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(3,8,20,0.92)",
        backdropFilter: "blur(12px) saturate(1.05)",
        WebkitBackdropFilter: "blur(12px) saturate(1.05)",
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        justifyContent: "center",
        padding: "56px 20px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 520,
          width: "100%",
          margin: "0 auto",
          display: "grid",
          gap: 14,
        }}
      >
        {/* Header · name + SKU */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontFamily: "var(--nex-font-display)",
                fontSize: 20,
                fontWeight: 800,
                letterSpacing: "-0.01em",
                lineHeight: 1.1,
                color: "var(--nex-text)",
              }}
            >
              {name}
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--nex-accent)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              SKU · {sku}
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              appearance: "none",
              width: 36,
              height: 36,
              borderRadius: "50%",
              // Founder direction 2026-09-30 · close button paints in
              // the active theme's accent · under Pink Dream that
              // reads as pink · under any other theme the button
              // picks up that theme's accent hex automatically.
              border: "1px solid var(--nex-accent)",
              background: "var(--nex-accent)",
              color: "#03101D",
              fontSize: 20,
              fontWeight: 800,
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              flex: "0 0 auto",
              boxShadow:
                "0 4px 12px rgba(0,0,0,0.45), 0 0 12px var(--nex-accent-glow, rgba(255,63,159,0.35))",
            }}
          >
            ×
          </button>
        </div>
        {/* Enlarged placeholder tile */}
        <div
          role="img"
          aria-label="Image placeholder"
          style={{
            aspectRatio: "1 / 1",
            width: "100%",
            borderRadius: 14,
            border: "1px solid var(--nex-accent-soft)",
            background: "#0a1120",
            display: "grid",
            placeItems: "center",
            boxShadow: "0 12px 40px rgba(0,0,0,0.55)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <svg
            aria-hidden
            width="100%"
            height="100%"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0.22,
              color: "var(--nex-accent, #FF3F9F)",
            }}
          >
            <line
              x1="0"
              y1="0"
              x2="100"
              y2="100"
              stroke="currentColor"
              strokeWidth="0.4"
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1="100"
              y1="0"
              x2="0"
              y2="100"
              stroke="currentColor"
              strokeWidth="0.4"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <span
            style={{
              position: "relative",
              fontSize: 16,
              fontWeight: 800,
              letterSpacing: "0.24em",
              color: "var(--nex-text-dim)",
              textAlign: "center",
              padding: "6px 14px",
              background: "#03101D",
              borderRadius: 6,
            }}
          >
            IMAGE HERE
          </span>
        </div>
        {/* Founder direction 2026-09-30 · 7-line long description
            below the enlarged tile. Sellers author the full body per
            image · placeholder text stops at ~7 lines with an
            ellipsis so long copy doesn't push the whole lightbox
            offscreen. Buyers who want to keep reading tap the chat
            composer to ask directly. */}
        <div
          style={{
            fontSize: 13,
            lineHeight: 1.55,
            color: "var(--nex-text)",
            display: "-webkit-box",
            WebkitLineClamp: 7,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            wordBreak: "break-word",
          }}
        >
          {description}
        </div>
      </div>
    </div>
  );
}

function GalleryArrow({
  direction,
  disabled,
  onClick,
}: {
  direction: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={direction === "prev" ? "Previous images" : "Next images"}
      onClick={onClick}
      disabled={disabled}
      style={{
        appearance: "none",
        width: 34,
        height: 34,
        borderRadius: "50%",
        border: "none",
        background: "#000000",
        color: "var(--nex-accent, #FF3F9F)",
        fontFamily: "var(--nex-font-body, inherit)",
        fontSize: 18,
        fontWeight: 800,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.35 : 1,
        display: "grid",
        placeItems: "center",
        boxShadow:
          "0 2px 6px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,0,0,0.6)",
      }}
    >
      {direction === "prev" ? "‹" : "›"}
    </button>
  );
}

/**
 * SizesPanel · Founder direction 2026-09-30 · placeholder list of
 * available sizes. Real sellers configure this via a future
 * /manage/sizes editor (queued). For now shows the common apparel
 * ladder so the Personal Brand demo reads meaningfully.
 */
function SizesPanel(): React.JSX.Element {
  const sizes = [
    { label: "XS", available: true },
    { label: "S", available: true },
    { label: "M", available: true },
    { label: "L", available: true },
    { label: "XL", available: true },
    { label: "XXL", available: false },
  ];
  return (
    <div>
      {/* Founder direction 2026-09-30 · size chart image placeholder ·
          sellers upload a fit chart (measurements, model wearing size,
          etc.) later via a future editor. Same IMAGE HERE treatment as
          the Images tab · solid navy tile with a diagonal cross and a
          SIZE CHART HERE caption. Wider than 1:1 to match the shape
          of a real fit chart. */}
      <div
        role="img"
        aria-label="Size chart placeholder"
        style={{
          aspectRatio: "3 / 2",
          width: "100%",
          borderRadius: 12,
          border: "1px solid var(--nex-accent-soft)",
          background: "#0a1120",
          display: "grid",
          placeItems: "center",
          boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
          position: "relative",
          overflow: "hidden",
          marginBottom: 14,
        }}
      >
        <svg
          aria-hidden
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.22,
            color: "var(--nex-accent, #FF3F9F)",
          }}
        >
          <line
            x1="0"
            y1="0"
            x2="100"
            y2="100"
            stroke="currentColor"
            strokeWidth="0.6"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1="100"
            y1="0"
            x2="0"
            y2="100"
            stroke="currentColor"
            strokeWidth="0.6"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span
          style={{
            position: "relative",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.18em",
            color: "var(--nex-text-dim)",
            textAlign: "center",
            padding: "4px 10px",
            background: "#03101D",
            borderRadius: 5,
          }}
        >
          SIZE CHART HERE
        </span>
      </div>
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--nex-accent)",
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        Available sizes
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {sizes.map((s) => (
          <span
            key={s.label}
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              border: s.available
                ? "1px solid var(--nex-accent-soft)"
                : "1px solid rgba(148,163,184,0.25)",
              background: s.available
                ? "var(--nex-accent-faint)"
                : "transparent",
              color: s.available
                ? "var(--nex-text)"
                : "var(--nex-text-dim)",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.02em",
              textDecoration: s.available ? "none" : "line-through",
            }}
          >
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * OrderingPanel · Founder direction 2026-09-30 · describes the order-
 * to-delivery flow. Body pulls from info_pages.delivery_details when
 * the seller has authored it · falls back to the default four-step
 * NEX flow so every buyer sees a clear path.
 */
function OrderingPanel({ body }: { body: string | null }): React.JSX.Element {
  const trimmed = body?.trim();
  if (trimmed && trimmed.length > 0) {
    return (
      <div
        style={{
          fontSize: 14,
          lineHeight: 1.55,
          color: "var(--nex-text)",
          whiteSpace: "pre-wrap",
        }}
      >
        {trimmed}
      </div>
    );
  }
  const steps = [
    {
      no: "01",
      label: "Send a message",
      body: "Ask us anything about the product · we reply in-chat.",
    },
    {
      no: "02",
      label: "Confirm details",
      body: "Size, quantity, delivery address · all agreed in-chat.",
    },
    {
      no: "03",
      label: "Ships in 24 hrs",
      body: "Packed the same day where possible · courier assigned.",
    },
    {
      no: "04",
      label: "Track delivery",
      body: "Courier tracking + arrival window sent in-chat.",
    },
  ];
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {steps.map((s) => (
        <div
          key={s.no}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid var(--nex-accent-soft)",
            background: "var(--nex-accent-faint)",
          }}
        >
          <div
            style={{
              flex: "0 0 auto",
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "var(--nex-accent)",
              color: "#03101D",
              display: "grid",
              placeItems: "center",
              fontFamily: "var(--nex-font-display)",
              fontSize: 12,
              fontWeight: 800,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {s.no}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontFamily: "var(--nex-font-display)",
                fontSize: 14,
                fontWeight: 700,
                lineHeight: 1.25,
              }}
            >
              {s.label}
            </div>
            <div
              style={{
                marginTop: 3,
                fontSize: 12,
                color: "var(--nex-text-dim)",
                lineHeight: 1.4,
              }}
            >
              {s.body}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function BlogPlaceholder(): React.JSX.Element {
  return (
    <div
      style={{
        padding: "20px 16px",
        textAlign: "center",
        borderRadius: 12,
        border: "1px dashed var(--nex-accent-soft)",
        background: "var(--nex-accent-faint)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--nex-accent)",
          fontWeight: 700,
          marginBottom: 6,
        }}
      >
        Blog
      </div>
      <div
        style={{
          fontSize: 13,
          color: "var(--nex-text-dim)",
          lineHeight: 1.55,
        }}
      >
        Posts, journal entries, and updates land here soon.
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

function formatMoney(currency: string, minor: number): string {
  const c = currency.toUpperCase();
  if (c === "IDR") return `Rp ${Math.round(minor / 100).toLocaleString("id-ID")}`;
  const sym = c === "GBP" ? "£" : c === "USD" ? "$" : c === "EUR" ? "€" : `${c} `;
  return `${sym}${(minor / 100).toFixed(2)}`;
}

// Layout registry lives in ./layout-ids.ts + ./layout-switch.tsx so
// server components can enumerate ids without pulling the "use client"
// layout functions into their bundle. The stale COVER_LAYOUTS map that
// used to live here referenced 7 deleted templates and blew up SSR ·
// removed 2026-09-30. Do not re-add it here.
