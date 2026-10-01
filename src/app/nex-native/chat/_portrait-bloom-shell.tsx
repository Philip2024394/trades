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
import { ReadTick } from "./_read-tick";
import { ReactionsChipRow, BubbleTopRightReaction } from "./_reactions";
import {
  SideNavPanel,
  type SideNavContact,
  type PendingInvite,
} from "./_side-nav-panel";
import { FirstConnectionEmpty } from "./_first-connection-empty";
import {
  ShopGridModal,
  type ShopProduct,
  type ShopSection,
} from "./_shop-grid-modal";
import { HeaderRightCluster } from "./_header-right-cluster";
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
    | "product_share"
    | "sticker"
    | null;
  /** Bridge ThemeSticker · sealed 2026-10-01 · when attachment_type
   *  = 'sticker' this carries the frozen sticker snapshot so the
   *  bubble renders ~140px tall even if the sticker is later removed
   *  from the theme. image_url is the sticker artwork, aspect_ratio
   *  reserves the correct portrait/square footprint before load. */
  attachment_sticker?: {
    theme_id: string;
    slug: string;
    label: string;
    sticker_type: "static" | "animated";
    aspect_ratio: number;
  } | null;
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
    /** Bridge 25c · bike-delivery quote block. */
    delivery_quote?: {
      kind: "free" | "estimate" | "unknown";
      distance_km?: number;
      fare_pence?: number;
      currency?: "IDR";
      eta_minutes?: number;
      free_reason?: string | null;
    } | null;
    /** Bridge 49b-final · NEX Direct Price discount applied at
     *  cart-send time · seller sees exact tier + share breakdown. */
    direct_price?: {
      tier_pct: number;
      share_pct: number;
      applied_pct: number;
      capped_at_max: boolean;
      saving_pence: number;
      total_after_discount_pence: number;
    } | null;
  } | null;
  /** Bridge 49b · when attachment_type='product_share' this carries
   *  the frozen banner snapshot the sharer sent. Rendered as B4
   *  Swiss NEX Banner in the recipient's chat. */
  attachment_product_share?: {
    grant_id: string;
    business_id: string;
    business_name: string;
    business_slug: string;
    business_location: string | null;
    product_id: string;
    product_name: string;
    product_image_url: string | null;
    price_pence: number;
    currency: string;
    receiver_bonus_pct: number;
    expires_at: string;
    personal_note: string | null;
    open_href: string;
  } | null;
  /** Bridge 66 · reactions map · emoji → [account_id, ...]. Empty
   *  object when there are no reactions on this message. */
  reactions?: Record<string, string[]>;
  /** Bridge Reactions-Order · migration 117 · sealed 2026-10-01 ·
   *  emoji keys in insertion order · last entry is "newest" and
   *  renders as a big stamp overlapping the bubble corner. */
  reactions_order?: string[];
  /** Bridge 81 · when this row's attachment is E2E encrypted, the
   *  envelope from attachment_meta.envelope is projected here so the
   *  shell can render a placeholder + let _e2e-decryptor swap it for
   *  a blob URL after client-side decryption. Base64-encoded JSON to
   *  keep the DOM attribute compact + safe. */
  attachment_envelope_b64?: string | null;
  /** Bridge 76 · when true, `body` is the sentinel '(encrypted)' and
   *  the encryption fields below carry the payload for client-side
   *  decrypt. */
  encrypted?: boolean;
  ciphertext_b64?: string | null;
  nonce_b64?: string | null;
  sender_public_key?: string | null;
  sender_device_id?: string | null;
  recipient_device_id?: string | null;
  sender_account_id?: string | null;
  message_group_id?: string | null;
}

export interface PortraitBloomContextChip {
  label: string;
  sublabel?: string | null;
}

export interface PortraitBloomShellProps {
  /** Big name printed over the portrait fade zone. */
  displayName: string;
  /** True when the peer is the NEX official support account (NEX1) ·
   *  renders a compact "NEX · Official" chip next to the display name.
   *  Bridge 32b · sealed 2026-09-28. */
  isOfficialPeer?: boolean;
  /** Bridge 34 · feed shape driven by the peer's theme catalog row ·
   *  nex_chat_theme.layout_style. Defaults to 'bubbles' (classic
   *  Portrait Bloom). Set to 'sky_cards' or 'timeline_ribbon' to
   *  render the theme-specific message row. */
  layoutStyle?: "bubbles" | "sky_cards" | "timeline_ribbon" | "terminal";
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
    /** Bridge 88 · true when this attachment came in through the
     *  encrypted-upload path · composer smuggles the flag into the
     *  send form so E2eComposerIntercept picks up the stashed key. */
    encrypted?: boolean;
  } | null;
  /** Bridge 88 · when true, media-capture routes files through the
   *  client-side encrypted upload path. Skip for NEX1 (support). */
  encryptedUploadEnabled?: boolean;
  /** Bridge ThemeEmoji-B · sealed 2026-10-01 · per-theme emoji set
   *  from nex_theme_emoji (Migration 116). Threaded straight through
   *  to PeerComposer so its EmojiModal swaps to image tiles when the
   *  current theme has a custom set. */
  themeEmojis?:
    | { slug: string; imageUrl: string; label: string }[]
    | null;
  /** Optional per-theme send-button artwork · passed straight through
   *  to PeerComposer's SendButton. When set, the orange disc + paper
   *  plane is replaced by this image (e.g. the Joker-theme Batman
   *  roundel). */
  themeSendButtonUrl?: string | null;
  /** Bridge ThemeSticker · sealed 2026-10-01 · per-theme sticker set
   *  from nex_theme_sticker (Migration 118). Threaded through to
   *  PeerComposer's EmojiModal so a theme with stickers exposes the
   *  dedicated Stickers tab. Stickers send via `sendStickerAction` as
   *  attachment_type='sticker' peer messages — never as emoji tokens. */
  themeStickers?:
    | {
        slug: string;
        imageUrl: string;
        label: string;
        stickerType: "static" | "animated";
        aspectRatio: number;
      }[]
    | null;
  /** Server Action to send a sticker peer message. Only wired through
   *  when `themeStickers` is non-empty · otherwise the Stickers tab is
   *  hidden. */
  sendStickerAction?: (formData: FormData) => Promise<void> | void;
  /** When present, the header renders a shop icon top-right that
   *  opens the peer's product grid bottom sheet. Populated by the
   *  peer chat page after fetching the peer's live products +
   *  (Bridge 51) menu items when the peer is a venue seller. */
  peerShop?: {
    name: string;
    href: string | null;
    products: ShopProduct[];
    /** Category Tabs sealed 2026-09-30 · the peer's one-word sections.
     *  Auto-detected by the loader: menu items → nex_menu_section,
     *  otherwise → nex_product_section. Optional · empty list hides the
     *  tab bar in ShopGridModal per doctrine. */
    sections?: ShopSection[];
    /** True when the peer's business_category is a venue (bakery /
     *  restaurant / cafe / bar / …). Threads through to the header
     *  icon (cutlery vs shop-bag) + slider labels (Menu vs Shop). */
    isVenue?: boolean;
    /** Shop identity fields required by the chat-native
     *  Add-to-cart + Send-in-chat CTAs inside the detail sheet. */
    context?: {
      shop_id: string;
      shop_slug: string | null;
      shop_owner_account_id: string;
      shop_display_name: string;
    };
  } | null;
  /** Server Action bound with peerAccountId · posts a cart_order
   *  peer message with the current shop's items · fires from the
   *  detail sheet's Send-in-chat CTA. */
  sendCartOrderAction?: (
    formData: FormData,
  ) => Promise<never> | void | Promise<void>;
  /** Bridge 11 · Server Action bound with peerAccountId · fires when
   *  the user taps Ask about this / I want this on a product detail
   *  (legacy fallback · superseded by chat-native CTAs above). */
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
  /** Bridge 66 · Server Action bound with peerAccountId · takes a
   *  form with `message_id` + `emoji` and toggles the caller's
   *  reaction on that message. When omitted, the reactions chip row
   *  + picker button are hidden (business/legacy chats). */
  toggleReactionAction?: (
    formData: FormData,
  ) => Promise<never> | void | Promise<void>;
  /** Self's nex_account.id · needed so the reactions chip row can
   *  highlight the emoji the viewer picked. Omit to hide reactions
   *  entirely (Bridge 66). */
  selfAccountId?: string;
  /** Optional theme wallpaper · painted behind the message zone as
   *  a soft, dimmed layer so the theme picks up an atmosphere
   *  distinct from the peer's profile image. Sealed 2026-09-27 ·
   *  Founder direction: "the theme saves the background image, the
   *  profile image must be of the profile user". */
  wallpaperUrl?: string | null;
  /** Per-theme environmental overlay config from
   *  nex_chat_theme.wallpaper_config · drives moonGlow (breathing
   *  halo) + particleDrift (soft particles floating up) + sparkle
   *  (twinkling stars). All optional · a theme opts into whichever
   *  overlays fit. When null, no overlay renders.
   *  Sealed 2026-09-27 · migration 056 · Bridge 97 added drift +
   *  sparkle for the 20-theme batch. */
  wallpaperConfig?: {
    moonGlow?: {
      x: string;
      y: string;
      size: number;
      color?: string;
    };
    particleDrift?: {
      color: string;
      count?: number;
      direction?: "up";
      size?: number;
      speedSeconds?: number;
    };
    sparkle?: {
      color: string;
      count?: number;
      size?: number;
      twinkleSeconds?: number;
    };
    /** Bridge Theme-0 · sealed 2026-09-30 · fog blobs that rise from
     *  below the composer up past the top of the chat. Matches the
     *  cover-side MistDrift so chat + cover render identically per
     *  the ONE NEX IDENTITY doctrine. */
    mistDrift?: {
      color?: string;
      count?: number;
      size?: number;
      blur?: number;
      speedSeconds?: number;
    };
    /** Bridge 97f · bubble-shape preset · classic (default), pill,
     *  square, outlined, gradient. See BubbleShape helper for the
     *  exact CSS per preset. */
    bubbleStyle?: {
      preset:
        | "classic"
        | "pill"
        | "square"
        | "outlined"
        | "gradient";
    };
  } | null;
  /** Bridge 97h · when true, HeaderRightCluster shows the Cart
   *  button even while NEX_COMMERCE_ENABLED is false. Only the
   *  theme viewer sets this so previews render the full 3-button
   *  cluster. Production peer chat leaves it unset. */
  forceShowCart?: boolean;
  /** Optional per-theme shop background image · threaded straight
   *  through to ShopGridModal via HeaderRightCluster. Resolved
   *  upstream from theme-assets.ts (e.g. Joker → alley wallpaper). */
  shopBackgroundImageUrl?: string | null;
  /** Shop-type chooser · when true, the Shop header icon opens the
   *  slider in first-time setup mode. Resolved upstream (viewer / peer-
   *  chat page) · typically based on whether the current user has a
   *  configured business yet. */
  showShopSetupChooser?: boolean;
  onSelectShopType?: (type: "products" | "food" | "affiliate") => void;
}

export function PortraitBloomShell({
  displayName,
  isOfficialPeer,
  layoutStyle = "bubbles",
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
  forceShowCart = false,
  shopBackgroundImageUrl,
  showShopSetupChooser,
  onSelectShopType,
  uploadAction,
  pendingAttachment,
  encryptedUploadEnabled,
  themeEmojis,
  themeSendButtonUrl,
  themeStickers,
  sendStickerAction,
  peerShop,
  sendCartOrderAction,
  productInquiryAction,
  tradeAgreementSellerName,
  tradeAgreementActivated,
  likeProductAction,
  toggleReactionAction,
  selfAccountId,
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

  // Send-flicker gate · sealed 2026-10-01 · the mount-time anchor
  // marks "we loaded a conversation at T". Any mine message whose
  // sent_at is NEWER than T is treated as a just-posted message and
  // gets the one-shot accent flicker on its leading edge. Historical
  // mine messages (sent before mount) never flicker, so the first
  // scroll never looks like fireworks.
  const mountAtRef = React.useRef<number>(0);
  React.useEffect(() => {
    mountAtRef.current = Date.now();
  }, []);

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
        /* Joker-specific lamp keyframes retired 2026-10-01 · founder
           preferred the universal heartbeat ping for every theme ·
           Joker now reuses nex-presence-heartbeat above with an
           acid-green border override at the call site. */
        /* Smoke-drift keyframes retired 2026-10-01 · founder reverted
           to the static fog floor · the drifting layers read as too
           much visual noise over the composer. */
        @keyframes nex-bloom-msg-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        [data-nex-bloom-msg] {
          animation: nex-bloom-msg-in 260ms cubic-bezier(.2,.7,.2,1) both;
          position: relative;
        }
        /* Send flicker · sealed 2026-10-01 · outgoing bubble gets a
           2px accent-coloured leading-edge pulse for 0.6s when it was
           JUST posted (within ~2s of mount). The accent is injected
           per-chat via --nex-send-flicker so every theme pulses in its
           own colour (Joker · acid green · Night Sky · blue · etc.).
           Scarce, electric, one moment per interaction. */
        @keyframes nex-bloom-send-flicker {
          0%   { opacity: 0;    transform: scaleY(0.5); }
          15%  { opacity: 1;    transform: scaleY(1); }
          55%  { opacity: 0.85; transform: scaleY(1); }
          100% { opacity: 0;    transform: scaleY(1); }
        }
        [data-nex-bloom-msg-fresh="true"]::before {
          content: "";
          position: absolute;
          top: 2px;
          bottom: 2px;
          right: -1px;
          width: 2px;
          border-radius: 2px;
          background: var(--nex-send-flicker, #00AFFF);
          box-shadow:
            0 0 10px var(--nex-send-flicker, #00AFFF),
            0 0 4px var(--nex-send-flicker, #00AFFF);
          animation: nex-bloom-send-flicker 600ms cubic-bezier(.2,.7,.2,1) both;
          animation-delay: 60ms;
          pointer-events: none;
          transform-origin: center;
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
           the underside of the header rim rather than fading well
           into the message area. Tight 32px band hugging the top so
           the disappear point sits right under the header edge. */
        [data-nex-message-scroll] {
          scrollbar-width: none;
          mask-image: linear-gradient(
            180deg,
            transparent 0px,
            rgba(0,0,0,0.2) 10px,
            rgba(0,0,0,0.65) 22px,
            #000 32px,
            #000 100%
          );
          -webkit-mask-image: linear-gradient(
            180deg,
            transparent 0px,
            rgba(0,0,0,0.2) 10px,
            rgba(0,0,0,0.65) 22px,
            #000 32px,
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
          // Theme-accent CSS variable · read by send-flicker + any
          // other scarce accent moment that needs the per-theme hex
          // without threading it through every component tree.
          ["--nex-send-flicker" as unknown as string]: rippleColor,
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
            {/* Legibility scrim · sealed 2026-10-01 · flipped from a
                uniform three-point darkening to a "clear up top, fog
                settles toward the floor" gradient. The alley / sky
                / wallpaper now reads crisply through the upper two-
                thirds; darkness builds progressively from ~65% down
                so the scrim naturally meets the composer fog floor
                (which handles the final 96px). Message legibility is
                covered by proto #05 TV-broadcast text shadows on
                bubble bodies, so the top can stay almost fully
                transparent without hurting readability. */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(180deg, rgba(2,9,20,0.08) 0%, rgba(2,9,20,0.14) 40%, rgba(2,9,20,0.32) 70%, rgba(2,9,20,0.6) 95%, rgba(2,9,20,0.78) 100%)",
                zIndex: 0,
              }}
            />
            {/* Bridge 97 · two lightweight ambient overlays keyed off
                the theme's wallpaper_config. Both render only when the
                theme opts in · both use pointer-events: none so they
                never intercept taps on the message zone above them. */}
            {wallpaperConfig?.particleDrift && (
              <ParticleDrift config={wallpaperConfig.particleDrift} />
            )}
            {wallpaperConfig?.sparkle && (
              <SparkleField config={wallpaperConfig.sparkle} />
            )}
            {wallpaperConfig?.mistDrift && (
              <MistDrift config={wallpaperConfig.mistDrift} />
            )}
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
              {/* Presence ring · sealed 2026-09-27 · reverted 2026-10-01.
                  Earlier Joker-specific lamp animation (steps + glow
                  flicker, then smooth breathe) felt either broken or
                  flat vs. the expand+fade ping. Founder preferred the
                  heartbeat ping on every theme · we just override the
                  border colour so Joker's ping lands in acid green and
                  non-Joker themes keep the default NEX green. */}
              {presenceKind === "online" && (
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    inset: -2,
                    borderRadius: "50%",
                    border: `2px solid ${
                      rippleColor === "#8FFF6E" ? "#8FFF6E" : NEX.green
                    }`,
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
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    // Sealed 2026-10-01 · header name reads as
                    // "cinematic identity" instead of "metadata."
                    // Bumped from 22→26, pushed to full white, and
                    // picks up a soft text-shadow so it holds against
                    // the busy alley wallpaper without needing a bar
                    // or background chip underneath it.
                    fontSize: 26,
                    fontWeight: 700,
                    lineHeight: 1.1,
                    letterSpacing: "-0.01em",
                    color: "#FFFFFF",
                    textShadow: "0 1px 3px rgba(0,0,0,0.65)",
                    minWidth: 0,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    flexShrink: 1,
                  }}
                >
                  {displayName}
                </div>
                {isOfficialPeer && (
                  <span
                    aria-label="Official NEX support account"
                    title="Official NEX · verified"
                    style={{
                      flexShrink: 0,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "3px 8px",
                      borderRadius: 999,
                      background: NEX.cyan,
                      color: "#0B0F1A",
                      fontSize: 9,
                      fontWeight: 800,
                      letterSpacing: "0.10em",
                      textTransform: "uppercase",
                      lineHeight: 1,
                    }}
                  >
                    <svg
                      width="9"
                      height="9"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={3.4}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M5 12 L10 17 L20 6" />
                    </svg>
                    NEX
                  </span>
                )}
              </div>
              {subtitle && (
                <div
                  style={{
                    marginTop: 2,
                    // Sealed 2026-10-01 · proto #05 · TV-broadcast
                    // legibility · brighter neutral gray + dual
                    // shadow so the role under the header name holds
                    // against the alley wallpaper and matches the
                    // caption treatment used everywhere else (shop
                    // chooser cards, animation panel cards).
                    fontSize: 13,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    color: "#B4BAC3",
                    textShadow:
                      "0 0 2px rgba(0,0,0,0.9), 0 1px 2px rgba(0,0,0,0.5)",
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
            // Sealed 2026-10-01 · side-nav rail retired, so the
            // right padding drops back to 20px (symmetric with the
            // left). Outgoing bubbles now use the full width of the
            // chat surface — no more "ghost rail" eating 32px.
            padding:
              "20px 20px calc(env(safe-area-inset-bottom, 0) + 118px) 20px",
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
                      data-nex-bloom-msg-fresh={
                        m.mine &&
                        new Date(m.sent_at).getTime() > mountAtRef.current
                          ? "true"
                          : undefined
                      }
                      data-nex-bloom-msg-deleted={
                        m.deleted_for_everyone ? "true" : undefined
                      }
                      data-nex-bloom-msg-layout={layoutStyle}
                      data-nex-msg-id={m.id}
                      /* Bridge 76 · encryption payload for client-side
                         decrypt. Read by _e2e-decryptor.tsx which
                         replaces the body text on hydration. */
                      data-nex-msg-encrypted={m.encrypted ? "true" : undefined}
                      data-nex-msg-ct={m.ciphertext_b64 ?? undefined}
                      data-nex-msg-nonce={m.nonce_b64 ?? undefined}
                      data-nex-msg-sender-pub={m.sender_public_key ?? undefined}
                      data-nex-msg-sender-dev={m.sender_device_id ?? undefined}
                      data-nex-msg-sender-acc={m.sender_account_id ?? undefined}
                      data-nex-msg-recipient-dev={m.recipient_device_id ?? undefined}
                      /* Bridge 77 · sent_at so the decryptor can persist
                         the plaintext into IndexedDB with the right
                         timestamp (survives Bridge 78 server purge). */
                      data-nex-msg-sent-at={m.sent_at}
                      style={(() => {
                        // Sticker-only bubble · sealed 2026-10-01 ·
                        // the sticker IS the bubble · drop all chrome
                        // (padding, background, border, blur) so the
                        // artwork reads edge-to-edge. Timestamp is
                        // overlaid on the sticker at top-right.
                        const isStickerOnly =
                          m.attachment_type === "sticker" &&
                          m.attachment_url &&
                          !m.body &&
                          !m.deleted_for_everyone;
                        const base: React.CSSProperties = {
                          position: "relative",
                          padding: m.deleted_for_everyone
                            ? "9px 14px"
                            : showTimestamp
                              ? "11px 14px 9px"
                              : "10px 14px",
                          marginTop,
                          color: NEX.text,
                          fontSize: 15,
                          lineHeight: 1.42,
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        };
                        if (isStickerOnly) {
                          return {
                            ...base,
                            padding: 0,
                            background: "transparent",
                            border: "none",
                            borderRadius: 14,
                            boxShadow: "none",
                            overflow: "hidden",
                          };
                        }
                        return {
                          ...base,
                        // Bridge 97f · bubble geometry + background +
                        // border resolved from the theme's
                        // wallpaperConfig.bubbleStyle preset. Falls
                        // back to the classic Bloom shape when the
                        // theme has no preset. Deleted bubbles wear
                        // the same tombstone treatment regardless of
                        // preset so retracted messages are always
                        // recognisable across themes.
                        ...resolveBubbleShape({
                          preset: wallpaperConfig?.bubbleStyle?.preset ?? "classic",
                          mine: m.mine,
                          deleted: !!m.deleted_for_everyone,
                          bubbleRim,
                          accentGlassMine: "rgba(12,32,58,0.62)",
                          accentGlassPeer: NEX.glassBubble,
                        }),
                        backdropFilter: "blur(24px) saturate(1.2)",
                        WebkitBackdropFilter: "blur(24px) saturate(1.2)",
                        boxShadow: m.deleted_for_everyone
                          ? "0 4px 14px rgba(0,0,0,0.4)"
                          : m.mine
                            ? "0 0 14px rgba(0,159,239,0.25), 0 6px 20px rgba(0,0,0,0.45)"
                            : "0 6px 22px rgba(0,0,0,0.55)",
                        };
                      })()}
                    >
                      {/* Bridge Reactions-Order · Founder direction
                          2026-10-01 · newest reaction renders INSIDE
                          the bubble at top-right · no frame · just the
                          glyph/image · absolute-positioned relative to
                          this bubble content div. */}
                      {toggleReactionAction && selfAccountId && (() => {
                        const order =
                          m.reactions_order && m.reactions_order.length > 0
                            ? m.reactions_order
                            : Object.keys(m.reactions ?? {});
                        const live = order.filter((e) => {
                          const ids = m.reactions?.[e];
                          return Array.isArray(ids) && ids.length > 0;
                        });
                        const newest = live[live.length - 1];
                        if (!newest) return null;
                        const ids = m.reactions?.[newest] ?? [];
                        return (
                          <BubbleTopRightReaction
                            messageId={m.id}
                            emoji={newest}
                            count={ids.length}
                            selfSelected={ids.includes(selfAccountId)}
                            toggleAction={toggleReactionAction}
                            themeEmojis={themeEmojis ?? null}
                          />
                        );
                      })()}
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
                              // Sealed 2026-10-01 · sized to sit at the
                              // same height as the stacked name +
                              // subtitle, dialled back 10% from the
                              // initial 34px so it anchors the identity
                              // row without dominating the bubble.
                              width: 31,
                              height: 31,
                              borderRadius: "50%",
                              overflow: "hidden",
                              backgroundImage: portraitUrl
                                ? `url(${portraitUrl})`
                                : `linear-gradient(135deg, ${NEX.cyanDeep} 0%, #05101f 100%)`,
                              backgroundSize: "cover",
                              backgroundPosition: "center 22%",
                              // Sealed 2026-10-01 · bubble avatars get
                              // a thin STATIC theme-accent hairline so
                              // the per-message face ties back to the
                              // theme palette without animating (no
                              // ping — pings only live on the header
                              // portrait so the scarcity rule holds).
                              border: (() => {
                                const r = hexToRgb(rippleColor);
                                return `1px solid rgba(${r.r},${r.g},${r.b},0.6)`;
                              })(),
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
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: NEX.cyan,
                                  letterSpacing: "0.04em",
                                }}
                              >
                                {initialsFromName(displayName)}
                              </div>
                            )}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 1,
                              minWidth: 0,
                            }}
                          >
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                // Sealed 2026-10-01 · bubble sender
                                // name reads in the theme accent
                                // (acid green on Joker) · the subtitle
                                // (skill / profession) below reads in
                                // muted gray so identity + role are
                                // instantly scannable without the two
                                // competing.
                                color: rippleColor,
                                letterSpacing: "0.02em",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                textShadow:
                                  "0 1px 2px rgba(0,0,0,0.5)",
                              }}
                            >
                              {displayName}
                            </div>
                            {subtitle && (
                              <div
                                style={{
                                  fontSize: 10,
                                  fontWeight: 500,
                                  color: "#8B95A5",
                                  letterSpacing: "0.04em",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {subtitle}
                              </div>
                            )}
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
                      ) : m.attachment_type === "product_share" &&
                        m.attachment_product_share ? (
                        <MessageProductShareBanner
                          share={m.attachment_product_share}
                          hasBody={!!m.body}
                        />
                      ) : m.attachment_type === "sticker" &&
                        m.attachment_url &&
                        m.attachment_sticker ? (
                        /* Bridge ThemeSticker · sealed 2026-10-01 ·
                           sticker fills the full bubble (height AND
                           width per founder direction) · timestamp
                           overlays top-right of the artwork · the
                           bubble wrapper above already dropped all
                           chrome for sticker-only messages. */
                        <div
                          style={{
                            position: "relative",
                            width: "100%",
                            aspectRatio: m.attachment_sticker.aspect_ratio,
                            display: "block",
                            marginTop: m.body ? 6 : 0,
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={m.attachment_url}
                            alt={
                              m.attachment_sticker.label ||
                              m.attachment_sticker.slug
                            }
                            style={{
                              display: "block",
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                              pointerEvents: "none",
                              borderRadius: m.body ? 10 : 14,
                            }}
                          />
                          {/* BOTTOM-right timestamp pill · sealed
                              2026-10-01 · moved from top-right so it
                              never fights the top-right reaction
                              stamp (BubbleTopRightReaction). Reactions
                              own the top-right quadrant · time + tick
                              own the bottom-right. */}
                          {!m.body && (
                            <div
                              style={{
                                position: "absolute",
                                bottom: 8,
                                right: 10,
                                padding: "3px 9px",
                                borderRadius: 999,
                                background: "rgba(0,0,0,0.55)",
                                color: "rgba(244,247,252,0.95)",
                                fontSize: 10,
                                fontWeight: 600,
                                letterSpacing: "0.03em",
                                backdropFilter: "blur(6px)",
                                WebkitBackdropFilter: "blur(6px)",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                pointerEvents: "none",
                              }}
                            >
                              {formatTime(m.sent_at)}
                              {m.mine && (
                                <ReadTick
                                  sentAtIso={m.sent_at}
                                  readAtIso={m.read_at ?? null}
                                  messageId={m.id}
                                  themeAccent={rippleColor}
                                />
                              )}
                            </div>
                          )}
                        </div>
                      ) : m.attachment_envelope_b64 &&
                        (m.attachment_type === "image" ||
                          m.attachment_type === "video" ||
                          m.attachment_type === "audio") ? (
                        /* Bridge 81 · encrypted attachment placeholder ·
                           _e2e-decryptor reads the envelope, decrypts
                           the ciphertext, and swaps this placeholder for
                           the actual media element with a blob URL. */
                        <div
                          data-nex-encrypted-attach={m.attachment_envelope_b64}
                          data-nex-encrypted-attach-kind={m.attachment_type}
                          data-nex-encrypted-attach-sender={m.sender_account_id ?? undefined}
                          style={{
                            width: "100%",
                            aspectRatio: m.attachment_type === "audio" ? "5 / 1" : "3 / 2",
                            borderRadius: 12,
                            background: "linear-gradient(135deg, rgba(0,175,255,0.08), rgba(4,20,36,0.55))",
                            border: "1px solid rgba(0,175,255,0.25)",
                            display: "grid",
                            placeItems: "center",
                            marginBottom: m.body ? 6 : 0,
                            fontSize: 12,
                            color: "rgba(139,169,209,0.75)",
                            letterSpacing: "0.06em",
                            fontWeight: 600,
                          }}
                        >
                          🔒 Decrypting…
                        </div>
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
                      {m.body && (() => {
                        // Jumbo emoji auto-sizing · sealed 2026-10-01.
                        // When a message body is ONLY emoji glyphs
                        // (optionally with whitespace) we scale the
                        // text up to the WhatsApp/iMessage sizes so
                        // the emoji carries its own weight.
                        //   1 glyph  → 48px
                        //   2 glyphs → 40px
                        //   3-5      → 32px
                        //   6+       → 22px
                        //   any text letters alongside → normal 15px.
                        const jumboSize = computeJumboEmojiSize(m.body);
                        return (
                          <div
                            /* Bridge 76 · marker so the decryptor can
                               replace the '(encrypted)' sentinel with
                               the plaintext once decryption succeeds. */
                            data-nex-msg-body={m.id}
                            style={{
                              fontSize: jumboSize ?? undefined,
                              lineHeight: jumboSize ? 1.15 : undefined,
                              // Sealed 2026-10-01 · proto #05 applied ·
                              // body text uses the muted neutral gray
                              // (#B4BAC3) with the dual TV-broadcast
                              // shadow so messages read as cinematic
                              // noir on the alley wallpaper · every
                              // letter carries its own dark edge for
                              // legibility against busy backdrops.
                              color: "#B4BAC3",
                              textShadow:
                                "0 0 2px rgba(0,0,0,0.9), 0 1px 2px rgba(0,0,0,0.5)",
                            }}
                          >
                            {m.body}
                          </div>
                        );
                      })()}
                      {showTimestamp &&
                        !(
                          m.attachment_type === "sticker" &&
                          m.attachment_url &&
                          !m.body
                        ) && (
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
                            <ReadTick
                              sentAtIso={m.sent_at}
                              readAtIso={m.read_at ?? null}
                              messageId={m.id}
                              themeAccent={rippleColor}
                            />
                          )}
                        </div>
                      )}
                        </>
                      )}
                    </div>
                    </MessageBubbleClient>
                    {/* Bridge 66 · reactions chip row · one pill per
                        emoji · tap to toggle · self's own picks get a
                        cyan rim. Only renders when the shell was given
                        the toggle action + selfAccountId (peer chats
                        only, business chats keep the old rendering). */}
                    {toggleReactionAction && selfAccountId && (
                      <ReactionsChipRow
                        messageId={m.id}
                        selfAccountId={selfAccountId}
                        reactions={m.reactions ?? {}}
                        reactionsOrder={m.reactions_order ?? []}
                        toggleAction={toggleReactionAction}
                        mine={m.mine}
                        themeEmojis={themeEmojis ?? null}
                      />
                    )}
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

        {/* Composer fog floor · sealed 2026-10-01 · a short dark
            gradient at the very bottom of the viewport that lives
            BEHIND the composer. Grounds the UI "in the environment"
            instead of floating on top of the wallpaper · reads as
            morning fog hugging the alley floor on Joker, as deep
            water edge on Night Sky, etc. Theme-neutral: the gradient
            is just dark, not accent-coloured. */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: "calc(env(safe-area-inset-bottom, 0) + 96px)",
            background:
              "linear-gradient(180deg, transparent 0%, rgba(2,9,20,0.35) 55%, rgba(2,9,20,0.78) 85%, rgba(2,9,20,0.92) 100%)",
            zIndex: 3,
            pointerEvents: "none",
          }}
        />
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
              themeAccent={
                // Sealed 2026-10-01 · Joker overrides the muted
                // dark-forest composer_rim_hex (Migration 121) with
                // the acid-green rippleColor so the footer carries a
                // thin visible green hairline. Other themes keep the
                // stored composer rim as-is.
                rippleColor === "#8FFF6E" ? rippleColor : composerRim
              }
              replyTarget={replyTarget ?? null}
              uploadAction={uploadAction}
              pendingAttachment={pendingAttachment ?? null}
              encryptedUploadEnabled={encryptedUploadEnabled}
              themeEmojis={themeEmojis}
              themeSendButtonUrl={themeSendButtonUrl}
              themeStickers={themeStickers ?? null}
              sendStickerAction={sendStickerAction}
            />
          </div>
        </div>
        <ScrollToBottomOnMount signal={messages.length} />
      </main>
      {/* Sealed 2026-10-01 · the right-rail SideNavPanel (Home +
          Contacts floating icons) is retired to give the chat surface
          the full viewport width. Home still lives in the top-right
          header cluster; Contacts gets reintroduced via a dedicated
          entry point in a later bridge (not a floating overlay).
          Keeping the `contacts` prop plumbed so nothing breaks
          upstream · it's just unused on the surface right now. */}
      {/* Bridge 53 · standard chat header right-cluster · Home + Shop
          /Menu (when peer has a business) + Cart · rendered on every
          chat surface using this shell. Home + Cart ALWAYS render even
          when the peer has no shop, so buyers can always exit to
          home + reach their cart from within any conversation. */}
      <HeaderRightCluster
        peerName={displayName}
        shop={
          peerShop
            ? {
                name: peerShop.name,
                href: peerShop.href,
                products: peerShop.products,
                sections: peerShop.sections ?? [],
                isVenue: peerShop.isVenue ?? false,
                context: peerShop.context,
              }
            : null
        }
        sendCartOrderAction={sendCartOrderAction}
        inquiryAction={productInquiryAction}
        forceShowCart={forceShowCart}
        shopBackgroundImageUrl={shopBackgroundImageUrl ?? null}
        showShopSetupChooser={showShopSetupChooser}
        onSelectShopType={onSelectShopType}
        themeAccent={rippleColor}
      />
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

/** Jumbo emoji sizing · returns the font-size (in px) a message body
 *  should render at when it contains ONLY emoji glyphs (plus optional
 *  whitespace), or `null` when the body has any text letters alongside
 *  (in which case the caller should use its default size).
 *
 *  Sealed 2026-10-01 · matches iOS/WhatsApp conventions:
 *    1 glyph  → 48px
 *    2 glyphs → 40px
 *    3-5      → 32px
 *    6+       → default size (null)
 *
 *  The glyph counter uses `Intl.Segmenter` where available so compound
 *  emoji (ZWJ sequences like 👨‍👩‍👧 or 👍🏽) count as one grapheme,
 *  falling back to a code-point counter in older runtimes. */
function computeJumboEmojiSize(body: string): number | null {
  const stripped = body.replace(/\s+/g, "");
  if (!stripped) return null;
  // Reject any letter / digit · the string must be pure symbol glyphs
  // to qualify. \p{L} covers all alphabetic scripts; \p{N} covers all
  // numerals. If either shows up we fall through to normal text.
  if (/[\p{L}\p{N}]/u.test(stripped)) return null;
  // Reject any `:slug:` theme-emoji token · they currently render as
  // raw text in the bubble body and jumbo-sizing them would make the
  // colons huge too. (A future bridge that swaps tokens for inline
  // images can revisit this.)
  if (/:[a-z0-9][a-z0-9_-]{0,60}:/.test(stripped)) return null;
  // Count graphemes · the correct unit for emoji ZWJ sequences.
  let count = 0;
  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    for (const _ of seg.segment(stripped)) count++;
    if (count === 0) return null;
  } else {
    // Fallback: code-point count (over-counts ZWJ sequences but still
    // caps correctly at the 6+ threshold).
    count = Array.from(stripped).length;
    if (count === 0) return null;
  }
  if (count === 1) return 48;
  if (count === 2) return 40;
  if (count <= 5) return 32;
  return null;
}

function formatTime(iso: string): string {
  // Pinned to en-GB · 24-hour · no locale drift between server SSR
  // (system locale) and client hydration (browser locale). Fixes a
  // hydration mismatch surfaced by the theme viewer (Bridge 97g)
  // and any chat surface where the Node process locale differs from
  // the visitor's browser locale (e.g. id-ID server → en-US client).
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
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

/** Bridge 49b · B4 Swiss NEX Banner · rendered when a peer sends a
 *  product_share attachment. Landscape · shop identity · product name
 *  + price · personal note · huge typographic reward · "Open · claim
 *  reward" CTA that deep-links to the buyer-facing D6 view with the
 *  grant hydrated. Matches the sealed B4 design from
 *  /nex-native/shop-prototypes/direct-price/share-banner. */
function MessageProductShareBanner({
  share,
  hasBody,
}: {
  share: {
    grant_id: string;
    business_id: string;
    business_name: string;
    business_slug: string;
    business_location: string | null;
    product_id: string;
    product_name: string;
    product_image_url: string | null;
    price_pence: number;
    currency: string;
    receiver_bonus_pct: number;
    expires_at: string;
    personal_note: string | null;
    open_href: string;
  };
  hasBody: boolean;
}) {
  const priceLabel = formatPriceForShare(share.price_pence, share.currency);
  const hoursLeft = Math.max(
    0,
    Math.round((new Date(share.expires_at).getTime() - Date.now()) / (60 * 60 * 1000)),
  );
  const expiryLabel =
    hoursLeft <= 0 ? "expired" : hoursLeft < 1 ? "<1 hr" : `${hoursLeft}hr window`;
  return (
    <div
      data-nex-product-share-banner
      style={{
        margin: hasBody ? "-2px -6px 8px" : "-2px -6px 2px",
        borderRadius: 12,
        overflow: "hidden",
        background: "#020914",
        border: "1px solid rgba(0,175,255,0.35)",
        boxShadow: "0 6px 16px rgba(0,0,0,0.45)",
      }}
    >
      {/* Top row · landscape image + Bauhaus product headline */}
      <div style={{ display: "flex", minHeight: 116 }}>
        {share.product_image_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={share.product_image_url}
            alt=""
            style={{
              width: 116,
              height: 116,
              objectFit: "cover",
              flexShrink: 0,
            }}
          />
        ) : (
          <div
            aria-hidden
            style={{
              width: 116,
              height: 116,
              flexShrink: 0,
              background: "linear-gradient(135deg, #FF9033, #FF7200)",
              display: "grid",
              placeItems: "center",
              fontSize: 30,
            }}
          >
            🛍
          </div>
        )}
        <div
          style={{
            flex: 1,
            padding: "10px 12px",
            borderLeft: "2px solid #00AFFF",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            minWidth: 0,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 8,
                letterSpacing: "0.20em",
                textTransform: "uppercase",
                fontWeight: 900,
                color: "#00AFFF",
              }}
            >
              🛍 {share.business_name}
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 14,
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: "-0.02em",
                lineHeight: 1.05,
                color: "#F2F5F8",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {share.product_name}
            </div>
            {share.business_location && (
              <div
                style={{
                  marginTop: 2,
                  fontSize: 9,
                  color: "rgba(125,155,192,0.85)",
                  letterSpacing: "0.06em",
                }}
              >
                📍 {share.business_location}
              </div>
            )}
          </div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 900,
              color: "#FF7200",
              letterSpacing: "-0.03em",
              lineHeight: 1,
            }}
          >
            {priceLabel}
          </div>
        </div>
      </div>

      {/* Personal note strip · only when the sharer added one */}
      {share.personal_note && (
        <div
          style={{
            padding: "8px 12px",
            borderTop: "1px solid rgba(0,175,255,0.15)",
            fontSize: 11,
            color: "#F2F5F8",
            fontStyle: "italic",
            lineHeight: 1.4,
          }}
        >
          &ldquo;{share.personal_note}&rdquo;
        </div>
      )}

      {/* Reward row · huge typographic value */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          gap: 12,
          padding: "8px 12px",
          borderTop: "2px solid #FF7200",
          alignItems: "center",
        }}
      >
        <div
          style={{
            fontSize: 22,
            fontWeight: 900,
            letterSpacing: "-0.03em",
            color: "#FF7200",
            lineHeight: 1,
          }}
        >
          −{share.receiver_bonus_pct}%
        </div>
        <div>
          <div
            style={{
              fontSize: 8,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              fontWeight: 900,
              color: "#FF7200",
            }}
          >
            Your reward
          </div>
          <div
            style={{
              fontSize: 9,
              color: "rgba(125,155,192,0.85)",
              letterSpacing: "0.02em",
            }}
          >
            Order within {expiryLabel}
          </div>
        </div>
      </div>

      {/* Open CTA */}
      <a
        href={share.open_href}
        style={{
          display: "block",
          padding: "10px 12px",
          background: "linear-gradient(180deg, #FF9033 0%, #FF7200 100%)",
          color: "#0B0F1A",
          textAlign: "center",
          fontSize: 10,
          fontWeight: 900,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          textDecoration: "none",
          cursor: "pointer",
        }}
      >
        Open · claim reward
      </a>
    </div>
  );
}

function formatPriceForShare(pence: number, currency: string): string {
  const rupiah = pence / 100;
  const formatted = rupiah.toLocaleString("en-US", { maximumFractionDigits: 0 });
  const symbol = currency.toUpperCase() === "IDR" ? "Rp" : currency;
  return `${symbol} ${formatted}`;
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
      {/* Bridge 25c · bike-delivery quote · lets seller book courier
          at the same Rp figure the buyer was quoted. */}
      {cart.delivery_quote && cart.delivery_quote.kind !== "unknown" && (
        <div
          style={{
            margin: "0 10px 8px",
            padding: "8px 10px",
            borderRadius: 10,
            background:
              cart.delivery_quote.kind === "free"
                ? "rgba(22,214,107,0.10)"
                : "rgba(255,120,0,0.10)",
            border: `1px solid ${
              cart.delivery_quote.kind === "free"
                ? "rgba(22,214,107,0.35)"
                : "rgba(255,120,0,0.35)"
            }`,
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
              color:
                cart.delivery_quote.kind === "free" ? "#B8F1CC" : "#FFC96B",
              marginBottom: 4,
            }}
          >
            🚚 Delivery
          </div>
          {cart.delivery_quote.kind === "free" ? (
            <div style={{ fontWeight: 700 }}>
              FREE
              {cart.delivery_quote.free_reason
                ? ` · included with ${cart.delivery_quote.free_reason}`
                : ""}
            </div>
          ) : (
            <div style={{ fontWeight: 700 }}>
              {typeof cart.delivery_quote.fare_pence === "number"
                ? `Rp ${Math.round(
                    cart.delivery_quote.fare_pence / 100,
                  ).toLocaleString("id-ID")}`
                : "—"}
              {typeof cart.delivery_quote.distance_km === "number" && (
                <span
                  style={{
                    marginLeft: 6,
                    color: "rgba(244,247,252,0.75)",
                    fontWeight: 600,
                  }}
                >
                  · {cart.delivery_quote.distance_km.toFixed(1)} km
                </span>
              )}
              {typeof cart.delivery_quote.eta_minutes === "number" && (
                <span
                  style={{
                    marginLeft: 6,
                    color: "rgba(244,247,252,0.75)",
                    fontWeight: 600,
                  }}
                >
                  · ~{cart.delivery_quote.eta_minutes} min
                </span>
              )}
            </div>
          )}
          <div
            style={{
              marginTop: 3,
              fontSize: 10,
              color: "rgba(244,247,252,0.62)",
            }}
          >
            {cart.delivery_quote.kind === "free"
              ? "Seller pays the courier · book as usual."
              : "NEX standard bike rate (GoSend / GrabExpress / Maxim tier) · book your courier and confirm the final fare with the buyer if it differs."}
          </div>
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
      {/* Bridge 49b-final · NEX Direct Price discount chip · shows
          the tier + share breakdown + saving + total-after so the
          seller sees exactly what the buyer paid vs listed price.
          Only renders when the cart carries the direct_price block. */}
      {cart.direct_price && cart.direct_price.applied_pct > 0 && (
        <div
          style={{
            padding: "8px 12px",
            borderTop: "1px solid rgba(255,114,0,0.30)",
            background: "rgba(255,114,0,0.10)",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
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
                fontSize: 9,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "#FFB989",
                fontWeight: 900,
              }}
            >
              🎯 NEX Direct · −{cart.direct_price.applied_pct}%
              {cart.direct_price.capped_at_max ? " · capped" : ""}
            </div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: "#4CFF7A",
                letterSpacing: "-0.005em",
              }}
            >
              −{formatBubblePrice(cart.direct_price.saving_pence, cart.currency)}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            {cart.direct_price.tier_pct > 0 && (
              <span
                style={{
                  fontSize: 9,
                  letterSpacing: "0.10em",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  color: "#FFB989",
                  padding: "2px 8px",
                  borderRadius: 4,
                  background: "rgba(255,114,0,0.14)",
                  border: "1px solid rgba(255,114,0,0.35)",
                }}
              >
                Loyalty −{cart.direct_price.tier_pct}%
              </span>
            )}
            {cart.direct_price.share_pct > 0 && (
              <span
                style={{
                  fontSize: 9,
                  letterSpacing: "0.10em",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  color: "#7DDCFF",
                  padding: "2px 8px",
                  borderRadius: 4,
                  background: "rgba(0,175,255,0.14)",
                  border: "1px solid rgba(0,175,255,0.35)",
                }}
              >
                Share −{cart.direct_price.share_pct}%
              </span>
            )}
          </div>
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
            {cart.direct_price && cart.direct_price.applied_pct > 0
              ? `Total · ${cart.item_count} item${cart.item_count === 1 ? "" : "s"}`
              : `Subtotal · ${cart.item_count} item${cart.item_count === 1 ? "" : "s"}`}
          </div>
          {cart.direct_price && cart.direct_price.applied_pct > 0 ? (
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span
                style={{
                  fontSize: 11,
                  color: "rgba(139,169,209,0.75)",
                  textDecoration: "line-through",
                }}
              >
                {subtotal}
              </span>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: "#FF7800",
                  marginTop: 1,
                }}
              >
                {formatBubblePrice(
                  cart.direct_price.total_after_discount_pence,
                  cart.currency,
                )}
              </span>
            </div>
          ) : (
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
          )}
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

// ─── Bridge 97 · ambient overlays for the 20-theme batch ─────────────
//
// Both overlays sit inside the wallpaper zone (z-index 2 · above the
// wallpaper + scrim, below the header + bubbles) with pointer-events
// off so they never intercept taps. They render deterministically
// from their config so SSR + client render agree.

interface ParticleDriftConfig {
  color: string;
  count?: number;
  direction?: "up";
  size?: number;
  speedSeconds?: number;
}

function ParticleDrift({ config }: { config: ParticleDriftConfig }): React.JSX.Element {
  const count = Math.max(4, Math.min(48, config.count ?? 16));
  const size = Math.max(2, Math.min(10, config.size ?? 4));
  const speed = Math.max(6, Math.min(30, config.speedSeconds ?? 14));
  const color = config.color;
  const particles = React.useMemo(() => {
    // Seeded pseudo-random so SSR and client agree on every particle
    // position + delay. Same seed → same visual.
    let seed = 424242;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    return Array.from({ length: count }, () => ({
      left: rand() * 100,
      delay: rand() * speed,
      xShift: (rand() - 0.5) * 40,
      opacity: 0.35 + rand() * 0.45,
      scale: 0.7 + rand() * 0.7,
    }));
  }, [count, speed]);

  const anim = `nex-drift-${Math.round(speed)}`;

  return (
    <>
      <style>{`
        @keyframes ${anim} {
          0%   { transform: translate3d(0, 40px, 0); opacity: 0; }
          15%  { opacity: 1; }
          85%  { opacity: 0.6; }
          100% { transform: translate3d(var(--nx-x, 0px), -110%, 0); opacity: 0; }
        }
      `}</style>
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 2,
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        {particles.map((p, i) => (
          <span
            key={i}
            style={
              {
                position: "absolute",
                left: `${p.left}%`,
                bottom: -12,
                width: size,
                height: size,
                borderRadius: "50%",
                background: color,
                filter: `blur(${size / 4}px)`,
                opacity: p.opacity,
                transform: `scale(${p.scale})`,
                animation: `${anim} ${speed}s linear infinite`,
                animationDelay: `-${p.delay}s`,
                "--nx-x": `${p.xShift}px`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
    </>
  );
}

interface SparkleConfig {
  color: string;
  count?: number;
  size?: number;
  twinkleSeconds?: number;
}

// Bridge 97f · Resolve the geometry + background + border for a
// message bubble based on the theme's bubbleStyle preset. Returns a
// partial style object that gets spread into the bubble div. Deleted
// bubbles wear the tombstone treatment regardless of preset so
// retracted messages are always recognisable across themes.
function resolveBubbleShape(input: {
  preset: "classic" | "pill" | "square" | "outlined" | "gradient";
  mine: boolean;
  deleted: boolean;
  bubbleRim: string;
  accentGlassMine: string;
  accentGlassPeer: string;
}): {
  borderRadius: string;
  background: string;
  border: string;
  boxShadow: string;
} {
  const { preset, mine, deleted, bubbleRim, accentGlassMine, accentGlassPeer } = input;

  if (deleted) {
    return {
      borderRadius: preset === "square" ? "4px" : preset === "pill" ? "20px" : "14px",
      background: "rgba(20,26,38,0.48)",
      border: "1px dashed rgba(139,169,209,0.35)",
      boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
    };
  }

  const strongRim = themeRimStrong(bubbleRim);
  const softRim = "1px solid rgba(150,160,180,0.55)";
  const mineShadow = "0 0 14px rgba(0,159,239,0.25), 0 6px 20px rgba(0,0,0,0.45)";
  const peerShadow = "0 6px 22px rgba(0,0,0,0.55)";

  switch (preset) {
    case "pill":
      // Fully rounded · no tail · reads as a calm sticker.
      return {
        borderRadius: "24px",
        background: mine ? accentGlassMine : accentGlassPeer,
        border: mine ? `1px solid ${strongRim}` : softRim,
        boxShadow: mine ? mineShadow : peerShadow,
      };
    case "square":
      // Sharp geometric · minimal rounding · no tail.
      return {
        borderRadius: "4px",
        background: mine ? accentGlassMine : accentGlassPeer,
        border: mine ? `1px solid ${strongRim}` : softRim,
        boxShadow: mine ? mineShadow : peerShadow,
      };
    case "outlined":
      // Transparent background · accent-coloured outline dominates.
      // Reads as a "card" rather than a solid bubble.
      return {
        borderRadius: "12px",
        background: "rgba(2,9,20,0.30)",
        border: mine
          ? `1.5px solid ${strongRim}`
          : `1.5px solid rgba(150,160,180,0.7)`,
        boxShadow: mine
          ? "0 0 10px rgba(0,159,239,0.18)"
          : "0 4px 14px rgba(0,0,0,0.35)",
      };
    case "gradient":
      // Subtle accent-tinted gradient · warmer feel than solid.
      return {
        borderRadius: mine ? "16px 16px 6px 16px" : "16px 16px 16px 6px",
        background: mine
          ? `linear-gradient(135deg, ${themeRimStrong(bubbleRim)}55 0%, rgba(12,32,58,0.75) 60%)`
          : `linear-gradient(135deg, rgba(150,160,180,0.32) 0%, rgba(30,44,66,0.62) 60%)`,
        border: mine ? `1px solid ${strongRim}` : softRim,
        boxShadow: mine ? mineShadow : peerShadow,
      };
    case "classic":
    default:
      // Sealed 2026-09-27 · original Bloom shape · 14px + sender tail.
      return {
        borderRadius: mine ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
        background: mine ? accentGlassMine : accentGlassPeer,
        border: mine ? `1px solid ${strongRim}` : softRim,
        boxShadow: mine ? mineShadow : peerShadow,
      };
  }
}

function SparkleField({ config }: { config: SparkleConfig }): React.JSX.Element {
  const count = Math.max(6, Math.min(60, config.count ?? 24));
  const size = Math.max(2, Math.min(8, config.size ?? 3));
  const twinkle = Math.max(1.5, Math.min(8, config.twinkleSeconds ?? 3));
  const color = config.color;
  const stars = React.useMemo(() => {
    let seed = 91827;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    return Array.from({ length: count }, () => ({
      left: rand() * 100,
      top: rand() * 100,
      delay: rand() * twinkle * 2,
      scale: 0.6 + rand() * 0.8,
    }));
  }, [count, twinkle]);

  return (
    <>
      <style>{`
        @keyframes nex-sparkle {
          0%, 100% { opacity: 0.15; transform: scale(0.9); }
          50%      { opacity: 1;    transform: scale(1.15); }
        }
      `}</style>
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 2,
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        {stars.map((s, i) => (
          <span
            key={i}
            style={{
              position: "absolute",
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: size,
              height: size,
              borderRadius: "50%",
              background: color,
              boxShadow: `0 0 ${size * 2}px ${color}`,
              transform: `scale(${s.scale})`,
              animation: `nex-sparkle ${twinkle}s ease-in-out infinite`,
              animationDelay: `-${s.delay}s`,
            }}
          />
        ))}
      </div>
    </>
  );
}

// ─── MistDrift · Bridge Theme-0 · sealed 2026-09-30 ──────────────────
// Fog blobs rise from below the composer up past the top of the chat.
// Byte-identical to the cover-side MistDrift in theme-skin.tsx so the
// two surfaces render the same environmental overlay per the ONE NEX
// IDENTITY doctrine.

interface MistDriftConfig {
  color?: string;
  count?: number;
  size?: number;
  blur?: number;
  speedSeconds?: number;
}

function MistDrift({ config }: { config: MistDriftConfig }): React.JSX.Element {
  const color = config.color ?? "rgba(220,235,225,0.45)";
  const count = Math.max(4, Math.min(14, config.count ?? 8));
  const baseSize = Math.max(80, Math.min(260, config.size ?? 160));
  const blur = Math.max(16, Math.min(80, config.blur ?? 44));
  const speed = Math.max(10, Math.min(60, config.speedSeconds ?? 22));

  const blobs = React.useMemo(() => {
    let seed = 733333;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    // Byte-identical realistic-ground-fog behaviour to the cover
    // side (theme-skin.tsx MistDrift · see there for design notes).
    return Array.from({ length: count }, () => ({
      left: rand() * 100,
      scale: 0.7 + rand() * 0.7,
      xShift: (rand() - 0.5) * 16,
      delay: rand() * speed,
      dur: speed * (0.8 + rand() * 0.5),
      opacity: 0.35 + rand() * 0.5,
      tilt: (rand() - 0.5) * 8,
    }));
  }, [count, speed]);

  const anim = `nex-chat-mist-${Math.round(speed)}`;
  const haze = `nex-chat-mist-haze-${Math.round(speed)}`;
  return (
    <>
      <style>{`
        @keyframes ${anim} {
          0%   { transform: translate3d(0, 0, 0) scale(0.7) rotate(0deg); opacity: 0; }
          15%  { opacity: 1; }
          60%  { opacity: 0.5; }
          85%  { opacity: 0; }
          100% { transform: translate3d(var(--nx-x, 0px), -110vh, 0) scale(1.6) rotate(var(--nx-r, 0deg)); opacity: 0; }
        }
        @keyframes ${haze} {
          0%, 100% { opacity: 0.5; transform: scaleY(1); }
          50%      { opacity: 0.9; transform: scaleY(1.15); }
        }
      `}</style>
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 140,
            background: `linear-gradient(to top, ${color} 0%, transparent 100%)`,
            filter: `blur(${Math.round(blur * 0.6)}px)`,
            transformOrigin: "bottom center",
            animation: `${haze} ${Math.round(speed * 1.5)}s ease-in-out infinite`,
          }}
        />
        {blobs.map((b, i) => {
          const wW = baseSize * 0.55 * b.scale;
          const wH = baseSize * 1.4 * b.scale;
          return (
            <span
              key={i}
              style={
                {
                  position: "absolute",
                  left: `${b.left}%`,
                  bottom: 0,
                  width: wW,
                  height: wH,
                  borderRadius: "50%",
                  transformOrigin: "bottom center",
                  background: `radial-gradient(ellipse at center 90%, ${color} 0%, transparent 75%)`,
                  filter: `blur(${blur}px)`,
                  opacity: b.opacity,
                  animation: `${anim} ${b.dur}s linear infinite`,
                  animationDelay: `-${b.delay}s`,
                  willChange: "transform, opacity",
                  "--nx-x": `${b.xShift}vw`,
                  "--nx-r": `${b.tilt}deg`,
                } as React.CSSProperties
              }
            />
          );
        })}
      </div>
    </>
  );
}
