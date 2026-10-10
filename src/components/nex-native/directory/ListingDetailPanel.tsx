// src/components/nex-native/directory/ListingDetailPanel.tsx
//
// NEX Directory · Card-refresh wave · Listing Detail / Chat slide-up panel.
//
// What this component is
//   · A fixed-position modal/sheet that opens IN-PAGE when a Directory
//     card's CTA is pressed. Preserves the current /directory URL and
//     scroll position — no next-navigation push, no new route.
//   · Two modes:
//       "details" · full identity + CTA strip (view-only)
//       "chat"    · <ListingChatPanel> inside the same shell
//
// What this component is NOT
//   · Not a replacement for the Directory detail PAGE
//     (/nex-native/directory/[id]) — that remains the deep-linkable
//     surface. This panel is the lightweight in-flow experience.
//   · Not a renderer of fabricated fields — if a field is null, it is
//     simply absent from the detail body. No "N/A", no placeholder copy.
//
// Accessibility
//   · role="dialog" + aria-modal="true"
//   · Esc closes
//   · backdrop click closes
//   · Focus trap · initial focus → close button
//   · Focus restoration → caller passes `returnFocusRef` so the
//     triggering card regains focus on close
//
// Doctrine #7 reminder
//   · In chat mode we never log message content.
//   · The outer panel does nothing with chat messages — it only hosts
//     <ListingChatPanel>, which itself calls Agent C's server actions.

"use client";

import type * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  DirectoryDestination,
  DirectoryListingVM,
} from "@/lib/nex-native/directory";
import {
  resolveCategoryImage,
  type CategoryImageLibraryRow,
  type CategoryImageResolved,
} from "@/lib/nex-native/directory/category-image-resolver";
import { NoImage } from "@/app/nex-native/directory/_no-image";
import { ListingChatPanel } from "./ListingChatPanel";
import { CategoryDetailSections } from "./CategoryDetailSections";
import { RelatedBusinessesSectionClient } from "./RelatedBusinessesSectionClient";

const PALETTE = {
  bg: "#020914",
  surface: "#0E1526",
  surfaceHi: "#182540",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMuted: "#7D9BC0",
  textSoft: "#4B6683",
  orange: "#FF7200",
  cyan: "#00AFFF",
  cyanFaint: "rgba(0,175,255,0.08)",
  borderSoft: "rgba(255,255,255,0.08)",
  backdrop: "rgba(2,9,20,0.72)",
} as const;

export type ListingPanelMode = "details" | "chat";

export interface ListingDetailPanelProps {
  readonly listing: DirectoryListingVM;
  readonly destination: DirectoryDestination;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly initialMode?: ListingPanelMode;
  /**
   * The element to re-focus when the panel closes (typically the
   * triggering card). Keyboard-accessibility: focus must land on a
   * sensible, visible target.
   */
  readonly returnFocusRef?: React.RefObject<HTMLElement | null>;
  /** Curated category-image library (`nex.category_image_library` ·
   *  migration 112). Passed through from the parent so the hero
   *  renders a representative illustration (ADR-0022) when the
   *  listing has no OWNER_IMAGE / VERIFIED_REAL primary image. */
  readonly categoryImageLibrary?: readonly CategoryImageLibraryRow[];
}

export function ListingDetailPanel(
  props: ListingDetailPanelProps,
): React.ReactElement | null {
  const { listing, destination, open, onClose, initialMode, categoryImageLibrary } = props;

  const [mode, setMode] = useState<ListingPanelMode>(initialMode ?? "details");
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  // Reset mode when the panel re-opens or the initialMode changes.
  useEffect(() => {
    if (open) {
      setMode(initialMode ?? "details");
    }
  }, [open, initialMode, listing.canonicalBusinessId]);

  // Esc key + focus trap
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab" && panelRef.current !== null) {
        trapFocus(e, panelRef.current);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  // Initial focus → close button · also lock page scroll
  useEffect(() => {
    if (!open) return;
    // Focus the close button so Esc + Tab both have a sensible anchor.
    closeButtonRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  // Return focus to the triggering card on close
  useEffect(() => {
    if (open) return;
    const el = props.returnFocusRef?.current;
    if (el !== null && el !== undefined) {
      // Defer so the DOM has removed the panel first
      requestAnimationFrame(() => {
        try {
          el.focus();
        } catch {
          /* no-op */
        }
      });
    }
  }, [open, props.returnFocusRef]);

  const onBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  if (!open) return null;

  const claimed =
    destination.kind === "nex_business" ||
    destination.kind === "nex_user_profile";

  return (
    <div
      data-nex-directory-panel-backdrop
      onMouseDown={onBackdropClick}
      style={{
        position: "fixed",
        inset: 0,
        background: PALETTE.backdrop,
        zIndex: 1000,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${listing.name} · ${mode === "chat" ? "message" : "details"}`}
        data-nex-directory-panel
        data-nex-directory-panel-mode={mode}
        data-nex-directory-panel-canonical-id={listing.canonicalBusinessId}
        style={{
          background: PALETTE.bg,
          color: PALETTE.text,
          width: "100%",
          maxWidth: 560,
          maxHeight: "90vh",
          minHeight: "60vh",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          boxShadow: "0 -10px 30px rgba(0,0,0,0.45)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          // On desktop we centre and give a rounded all-around card.
          // The media query is accomplished via responsive style only
          // on the outer wrapper's alignment. Here we add safe default
          // styles that work at both 393px and desktop widths.
        }}
      >
        {/* ── Header ───────────────────────────────────── */}
        <PanelHeader
          listing={listing}
          mode={mode}
          onClose={onClose}
          onChangeMode={setMode}
          closeButtonRef={closeButtonRef}
        />

        {/* ── Body ─────────────────────────────────────── */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "12px 16px 16px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {mode === "details" ? (
            <DetailsBody
              listing={listing}
              destination={destination}
              onOpenChat={() => setMode("chat")}
              categoryImageLibrary={categoryImageLibrary}
            />
          ) : (
            <ListingChatPanel
              canonicalId={listing.canonicalBusinessId}
              listingName={listing.name}
              claimed={claimed}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────────────

function PanelHeader(props: {
  readonly listing: DirectoryListingVM;
  readonly mode: ListingPanelMode;
  readonly onClose: () => void;
  readonly onChangeMode: (m: ListingPanelMode) => void;
  readonly closeButtonRef: React.RefObject<HTMLButtonElement | null>;
}): React.ReactElement {
  const { listing, mode, onClose, onChangeMode, closeButtonRef } = props;
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 14px",
        borderBottom: `1px solid ${PALETTE.borderSoft}`,
        background: PALETTE.surface,
        flexShrink: 0,
      }}
    >
      {/* Drag handle (mobile) */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 6,
          left: "50%",
          transform: "translateX(-50%)",
          width: 44,
          height: 4,
          borderRadius: 2,
          background: PALETTE.surfaceHi,
          pointerEvents: "none",
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: PALETTE.textMuted,
          }}
        >
          {mode === "chat" ? "Message" : "Listing"}
        </div>
        <h2
          data-nex-directory-panel-title
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 600,
            lineHeight: 1.25,
            color: PALETTE.text,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {listing.name}
        </h2>
      </div>
      {mode === "chat" ? (
        <button
          type="button"
          onClick={() => onChangeMode("details")}
          data-nex-directory-panel-back
          aria-label="Back to listing details"
          style={{
            background: "transparent",
            color: PALETTE.cyan,
            border: `1px solid ${PALETTE.cyan}`,
            padding: "6px 10px",
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Details
        </button>
      ) : null}
      <button
        ref={closeButtonRef}
        type="button"
        onClick={onClose}
        data-nex-directory-panel-close
        aria-label="Close"
        style={{
          background: PALETTE.surfaceHi,
          color: PALETTE.textDim,
          border: `1px solid ${PALETTE.borderSoft}`,
          width: 32,
          height: 32,
          borderRadius: 999,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
      >
        <CloseGlyph />
      </button>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Details body
// ─────────────────────────────────────────────────────────────────────

function DetailsBody(props: {
  readonly listing: DirectoryListingVM;
  readonly destination: DirectoryDestination;
  readonly onOpenChat: () => void;
  readonly categoryImageLibrary?: readonly CategoryImageLibraryRow[];
}): React.ReactElement {
  const { listing, destination, onOpenChat, categoryImageLibrary } = props;

  return (
    <>
      <HeroImage listing={listing} categoryImageLibrary={categoryImageLibrary} />

      <CtaStripOrFallback
        listing={listing}
        destination={destination}
        onOpenChat={onOpenChat}
      />

      <IdentitySection listing={listing} />
      <LocationSection listing={listing} />
      <ContactSection listing={listing} />
      {/* Replaces the previous raw-jsonb services/products pretty-print.
          Honest-empty: the component itself returns null when the
          projected shape has no renderable data (collapsing the whole
          section rather than fabricating defaults). */}
      <CategoryDetailSections listing={listing} />
      {/* Agent B's server-component sibling cannot mount inside this
          `"use client"` panel. The client wrapper fetches the same
          data via GET /api/nex-directory/v1/related/[canonical_id]
          and renders identical UI. Honest-empty: no coords → section
          renders nothing; empty groups → muted microcopy. */}
      <RelatedBusinessesSectionClient listing={listing} />
      {/* Agent C · OwnerClaimForm claim prompt replaces the previous
          single "Message" nudge for unclaimed listings. Dynamic import
          with honest fallback copy if the module hasn't landed. */}
      <ClaimPromptSlot
        listing={listing}
        destination={destination}
        onOpenChat={onOpenChat}
      />
      <LifecycleChip listing={listing} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Agent C slot · OwnerClaimForm · dynamic import w/ honest fallback.
// ─────────────────────────────────────────────────────────────────────

type OwnerClaimFormComponent = React.ComponentType<{
  readonly listing: DirectoryListingVM;
  readonly canonicalId: string;
}>;

function ClaimPromptSlot(props: {
  readonly listing: DirectoryListingVM;
  readonly destination: DirectoryDestination;
  readonly onOpenChat: () => void;
}): React.ReactElement | null {
  const [Comp, setComp] = useState<OwnerClaimFormComponent | null>(null);
  const [tried, setTried] = useState<boolean>(false);
  const unclaimed =
    props.destination.kind !== "nex_business" &&
    props.destination.kind !== "nex_user_profile";

  useEffect(() => {
    if (!unclaimed) return;
    let cancelled = false;
    void (async () => {
      try {
        const mod = (await import(
          "@/components/nex-native/directory/OwnerClaimForm"
        )) as {
          OwnerClaimForm?: OwnerClaimFormComponent;
          default?: OwnerClaimFormComponent;
        };
        if (cancelled) return;
        const C = mod.OwnerClaimForm ?? mod.default ?? null;
        setComp(() => C);
      } catch {
        /* module not yet landed · fall through to honest nudge */
      } finally {
        if (!cancelled) setTried(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [unclaimed]);

  if (!unclaimed) return null;
  if (Comp !== null) {
    return (
      <div
        data-nex-owner-claim-slot
        data-nex-owner-claim-canonical-id={props.listing.canonicalBusinessId}
      >
        <Comp
          listing={props.listing}
          canonicalId={props.listing.canonicalBusinessId}
        />
      </div>
    );
  }
  if (!tried) {
    return (
      <div
        data-nex-owner-claim-pending
        style={{
          height: 44,
          background: PALETTE.surface,
          border: `1px solid ${PALETTE.borderSoft}`,
          borderRadius: 10,
        }}
      />
    );
  }
  return (
    <div
      data-nex-owner-claim-fallback
      style={{
        padding: "10px 12px",
        borderRadius: 10,
        background: PALETTE.surface,
        border: `1px solid ${PALETTE.borderSoft}`,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ fontSize: 12.5, color: PALETTE.text, fontWeight: 600 }}>
        Is this your listing?
      </div>
      <div style={{ fontSize: 11.5, color: PALETTE.textMuted }}>
        Claim it to update details, add photos, and respond to messages.
      </div>
      <button
        type="button"
        onClick={props.onOpenChat}
        style={{
          alignSelf: "flex-start",
          background: PALETTE.orange,
          color: "#1A0F00",
          border: "none",
          borderRadius: 8,
          padding: "6px 12px",
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Message to claim
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Agent-A integration · dynamic import with graceful fallback
// ─────────────────────────────────────────────────────────────────────
//
// Agent A owns `CardCtaStrip`. We import it dynamically so this panel
// compiles when Agent A's module hasn't landed yet. If the import
// resolves AND the component is a function, we render it; otherwise we
// render a minimal honest fallback (one "Message" button + the detail
// page link).

type CardCtaStripComponent = React.ComponentType<{
  readonly listing: DirectoryListingVM;
  readonly onOpenDetail?: () => void;
  readonly onOpenChat?: () => void;
}>;

function CtaStripOrFallback(props: {
  readonly listing: DirectoryListingVM;
  readonly destination: DirectoryDestination;
  readonly onOpenChat: () => void;
}): React.ReactElement {
  const [Comp, setComp] = useState<CardCtaStripComponent | null>(null);
  const [tried, setTried] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const mod = (await import(
          "@/components/nex-native/directory/CardCtaStrip"
        )) as { CardCtaStrip?: CardCtaStripComponent; default?: CardCtaStripComponent };
        if (cancelled) return;
        const C = mod.CardCtaStrip ?? mod.default ?? null;
        setComp(() => C);
      } catch {
        /* no module yet · fall through */
      } finally {
        if (!cancelled) setTried(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (Comp !== null) {
    return (
      <Comp
        listing={props.listing}
        onOpenDetail={undefined}
        onOpenChat={props.onOpenChat}
      />
    );
  }
  if (!tried) {
    return (
      <div
        style={{
          height: 44,
          background: PALETTE.surface,
          border: `1px solid ${PALETTE.borderSoft}`,
          borderRadius: 10,
        }}
      />
    );
  }
  // Honest fallback: minimum useful control surface until Agent A ships.
  return (
    <div
      data-nex-directory-panel-cta-fallback
      style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
    >
      <button
        type="button"
        onClick={props.onOpenChat}
        style={{
          flex: 1,
          minHeight: 42,
          background: PALETTE.orange,
          color: "#1A0F00",
          border: "none",
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          padding: "0 14px",
        }}
      >
        Message
      </button>
      {props.destination.kind === "nex_business" ? (
        <a
          href={props.destination.path}
          style={{
            flex: 1,
            minHeight: 42,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            color: PALETTE.cyan,
            border: `1px solid ${PALETTE.cyan}`,
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
            padding: "0 14px",
            textDecoration: "none",
          }}
        >
          Open on NEX
        </a>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Hero image
// ─────────────────────────────────────────────────────────────────────

function HeroImage(props: {
  readonly listing: DirectoryListingVM;
  readonly categoryImageLibrary?: readonly CategoryImageLibraryRow[];
}): React.ReactElement {
  const { listing, categoryImageLibrary } = props;
  if (listing.primaryImage !== null) {
    return (
      <div
        data-nex-directory-panel-hero="present"
        style={{
          width: "100%",
          height: 220,
          borderRadius: 12,
          overflow: "hidden",
          background: PALETTE.surfaceHi,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={listing.primaryImage.url}
          alt={listing.primaryImage.altText || listing.name}
          loading="lazy"
          decoding="async"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      </div>
    );
  }

  // No real primary image · try the curated representative library.
  const resolved: CategoryImageResolved | null =
    categoryImageLibrary !== undefined
      ? resolveCategoryImage({
          libraryRows: categoryImageLibrary,
          entityType: listing.entityType,
          categoryIds: listing.categoryIds,
          canonicalBusinessId: listing.canonicalBusinessId,
        })
      : null;

  if (resolved !== null) {
    return (
      <div
        data-nex-directory-panel-hero="representative"
        data-nex-directory-panel-hero-slug={resolved.category_slug}
        data-nex-directory-panel-hero-variant={resolved.variant_tag ?? ""}
        style={{
          width: "100%",
          height: 220,
          borderRadius: 12,
          overflow: "hidden",
          position: "relative",
          background: PALETTE.surfaceHi,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolved.url}
          alt={`Representative illustration · ${resolved.category_slug}${resolved.variant_tag ? ` · ${resolved.variant_tag}` : ""}`}
          data-nex-directory-panel-hero-img
          loading="lazy"
          decoding="async"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
        <span
          data-nex-directory-panel-hero-caption
          style={{
            position: "absolute",
            right: 10,
            bottom: 10,
            padding: "4px 10px",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.02em",
            color: PALETTE.textDim,
            background: "rgba(2,9,20,0.72)",
            border: `1px solid ${PALETTE.borderSoft}`,
            borderRadius: 999,
            pointerEvents: "none",
          }}
        >
          Representative illustration
        </span>
      </div>
    );
  }

  // Library had no match (or wasn't threaded in) · honest fallback.
  return (
    <div
      data-nex-directory-panel-hero="absent"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      <NoImage
        classification={listing.classification}
        name={listing.name}
        size="hero"
      />
      <div
        style={{
          fontSize: 11.5,
          color: PALETTE.textMuted,
          fontStyle: "italic",
        }}
      >
        Image not yet added
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Section components · each hides itself when all fields are null
// ─────────────────────────────────────────────────────────────────────

function IdentitySection(props: {
  readonly listing: DirectoryListingVM;
}): React.ReactElement | null {
  const { listing } = props;
  const aliases = listing.aliases.filter((a) => a.trim().length > 0);
  const categories = listing.categoryIds.filter((c) => c.trim().length > 0);
  if (aliases.length === 0 && categories.length === 0) return null;
  return (
    <SectionShell title="About">
      {aliases.length > 0 ? (
        <KV label="Also known as" value={aliases.join(" · ")} />
      ) : null}
      {categories.length > 0 ? (
        <div
          aria-label="Categories"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            marginTop: 4,
          }}
        >
          {categories.slice(0, 8).map((c) => (
            <span
              key={c}
              style={{
                fontSize: 11,
                fontWeight: 500,
                padding: "2px 8px",
                background: PALETTE.surfaceHi,
                color: PALETTE.textDim,
                borderRadius: 999,
              }}
            >
              {c}
            </span>
          ))}
        </div>
      ) : null}
    </SectionShell>
  );
}

function LocationSection(props: {
  readonly listing: DirectoryListingVM;
}): React.ReactElement | null {
  const { listing } = props;
  const l1 = listing.address?.line1 ?? null;
  const hasAny =
    listing.streetLine !== null ||
    listing.neighbourhood !== null ||
    listing.district !== null ||
    listing.city !== null ||
    listing.country !== null ||
    l1 !== null ||
    listing.coordinates !== null;
  if (!hasAny) return null;

  const mapsHref =
    listing.coordinates !== null
      ? `https://www.google.com/maps/search/?api=1&query=${listing.coordinates.lat},${listing.coordinates.lng}`
      : null;

  return (
    <SectionShell title="Location">
      {listing.streetLine !== null ? (
        <KV label="Street" value={listing.streetLine} />
      ) : null}
      {l1 !== null ? <KV label="Address" value={l1} /> : null}
      {listing.neighbourhood !== null ? (
        <KV label="Neighbourhood" value={listing.neighbourhood} />
      ) : null}
      {listing.district !== null ? (
        <KV label="District" value={listing.district} />
      ) : null}
      {listing.city !== null ? <KV label="City" value={listing.city} /> : null}
      <KV label="Country" value={listing.country} />
      {listing.coordinates !== null ? (
        <div style={{ marginTop: 4 }}>
          <KV
            label="Coordinates"
            value={`(${listing.coordinates.lat.toFixed(5)}, ${listing.coordinates.lng.toFixed(5)})`}
          />
          {mapsHref !== null ? (
            <a
              href={mapsHref}
              target="_blank"
              rel="noopener noreferrer"
              data-nex-directory-panel-maps-link
              style={{
                fontSize: 12.5,
                color: PALETTE.cyan,
                textDecoration: "underline",
                marginTop: 2,
                display: "inline-block",
              }}
            >
              Open in Maps
            </a>
          ) : null}
        </div>
      ) : null}
    </SectionShell>
  );
}

function ContactSection(props: {
  readonly listing: DirectoryListingVM;
}): React.ReactElement | null {
  const { listing } = props;
  if (listing.phoneE164 === null && listing.websiteApex === null) return null;
  return (
    <SectionShell title="Contact">
      {listing.phoneE164 !== null ? (
        <div style={{ marginBottom: 4 }}>
          <KVLabel>Phone</KVLabel>
          <a
            href={`tel:${listing.phoneE164}`}
            style={{
              color: PALETTE.cyan,
              textDecoration: "none",
              fontSize: 13,
            }}
          >
            {listing.phoneE164}
          </a>
        </div>
      ) : null}
      {listing.websiteApex !== null ? (
        <div>
          <KVLabel>Website</KVLabel>
          <a
            href={`https://${listing.websiteApex}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: PALETTE.cyan,
              textDecoration: "none",
              fontSize: 13,
            }}
          >
            {listing.websiteApex}
          </a>
        </div>
      ) : null}
    </SectionShell>
  );
}

function LifecycleChip(props: {
  readonly listing: DirectoryListingVM;
}): React.ReactElement {
  return (
    <div style={{ marginTop: 2 }}>
      <span
        data-nex-directory-panel-lifecycle-chip
        data-nex-directory-panel-lifecycle-state={props.listing.lifecycleState}
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: PALETTE.textMuted,
          padding: "2px 8px",
          borderRadius: 999,
          border: `1px solid ${PALETTE.borderSoft}`,
          background: PALETTE.surface,
        }}
      >
        {props.listing.lifecycleState.replace(/_/g, " ").toLowerCase()}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Section shell + KV helpers
// ─────────────────────────────────────────────────────────────────────

function SectionShell(props: {
  readonly title: string;
  readonly children: React.ReactNode;
}): React.ReactElement {
  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: PALETTE.textMuted,
          marginBottom: 4,
        }}
      >
        {props.title}
      </div>
      {props.children}
    </section>
  );
}

function KV(props: {
  readonly label: string;
  readonly value: string;
}): React.ReactElement {
  return (
    <div style={{ marginBottom: 2 }}>
      <KVLabel>{props.label}</KVLabel>
      <div style={{ color: PALETTE.text, fontSize: 13, lineHeight: 1.4 }}>
        {props.value}
      </div>
    </div>
  );
}

function KVLabel(props: { readonly children: React.ReactNode }): React.ReactElement {
  return (
    <div style={{ color: PALETTE.textSoft, fontSize: 11, fontWeight: 600 }}>
      {props.children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Glyphs & focus trap
// ─────────────────────────────────────────────────────────────────────

function CloseGlyph(): React.ReactElement {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function trapFocus(e: KeyboardEvent, container: HTMLElement): void {
  const focusables = container.querySelectorAll<HTMLElement>(
    [
      "a[href]",
      "button:not([disabled])",
      "textarea:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "[tabindex]:not([tabindex='-1'])",
    ].join(","),
  );
  if (focusables.length === 0) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement as HTMLElement | null;
  if (e.shiftKey) {
    if (active === first || !container.contains(active)) {
      e.preventDefault();
      last.focus();
    }
  } else {
    if (active === last) {
      e.preventDefault();
      first.focus();
    }
  }
}
