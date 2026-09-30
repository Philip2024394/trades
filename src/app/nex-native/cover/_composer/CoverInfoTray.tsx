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

/** Founder direction 2026-09-30 · one row per weekday for the Hours
 *  panel. `closed=true` (or a null open/close) renders as "Closed".
 *  Times are stored as strings (e.g. "07:00") so we don't couple the
 *  UI to a timezone parser · seller writes them exactly how they
 *  want them displayed. */
export interface WeeklyHoursDay {
  open?: string | null;
  close?: string | null;
  closed?: boolean;
}
export type WeeklyHours = Record<
  "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun",
  WeeklyHoursDay
>;

export interface CoverInfoTrayContent {
  /** Seller-authored blob from nex_business.info_pages. */
  pages: NexInfoPagesJson | null | undefined;
  /** nex_business.description · About Us body. */
  aboutUs: string | null;
  /** Founder direction 2026-09-30 · year the business was founded
   *  (from nex_business.year_established smallint). Rendered as a
   *  small pill at the top of the About Us panel. */
  yearEstablished?: number | null;
  /** Owner's real name (from nex_account.display_name on the
   *  business's owner_account_id). Shown next to the avatar and
   *  used as the signature on the About Us panel. */
  ownerName?: string | null;
  /** Owner's role · Founder / Owner / Chef / Head of Studio etc.
   *  Free text. */
  ownerPosition?: string | null;
  /** Round avatar for the owner (defaults to the same portrait shown
   *  on the identity badge · Maria's face on Maria's Café). */
  ownerAvatarUrl?: string | null;
  /** Rendered opening hours · plain-text fallback used when
   *  hoursByDay is not provided. */
  hours: string | null;
  /** Founder direction 2026-09-30 · structured Monday–Sunday schedule.
   *  When populated, the Hours panel renders a two-column day/time
   *  table instead of the plain-text `hours` string. Any day marked
   *  closed=true reads "Closed" · missing open OR close also reads
   *  "Closed" for safety. */
  hoursByDay?: WeeklyHours | null;
  /** Address + optional coords → shown in the Location card if the
   *  seller decides to keep a separate button (defaults hidden). */
  address: string | null;
  /** Payment method labels · from accepted_payment_methods → labels. */
  paymentMethodLabels: string[];
  /** Migration 110 · sealed 2026-09-30 · seller-uploaded QR image
   *  URL (QRIS / bank / e-wallet). When set AND acceptsQrisDelivery
   *  is true, the Payment panel renders the QR with the doctrine
   *  "scan on arrival" warning below it. */
  qrCodeImageUrl?: string | null;
  /** True when the seller ticked 📱 QRIS on Delivery in their
   *  accepted payment methods. Gates whether the QR panel renders. */
  acceptsQrisDelivery?: boolean;
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
          direction 2026-09-30 · tall (86dvh) · uniform 1px border on
          all 4 sides · no close button in the header (tap the + or
          the backdrop to close · Escape also closes). */}
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
          // Founder direction 2026-09-30 (revised) · every side gets
          // the same accent-soft border · spelt out per-edge so no
          // shadow or gradient washes any side out visually.
          borderTop:
            "1px solid var(--nex-accent-soft, rgba(0,175,255,0.35))",
          borderRight:
            "1px solid var(--nex-accent-soft, rgba(0,175,255,0.35))",
          borderBottom:
            "1px solid var(--nex-accent-soft, rgba(0,175,255,0.35))",
          borderLeft:
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
        {/* Header · NO borderBottom · NO close button · just seats the
            Back arrow when a panel is open. Close paths: tap the +
            button on the composer again (toggle), tap the backdrop,
            or press Escape. */}
        {activeItem && (
          <div
            style={{
              padding: "10px 14px 4px",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
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
          </div>
        )}

        {/* Body · grid or panel · opts in to the thin scrollbar rule
            declared in CoverThemeSkin so the tray gets a compact
            accent-tinted vertical thumb IF the content overflows. */}
        <div
          data-nex-cover-scroll="thin"
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
  /** Migration 110 · when set, Payment panel renders the QR image
   *  followed by the doctrine "scan on arrival · verify merchant name"
   *  warning. Only populated for the "payment" tray item when the
   *  seller has both uploaded a QR AND accepts qris_delivery. */
  qrImageUrl?: string | null;
  /** Free-text paragraph rendered at the bottom of the panel.
   *  Used by the Payment item for the "We also accept …" line and
   *  the Catering item for the "please contact to discuss …" prompt. */
  footerNote?: string | null;
  /** Bullet list rendered between body and any other blocks. Used by
   *  the Catering panel for the default event types (Birthdays ·
   *  Anniversaries · Graduations · Weddings). */
  bullets?: string[];
  /** Founder direction 2026-09-30 · two-column weekday schedule for
   *  the Hours panel. Rendered as a Mon–Sun list with open–close
   *  times · closed days read "Closed". */
  hoursByDay?: WeeklyHours | null;
  /** Owner block · Founder direction 2026-09-30 · rendered above the
   *  body on the About Us panel. Round avatar + name + position +
   *  year-established pill. */
  ownerBlock?: {
    yearEstablished?: number | null;
    avatarUrl?: string | null;
    name?: string | null;
    position?: string | null;
  };
  /** Signature name · rendered in italic serif at the very bottom of
   *  the panel body (About Us signs off with the owner's name after
   *  the thanking line). */
  signatureName?: string | null;
}

function PanelBody({ item }: { item: TrayItem }) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {item.ownerBlock && <OwnerBlock block={item.ownerBlock} />}
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

      {item.hoursByDay && <HoursTable hours={item.hoursByDay} />}

      {item.bullets && item.bullets.length > 0 && (
        <ul
          style={{
            margin: 0,
            paddingLeft: 20,
            display: "grid",
            gap: 4,
          }}
        >
          {item.bullets.map((b) => (
            <li
              key={b}
              style={{
                fontSize: 14,
                lineHeight: 1.5,
                color: "var(--nex-text, #F2F5F8)",
              }}
            >
              {b}
            </li>
          ))}
        </ul>
      )}

      {item.qrImageUrl && (
        <div
          style={{
            padding: 12,
            borderRadius: 14,
            background: "#ffffff",
            border:
              "1px solid var(--nex-accent-soft, rgba(0,175,255,0.35))",
            display: "grid",
            placeItems: "center",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.qrImageUrl}
            alt="Payment QR code"
            style={{
              display: "block",
              maxWidth: "100%",
              width: "100%",
              height: "auto",
              aspectRatio: "1 / 1",
              objectFit: "contain",
            }}
          />
        </div>
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

      {item.footerNote && item.footerNote.length > 0 && (
        <p
          style={{
            margin: 0,
            fontSize: 13,
            lineHeight: 1.55,
            color: "var(--nex-text-dim, rgba(255,255,255,0.72))",
          }}
        >
          {item.footerNote}
        </p>
      )}

      {item.signatureName && (
        <div
          style={{
            marginTop: 4,
            display: "grid",
            gap: 2,
            paddingTop: 8,
            borderTop:
              "1px solid var(--nex-accent-soft, rgba(0,175,255,0.18))",
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--nex-text-dim, rgba(255,255,255,0.55))",
              fontWeight: 700,
            }}
          >
            Signed
          </div>
          <div
            style={{
              fontFamily:
                "'Cormorant Garamond', 'EB Garamond', 'Playfair Display', Georgia, serif",
              fontStyle: "italic",
              fontSize: 26,
              lineHeight: 1.1,
              color: "var(--nex-accent, #F2F5F8)",
            }}
          >
            {item.signatureName}
          </div>
        </div>
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
      // Founder direction 2026-09-30 · About Us panel gains a rich
      // owner-block header (year est · round avatar · name · position),
      // a system-authored thanks line as the footer note, and the
      // owner's name in italic serif as the signature.
      ownerBlock: {
        yearEstablished: content.yearEstablished ?? null,
        avatarUrl: content.ownerAvatarUrl ?? null,
        name: content.ownerName ?? null,
        position: content.ownerPosition ?? null,
      },
      footerNote:
        "Thanking all our customers in advance for your commitment to our brand.",
      signatureName: content.ownerName ?? null,
    });
  }

  if (enabled("delivery") && content.pages?.delivery_details) {
    items.push({
      id: "delivery",
      icon: NEX_INFO_PAGE_META.delivery.icon,
      label: NEX_INFO_PAGE_META.delivery.label,
      body: content.pages.delivery_details,
      // Founder direction 2026-09-30 · every delivery panel closes
      // with the NEX-standard courier network note · lets buyers
      // know they can pick a delivery slot that fits their schedule
      // even when the seller's own rider is unavailable.
      footerNote:
        "We can also arrange delivery with local transportation companies at a time that best suits your schedule.",
    });
  }

  if (enabled("hours") && (content.hours || content.hoursByDay)) {
    // Founder direction 2026-09-30 · when the seller has provided a
    // structured Mon–Sun schedule, render that as a two-column table.
    // Fall back to the plain-text hours string only when no
    // hoursByDay is present.
    items.push({
      id: "hours",
      icon: NEX_INFO_PAGE_META.hours.icon,
      label: NEX_INFO_PAGE_META.hours.label,
      body: content.hoursByDay ? "" : (content.hours ?? ""),
      hoursByDay: content.hoursByDay ?? null,
    });
  }

  if (enabled("payment") && content.paymentMethodLabels.length > 0) {
    const qr =
      content.acceptsQrisDelivery && content.qrCodeImageUrl
        ? content.qrCodeImageUrl
        : null;
    // Founder direction 2026-09-30 (revised) · Payment panel footer
    // is a fixed system-authored line rather than a derivation from
    // the seller's ticked methods. Keeps the copy predictable and
    // covers both the local-cash + off-platform card paths NEX
    // sellers commonly offer.
    items.push({
      id: "payment",
      icon: NEX_INFO_PAGE_META.payment.icon,
      label: NEX_INFO_PAGE_META.payment.label,
      body: "Payment Methods we Accept",
      qrImageUrl: qr,
      footerNote: "We also accept cash on delivery and all major cards.",
    });
  }

  if (enabled("returns") && content.returnPolicyBody) {
    items.push({
      id: "returns",
      icon: NEX_INFO_PAGE_META.returns.icon,
      label: NEX_INFO_PAGE_META.returns.label,
      body: content.returnPolicyBody,
      // Founder direction 2026-09-30 · every Returns panel closes
      // with the NEX-standard courier-note prompt + refund /
      // replacement promise so buyers see BOTH the "flag it with the
      // rider" step AND the refund pathway regardless of what the
      // seller wrote above.
      footerNote:
        "If your delivery arrives with damaged packaging, please make a note with the delivery provider so we can help resolve this from happening again. If for any reason our product does not reach you in the condition you expect, please contact us for a full refund or replacement.",
    });
  }

  if (content.isVenue && enabled("catering") && content.eventsBody) {
    items.push({
      id: "catering",
      icon: NEX_INFO_PAGE_META.catering.icon,
      label: NEX_INFO_PAGE_META.catering.label,
      body: content.eventsBody,
      // Founder direction 2026-09-30 · default event-type list for
      // every venue seller · lets buyers see at a glance what the
      // venue can host. Followed by the contact-to-discuss prompt as
      // the footer note.
      bullets: [
        "Birthdays",
        "Anniversaries",
        "Graduations",
        "Weddings",
      ],
      footerNote:
        "Please contact to discuss your requirements in detail.",
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

// ─── Weekly hours table (Hours panel) ────────────────────────────────

function HoursTable({ hours }: { hours: WeeklyHours }) {
  const rows: { key: keyof WeeklyHours; label: string }[] = [
    { key: "mon", label: "Monday" },
    { key: "tue", label: "Tuesday" },
    { key: "wed", label: "Wednesday" },
    { key: "thu", label: "Thursday" },
    { key: "fri", label: "Friday" },
    { key: "sat", label: "Saturday" },
    { key: "sun", label: "Sunday" },
  ];
  const now = new Date();
  // JS getDay: 0=Sun ... 6=Sat · map to our key order.
  const todayKey: keyof WeeklyHours = (
    ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const
  )[now.getDay()];

  return (
    <div
      style={{
        display: "grid",
        gap: 0,
        borderRadius: 12,
        border: "1px solid var(--nex-accent-soft, rgba(0,175,255,0.20))",
        overflow: "hidden",
      }}
    >
      {rows.map((r) => {
        const day = hours[r.key] ?? {};
        const isClosed =
          day.closed === true || !day.open || !day.close;
        const isToday = r.key === todayKey;
        return (
          <div
            key={r.key}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "10px 14px",
              background: isToday
                ? "var(--nex-accent-faint, rgba(0,175,255,0.10))"
                : "transparent",
              borderTop:
                "1px solid var(--nex-accent-soft, rgba(0,175,255,0.12))",
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: isToday ? 800 : 600,
                color: isToday
                  ? "var(--nex-accent)"
                  : "var(--nex-text, #F2F5F8)",
                letterSpacing: "0.01em",
              }}
            >
              {r.label}
              {isToday && (
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 9,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: "var(--nex-accent)",
                    fontWeight: 700,
                  }}
                >
                  Today
                </span>
              )}
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: isClosed
                  ? "var(--nex-text-dim, rgba(255,255,255,0.55))"
                  : isToday
                    ? "var(--nex-accent)"
                    : "var(--nex-text, #F2F5F8)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {isClosed ? "Closed" : `${day.open} – ${day.close}`}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Owner block (About Us header) ───────────────────────────────────

function OwnerBlock({
  block,
}: {
  block: NonNullable<TrayItem["ownerBlock"]>;
}) {
  const { yearEstablished, avatarUrl, name, position } = block;
  const hasAnyOwnerInfo = !!(avatarUrl || name || position);
  if (!hasAnyOwnerInfo && !yearEstablished) return null;
  return (
    <div
      style={{
        display: "grid",
        gap: 10,
        paddingBottom: 12,
        borderBottom:
          "1px solid var(--nex-accent-soft, rgba(0,175,255,0.18))",
      }}
    >
      {typeof yearEstablished === "number" && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            alignSelf: "flex-start",
            padding: "3px 10px",
            borderRadius: 999,
            background: "var(--nex-accent-faint, rgba(0,175,255,0.10))",
            border:
              "1px solid var(--nex-accent-soft, rgba(0,175,255,0.35))",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--nex-accent)",
          }}
        >
          Est. {yearEstablished}
        </div>
      )}
      {hasAnyOwnerInfo && (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {avatarUrl ? (
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                flexShrink: 0,
                backgroundImage: `url(${avatarUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center 30%",
                border:
                  "2px solid var(--nex-accent, #00AFFF)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
              }}
              aria-hidden
            />
          ) : (
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                flexShrink: 0,
                background: "var(--nex-accent-faint, rgba(0,175,255,0.10))",
                border:
                  "2px solid var(--nex-accent, #00AFFF)",
              }}
              aria-hidden
            />
          )}
          <div style={{ minWidth: 0 }}>
            {name && (
              <div
                style={{
                  fontFamily: "var(--nex-font-display)",
                  fontSize: 15,
                  fontWeight: 700,
                  letterSpacing: "-0.005em",
                  lineHeight: 1.2,
                }}
              >
                {name}
              </div>
            )}
            {position && (
              <div
                style={{
                  marginTop: 2,
                  fontSize: 11,
                  color: "var(--nex-accent)",
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                }}
              >
                {position}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
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
  // Founder direction 2026-09-30 (revised) · switched from motorbike
  // silhouette to a car · reads as the universal "delivery" symbol
  // internationally rather than region-specific (scooter reads as
  // Indonesia-only). Roofline + hood + two wheels + a couple of
  // window separators.
  return (
    <svg {...iconProps(size)}>
      <path d="M3 15l2-6a2 2 0 0 1 2-1h10a2 2 0 0 1 2 1l2 6" />
      <path d="M3 15v3h18v-3" />
      <path d="M3 15h18" />
      <circle cx="7" cy="18" r="1.6" />
      <circle cx="17" cy="18" r="1.6" />
      <line x1="10" y1="9" x2="10" y2="14" />
      <line x1="14" y1="9" x2="14" y2="14" />
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
