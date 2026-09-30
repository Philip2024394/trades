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

      {/* Bottom sheet · slides above the composer footer · founder
          direction 2026-09-30 · tall (86dvh) · no divider line at the
          header · small × close button top-right. */}
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
          maxHeight: "86dvh",
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
        {/* Header · NO borderBottom · just enough padding to seat the
            × close button top-right (and Back arrow on the left when
            a panel is open). */}
        <div
          style={{
            padding: "12px 14px 6px",
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
            <span aria-hidden style={{ flex: 1 }} />
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              border: "none",
              background: "rgba(255,255,255,0.08)",
              color: "var(--nex-text-dim, rgba(255,255,255,0.65))",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              padding: 0,
            }}
          >
            <IconClose />
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
                  <span
                    aria-hidden
                    style={{
                      color: "var(--nex-accent)",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    {renderTrayIcon(it, 26)}
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

/**
 * Render the icon for a tray item. Sealed IDs (about_us, delivery, …)
 * get a stroke-based NEX SVG icon. Custom buttons (id prefixed with
 * "custom__") fall back to the seller's chosen emoji glyph since the
 * seller can't author an SVG.
 */
function renderTrayIcon(it: TrayItem, size: number): React.ReactNode {
  if (it.id.startsWith("custom__")) {
    return (
      <span style={{ fontSize: size, lineHeight: 1 }}>{it.icon}</span>
    );
  }
  switch (it.id) {
    case "about_us":
      return <IconAboutUs size={size} />;
    case "delivery":
      return <IconDelivery size={size} />;
    case "hours":
      return <IconClock size={size} />;
    case "payment":
      return <IconWallet size={size} />;
    case "returns":
      return <IconReturn size={size} />;
    case "catering":
      return <IconCelebration size={size} />;
    case "gallery":
      return <IconImage size={size} />;
    case "custom_orders":
      return <IconPackage size={size} />;
    case "services":
      return <IconWrench size={size} />;
    default:
      return (
        <span style={{ fontSize: size, lineHeight: 1 }}>{it.icon}</span>
      );
  }
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
        <span
          aria-hidden
          style={{
            color: "var(--nex-accent)",
            display: "grid",
            placeItems: "center",
          }}
        >
          {renderTrayIcon(item, 28)}
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

// ─── Stroke-based NEX icons ──────────────────────────────────────────
// Match the visual language of the chat header cluster (HomeIcon /
// ShopBagIcon / CutleryIcon / CartIcon in src/app/nex-native/chat/
// _header-right-cluster.tsx): 24×24 viewBox · fill:none · stroke:
// currentColor · strokeWidth:1.9 · round line-caps and joins.

function iconProps(size: number) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
}

function IconClose() {
  return (
    <svg {...iconProps(14)}>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}

function IconAboutUs({ size }: { size: number }) {
  return (
    <svg {...iconProps(size)}>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="11" x2="12" y2="16" />
      <circle cx="12" cy="8" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconDelivery({ size }: { size: number }) {
  return (
    <svg {...iconProps(size)}>
      <path d="M3 7h11v9H3z" />
      <path d="M14 10h4l3 3v3h-7" />
      <circle cx="7" cy="18" r="1.7" />
      <circle cx="17" cy="18" r="1.7" />
    </svg>
  );
}

function IconClock({ size }: { size: number }) {
  return (
    <svg {...iconProps(size)}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 16 14" />
    </svg>
  );
}

function IconWallet({ size }: { size: number }) {
  return (
    <svg {...iconProps(size)}>
      <path d="M3 8a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M16 13h4" />
      <circle cx="17" cy="13" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconReturn({ size }: { size: number }) {
  return (
    <svg {...iconProps(size)}>
      <polyline points="9 14 4 9 9 4" />
      <path d="M4 9h11a5 5 0 0 1 5 5v2a4 4 0 0 1-4 4h-3" />
    </svg>
  );
}

function IconCelebration({ size }: { size: number }) {
  return (
    <svg {...iconProps(size)}>
      <rect x="4" y="10" width="16" height="4" rx="1" />
      <path d="M6 14v7h12v-7" />
      <line x1="12" y1="10" x2="12" y2="21" />
      <path d="M12 10c-2 0-3-1-3-2s1-2 2-2 1 1 1 2" />
      <path d="M12 10c2 0 3-1 3-2s-1-2-2-2-1 1-1 2" />
    </svg>
  );
}

function IconImage({ size }: { size: number }) {
  return (
    <svg {...iconProps(size)}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.8" />
      <polyline points="21 17 15 11 5 20" />
    </svg>
  );
}

function IconPackage({ size }: { size: number }) {
  return (
    <svg {...iconProps(size)}>
      <path d="M3 8l9-4 9 4v9l-9 4-9-4z" />
      <path d="M3 8l9 4 9-4" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <path d="M7.5 6l9 4" />
    </svg>
  );
}

function IconWrench({ size }: { size: number }) {
  return (
    <svg {...iconProps(size)}>
      <path d="M15 3a4 4 0 0 0-4 6l-7 7 3 3 7-7a4 4 0 0 0 6-4l-3 3-2-2z" />
    </svg>
  );
}
