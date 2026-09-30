"use client";

// src/app/nex-native/cover/_composer/CoverInfoTray.tsx
//
// Founder direction 2026-09-30 · the + button on the cover composer
// opens THIS · a themed tray of info buttons the visitor can tap to
// read About Us · Delivery · Hours · Payment · Returns · Catering ·
// Gallery · Custom orders · Services · plus up to 3 seller-defined
// custom buttons.
//
// Anti-pattern guardrail: buttons whose backing data is absent AND
// whose enabled toggle isn't explicitly true don't render. Buyer
// never sees an empty state.
//
// Two internal views:
//   · Grid  · a scrollable list of icon+label rows
//   · Panel · the body of one selected page · back arrow returns to grid
//
// All colours flow from CSS vars set by <CoverThemeSkin>.

import * as React from "react";
import {
  isCustomButtonEnabled,
  isInfoPageEnabled,
  NEX_INFO_PAGE_META,
  type NexInfoCustomButton,
  type NexInfoPageKey,
  type NexInfoPagesJson,
} from "@/lib/nex-native/info-pages";

export interface CoverInfoTrayContent {
  /** Seller-authored blob from nex_business.info_pages. */
  pages: NexInfoPagesJson | null | undefined;
  /** nex_business.description · About Us body. */
  aboutUs: string | null;
  /** Rendered opening hours. */
  hours: string | null;
  /** Address + optional coords → shown in the Location card if the
   *  seller decides to keep a separate button (defaults hidden). */
  address: string | null;
  /** Payment method labels · from accepted_payment_methods → labels. */
  paymentMethodLabels: string[];
  /** Return policy · pre-rendered body when set. */
  returnPolicyBody: string | null;
  /** Events / catering body · pre-rendered from events_profile. */
  eventsBody: string | null;
  /** Venue gallery photo URLs (up to 6). */
  galleryUrls: string[];
  /** True when this shop's business_category is a venue. */
  isVenue: boolean;
}

export function CoverInfoTray({
  open,
  onClose,
  businessName,
  content,
}: {
  open: boolean;
  onClose: () => void;
  businessName: string;
  content: CoverInfoTrayContent;
}): React.JSX.Element | null {
  const [panelKey, setPanelKey] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (panelKey) setPanelKey(null);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, panelKey, onClose]);

  if (!open) return null;

  const items = buildTrayItems(content);
  const activeItem = panelKey ? items.find((i) => i.id === panelKey) : null;

  return (
    <>
      {/* Dim backdrop · tap to close */}
      <div
        role="button"
        aria-label="Close info"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(3,8,20,0.55)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          zIndex: 40,
        }}
      />

      {/* Bottom sheet · slides above the composer footer */}
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`Info about ${businessName}`}
        data-nex-cover-info-tray
        style={{
          position: "fixed",
          left: 12,
          right: 12,
          bottom:
            "calc(env(safe-area-inset-bottom, 0) + 76px)",
          maxHeight: "68dvh",
          zIndex: 41,
          borderRadius: 20,
          background:
            "linear-gradient(180deg, rgba(3,8,20,0.98), rgba(3,8,20,0.94))",
          border:
            "1px solid var(--nex-accent-soft, rgba(0,175,255,0.35))",
          boxShadow:
            "0 -20px 60px rgba(0,0,0,0.7), 0 0 40px var(--nex-accent-glow, rgba(0,175,255,0.2))",
          color: "var(--nex-text, #F2F5F8)",
          fontFamily: "var(--nex-font-body, inherit)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "14px 16px 10px",
            borderBottom:
              "1px solid var(--nex-accent-soft, rgba(0,175,255,0.15))",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          {activeItem ? (
            <button
              type="button"
              onClick={() => setPanelKey(null)}
              aria-label="Back to info list"
              style={{
                border: "none",
                background: "transparent",
                color: "var(--nex-accent)",
                fontFamily: "inherit",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                cursor: "pointer",
                padding: "4px 6px",
              }}
            >
              ‹ Back
            </button>
          ) : (
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--nex-accent)",
                fontWeight: 700,
              }}
            >
              About {businessName}
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              border:
                "1px solid var(--nex-accent-soft, rgba(0,175,255,0.35))",
              background: "transparent",
              color: "var(--nex-text-dim, rgba(255,255,255,0.65))",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              fontFamily: "inherit",
              fontSize: 14,
              lineHeight: 1,
              padding: 0,
            }}
          >
            ×
          </button>
        </div>

        {/* Body · grid or panel */}
        <div
          style={{
            flex: "1 1 auto",
            overflowY: "auto",
            padding: 14,
          }}
        >
          {activeItem ? (
            <PanelBody item={activeItem} />
          ) : items.length === 0 ? (
            <EmptyState businessName={businessName} />
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              {items.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => setPanelKey(it.id)}
                  style={{
                    padding: "14px 12px",
                    borderRadius: 12,
                    border:
                      "1px solid var(--nex-accent-soft, rgba(0,175,255,0.35))",
                    background: "var(--nex-accent-faint, rgba(0,175,255,0.08))",
                    color: "var(--nex-text, #F2F5F8)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: 6,
                    textAlign: "left",
                  }}
                >
                  <span aria-hidden style={{ fontSize: 22, lineHeight: 1 }}>
                    {it.icon}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: "0.01em",
                    }}
                  >
                    {it.label}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

// ─── Panel body renderer ─────────────────────────────────────────────

interface TrayItem {
  id: string;
  icon: string;
  label: string;
  body: string;
  imageUrl?: string | null;
  externalUrl?: string | null;
  chips?: string[];
  images?: string[];
}

function PanelBody({ item }: { item: TrayItem }) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span aria-hidden style={{ fontSize: 26, lineHeight: 1 }}>
          {item.icon}
        </span>
        <h2
          style={{
            margin: 0,
            fontFamily: "var(--nex-font-display)",
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: "-0.01em",
          }}
        >
          {item.label}
        </h2>
      </div>

      {item.imageUrl && (
        <div
          style={{
            borderRadius: 12,
            overflow: "hidden",
            border:
              "1px solid var(--nex-accent-soft, rgba(0,175,255,0.35))",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.imageUrl}
            alt=""
            style={{ width: "100%", display: "block" }}
          />
        </div>
      )}

      {item.body && (
        <p
          style={{
            margin: 0,
            fontSize: 14,
            lineHeight: 1.55,
            color: "var(--nex-text, #F2F5F8)",
            whiteSpace: "pre-wrap",
          }}
        >
          {item.body}
        </p>
      )}

      {item.chips && item.chips.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {item.chips.map((c) => (
            <span
              key={c}
              style={{
                padding: "5px 10px",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.02em",
                border:
                  "1px solid var(--nex-accent-soft, rgba(0,175,255,0.35))",
                background: "var(--nex-accent-faint, rgba(0,175,255,0.08))",
                color: "var(--nex-text, #F2F5F8)",
              }}
            >
              {c}
            </span>
          ))}
        </div>
      )}

      {item.images && item.images.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
          }}
        >
          {item.images.map((u, i) => (
            <div
              key={`${u}_${i}`}
              style={{
                aspectRatio: "1 / 1",
                borderRadius: 10,
                overflow: "hidden",
                border:
                  "1px solid var(--nex-accent-soft, rgba(0,175,255,0.35))",
                background: "rgba(0,0,0,0.35)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={u}
                alt=""
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            </div>
          ))}
        </div>
      )}

      {item.externalUrl && (
        <a
          href={item.externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            marginTop: 4,
            padding: "10px 14px",
            borderRadius: 10,
            border: "none",
            background: "var(--nex-accent, #00AFFF)",
            color: "#03101D",
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.06em",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          Open link ↗
        </a>
      )}
    </div>
  );
}

function EmptyState({ businessName }: { businessName: string }) {
  return (
    <div
      style={{
        padding: "24px 12px",
        textAlign: "center",
        color: "var(--nex-text-dim, rgba(255,255,255,0.65))",
        fontSize: 13,
        lineHeight: 1.55,
      }}
    >
      {businessName} hasn&apos;t filled in any info yet.
      <br />
      Send a message using the composer instead.
    </div>
  );
}

// ─── Item builder ────────────────────────────────────────────────────
// Turns the raw content bundle into a filtered TrayItem[] respecting
// per-page enabled flags AND presence of backing data.

function buildTrayItems(content: CoverInfoTrayContent): TrayItem[] {
  const items: TrayItem[] = [];
  const enabled = (k: NexInfoPageKey) =>
    isInfoPageEnabled(content.pages, k);

  if (enabled("about_us") && content.aboutUs) {
    items.push({
      id: "about_us",
      icon: NEX_INFO_PAGE_META.about_us.icon,
      label: NEX_INFO_PAGE_META.about_us.label,
      body: content.aboutUs,
    });
  }

  if (enabled("delivery") && content.pages?.delivery_details) {
    items.push({
      id: "delivery",
      icon: NEX_INFO_PAGE_META.delivery.icon,
      label: NEX_INFO_PAGE_META.delivery.label,
      body: content.pages.delivery_details,
    });
  }

  if (enabled("hours") && content.hours) {
    items.push({
      id: "hours",
      icon: NEX_INFO_PAGE_META.hours.icon,
      label: NEX_INFO_PAGE_META.hours.label,
      body: content.hours,
    });
  }

  if (enabled("payment") && content.paymentMethodLabels.length > 0) {
    items.push({
      id: "payment",
      icon: NEX_INFO_PAGE_META.payment.icon,
      label: NEX_INFO_PAGE_META.payment.label,
      body: "Payment methods this shop accepts:",
      chips: content.paymentMethodLabels,
    });
  }

  if (enabled("returns") && content.returnPolicyBody) {
    items.push({
      id: "returns",
      icon: NEX_INFO_PAGE_META.returns.icon,
      label: NEX_INFO_PAGE_META.returns.label,
      body: content.returnPolicyBody,
    });
  }

  if (content.isVenue && enabled("catering") && content.eventsBody) {
    items.push({
      id: "catering",
      icon: NEX_INFO_PAGE_META.catering.icon,
      label: NEX_INFO_PAGE_META.catering.label,
      body: content.eventsBody,
    });
  }

  if (
    content.isVenue &&
    enabled("gallery") &&
    content.galleryUrls.length > 0
  ) {
    items.push({
      id: "gallery",
      icon: NEX_INFO_PAGE_META.gallery.icon,
      label: NEX_INFO_PAGE_META.gallery.label,
      body: "",
      images: content.galleryUrls,
    });
  }

  if (
    !content.isVenue &&
    enabled("custom_orders") &&
    content.pages?.custom_orders
  ) {
    items.push({
      id: "custom_orders",
      icon: NEX_INFO_PAGE_META.custom_orders.icon,
      label: NEX_INFO_PAGE_META.custom_orders.label,
      body: content.pages.custom_orders,
    });
  }

  if (
    !content.isVenue &&
    enabled("services") &&
    content.pages?.services_scope
  ) {
    items.push({
      id: "services",
      icon: NEX_INFO_PAGE_META.services.icon,
      label: NEX_INFO_PAGE_META.services.label,
      body: content.pages.services_scope,
    });
  }

  const customButtons = content.pages?.custom_buttons ?? [];
  for (const btn of customButtons) {
    if (!isCustomButtonEnabled(btn)) continue;
    if (!btn.label || btn.label.trim().length === 0) continue;
    items.push({
      id: `custom__${btn.id}`,
      icon: btn.icon || "✨",
      label: btn.label,
      body: btn.body ?? "",
      imageUrl: btn.image_url ?? null,
      externalUrl: btn.external_url ?? null,
    });
  }

  return items;
}
