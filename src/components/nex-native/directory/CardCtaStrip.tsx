// src/components/nex-native/directory/CardCtaStrip.tsx
//
// NEX Directory · Phase A refresh · CTA strip for a Directory card.
//
// What this is
//   · A pure, data-conditional CTA strip rendered at the bottom of
//     a DirectoryCard. Decides which buttons to show from the real
//     fields on the DirectoryListingVM — never fabricates a CTA for
//     a null / undefined field.
//
// What this is NOT
//   · Not a service · no DB access, no network, no state.
//   · Not a routing owner · the strip either (a) opens an external
//     resource via a plain anchor (tel:, https://, maps dir URL), or
//     (b) defers to a parent callback (onOpenDetail / onOpenChat)
//     that the parent wires up to the sealed listing-chat +
//     slide-up detail panel.
//   · Not a logger · Doctrine #7 — CTA interactions never log,
//     never embed, never surface message content.
//
// CTA matrix (per task spec)
//   Direct-action (render iff real field present):
//     · Call        iff listing.phoneE164 is non-empty string
//     · Website     iff listing.websiteApex is non-empty string
//     · Directions  iff listing.coordinates has both lat + lng
//   Panel-opening (defer to parent):
//     · Message     ALWAYS shown (primary accent)
//     · View X      iff listing.verticalPayload is a non-null object
//                   with ≥ 1 own key · label from entityType
//
// Data notes
//   · VM field is `verticalPayload`, which is the pure projection of
//     `nex.business_canonical.services_products` jsonb. The task spec
//     calls it "servicesProducts"; the on-VM field name is
//     `verticalPayload`. We read the real VM field — no fabrication.

"use client";

import type * as React from "react";
import type {
  DirectoryListingVM,
  EntityType,
} from "@/lib/nex-native/directory";

// ─────────────────────────────────────────────────────────────────────
// Palette · mirrored verbatim from _directory-card.tsx so the strip
// stays visually locked to the sealed card frame. If the card palette
// moves to a shared module one day this import swaps in place.
// ─────────────────────────────────────────────────────────────────────

const PALETTE = {
  surfaceHi: "#182540",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textSoft: "#4B6683",
  orange: "#FF7200",
  cyan: "#00AFFF",
  borderSoft: "rgba(255,255,255,0.06)",
} as const;

// ─────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────

export interface CardCtaStripProps {
  readonly listing: DirectoryListingVM;
  readonly onOpenDetail?: () => void;
  readonly onOpenChat?: () => void;
}

// ─────────────────────────────────────────────────────────────────────
// Public component
// ─────────────────────────────────────────────────────────────────────

export function CardCtaStrip(props: CardCtaStripProps): React.ReactElement {
  const { listing, onOpenDetail, onOpenChat } = props;

  const hasPhone =
    typeof listing.phoneE164 === "string" && listing.phoneE164.length > 0;
  const hasWebsite =
    typeof listing.websiteApex === "string" && listing.websiteApex.length > 0;
  const hasCoordinates =
    listing.coordinates !== null &&
    Number.isFinite(listing.coordinates.lat) &&
    Number.isFinite(listing.coordinates.lng);
  const hasVerticalPayload = isNonEmptyObject(listing.verticalPayload);

  return (
    <div
      data-nex-directory-cta-strip
      role="group"
      aria-label="Listing actions"
      style={{
        marginTop: 8,
        display: "flex",
        gap: 6,
        overflowX: "auto",
        overflowY: "hidden",
        WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none",
        paddingBottom: 2,
      }}
    >
      {/* Primary — always shown. Message is a panel-opening CTA that
          defers to the parent-provided onOpenChat callback. */}
      <PrimaryButton
        label="Message"
        testKey="message"
        onClick={onOpenChat}
        icon={<MessageIcon />}
      />

      {hasPhone ? (
        <AnchorButton
          label="Call"
          testKey="call"
          // `tel:` is the sealed direct-action transport · no runtime cost,
          // no NEX layer involvement. Phone is already E.164 enforced by
          // migration 167 CHECK, so passthrough is honest.
          href={`tel:${listing.phoneE164 as string}`}
          icon={<PhoneIcon />}
        />
      ) : null}

      {hasWebsite ? (
        <AnchorButton
          label="Website"
          testKey="website"
          href={`https://${listing.websiteApex as string}`}
          target="_blank"
          rel="noopener noreferrer"
          icon={<GlobeIcon />}
        />
      ) : null}

      {hasCoordinates ? (
        <AnchorButton
          label="Directions"
          testKey="directions"
          href={buildDirectionsHref(
            listing.coordinates!.lat,
            listing.coordinates!.lng,
          )}
          target="_blank"
          rel="noopener noreferrer"
          icon={<DirectionsIcon />}
        />
      ) : null}

      {hasVerticalPayload ? (
        <SecondaryButton
          label={buildViewLabel(listing.entityType)}
          testKey="view"
          onClick={onOpenDetail}
          icon={<MenuIcon />}
        />
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Buttons · three visual variants, all keyboard-accessible, all
// share the pill shape of the sealed card chips.
// ─────────────────────────────────────────────────────────────────────

type ButtonKey =
  | "call"
  | "website"
  | "directions"
  | "message"
  | "view";

function PrimaryButton(props: {
  readonly label: string;
  readonly testKey: ButtonKey;
  readonly onClick?: () => void;
  readonly icon: React.ReactElement;
}): React.ReactElement {
  const { label, testKey, onClick, icon } = props;
  const disabled = typeof onClick !== "function";
  return (
    <button
      type="button"
      data-nex-directory-cta={testKey}
      data-nex-directory-cta-variant="primary"
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        // Stop the surrounding card <Link> from navigating when the
        // user taps a CTA. Both `preventDefault` AND `stopPropagation`
        // are required: Next.js's <Link> intercepts clicks via a
        // bubbling listener on the <a> AND wires a native navigation
        // on the anchor itself; stopPropagation alone leaves the
        // default anchor navigation armed. preventDefault silences
        // the default navigation; stopPropagation keeps the event
        // from reaching any ancestor Link click handler.
        e.preventDefault();
        e.stopPropagation();
        onClick?.();
      }}
      style={{
        ...baseButtonStyle,
        background: PALETTE.orange,
        color: "#1A1300",
        border: `1px solid ${PALETTE.orange}`,
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function SecondaryButton(props: {
  readonly label: string;
  readonly testKey: ButtonKey;
  readonly onClick?: () => void;
  readonly icon: React.ReactElement;
}): React.ReactElement {
  const { label, testKey, onClick, icon } = props;
  const disabled = typeof onClick !== "function";
  return (
    <button
      type="button"
      data-nex-directory-cta={testKey}
      data-nex-directory-cta-variant="secondary"
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        // See PrimaryButton — same reasoning. Panel-opening CTAs
        // must suppress the surrounding card <Link>'s default
        // navigation, not just the bubbling.
        e.preventDefault();
        e.stopPropagation();
        onClick?.();
      }}
      style={{
        ...baseButtonStyle,
        background: PALETTE.surfaceHi,
        color: PALETTE.textDim,
        border: `1px solid ${PALETTE.borderSoft}`,
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function AnchorButton(props: {
  readonly label: string;
  readonly testKey: ButtonKey;
  readonly href: string;
  readonly target?: "_blank";
  readonly rel?: string;
  readonly icon: React.ReactElement;
}): React.ReactElement {
  const { label, testKey, href, target, rel, icon } = props;
  return (
    <a
      data-nex-directory-cta={testKey}
      data-nex-directory-cta-variant="anchor"
      aria-label={label}
      href={href}
      target={target}
      rel={rel}
      onClick={(e) => {
        // Prevent the surrounding card <Link> from intercepting the
        // tap. The anchor's own default action still fires (tel://,
        // external link, maps) because we are not calling
        // preventDefault.
        e.stopPropagation();
      }}
      style={{
        ...baseButtonStyle,
        background: "transparent",
        color: PALETTE.cyan,
        border: `1px solid ${PALETTE.cyan}`,
        textDecoration: "none",
      }}
    >
      {icon}
      <span>{label}</span>
    </a>
  );
}

const baseButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  flexShrink: 0,
  fontSize: 12.5,
  fontWeight: 600,
  padding: "6px 12px",
  borderRadius: 999,
  lineHeight: 1,
  whiteSpace: "nowrap",
  minHeight: 32,
};

// ─────────────────────────────────────────────────────────────────────
// Inline SVG icons · no icon library, no new deps. 16px square,
// stroke-based so they inherit the button's text colour.
// ─────────────────────────────────────────────────────────────────────

function PhoneIcon(): React.ReactElement {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function GlobeIcon(): React.ReactElement {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx={12} cy={12} r={10} />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function DirectionsIcon(): React.ReactElement {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx={12} cy={10} r={3} />
    </svg>
  );
}

function MessageIcon(): React.ReactElement {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function MenuIcon(): React.ReactElement {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h10" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────────────────

/** Google Maps "directions to destination" URL. The sealed `?api=1`
 *  format is a public, stable, no-API-key direct-action handoff. */
function buildDirectionsHref(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

/** True when `value` is a plain object with at least one own key.
 *  Rejects: null, undefined, primitives, arrays. */
function isNonEmptyObject(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value !== "object") return false;
  if (Array.isArray(value)) return false;
  // Own keys only — matches the "jsonb object with ≥ 1 key" test.
  return Object.keys(value as Record<string, unknown>).length > 0;
}

/** Entity-type-aware label for the "View X" CTA.
 *
 *  Covers every value of the sealed 9-value entity_type enum. The
 *  switch is exhaustive on `EntityType` so a future enum extension
 *  surfaces here as a TypeScript error, not a silent fallback. */
function buildViewLabel(entityType: EntityType): string {
  switch (entityType) {
    case "food":
      return "View menu";
    case "accommodation":
      return "View rooms";
    case "vehicle_rental":
      return "View rates";
    case "service":
      return "View services";
    case "professional":
      return "View services";
    case "marketplace_seller":
      return "View products";
    case "transport_driver":
      return "View rates";
    case "transport_operator":
      return "View rates";
    case "place":
      return "More info";
    default: {
      // Exhaustiveness guard — TS complains if a new enum value lands
      // without a case here. Runtime fallback stays truthful.
      const _exhaustive: never = entityType;
      void _exhaustive;
      return "More info";
    }
  }
}
