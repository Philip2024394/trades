"use client";

// src/app/nex-native/chat-standard/_universal-header-icons-overlay.tsx
//
// UNIVERSAL HEADER ICONS OVERLAY · sealed 2026-10-05 · R11b parity.
//
// Mounts the sealed R1 cluster (Home · Cart · Shop) on any legacy
// theme route without touching that theme's shell. Parallels
// UniversalChromeOverlay (R7 · lower-right 3-dots) and
// UniversalComposerFooter (R3 · pill composer) so every legacy
// production theme gets R1 / R3 / R7 from a single overlay family.
//
// Why this exists · R1 was sealed universal in the chrome doctrine
// (2026-10-05) but — unlike R3 and R7 — had no universal overlay
// implementation. Individual legacy themes carried their own
// hand-coded header right-clusters; motorbike / vitamins / cakes
// routes (served via PortraitBloomShell / HeaderRightCluster) gated
// Cart + Shop behind the NEX_COMMERCE_ENABLED flag, which left them
// shipping only Home. The doctrine was stronger than the
// implementation.
//
// Load-bearing architecture rules (sealed 2026-10-05):
//
//   1 · This overlay is the UNIVERSAL R1 implementation for legacy
//       theme routes. Standard Experience worlds carry R1 natively
//       (StandardHeaderActions inside _standard-experience.tsx) and
//       MUST NOT mount this overlay.
//   2 · Behaviour is universal · function first. Theme-specific
//       destinations go through props (`onShopClick`) · never
//       through theme-ID branches inside the overlay.
//   3 · The overlay suppresses native R1 clusters tagged with
//       `data-nex-native-r1-cluster`. The audit confirmed every
//       known native cluster is 100% R1 (no non-R1 controls
//       mixed in), so hiding the cluster is surgical, not blind.
//       Any future legacy theme that mixes R1 with unrelated
//       controls MUST split them so the suppression stays surgical.
//
// Props:
//   accent · optional CSS colour · defaults to NEX cyan
//   onShopClick · optional handler for the Shop icon · when omitted
//                 the Shop icon renders as a link to /nex-native/shop
//
// Positioning · fixed, top-right, respects safe-area-inset-top.
// zIndex 60 matches the UniversalChromeOverlay 3-dots.
//
// Icons self-contained · no engine dependency.

import * as React from "react";

const NEX_CYAN = "#00AFFF";
const NEX_HIGHLIGHT = "#F4F7FC";

export interface UniversalHeaderIconsOverlayProps {
  accent?: string;
  /** Optional handler for Shop. When supplied the Shop icon fires
   *  this callback (e.g. to open a theme-specific shop sheet).
   *  When omitted the icon renders as a link (see `shopHref`),
   *  preserving navigability without inventing per-theme behaviour.
   *  Precedence: onShopClick > shopHref > default href. */
  onShopClick?: () => void;
  /** Optional aria-pressed state for Shop. Signals open/closed when
   *  the host wires `onShopClick` to a toggle. */
  shopOpen?: boolean;
  /** Optional declarative Shop destination. When supplied (and
   *  `onShopClick` is NOT), the Shop icon navigates here instead of
   *  the default `/nex-native/shop`. Used by legacy themes whose
   *  pre-overlay Shop target was a specific destination (e.g.
   *  theme-1 → /nex-native/maria). Preserving existing destinations
   *  prevents the universalisation from silently changing behaviour. */
  shopHref?: string;
}

export function UniversalHeaderIconsOverlay({
  accent = NEX_CYAN,
  onShopClick,
  shopOpen,
  shopHref,
}: UniversalHeaderIconsOverlayProps): React.JSX.Element {
  const circle: React.CSSProperties = {
    width: 32,
    height: 32,
    borderRadius: 999,
    border: `1px solid ${accent}99`,
    background: `${accent}22`,
    color: NEX_HIGHLIGHT,
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
    flexShrink: 0,
    padding: 0,
    textDecoration: "none",
    transition: "background 160ms ease-out, border-color 160ms ease-out",
  };
  const activeShop: React.CSSProperties = {
    ...circle,
    background: `${accent}aa`,
    border: `1px solid ${accent}`,
  };
  return (
    <>
      {/* SEALED RULE 2026-10-05 · R11b · "one R1 implementation per
          production theme" · the overlay is the single source of truth
          for the header right-cluster on every legacy theme. Native
          clusters tagged with data-nex-native-r1-cluster are suppressed
          while this overlay is mounted. The audit confirmed every such
          cluster is 100% R1, so hiding is surgical. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            [data-nex-native-r1-cluster] { display: none !important; }
          `,
        }}
      />
      <div
        data-nex-universal-header-icons
        style={{
          position: "fixed",
          top: "calc(env(safe-area-inset-top, 0) + 14px)",
          right: 12,
          zIndex: 60,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <a
          href="/nex-native/home"
          aria-label="Home"
          data-nex-universal-header-action="home"
          style={circle}
        >
          <HomeIcon />
        </a>
        <a
          href="/nex-native/cart"
          aria-label="Cart"
          data-nex-universal-header-action="cart"
          style={circle}
        >
          <CartIcon />
        </a>
        {onShopClick ? (
          <button
            type="button"
            aria-label={shopOpen ? "Close shop" : "Open shop"}
            aria-pressed={shopOpen ?? false}
            data-nex-universal-header-action="shop"
            data-nex-universal-shop-toggle={shopOpen ? "open" : "closed"}
            onClick={onShopClick}
            style={shopOpen ? activeShop : circle}
          >
            <ShopIcon />
          </button>
        ) : (
          <a
            href={shopHref ?? "/nex-native/shop"}
            aria-label="Shop"
            data-nex-universal-header-action="shop"
            data-nex-universal-shop-href={shopHref ?? "/nex-native/shop"}
            style={circle}
          >
            <ShopIcon />
          </a>
        )}
      </div>
    </>
  );
}

// ─── Icons · match the Standard Experience glyph vocabulary ─────────

function HomeIcon(): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden>
      <path d="M3 11 12 3l9 8" />
      <path d="M5 10v10h14V10" />
      <path d="M10 20v-6h4v6" />
    </svg>
  );
}

function CartIcon(): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden>
      <circle cx="9" cy="20" r="1.6" />
      <circle cx="17" cy="20" r="1.6" />
      <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.4a2 2 0 0 0 2-1.5L21 8H6" />
    </svg>
  );
}

function ShopIcon(): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden>
      <path d="M4 7h16l-1.2 11a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8z" />
      <path d="M8 7V5a4 4 0 0 1 8 0v2" />
    </svg>
  );
}
