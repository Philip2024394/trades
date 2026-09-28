// src/app/nex-native/chat/_portrait-bloom-shell.tsx
//
// Portrait Bloom · shared chat surface shell for NEX-native.
// ----------------------------------------------------------
// The Founder-approved chat interface for both friend chats
// (/nex-native/chat/peer/[accountId]) and business chats
// (/nex-native/conversations/[conversationId]).
//
// Sealed 2026-09-27. Design language stays the same across both
// surfaces so identity + relationship + conversation reads
// consistently regardless of who the peer is. Only the data mapping
// differs (peer account vs business, avatar_url vs logo_url,
// profession vs product context, chat_theme accent vs cyan default,
// online-presence vs open-hours).
//
// The composer is delegated to `chat/peer/[accountId]/_composer.tsx`
// (PeerComposer) which is a headless client component that takes an
// `action` prop, so both surfaces bind their own Server Action.

import * as React from "react";
import { PeerComposer } from "./peer/[accountId]/_composer";
import { ScrollToBottomOnMount } from "./_scroll-to-bottom";
import { MessageBubbleClient } from "./_message-bubble-client";
import {
  SideNavPanel,
  type SideNavContact,
  type PendingInvite,
} from "./_side-nav-panel";
import { AmbientMotion } from "./_ambient-motion";
import { FirstConnectionEmpty } from "./_first-connection-empty";
import { ShopGridModal, type ShopProduct } from "./_shop-grid-modal";
import { ShopHeaderButton } from "./_shop-header-button";
import { ImageQrProbe } from "./_qr-image-scanner";
import { TradeAgreementCard } from "./_trade-agreement-card";

const NEX = {
  bg: "#020914",
  cyan: "#009FEF",
  cyanDeep: "#063B67",
  orange: "#FF7800",
  green: "#16D66B",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  glassBubble: "rgba(8,20,36,0.55)",
  // Same tone as the incoming-timestamp text so the bubble rim reads
  // as visually coherent with the caption it wraps.
  glassBorder: "rgba(139,169,209,0.55)",
};

/** Bridge 23a · Icon + label maps for menu-item perks · duplicated
 *  here (client boundary) so this shell doesn't need to import from
 *  the server-only menu-service. Keep in sync with
 *  NEX_MENU_PERK_ICONS/LABELS in src/lib/nex-native/menu-service.ts. */
const PERK_ICON_MAP: Record<string, string> = {
  bogo: "🎁",
  free_drink: "🥤",
  free_rice: "🍚",
  free_fries: "🍟",
  free_delivery: "🚚",
  other: "✨",
};
const PERK_LABEL_MAP: Record<string, string> = {
  bogo: "Buy 1 Get 1 Free",
  free_drink: "Free Drink",
  free_rice: "Free Rice",
  free_fries: "Free Fries",
  free_delivery: "Free Delivery",
  other: "Other Perk",
};

export type PortraitBloomPresenceKind = "online" | "offline" | "away";

export interface PortraitBloomMessage {
  id: string;
  body: string;
  sent_at: string;
  read_at: string | null;
  mine: boolean;
  /** Bridge 5 · when non-null this message quotes another. The
   *  shell renders a reply-quote header at the top of the bubble
   *  showing the quoted sender + preview snippet. */
  reply_to_id?: string | null;
  /** Cached preview data for the message being quoted · avoids the
   *  bubble having to join the message list. */
  reply_preview?: {
    body: string;
    /** true if the quoted message was from the viewer, false if it
     *  was the peer · lets the quote header show "You" vs peer name */
    mine: boolean;
  } | null;
  /** Bridge 6 · when true, the sender retracted this message. The
   *  bubble renders a "🚫 This message was deleted" placeholder in
   *  its slot instead of the body. */
  deleted_for_everyone?: boolean;
  /** Bridge 8+9+11 · optional attachment · photo, video, voice
   *  note, or a peer product card · rendered inline above the body. */
  attachment_url?: string | null;
  attachment_type?:
    | "image"
    | "video"
    | "audio"
    | "product"
    | "menu_item"
    | "cart_order"
    | null;
  /** Bridge 11 · when attachment_type='product' this carries the
   *  frozen product snapshot so the card renders correctly even if
   *  the underlying product is later edited or deleted. */
  attachment_product?: {
    product_id: string;
    business_id: string;
    business_slug: string | null;
    name: string;
    price_pence: number;
    currency: string;
    image_url: string | null;
    short_description: string | null;
  } | null;
  /** Bridge 15c · when attachment_type='menu_item' this carries the
   *  frozen dish snapshot so the card renders correctly even if the
   *  underlying dish is later edited, marked sold-out, or deleted. */
  attachment_menu_item?: {
    menu_item_id: string;
    business_id: string;
    business_slug: string | null;
    section_name: string | null;
    name: string;
    price_pence: number;
    currency: string;
    image_url: string | null;
    short_description: string | null;
    spice_level: number;
    dietary_tags: string[];
    portion_note: string | null;
    /** Bridge 23a · perk tokens · buyer bubble renders chips with
     *  Free Delivery highlighted. */
    perks?: string[];
    perks_note?: string | null;
  } | null;
  /** Bridge 22 · when attachment_type='cart_order' this carries the
   *  full cart snapshot · list of items + qty + variants + notes +
   *  subtotal. Rendered as MessageCartOrderCard in the bubble. */
  attachment_cart?: {
    shop_id: string;
    shop_slug: string | null;
    shop_display_name: string;
    items: Array<{
      kind: "product" | "menu_item";
      id: string;
      name: string;
      price_pence: number;
      currency: string;
      quantity: number;
      variants: string[];
      /** Bridge 23c-3 · perks frozen at add-time on this line. */
      perks?: string[];
      perks_note?: string | null;
      note: string | null;
      image_url: string | null;
    }>;
    buyer_notes: string | null;
    subtotal_pence: number;
    currency: string;
    item_count: number;
    /** Bridge 22c-2 · structured delivery address the buyer entered
     *  on the /cart page · null for legacy carts / carts sent before
     *  the field existed. */
    delivery_address?: {
      recipient_name: string;
      phone: string;
      street: string;
      street_2: string;
      city: string;
      region: string;
      postal_code: string;
      country: string;
      notes: string;
    } | null;
  } | null;
}

export interface PortraitBloomContextChip {
  label: string;
  sublabel?: string | null;
}

export interface PortraitBloomShellProps {
  /** Big name printed over the portrait fade zone. */
  displayName: string;
  /** Small caption under the name · profession for friends, business
   *  tagline for businesses, product name for a product-scoped chat.
   *  Null hides the row. */
  subtitle: string | null;
  /** Portrait behind the fade · avatar_url for friends, logo_url for
   *  businesses. Null falls back to a gradient with initials. */
  portraitUrl: string | null;
  /** Optional additional context chip rendered under the subtitle ·
   *  used for business chat to show "About <product>" price. */
  contextChip?: PortraitBloomContextChip | null;
  /** Presence state · drives portrait desaturation + status pip. */
  presenceKind: PortraitBloomPresenceKind;
  /** Small label above the name · presence-aware. "NEX · chatting
   *  with" / "Away · will see later" / "OPEN · here now" etc. */
  presenceLabel: string;
  /** Accent colour for the fresh-inbound ripple + portrait halo.
   *  Chat-theme accent for friends · NEX cyan default for businesses. */
  rippleColor: string;
  /** Bubble rim colour · optional override that lets themes paint
   *  message bubbles a DIFFERENT colour from the accent (see Rose ·
   *  blue bubbles + pink accent). Falls back to rippleColor. */
  bubbleRimColor?: string;
  /** Composer input rim colour · optional override for themes that
   *  want the composer to read as its own zone (see Rose · orange
   *  composer + pink accent). Falls back to rippleColor. */
  composerRimColor?: string;
  /** Href for the back navigation. Currently unused visually (no back
   *  button rendered) but retained so callers can keep supplying it
   *  and a future affordance can wire in without a prop refactor. */
  backHref: string;
  /** Full ordered message list (asc by sent_at). */
  messages: PortraitBloomMessage[];
  /** Server Action bound with the peer/conversation id. */
  composerAction: (formData: FormData) => Promise<never> | void | Promise<void>;
  /** Composer placeholder ("Message X…"). */
  composerPlaceholder: string;
  /** Data attribute for test/telemetry scoping. */
  scope: string;
  /** Optional badge · currently unused visually (header tag removed
   *  by Founder direction 2026-09-27). Callers may keep passing it. */
  headerTag?: string;
  /** Optional contacts list · when present, the header renders a
   *  home icon + 3-dot menu that opens a drawer showing these
   *  contacts. Omit on surfaces that shouldn't show contact
   *  switching (e.g. business chat for now). */
  contacts?: SideNavContact[];
  /** Pending incoming friend invites the viewer can accept or
   *  decline from the header drawer. Empty array (or omit) means
   *  no invites section renders. */
  pendingInvites?: PendingInvite[];
  /** Bridge 5 · reply state pass-through · when set, the composer
   *  shows a reply header and smuggles reply_to_id into the send
   *  form. Server-side resolved from ?reply=<id> in the URL. */
  replyTarget?: {
    id: string;
    body: string;
    mine: boolean;
    peerName: string;
    clearHref: string;
  } | null;
  /** Bridge 6 · Server Action bound with the peer id. When present,
   *  long-press on your own bubble (< 1 hour old) opens a confirm
   *  modal that submits this action with a hidden `message_id`.
   *  Omit on surfaces that don't yet support retract. */
  deleteAction?: (formData: FormData) => Promise<never> | void | Promise<void>;
  /** Bridge 8+9 · Server Action bound with peer id · takes a form
   *  with `attachment_file` and redirects back with the uploaded
   *  URL on the query string. Enables Camera / Video / Voice in the
   *  media modal. */
  uploadAction?: (
    formData: FormData,
  ) => Promise<never> | void | Promise<void>;
  /** Bridge 8+9 · pending attachment resolved from URL query state
   *  by the peer chat page · when set, the composer shows a preview
   *  thumbnail above the pill. */
  pendingAttachment?: {
    url: string;
    kind: "image" | "video" | "audio";
    clearHref: string;
  } | null;
  /** When present, the header renders a shop icon top-right that
   *  opens the peer's product grid bottom sheet. Populated by the
   *  peer chat page after fetching the peer's live products. */
  peerShop?: {
    name: string;
    href: string | null;
    products: ShopProduct[];
  } | null;
  /** Bridge 11 · Server Action bound with peerAccountId · fires when
   *  the user taps Ask about this / I want this on a product detail. */
  productInquiryAction?: (
    formData: FormData,
  ) => Promise<never> | void | Promise<void>;
  /** Bridge 17d · when set, a compact safe-trade status line renders
   *  at the top of the message stream. Binary based on the seller's
   *  safe_trade_activated flag. Only meaningful on commerce chats. */
  tradeAgreementSellerName?: string | null;
  tradeAgreementActivated?: boolean;
  /** Bridge 18 · when set, product-card bubbles show a heart icon
   *  that fires this bound action with hidden product_id to save
   *  the product to the viewer's /nex-native/liked list. */
  likeProductAction?: (
    productId: string,
    formData: FormData,
  ) => Promise<never> | void;
  /** Optional theme wallpaper · painted behind the message zone as
   *  a soft, dimmed layer so the theme picks up an atmosphere
   *  distinct from the peer's profile image. Sealed 2026-09-27 ·
   *  Founder direction: "the theme saves the background image, the
   *  profile image must be of the profile user". */
  wallpaperUrl?: string | null;
  /** Per-theme environmental overlay config from
   *  nex_chat_theme.wallpaper_config · currently drives the moon
   *  glow position + size + colour. When null, no overlay renders.
   *  Sealed 2026-09-27 · migration 056. */
  wallpaperConfig?: {
    moonGlow?: {
      x: string;
      y: string;
      size: number;
      color?: string;
    };
  } | null;
}

export function PortraitBloomShell({
  displayName,
  subtitle,
  portraitUrl,
  contextChip,
  presenceKind,
  presenceLabel,
  rippleColor,
  bubbleRimColor,
  composerRimColor,
  messages,
  composerAction,
  composerPlaceholder,
  scope,
  contacts,
  pendingInvites,
  replyTarget,
  deleteAction,
  wallpaperUrl,
  wallpaperConfig,
  uploadAction,
  pendingAttachment,
  peerShop,
  productInquiryAction,
  tradeAgreementSellerName,
  tradeAgreementActivated,
  likeProductAction,
}: PortraitBloomShellProps) {
  const isOffline = presenceKind !== "online";
  // Per-element theme colours · fall back to rippleColor (accent)
  // when the theme doesn't provide overrides.
  const bubbleRim = bubbleRimColor ?? rippleColor;
  const composerRim = composerRimColor ?? rippleColor;

  const lastMessage = messages[messages.length - 1];
  const now = Date.now();
  const lastAgeMs = lastMessage
    ? now - new Date(lastMessage.sent_at).getTime()
    : Number.POSITIVE_INFINITY;
  const showFreshRipple =
    !!lastMessage && !lastMessage.mine && lastAgeMs < 15_000;
  const rippleKey = showFreshRipple ? lastMessage!.id : "idle";

  return (
    <>
      <style>{`
        html, body {
          background: ${NEX.bg} !important;
          overflow: hidden;
          overscroll-behavior: none;
          /* Belt-and-braces horizontal lock · bubble swipe gestures
             translate up to 96px · without this a wide iPhone could
             show a hairline of horizontal scroll. */
          max-width: 100vw;
          overflow-x: hidden;
        }
        /* Presence heartbeat · a soft ring expands + fades out
           from the profile chip every 1.2s (~75 bpm) whenever the
           peer is online. Signals "here, right now" without shouting.
           Composited transform + opacity keep it cheap. */
        @keyframes nex-presence-heartbeat {
          0%   { transform: scale(1);    opacity: 0.55; }
          70%  { transform: scale(1.32); opacity: 0; }
          100% { transform: scale(1.32); opacity: 0; }
        }
        @keyframes nex-bloom-msg-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        [data-nex-bloom-msg] {
          animation: nex-bloom-msg-in 260ms cubic-bezier(.2,.7,.2,1) both;
        }
        @keyframes nex-portrait-breathe {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.025); }
        }
        [data-nex-bloom-portrait] {
          animation: nex-portrait-breathe 8s ease-in-out infinite;
          transform-origin: 50% 30%;
          transition: filter 900ms ease;
        }
        [data-nex-bloom-offline] {
          filter: grayscale(0.72) brightness(0.72) contrast(0.92);
        }
        @keyframes nex-bloom-ripple {
          0%   { opacity: 0.0; transform: translate(-50%, -50%) scale(0.6); }
          40%  { opacity: 0.55; }
          100% { opacity: 0;   transform: translate(-50%, -50%) scale(3.4); }
        }
        [data-nex-bloom-ripple-inner] {
          animation: nex-bloom-ripple 2600ms cubic-bezier(.2,.7,.2,1) both;
        }
        /* Scrollbar hidden + top-fade mask · bubbles dissolve into
           the header area on scroll instead of cutting hard. The
           first ~72px of the scroll region fades to transparent
           so nothing pops behind the identity block. Sealed
           2026-09-27. */
        [data-nex-message-scroll] {
          scrollbar-width: none;
          mask-image: linear-gradient(
            180deg,
            transparent 0px,
            rgba(0,0,0,0.15) 24px,
            rgba(0,0,0,0.55) 48px,
            #000 72px,
            #000 100%
          );
          -webkit-mask-image: linear-gradient(
            180deg,
            transparent 0px,
            rgba(0,0,0,0.15) 24px,
            rgba(0,0,0,0.55) 48px,
            #000 72px,
            #000 100%
          );
        }
        [data-nex-message-scroll]::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }
      `}</style>
      <main
        data-nex-bloom-scope={scope}
        style={{
          position: "fixed",
          inset: 0,
          // dvh accounts for mobile browser chrome (URL bar collapse/
          // expand) · pins the shell exactly to the visible viewport
          // so composer + name never slip off screen.
          height: "100dvh",
          background: NEX.bg,
          color: NEX.text,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Theme wallpaper · fills the whole chat surface (Founder
            direction 2026-09-27: hero portrait layer removed · theme1
            is the full background image). Bubbles + composer + header
            all sit over this layer. A subtle scrim keeps the reading
            zone legible without dulling the theme's colour. */}
        {wallpaperUrl && (
          <>
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: `url(${wallpaperUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
                filter: `saturate(1.05)${isOffline ? " grayscale(0.6)" : ""}`,
                zIndex: 0,
              }}
            />
            {/* Legibility scrim · a soft dark tint over the wallpaper
                so text + bubbles never fight the theme photograph. */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(180deg, rgba(2,9,20,0.55) 0%, rgba(2,9,20,0.35) 30%, rgba(2,9,20,0.55) 100%)",
                zIndex: 0,
              }}
            />
            {/* Ambient motion · crows + twinkles · only when a
                wallpaper is present so unthemed surfaces stay quiet.
                Sits at z-index 2 (above wallpaper + scrim, below
                header + bubbles). Theme accent painted as ambient
                tint so distant crows blend with the wallpaper's
                light instead of reading as flat stickers. Moon
                glow position comes from the theme's wallpaper_config
                (sealed 2026-09-27 · migration 056) so every theme
                declares its own overlay · no more hardcoded values. */}
            <AmbientMotion
              ambientTint={`${rippleColor}55`}
              moonGlow={wallpaperConfig?.moonGlow ?? null}
            />
          </>
        )}

        {/* Chat-theme ripple · flashes over the wallpaper when a
            fresh inbound arrives. */}
        <div
          key={rippleKey}
          aria-hidden
          style={{
            position: "absolute",
            top: "20vh",
            left: "50%",
            width: 0,
            height: 0,
            pointerEvents: "none",
            zIndex: 2,
          }}
        >
          {showFreshRipple && (
            <div
              data-nex-bloom-ripple-inner
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: 220,
                height: 220,
                borderRadius: "50%",
                background: `radial-gradient(circle, ${rippleColor}55 0%, ${rippleColor}22 45%, transparent 70%)`,
                mixBlendMode: "screen",
                transform: "translate(-50%, -50%) scale(0.6)",
              }}
            />
          )}
        </div>

        {/* Identity overlay · text sits directly on the theme
            wallpaper with a soft shadow for legibility. No bottom
            border line · bubbles dissolve into this zone via the
            scroll region's fade mask instead of cutting against a
            hairline. */}
        <div
          style={{
            position: "relative",
            zIndex: 3,
            flexShrink: 0,
            /* Right padding leaves room for the header shop button
               (40px round at right:12px) when the peer has a shop.
               Rail lives at 50% vertical, doesn't touch the header. */
            padding:
              "calc(env(safe-area-inset-top, 0) + 14px) 62px 12px 20px",
            textShadow: "0 2px 20px rgba(0,0,0,0.75)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            {/* Small round profile avatar · the peer's face lives
                here now that the hero portrait layer is gone. The
                theme wallpaper is the environment · this dot is the
                person. Presence colour lives on the ring. */}
            {/* Chip wrapper · outer container carries the heartbeat
                pulse ring (overflow:visible so it can expand past
                the chip's 42px). The inner chip keeps overflow:
                hidden so the avatar image stays circle-cropped. */}
            <div
              aria-label={presenceLabel}
              title={presenceLabel}
              style={{
                position: "relative",
                flexShrink: 0,
                width: 42,
                height: 42,
              }}
            >
              {/* Heartbeat pulse ring · sealed 2026-09-27. Renders
                  only when the peer is online · matches the presence
                  ring colour · expands + fades at ~75 bpm to signal
                  "here, right now". GPU-friendly (transform +
                  opacity, no box-shadow animation). */}
              {presenceKind === "online" && (
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    inset: -2,
                    borderRadius: "50%",
                    border: `2px solid ${NEX.green}`,
                    animation:
                      "nex-presence-heartbeat 1200ms cubic-bezier(0.4, 0, 0.2, 1) infinite",
                    pointerEvents: "none",
                    willChange: "transform, opacity",
                  }}
                />
              )}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  overflow: "hidden",
                  border: `2px solid ${
                    presenceKind === "online"
                      ? NEX.green
                      : presenceKind === "away"
                        ? "#F59E0B"
                        : "rgba(139,169,209,0.5)"
                  }`,
                  boxShadow:
                    presenceKind === "online"
                      ? `0 0 0 3px ${NEX.green}22, 0 4px 14px rgba(0,0,0,0.6)`
                      : "0 4px 14px rgba(0,0,0,0.6)",
                  backgroundImage: portraitUrl
                    ? `url(${portraitUrl})`
                    : `linear-gradient(135deg, ${NEX.cyanDeep} 0%, #05101f 100%)`,
                  backgroundSize: "cover",
                  backgroundPosition: "center 22%",
                  transition:
                    "border-color 500ms ease, box-shadow 500ms ease",
                }}
              >
                {!portraitUrl && (
                  <div
                    aria-hidden
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "grid",
                      placeItems: "center",
                      color: NEX.cyan,
                      fontSize: 15,
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      opacity: 0.9,
                    }}
                  >
                    {initialsFromName(displayName)}
                  </div>
                )}
              </div>
            </div>
            {/* Right column · name stacks over subtitle so
                "Footwear designer" sits directly under "Maria",
                not under the whole row. Sealed 2026-09-27. */}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  lineHeight: 1.1,
                  letterSpacing: "-0.005em",
                  minWidth: 0,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {displayName}
              </div>
              {subtitle && (
                <div
                  style={{
                    marginTop: 2,
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    // Dark gray · profession recedes from the name
                    // instead of competing with it in orange.
                    color: "#8B95A5",
                    // One line · no ellipsis · profession is short
                    // enough to always fit at 12px.
                    whiteSpace: "nowrap",
                  }}
                >
                  {subtitle}
                </div>
              )}
            </div>
          </div>
          {contextChip && (
            <div
              style={{
                marginTop: 6,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 10px",
                borderRadius: 999,
                background: "rgba(0,159,239,0.14)",
                border: "1px solid rgba(0,159,239,0.4)",
                color: NEX.text,
                fontSize: 11,
                letterSpacing: "0.02em",
                textShadow: "none",
              }}
            >
              <span style={{ opacity: 0.75, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase" }}>About</span>
              <span style={{ fontWeight: 600 }}>{contextChip.label}</span>
              {contextChip.sublabel && (
                <>
                  <span style={{ opacity: 0.5 }}>·</span>
                  <span>{contextChip.sublabel}</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Message list · the ONLY scrollable region on the surface.
            flex:1 + minHeight:0 lets it shrink below its natural
            content size so overflow-y: auto actually activates. The
            large paddingBottom reserves visual space for the
            absolute-positioned composer to float over · without
            reserving, the last message would slide behind it when
            auto-scrolled. Auto-scroll to bottom on load lives in
            _scroll-to-bottom.tsx (client component). */}
        <section
          data-nex-message-scroll
          style={{
            position: "relative",
            zIndex: 3,
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain",
            display: "flex",
            flexDirection: "column",
            // Right padding widened past the side-nav rail so
            // outgoing bubbles never slip behind the home/friends
            // icons pinned at right: 2px. Sealed 2026-09-28 · fix
            // for bubbles running under the rail.
            padding:
              "20px 52px calc(env(safe-area-inset-bottom, 0) + 118px) 20px",
          }}
        >
          <div
            style={{
              marginTop: "auto",
              display: "flex",
              flexDirection: "column",
              // Explicit per-message spacing replaces the flex gap ·
              // grouping rhythm is applied via marginTop on each item.
              gap: 0,
            }}
          >
            {tradeAgreementSellerName && (
              <TradeAgreementCard
                sellerName={tradeAgreementSellerName}
                activated={!!tradeAgreementActivated}
              />
            )}
            {messages.length === 0 ? (
              <FirstConnectionEmpty
                peerName={displayName}
                themeAccent={rippleColor}
              />
            ) : (
              messages.map((m, idx) => {
                const prev = messages[idx - 1];
                const senderChanged = !prev || prev.mine !== m.mine;
                const timeGapMs = prev
                  ? new Date(m.sent_at).getTime() -
                    new Date(prev.sent_at).getTime()
                  : Number.POSITIVE_INFINITY;
                const bigTimeGap = timeGapMs > 5 * 60_000;
                const isFirst = idx === 0;
                // Day divider · shows Today / Yesterday / short date
                // at the very top and whenever the day changes.
                // Never repeats a time — the bubble already carries
                // its own timestamp so a time-pill would be noise.
                const prevDay = prev
                  ? new Date(prev.sent_at).toDateString()
                  : null;
                const currDay = new Date(m.sent_at).toDateString();
                const dayChanged = prevDay !== null && prevDay !== currDay;
                const showDayDivider = isFirst || dayChanged;
                // Tighter grouping rhythm sealed 2026-09-27:
                // "we need close the space between the chat bubbles".
                //   · same sender consecutive · 2px (tight cluster)
                //   · sender change · 8px (breath, half the previous)
                //   · time gap > 5 min · 14px + centered day pill
                const marginTop = isFirst
                  ? 0
                  : bigTimeGap
                    ? 14
                    : senderChanged
                      ? 8
                      : 2;
                // Only show timestamp inside the bubble for the last
                // message in a same-sender group OR when there's a
                // big time gap coming after this message. Reduces
                // visual noise in a rapid burst.
                const next = messages[idx + 1];
                const nextSenderDiffers = !next || next.mine !== m.mine;
                const nextTimeGap = next
                  ? new Date(next.sent_at).getTime() -
                    new Date(m.sent_at).getTime() >
                    5 * 60_000
                  : true;
                const showTimestamp = nextSenderDiffers || nextTimeGap;
                return (
                  <React.Fragment key={m.id}>
                    {showDayDivider && (
                      <div
                        style={{
                          alignSelf: "center",
                          padding: "5px 14px",
                          margin: isFirst ? "0 0 8px" : "10px 0 6px",
                          borderRadius: 999,
                          // Solid dark pill · stays crisp against the
                          // top fade mask so Today / Yesterday remain
                          // readable even as the pill enters the
                          // fade-out zone at the top of the scroll.
                          background: "rgba(2,9,20,0.94)",
                          border: "1px solid rgba(139,169,209,0.28)",
                          color: "#F4F7FC",
                          fontSize: 10,
                          letterSpacing: "0.16em",
                          textTransform: "uppercase",
                          fontWeight: 800,
                          textShadow: "0 1px 3px rgba(0,0,0,0.6)",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.45)",
                        }}
                      >
                        {formatDayLabel(m.sent_at)}
                      </div>
                    )}
                    <MessageBubbleClient
                      messageId={m.id}
                      mine={m.mine}
                      sentAtMs={new Date(m.sent_at).getTime()}
                      deletedForEveryone={!!m.deleted_for_everyone}
                      deleteAction={deleteAction}
                    >
                    <div
                      data-nex-bloom-msg
                      data-nex-bloom-msg-mine={m.mine ? "true" : undefined}
                      data-nex-bloom-msg-deleted={
                        m.deleted_for_everyone ? "true" : undefined
                      }
                      data-nex-msg-id={m.id}
                      style={{
                        position: "relative",
                        padding: m.deleted_for_everyone
                          ? "9px 14px"
                          : showTimestamp
                            ? "11px 14px 9px"
                            : "10px 14px",
                        marginTop,
                        // Squarer corners with a tail corner near the
                        // sender · 14px main, 4px tail. Mine = tail
                        // bottom-right, theirs = tail bottom-left.
                        // Sealed 2026-09-27.
                        borderRadius: m.mine
                          ? "14px 14px 4px 14px"
                          : "14px 14px 14px 4px",
                        // Darker shaded glass · bubbles carry a
                        // distinctly dark tint so they read as their
                        // own containers over the portrait.
                        background: m.deleted_for_everyone
                          ? "rgba(20,26,38,0.48)"
                          : m.mine
                            ? "rgba(12,32,58,0.62)"
                            : NEX.glassBubble,
                        backdropFilter: "blur(24px) saturate(1.2)",
                        WebkitBackdropFilter: "blur(24px) saturate(1.2)",
                        // Outgoing bubble rim adopts the peer's
                        // theme bubble colour (Rose = blue) · sealed
                        // 2026-09-27. Incoming bubble rim stays a
                        // neutral frosted gray so the other person's
                        // messages read as content, not as another
                        // identity paint layer. Deleted bubbles wear a
                        // muted dashed rim so they read as tombstones.
                        border: m.deleted_for_everyone
                          ? "1px dashed rgba(139,169,209,0.35)"
                          : m.mine
                            ? `1px solid ${themeRimStrong(bubbleRim)}`
                            : "1px solid rgba(150,160,180,0.55)",
                        color: NEX.text,
                        fontSize: 15,
                        lineHeight: 1.42,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        boxShadow: m.deleted_for_everyone
                          ? "0 4px 14px rgba(0,0,0,0.4)"
                          : m.mine
                            ? "0 0 14px rgba(0,159,239,0.25), 0 6px 20px rgba(0,0,0,0.45)"
                            : "0 6px 22px rgba(0,0,0,0.55)",
                      }}
                    >
                      {/* Sender header · avatar top-left + name to
                          the right · shown only on the first
                          incoming bubble of a same-sender group so
                          the avatar doesn't repeat on every
                          continuation message. Reuses displayName +
                          portraitUrl since in 1:1 chat those are
                          always the peer's identity. */}
                      {!m.mine && !m.deleted_for_everyone && senderChanged && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            marginBottom: 6,
                          }}
                        >
                          <div
                            style={{
                              flexShrink: 0,
                              width: 22,
                              height: 22,
                              borderRadius: "50%",
                              overflow: "hidden",
                              backgroundImage: portraitUrl
                                ? `url(${portraitUrl})`
                                : `linear-gradient(135deg, ${NEX.cyanDeep} 0%, #05101f 100%)`,
                              backgroundSize: "cover",
                              backgroundPosition: "center 22%",
                              border: "1px solid rgba(255,255,255,0.15)",
                              position: "relative",
                            }}
                            aria-hidden
                          >
                            {!portraitUrl && (
                              <div
                                style={{
                                  position: "absolute",
                                  inset: 0,
                                  display: "grid",
                                  placeItems: "center",
                                  fontSize: 9,
                                  fontWeight: 700,
                                  color: NEX.cyan,
                                  letterSpacing: "0.06em",
                                }}
                              >
                                {initialsFromName(displayName)}
                              </div>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: bubbleRim,
                              letterSpacing: "0.02em",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              minWidth: 0,
                            }}
                          >
                            {displayName}
                          </div>
                        </div>
                      )}
                      {/* Bridge 6 · retracted message placeholder ·
                          shows in the sender's OR the recipient's
                          bubble slot so the space is preserved but
                          no content leaks. Reply quotes + timestamps
                          are suppressed for deleted messages so the
                          tombstone reads as a single quiet line. */}
                      {m.deleted_for_everyone ? (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            color: "rgba(139,169,209,0.75)",
                            fontStyle: "italic",
                            fontSize: 13,
                          }}
                        >
                          <span aria-hidden style={{ fontSize: 14 }}>🚫</span>
                          <span>
                            {m.mine
                              ? "You deleted this message"
                              : "This message was deleted"}
                          </span>
                        </div>
                      ) : (
                        <>
                      {/* Bridge 5 · reply quote header · rendered at
                          the top of the bubble when this message
                          quotes another. Coloured vertical stripe +
                          sender label + snippet. */}
                      {m.reply_preview && (
                        <div
                          style={{
                            marginBottom: 6,
                            padding: "5px 10px 5px 12px",
                            borderRadius: 10,
                            background: "rgba(0,0,0,0.28)",
                            borderLeft: `3px solid ${bubbleRim}`,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              letterSpacing: "0.08em",
                              textTransform: "uppercase",
                              color: bubbleRim,
                              marginBottom: 1,
                            }}
                          >
                            {m.reply_preview.mine ? "You" : displayName}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: "rgba(244,247,252,0.72)",
                              lineHeight: 1.35,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              maxWidth: 260,
                            }}
                          >
                            {m.reply_preview.body}
                          </div>
                        </div>
                      )}
                      {/* Bridge 8+9+11 · inline attachment · media
                          (image/video/audio) uses MessageAttachment ·
                          product cards get their own richer renderer
                          via MessageProductCard so the price + name
                          + shop context reads as commerce not media. */}
                      {m.attachment_type === "product" && m.attachment_product ? (
                        <MessageProductCard
                          product={m.attachment_product}
                          hasBody={!!m.body}
                          accent={bubbleRim}
                          likeAction={
                            likeProductAction
                              ? likeProductAction.bind(
                                  null,
                                  m.attachment_product.product_id,
                                )
                              : undefined
                          }
                        />
                      ) : m.attachment_type === "menu_item" &&
                        m.attachment_menu_item ? (
                        <MessageMenuItemCard
                          item={m.attachment_menu_item}
                          hasBody={!!m.body}
                          accent={bubbleRim}
                        />
                      ) : m.attachment_type === "cart_order" &&
                        m.attachment_cart ? (
                        <MessageCartOrderCard
                          cart={m.attachment_cart}
                          hasBody={!!m.body}
                          accent={bubbleRim}
                        />
                      ) : m.attachment_url &&
                        (m.attachment_type === "image" ||
                          m.attachment_type === "video" ||
                          m.attachment_type === "audio") ? (
                        <MessageAttachment
                          url={m.attachment_url}
                          kind={m.attachment_type}
                          hasBody={!!m.body}
                        />
                      ) : null}
                      {m.body && (
                        <div
                          style={{
                            // Free legibility insurance for edge cases
                            // (bright portrait zones + light text).
                            textShadow: "0 1px 3px rgba(0,0,0,0.35)",
                          }}
                        >
                          {m.body}
                        </div>
                      )}
                      {showTimestamp && (
                        <div
                          style={{
                            marginTop: 4,
                            fontSize: 10,
                            color: m.mine
                              ? "rgba(255,255,255,0.75)"
                              : "rgba(139,169,209,0.85)",
                            textAlign: "right",
                            letterSpacing: "0.02em",
                          }}
                        >
                          {formatTime(m.sent_at)}
                          {m.mine && (
                            <span
                              style={{
                                marginLeft: 5,
                                color: m.read_at
                                  ? "#C4E5FF"
                                  : "rgba(255,255,255,0.6)",
                              }}
                            >
                              {m.read_at ? "✓✓" : "✓"}
                            </span>
                          )}
                        </div>
                      )}
                        </>
                      )}
                    </div>
                    </MessageBubbleClient>
                    {/* Bridge 16b · payment-request warning · fires
                        when a bubble body contains bank/account/wallet
                        keywords. Sits just below the offending bubble
                        so the buyer sees the warning in context. */}
                    {!m.deleted_for_everyone &&
                      detectPaymentRequestInBody(m.body ?? "") && (
                        <PaymentRequestWarning mine={m.mine} />
                      )}
                    {/* Bridge 16d · QR-code payment-image warning ·
                        client-side jsQR decode of the image bytes ·
                        flags Indonesian QRIS / wallet / bank payloads. */}
                    {!m.deleted_for_everyone &&
                      m.attachment_type === "image" &&
                      m.attachment_url && (
                        <ImageQrProbe
                          imageUrl={m.attachment_url}
                          mine={m.mine}
                        />
                      )}
                  </React.Fragment>
                );
              })
            )}
          </div>
        </section>

        {/* Composer · absolutely positioned at the bottom so it
            floats over the message list · bubbles scroll freely
            behind it (transparent background, no black panel). */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 4,
            padding:
              "10px 16px calc(env(safe-area-inset-bottom, 0) + 10px)",
            background: "transparent",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              maxWidth: 480,
              margin: "0 auto",
              // Re-enable pointer events on the composer itself · the
              // wrapping padding area passes clicks through to bubbles
              // scrolling behind.
              pointerEvents: "auto",
            }}
          >
            <PeerComposer
              action={composerAction}
              placeholder={composerPlaceholder}
              themeAccent={composerRim}
              replyTarget={replyTarget ?? null}
              uploadAction={uploadAction}
              pendingAttachment={pendingAttachment ?? null}
            />
          </div>
        </div>
        <ScrollToBottomOnMount signal={messages.length} />
      </main>
      {contacts && (
        <SideNavPanel
          contacts={contacts}
          pendingInvites={pendingInvites ?? []}
        />
      )}
      {peerShop && (
        <ShopHeaderButton
          shopName={peerShop.name}
          shopHref={peerShop.href}
          products={peerShop.products}
          peerName={displayName}
          inquiryAction={productInquiryAction}
        />
      )}
    </>
  );
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.charAt(0) ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

/** Peer-theme accent at high alpha for the outgoing bubble rim.
 *  Accepts the hex passed as rippleColor and forces it to 0.85 alpha
 *  regardless of source format · sealed 2026-09-27. */
function themeRimStrong(hex: string): string {
  const rgb = hexToRgb(hex);
  return `rgba(${rgb.r},${rgb.g},${rgb.b},0.85)`;
}

/** Peer-theme accent at low alpha for the incoming bubble rim ·
 *  softer so the two bubble kinds still read as slightly different
 *  weight even though they share a theme colour. */
function themeRimSoft(hex: string): string {
  const rgb = hexToRgb(hex);
  return `rgba(${rgb.r},${rgb.g},${rgb.b},0.5)`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace(/^#/, "");
  const full =
    clean.length === 3
      ? clean.split("").map((c) => c + c).join("")
      : clean;
  const num = parseInt(full, 16);
  return {
    r: (num >> 16) & 0xff,
    g: (num >> 8) & 0xff,
    b: num & 0xff,
  };
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Format a message's date as a day divider label.
 *   · Same calendar day as now → "Today"
 *   · One day earlier → "Yesterday"
 *   · Same week (< 7 days ago) → weekday name (Mon / Tue / ...)
 *   · Older → short date (Sep 24)
 *  Uses local time so the boundary matches what the user sees on
 *  the timestamps inside each bubble. */
function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((today.getTime() - target.getTime()) / dayMs);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1 && diffDays < 7) {
    return d.toLocaleDateString(undefined, { weekday: "long" });
  }
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

/** Bridge 8+9 · inline attachment renderer for a bubble.
 *   · image · <img> · click opens the original in a new tab
 *   · video · <video controls> with a poster fallback via the same file
 *   · audio · <audio controls> · voice-note bar
 *  Rounded to match the bubble corners · caps at bubble maxWidth so
 *  media never blows the layout. */
function MessageAttachment({
  url,
  kind,
  hasBody,
}: {
  url: string;
  kind: "image" | "video" | "audio";
  hasBody: boolean;
}) {
  const rounding = 12;
  const marginBottom = hasBody ? 8 : 0;
  if (kind === "image") {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open photo in a new tab"
        style={{
          display: "block",
          marginBottom,
          borderRadius: rounding,
          overflow: "hidden",
          maxWidth: "100%",
          background: "rgba(0,0,0,0.35)",
          textDecoration: "none",
        }}
      >
        <img
          src={url}
          alt="Photo"
          style={{
            display: "block",
            width: "100%",
            maxHeight: 320,
            objectFit: "cover",
          }}
        />
      </a>
    );
  }
  if (kind === "video") {
    return (
      <div style={{ marginBottom, borderRadius: rounding, overflow: "hidden" }}>
        <video
          src={url}
          controls
          playsInline
          preload="metadata"
          style={{
            display: "block",
            width: "100%",
            maxHeight: 320,
            background: "#000",
            borderRadius: rounding,
          }}
        />
      </div>
    );
  }
  // audio
  return (
    <div style={{ marginBottom, padding: "6px 4px" }}>
      <audio
        src={url}
        controls
        preload="metadata"
        style={{ width: "100%", height: 36 }}
      />
    </div>
  );
}

/** Bridge 11 · product card renderer inside a bubble.
 *  Compact card with the product image, name, price, and a subtle
 *  "See in shop →" affordance that links to the peer's public shop
 *  page. Bridge 12 will make the whole card tap-to-reopen the
 *  product detail sheet directly. */
function MessageProductCard({
  product,
  hasBody,
  accent,
  likeAction,
}: {
  product: {
    product_id: string;
    business_id: string;
    business_slug: string | null;
    name: string;
    price_pence: number;
    currency: string;
    image_url: string | null;
    short_description: string | null;
  };
  hasBody: boolean;
  accent: string;
  /** Bridge 18 · when set, a heart icon appears on the card image
   *  top-right · submitting the form adds the product to the
   *  viewer's /nex-native/liked list. */
  likeAction?: (formData: FormData) => Promise<never> | void;
}) {
  const marginBottom = hasBody ? 8 : 0;
  const price = formatBubblePrice(product.price_pence, product.currency);
  const href = product.business_slug
    ? `/nex-native/${product.business_slug}`
    : null;
  // Bridge 22b · shop domain removed from the eyebrow per Founder
  // direction · the card lives inside the bubble already, we don't
  // need a second identity line.
  // Bridge 19b · card structure kept · anchor covers, heart sits
  // above, but Bridge 22b removes the outer background + border so
  // the card blends into the bubble (no double-nested chrome).
  const shared: React.CSSProperties = {
    position: "relative",
    display: "block",
    width: "100%",
    boxSizing: "border-box",
    marginBottom,
    borderRadius: 12,
    overflow: "hidden",
    background: "transparent",
    border: "none",
    color: "inherit",
  };
  const cardBody = (
    <>
      {product.image_url && (
        <div
          style={{
            width: "100%",
            aspectRatio: "16 / 9",
            background: "#0a1a30",
            overflow: "hidden",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.image_url}
            alt={product.name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        </div>
      )}
      <div style={{ padding: "8px 2px 4px" }}>
        {/* Bridge 22b · minimal eyebrow · no shop-domain clutter ·
            the card is contained by the outer bubble already, we
            don't need a second frame. */}
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            lineHeight: 1.3,
            marginBottom: 3,
          }}
        >
          {product.name}
        </div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 800,
            color: "#FF7800",
            marginBottom: href ? 4 : 0,
          }}
        >
          {price}
        </div>
        {href && (
          <div
            style={{
              fontSize: 10,
              color: "rgba(139,169,209,0.85)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontWeight: 700,
            }}
          >
            See in shop
          </div>
        )}
      </div>
    </>
  );
  const heartForm = likeAction ? (
    <form
      action={likeAction}
      style={{
        position: "absolute",
        top: 8,
        right: 8,
        margin: 0,
        zIndex: 3,
      }}
    >
      <input type="hidden" name="intent" value="like" />
      <input type="hidden" name="product_id" value={product.product_id} />
      <button
        type="submit"
        aria-label="Save to liked items"
        title="Save to Liked"
        style={{
          width: 32,
          height: 32,
          borderRadius: 999,
          background: "rgba(2,9,20,0.85)",
          border: "1px solid rgba(255,51,85,0.55)",
          color: "#FF7A85",
          fontSize: 15,
          lineHeight: 1,
          cursor: "pointer",
          fontFamily: "inherit",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          boxShadow: "0 4px 10px rgba(0,0,0,0.5)",
        }}
      >
        ♥
      </button>
    </form>
  ) : null;
  return (
    <div style={shared}>
      {href ? (
        <a
          href={href}
          aria-label={`Open ${product.name} in shop`}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1,
            textDecoration: "none",
            color: "inherit",
          }}
        />
      ) : null}
      <div style={{ position: "relative", zIndex: 2, pointerEvents: "none" }}>
        {cardBody}
      </div>
      {heartForm}
    </div>
  );
}

function MessageMenuItemCard({
  item,
  hasBody,
  accent,
}: {
  item: {
    menu_item_id: string;
    business_id: string;
    business_slug: string | null;
    section_name: string | null;
    name: string;
    price_pence: number;
    currency: string;
    image_url: string | null;
    short_description: string | null;
    spice_level: number;
    dietary_tags: string[];
    portion_note: string | null;
    perks?: string[];
    perks_note?: string | null;
  };
  hasBody: boolean;
  accent: string;
}) {
  const marginBottom = hasBody ? 8 : 0;
  const price = formatBubblePrice(item.price_pence, item.currency);
  const href = item.business_slug
    ? `/nex-native/${item.business_slug}/menu`
    : null;
  const spiceChilies = item.spice_level > 0 ? "🌶".repeat(item.spice_level) : null;
  const inner = (
    <>
      {item.image_url && (
        <div
          style={{
            width: "100%",
            aspectRatio: "16 / 9",
            background: "#0a1a30",
            overflow: "hidden",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.image_url}
            alt={item.name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        </div>
      )}
      <div style={{ padding: "8px 10px 10px" }}>
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: accent,
            fontWeight: 700,
            marginBottom: 2,
          }}
        >
          {item.section_name ? `Menu · ${item.section_name}` : "Menu"}
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            lineHeight: 1.3,
            marginBottom: 4,
          }}
        >
          {item.name}
        </div>
        {item.perks?.includes("free_delivery") && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              marginBottom: 6,
              padding: "3px 9px",
              borderRadius: 999,
              background: "linear-gradient(180deg, #22c55e 0%, #16a34a 100%)",
              color: "#08170D",
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              boxShadow: "0 4px 12px rgba(22,214,107,0.30)",
            }}
          >
            🚚 Free Delivery
          </div>
        )}
        {(spiceChilies ||
          item.dietary_tags.length > 0 ||
          item.portion_note ||
          (item.perks?.length ?? 0) > 0) && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 4,
              marginBottom: 6,
            }}
          >
            {spiceChilies && (
              <span
                style={{
                  fontSize: 9,
                  padding: "2px 6px",
                  borderRadius: 999,
                  background: "rgba(255,90,60,0.14)",
                  color: "#FF9A80",
                  letterSpacing: "0.02em",
                }}
              >
                {spiceChilies}
              </span>
            )}
            {item.dietary_tags.slice(0, 3).map((t) => (
              <span
                key={t}
                style={{
                  fontSize: 9,
                  padding: "2px 6px",
                  borderRadius: 999,
                  background: "rgba(22,214,107,0.14)",
                  color: "#4EE38A",
                  letterSpacing: "0.02em",
                }}
              >
                {t}
              </span>
            ))}
            {(item.perks ?? [])
              .filter((p) => p !== "free_delivery")
              .slice(0, 3)
              .map((perk) => (
                <span
                  key={perk}
                  style={{
                    fontSize: 9,
                    padding: "2px 6px",
                    borderRadius: 999,
                    background: "rgba(22,214,107,0.10)",
                    color: "#B8F1CC",
                    letterSpacing: "0.02em",
                  }}
                >
                  {PERK_ICON_MAP[perk] ?? "✨"}{" "}
                  {perk === "other" && item.perks_note
                    ? item.perks_note
                    : PERK_LABEL_MAP[perk] ?? perk}
                </span>
              ))}
            {item.portion_note && (
              <span
                style={{
                  fontSize: 9,
                  padding: "2px 6px",
                  borderRadius: 999,
                  background: "rgba(139,169,209,0.10)",
                  color: "rgba(244,247,252,0.75)",
                  letterSpacing: "0.02em",
                }}
              >
                🍽 {item.portion_note}
              </span>
            )}
          </div>
        )}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#FF7800",
            }}
          >
            {price}
          </div>
          {href && (
            <span
              style={{
                fontSize: 10,
                color: "rgba(139,169,209,0.85)",
                letterSpacing: "0.04em",
              }}
            >
              See on menu →
            </span>
          )}
        </div>
      </div>
    </>
  );
  const shared: React.CSSProperties = {
    // Product/menu card fills the bubble width exactly · no minWidth
    // forcing the bubble to grow, no maxWidth capping. Sealed
    // 2026-09-28 · Bridge 17f · fix for shared product bubble
    // escaping its container on narrow viewports.
    display: "block",
    width: "100%",
    boxSizing: "border-box",
    marginBottom,
    borderRadius: 12,
    overflow: "hidden",
    background: "rgba(0,0,0,0.42)",
    border: `1px solid ${accent}55`,
    color: "inherit",
    textDecoration: "none",
  };
  if (href) {
    return (
      <a href={href} style={shared}>
        {inner}
      </a>
    );
  }
  return <div style={shared}>{inner}</div>;
}

function MessageCartOrderCard({
  cart,
  hasBody,
  accent,
}: {
  cart: NonNullable<PortraitBloomMessage["attachment_cart"]>;
  hasBody: boolean;
  accent: string;
}) {
  const marginBottom = hasBody ? 8 : 0;
  const subtotal = formatBubblePrice(cart.subtotal_pence, cart.currency);
  const href = cart.shop_slug ? `/nex-native/${cart.shop_slug}` : null;
  return (
    <div
      style={{
        display: "block",
        width: "100%",
        boxSizing: "border-box",
        marginBottom,
        borderRadius: 14,
        overflow: "hidden",
        background: "rgba(0,0,0,0.42)",
        border: `1px solid ${accent}55`,
      }}
    >
      {/* Header · shop identity + order badge */}
      <div
        style={{
          padding: "10px 12px",
          borderBottom: `1px solid rgba(139,169,209,0.15)`,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 9,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: accent,
            fontWeight: 800,
            padding: "3px 8px",
            borderRadius: 999,
            background: `${accent}20`,
          }}
        >
          🛒 Order
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "-0.003em",
            color: "#F4F7FC",
            minWidth: 0,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            flex: 1,
          }}
        >
          {cart.shop_display_name}
        </span>
      </div>
      {/* Items · one line each */}
      <div style={{ padding: "8px 10px" }}>
        {cart.items.map((it, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr auto",
              gap: 8,
              alignItems: "flex-start",
              padding: "6px 0",
              borderBottom:
                i < cart.items.length - 1
                  ? "1px solid rgba(139,169,209,0.10)"
                  : "none",
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: "#FF7800",
                paddingTop: 1,
                minWidth: 20,
              }}
            >
              {it.quantity}×
            </span>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#F4F7FC",
                  lineHeight: 1.3,
                }}
              >
                {it.name}
              </div>
              {it.variants.length > 0 && (
                <div
                  style={{
                    fontSize: 10,
                    color: "rgba(139,169,209,0.85)",
                    lineHeight: 1.35,
                    marginTop: 1,
                  }}
                >
                  {it.variants.join(" · ")}
                </div>
              )}
              {(it.perks ?? []).length > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 4,
                    marginTop: 3,
                  }}
                >
                  {(it.perks ?? []).map((perk) => (
                    <span
                      key={perk}
                      style={{
                        fontSize: 9,
                        padding: "1px 6px",
                        borderRadius: 999,
                        background:
                          perk === "free_delivery"
                            ? "linear-gradient(180deg, #22c55e 0%, #16a34a 100%)"
                            : "rgba(22,214,107,0.12)",
                        color:
                          perk === "free_delivery" ? "#08170D" : "#B8F1CC",
                        fontWeight: perk === "free_delivery" ? 800 : 700,
                        letterSpacing: "0.03em",
                      }}
                    >
                      {PERK_ICON_MAP[perk] ?? "✨"}{" "}
                      {perk === "other" && it.perks_note
                        ? it.perks_note
                        : PERK_LABEL_MAP[perk] ?? perk}
                    </span>
                  ))}
                </div>
              )}
              {it.note && (
                <div
                  style={{
                    fontSize: 10,
                    color: "#FFC96B",
                    lineHeight: 1.35,
                    marginTop: 2,
                    fontStyle: "italic",
                  }}
                >
                  “{it.note}”
                </div>
              )}
            </div>
            <span
              style={{
                fontSize: 11,
                color: "rgba(244,247,252,0.75)",
                whiteSpace: "nowrap",
                paddingTop: 1,
              }}
            >
              {formatBubblePrice(
                it.price_pence * it.quantity,
                it.currency,
              )}
            </span>
          </div>
        ))}
      </div>
      {/* Buyer note block */}
      {cart.buyer_notes && (
        <div
          style={{
            margin: "0 10px 8px",
            padding: "8px 10px",
            borderRadius: 10,
            background: "rgba(255,201,107,0.10)",
            border: "1px solid rgba(245,158,11,0.30)",
            fontSize: 11,
            lineHeight: 1.5,
            color: "#FFE1A8",
          }}
        >
          <span
            style={{
              fontSize: 9,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 800,
              color: "#FFC96B",
              marginRight: 6,
            }}
          >
            Note
          </span>
          {cart.buyer_notes}
        </div>
      )}
      {/* Bridge 22c-2 · structured delivery address block · rendered
          as a copy-friendly panel so sellers can paste straight into a
          courier booking screen. */}
      {cart.delivery_address && (
        <div
          style={{
            margin: "0 10px 8px",
            padding: "8px 10px",
            borderRadius: 10,
            background: "rgba(0,175,255,0.08)",
            border: `1px solid ${accent}44`,
            fontSize: 11,
            lineHeight: 1.55,
            color: "#F4F7FC",
          }}
        >
          <div
            style={{
              fontSize: 9,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 800,
              color: accent,
              marginBottom: 4,
            }}
          >
            📦 Deliver to
          </div>
          <div style={{ fontWeight: 700 }}>
            {cart.delivery_address.recipient_name}
          </div>
          {cart.delivery_address.phone && (
            <div style={{ color: "rgba(244,247,252,0.85)" }}>
              ☎ {cart.delivery_address.phone}
            </div>
          )}
          <div style={{ color: "rgba(244,247,252,0.85)" }}>
            {cart.delivery_address.street}
          </div>
          {cart.delivery_address.street_2 && (
            <div style={{ color: "rgba(244,247,252,0.85)" }}>
              {cart.delivery_address.street_2}
            </div>
          )}
          <div style={{ color: "rgba(244,247,252,0.85)" }}>
            {[
              cart.delivery_address.city,
              cart.delivery_address.region,
              cart.delivery_address.postal_code,
            ]
              .filter(Boolean)
              .join(", ")}
          </div>
          {cart.delivery_address.country && (
            <div style={{ color: "rgba(244,247,252,0.85)" }}>
              {cart.delivery_address.country}
            </div>
          )}
          {cart.delivery_address.notes && (
            <div
              style={{
                marginTop: 4,
                color: "#FFE1A8",
                fontStyle: "italic",
              }}
            >
              &ldquo;{cart.delivery_address.notes}&rdquo;
            </div>
          )}
        </div>
      )}
      {/* Subtotal + shop link */}
      <div
        style={{
          padding: "8px 12px 10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          background: "rgba(0,0,0,0.30)",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 9,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "rgba(139,169,209,0.85)",
              fontWeight: 800,
            }}
          >
            Subtotal · {cart.item_count} item{cart.item_count === 1 ? "" : "s"}
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: "#FF7800",
              marginTop: 1,
            }}
          >
            {subtotal}
          </div>
        </div>
        {href && (
          <a
            href={href}
            style={{
              fontSize: 9,
              letterSpacing: "0.10em",
              textTransform: "uppercase",
              color: "rgba(139,169,209,0.85)",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            See shop →
          </a>
        )}
      </div>
    </div>
  );
}

function formatBubblePrice(pence: number, currency: string): string {
  const majors = Math.round(pence / 100);
  const withCommas = majors.toLocaleString();
  if (currency === "IDR") return `Rp ${withCommas}`;
  if (currency === "GBP") return `£${(pence / 100).toFixed(2)}`;
  if (currency === "USD") return `$${(pence / 100).toFixed(2)}`;
  return `${currency} ${withCommas}`;
}

/** Bridge 16b · heuristic detector for "seller is asking for direct
 *  payment before delivery". Runs client-side on every bubble body ·
 *  when true the shell renders a red warning bubble below.
 *
 *  Signals we flag:
 *    · Indonesian bank name in the body (BCA, Mandiri, BRI, BNI, CIMB,
 *      Permata, Danamon, Panin, Maybank, Sinarmas)
 *    · The word "rekening" or "nomor rekening" (Bahasa Indonesia
 *      for bank account / account number)
 *    · Indonesian e-wallet names (GoPay, OVO, DANA, ShopeePay,
 *      LinkAja) paired with a numeric string
 *    · A plausible bank account number: 10-16 consecutive digits
 *      NOT looking like a phone number (starts 0812/0813/etc)
 *
 *  Deliberately biased towards false positives · we would rather
 *  warn twice than miss once. Buyers can still send whatever they
 *  want · the warning is educational, not a block. */
function detectPaymentRequestInBody(body: string): boolean {
  if (!body || body.length < 3) return false;
  const b = body.toLowerCase();

  // Bank names
  const bankNames = [
    "bca",
    "mandiri",
    "bri",
    "bni",
    "cimb",
    "permata",
    "danamon",
    "panin",
    "maybank",
    "sinarmas",
    "ocbc",
    "btpn",
    "jenius",
  ];
  for (const name of bankNames) {
    // Match as a standalone word · avoids "brief" matching "bri".
    const re = new RegExp(`(^|[^a-z0-9])${name}([^a-z0-9]|$)`, "i");
    if (re.test(b)) return true;
  }

  // "rekening" / "nomor rekening" / "no rek" / "no. rek"
  if (/\brekening\b|\bno\.?\s*rek(ening)?\b/i.test(body)) return true;

  // E-wallets
  const wallets = ["gopay", "ovo", "dana", "shopeepay", "linkaja"];
  for (const w of wallets) {
    if (b.includes(w)) return true;
  }

  // Long numeric string that looks like a bank account (10-16 digits).
  // We skip strings that look like Indonesian mobile numbers (start
  // with 08, 62 8 or +62 8) since those show up in every chat.
  const numeric = body.match(/\b\d{10,16}\b/g);
  if (numeric) {
    for (const n of numeric) {
      const looksMobile =
        n.startsWith("08") ||
        n.startsWith("628") ||
        n.startsWith("6208") ||
        n.startsWith("+628");
      if (!looksMobile) return true;
    }
  }

  return false;
}

function PaymentRequestWarning({ mine }: { mine: boolean }) {
  return (
    <div
      style={{
        margin: "6px 0 12px",
        display: "flex",
        justifyContent: mine ? "flex-end" : "flex-start",
      }}
    >
      <div
        style={{
          maxWidth: 320,
          padding: "10px 12px",
          borderRadius: 12,
          background: "rgba(255,51,85,0.10)",
          border: "1px solid rgba(255,51,85,0.35)",
          color: "#FFB4C0",
          fontSize: 12,
          lineHeight: 1.5,
          boxShadow: "0 6px 14px rgba(0,0,0,0.35)",
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#FF7A85",
            fontWeight: 700,
            marginBottom: 4,
          }}
        >
          ⚠ Payment request detected
        </div>
        <div style={{ color: "rgba(255,255,255,0.9)" }}>
          Direct transfers before delivery are <b>not protected</b> by
          NEX. Ask for <b>COD</b> or <b>Escrow (Rekber)</b> instead ·{" "}
          <a
            href="/nex-native/safe-trade"
            target="_blank"
            rel="noopener"
            style={{
              color: "#FF7A85",
              textDecoration: "underline",
              textDecorationColor: "rgba(255,51,85,0.6)",
              textUnderlineOffset: 2,
            }}
          >
            learn how
          </a>
          .
        </div>
      </div>
    </div>
  );
}
