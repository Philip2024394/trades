// src/app/nex-native/chat/peer/[accountId]/page.tsx
//
// NEX peer-to-peer chat · Portrait Bloom shell.
// ---------------------------------------------
// Renders friend↔friend conversations using the sealed Portrait Bloom
// design language shared with business chat. The peer's identity
// dominates the visual space (their avatar becomes the environment)
// and messages float over the fade zone.
//
// Refinements included:
//   · portrait breathes on an 8-second loop
//   · one-shot chat-theme ripple when the last inbound is < 15s old
//   · offline desaturation via ?online=0 (until presence Bridge lands)
//
// Backend is Bridge 3 (peer-conversation-service + peer-message-service).

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as accountService from "@/lib/nex-native/account-service";
import * as friendService from "@/lib/nex-native/friend-service";
import * as peerConversationService from "@/lib/nex-native/peer-conversation-service";
import * as peerMessageService from "@/lib/nex-native/peer-message-service";
import * as chatThemeService from "@/lib/nex-native/chat-theme-service";
import {
  sendPeerMessageAction,
  deletePeerMessageAction,
  uploadPeerAttachmentAction,
  sendProductInquiryAction,
  sendCartOrderAction,
  toggleMessageReactionAction,
} from "../../../_actions";
import {
  PortraitBloomShell,
  type PortraitBloomPresenceKind,
} from "../../_portrait-bloom-shell";
import { PeerCallLauncher } from "./_call-launcher";
import { PeerTypingClient } from "./_typing-client";
import { PeerPresenceClient } from "./_presence-client";
import { PeerMessageEventsClient } from "./_message-events-client";
import { DeviceKeyHub } from "./_device-key-hub";
import { E2eDecryptor } from "./_e2e-decryptor";
import { E2eComposerIntercept } from "./_e2e-composer-intercept";
import { ArchivePanel } from "./_archive-panel";
import type {
  SideNavContact,
  PendingInvite,
} from "../../_side-nav-panel";
import * as businessService from "@/lib/nex-native/business-service";
import {
  hasCurrentSafeTradeConsent,
  CURRENT_SAFE_TRADE_TERMS_VERSION,
} from "@/lib/nex-native/safe-trade-consent-service";
import {
  resolveLocale,
  SAFE_TRADE_STRINGS,
} from "@/lib/nex-native/i18n/safe-trade-strings";
import { headers } from "next/headers";
import {
  acknowledgeSafeTradeAction,
  toggleLikeProductAction,
} from "../../../_actions";
import { SafeTradeConsentModal } from "./_safe-trade-consent-modal";
import * as productService from "@/lib/nex-native/product-service";
import * as menuService from "@/lib/nex-native/menu-service";
import { isVenueCategory } from "@/lib/nex-native/types";
import { isNexOfficialAccount } from "@/lib/nex-native/nex-official";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Peer's chat theme now resolves via chat-theme-service (Bridge 4 ·
// nex_chat_theme table) so admin-created themes light up on any
// existing peer's chat without a code change. Fallback baked in for
// unknown / inactive rows.

export default async function PeerChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ accountId: string }>;
  searchParams: Promise<{
    online?: string;
    reply?: string;
    delete_error?: string;
    attachment_url?: string;
    attachment_type?: string;
    attachment_encrypted?: string;
    upload_error?: string;
    lang?: string;
  }>;
}) {
  const { accountId: peerAccountId } = await params;
  const sp = await searchParams;
  // Bridge 16c · locale resolution for the consent modal. URL param
  // wins, then Accept-Language, then Bahasa Indonesia (launch market).
  const acceptLanguage = (await headers()).get("accept-language");
  // Presence Bridge isn't built yet · query param toggle for preview.
  const isOffline = sp.online === "0";
  const replyId = sp.reply?.trim() || null;
  // Bridge 6 · surfaced by deletePeerMessageAction on retract failure.
  // Parsed for future banner surface · currently only observable via
  // the URL (the confirm modal closes, the message remains). Wiring
  // a proper toast is a follow-up.
  void sp.delete_error;

  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");
  if (peerAccountId === session.account.id) redirect("/nex-native/chat");

  // Bridge 16d · locale resolution now considers the account's
  // persisted preference (migration 071). URL param > account > header
  // > Indonesian market default.
  const locale = resolveLocale({
    urlParam: sp.lang ?? null,
    accountLocale: session.account.locale ?? null,
    acceptLanguage,
  });
  const safeTradeStrings = SAFE_TRADE_STRINGS[locale];

  const peer = await accountService.getAccountById(peerAccountId);
  if (!peer) redirect("/nex-native/chat");

  const profile = await (async () => {
    try {
      const svc = await import("@/lib/nex-native/account-profile-service");
      return await svc.getProfileByAccountId(peer.id);
    } catch {
      return null;
    }
  })();

  const conversation =
    await peerConversationService.getOrCreatePeerConversation(
      session.account.id,
      peer.id,
    );

  const [messages] = await Promise.all([
    peerMessageService.listPeerMessages(conversation.id),
    peerMessageService.markPeerMessagesRead(conversation.id, session.account.id),
  ]);

  const bind = sendPeerMessageAction.bind(null, peer.id);
  const bindDelete = deletePeerMessageAction.bind(null, peer.id);
  const bindUpload = uploadPeerAttachmentAction.bind(null, peer.id);
  const bindProductInquiry = sendProductInquiryAction.bind(null, peer.id);
  const bindReaction = toggleMessageReactionAction.bind(null, peer.id);

  // Bridge · shop icon in header · when the peer owns a business
  // with live products, the header renders a shop button that
  // opens the product grid modal. Fully fails safe · any service
  // error just hides the shop icon.
  const peerBusinesses = await businessService
    .listBusinessesByOwner(peer.id)
    .catch(() => [] as Awaited<ReturnType<typeof businessService.listBusinessesByOwner>>);
  const peerBusiness = peerBusinesses[0] ?? null;
  const peerProducts = peerBusiness
    ? await productService
        .listProductsByBusiness(peerBusiness.id, "live")
        .catch(() => [] as Awaited<ReturnType<typeof productService.listProductsByBusiness>>)
    : [];
  // Bridge 51 · food sellers (restaurant / cafe / bakery / bar / …)
  // keep their SKUs in nex_menu_item, not nex_product. Load menu items
  // when the peer's business is a venue category so the same slider
  // populates for every seller · one unified "browse what they sell"
  // grid regardless of whether they're a product seller or a food
  // seller. Founder direction 2026-09-29.
  const peerMenuItems =
    peerBusiness && isVenueCategory(peerBusiness.business_category)
      ? await menuService
          .listMenuItemsByBusiness(peerBusiness.id, { status: "live" })
          .catch(() => [] as Awaited<ReturnType<typeof menuService.listMenuItemsByBusiness>>)
      : [];
  // Bridge 16b · JIT safe-trade consent gate. Fires only when the
  // peer owns a business (i.e. this is a commerce chat) AND the
  // viewer hasn't yet acknowledged the current terms version. The
  // modal blocks the surface until they tick + submit.
  const needsSafeTradeConsent = peerBusiness
    ? !(await hasCurrentSafeTradeConsent(session.account.id).catch(() => true))
    : false;

  // Bridge 17e · report affordance moved to /nex-native/report/[id]
  // and surfaced from the /friends list next to Remove / Block · no
  // longer rendered on the peer chat surface.

  // Bridge 17b · shop button in the chat header shows whenever the
  // peer owns a business, even if they have no products (a cafe or
  // restaurant carries menu items in nex_menu_item, not products ·
  // sellers of services may have zero SKUs at all). When there are
  // products the grid modal renders · otherwise the button just
  // navigates straight to the shop landing.
  const peerIsVenue =
    !!peerBusiness && isVenueCategory(peerBusiness.business_category);
  const peerShop = peerBusiness
    ? {
        name: peerBusiness.display_name,
        href: peerBusiness.slug
          ? `/nex-native/${peerBusiness.slug}`
          : null,
        isVenue: peerIsVenue,
        // Bridge 52 · shopContext threads through to the in-chat
        // detail sheet · Add-to-cart writes localStorage using these
        // fields · Send-in-chat posts a cart_order to the seller.
        context: {
          shop_id: peerBusiness.id,
          shop_slug: peerBusiness.slug ?? null,
          shop_owner_account_id: peer.id,
          shop_display_name: peerBusiness.display_name,
        },
        products: [
          ...peerProducts.map((p) => ({
            id: p.id,
            kind: "product" as const,
            name: p.name,
            description: p.description ?? null,
            price_pence: p.price_pence,
            currency: p.currency,
            image_url: p.image_url ?? null,
            tags: p.tags ?? null,
            stock_status: p.stock_status ?? null,
          })),
          // Bridge 51 · food-seller menu items ride the same slider ·
          // dietary tags surface as the tag chips · availability
          // becomes the stock-status heuristic ("in_stock" vs "sold").
          ...peerMenuItems.map((m) => ({
            id: m.id,
            kind: "menu_item" as const,
            name: m.name,
            description: m.description ?? null,
            price_pence: m.price_pence,
            currency: m.currency,
            image_url: m.image_url ?? null,
            tags: m.dietary_tags.length > 0 ? m.dietary_tags : null,
            stock_status: m.is_available ? "in_stock" : "sold",
          })),
        ],
      }
    : null;

  // Bridge 8+9 · resolve the pending attachment from URL state.
  const attachUrl = sp.attachment_url?.trim() || null;
  const attachTypeRaw = sp.attachment_type?.trim() || null;
  const attachKind: "image" | "video" | "audio" | null =
    attachTypeRaw === "image" ||
    attachTypeRaw === "video" ||
    attachTypeRaw === "audio"
      ? attachTypeRaw
      : null;
  const pendingAttachment =
    attachUrl && attachKind
      ? {
          url: attachUrl,
          kind: attachKind,
          clearHref: `/nex-native/chat/peer/${peer.id}`,
          // Bridge 88 · flag encrypted so the composer smuggles a
          // hidden field and E2eComposerIntercept looks up the
          // stashed content key in sessionStorage.
          encrypted: sp.attachment_encrypted === "1",
        }
      : null;

  // Resolve peer's theme colours · bubble rims + composer rim +
  // ripple. Multi-colour themes (Rose etc.) supply per-element hex
  // overrides · single-accent themes fall back to accent for every
  // slot. Sealed 2026-09-27 · migration 051.
  const peerThemeRow = peer.chat_theme
    ? await chatThemeService.getThemeById(peer.chat_theme).catch(() => null)
    : null;
  const themeColours = peerThemeRow
    ? chatThemeService.resolveThemeColours(peerThemeRow)
    : { accent: "#00AFFF", bubbleRim: "#00AFFF", composerRim: "#00AFFF" };

  // Header contacts menu · list of accepted friends so the user can
  // hop between peer chats without leaving the chat surface. Best-
  // effort · if any lookup fails we return an empty list rather than
  // block the page render.
  const contacts: SideNavContact[] = await (async () => {
    try {
      const friendIds = await friendService.listFriends(session.account.id);
      const others = friendIds.filter((id) => id !== peer.id);
      // Put the current peer FIRST so it's obvious you're in that
      // chat when the drawer opens · include ALL friends after.
      const orderedIds = [peer.id, ...others];
      const list = await Promise.all(
        orderedIds.map(async (id) => {
          const [acc, profile] = await Promise.all([
            accountService.getAccountById(id),
            (async () => {
              try {
                const svc = await import(
                  "@/lib/nex-native/account-profile-service"
                );
                return await svc.getProfileByAccountId(id);
              } catch {
                return null;
              }
            })(),
          ]);
          if (!acc) return null;
          const professionShort = profile?.profession
            ? profile.profession.split(/[\s·,/-]+/).filter(Boolean)[0] ?? null
            : null;
          return {
            id: acc.id,
            name: acc.display_name,
            profession: professionShort,
            avatarUrl: profile?.avatar_url ?? null,
            href: `/nex-native/chat/peer/${acc.id}`,
            isCurrent: acc.id === peer.id,
          };
        }),
      );
      return list.filter((c): c is SideNavContact => !!c);
    } catch {
      return [];
    }
  })();

  // Pending friend invites the viewer can accept · shown at the top
  // of the header drawer.
  const pendingInvites: PendingInvite[] = await (async () => {
    try {
      const edges = await friendService.listPendingIncoming(session.account.id);
      const rows = await Promise.all(
        edges.map(async (edge) => {
          const otherId =
            edge.a_account_id === session.account.id
              ? edge.b_account_id
              : edge.a_account_id;
          const [acc, profile] = await Promise.all([
            accountService.getAccountById(otherId),
            (async () => {
              try {
                const svc = await import(
                  "@/lib/nex-native/account-profile-service"
                );
                return await svc.getProfileByAccountId(otherId);
              } catch {
                return null;
              }
            })(),
          ]);
          if (!acc) return null;
          const professionShort = profile?.profession
            ? profile.profession.split(/[\s·,/-]+/).filter(Boolean)[0] ?? null
            : null;
          return {
            otherAccountId: acc.id,
            name: acc.display_name,
            avatarUrl: profile?.avatar_url ?? null,
            profession: professionShort,
          };
        }),
      );
      return rows.filter((r): r is PendingInvite => !!r);
    } catch {
      return [];
    }
  })();

  const presenceKind: PortraitBloomPresenceKind = isOffline
    ? "offline"
    : "online";
  const presenceLabel = isOffline
    ? "Away · will see later"
    : "NEX · chatting with";

  // Bridge 5 · resolve reply-preview snippets so bubbles can render
  // their quote header without an extra client round-trip. O(n²) but
  // conversations are small · we can index later if this ever gets hot.
  const byId = new Map(messages.map((m) => [m.id, m]));
  const bloomMessages = messages.map((m) => {
    const quoted = m.reply_to_id ? byId.get(m.reply_to_id) : null;
    return {
      id: m.id,
      body: m.body,
      sent_at: m.sent_at,
      read_at: m.read_at,
      mine: m.sender_account_id === session.account.id,
      reply_to_id: m.reply_to_id ?? null,
      reply_preview: quoted
        ? {
            body: quoted.deleted_for_everyone
              ? "🚫 This message was deleted"
              : quoted.body,
            mine: quoted.sender_account_id === session.account.id,
          }
        : null,
      deleted_for_everyone: !!m.deleted_for_everyone,
      attachment_url: m.attachment_url ?? null,
      attachment_type: m.attachment_type ?? null,
      attachment_product:
        m.attachment_type === "product" &&
        m.attachment_meta &&
        typeof m.attachment_meta === "object" &&
        "product" in m.attachment_meta &&
        m.attachment_meta.product
          ? m.attachment_meta.product
          : null,
      attachment_menu_item:
        m.attachment_type === "menu_item" &&
        m.attachment_meta &&
        typeof m.attachment_meta === "object" &&
        "menu_item" in m.attachment_meta &&
        m.attachment_meta.menu_item
          ? m.attachment_meta.menu_item
          : null,
      attachment_cart:
        m.attachment_type === "cart_order" &&
        m.attachment_meta &&
        typeof m.attachment_meta === "object" &&
        "cart" in m.attachment_meta &&
        m.attachment_meta.cart
          ? {
              ...m.attachment_meta.cart,
              // Bridge 49b-final · pass through direct_price so the
              // cart-order card renders the discount chip.
              direct_price:
                m.attachment_meta.cart.direct_price ?? null,
            }
          : null,
      attachment_product_share:
        m.attachment_type === "product_share" &&
        m.attachment_meta &&
        typeof m.attachment_meta === "object" &&
        "product_share" in m.attachment_meta &&
        m.attachment_meta.product_share
          ? m.attachment_meta.product_share
          : null,
      // Bridge 66 · reactions map · defaults to {} when the column
      // is absent (older rows before migration 091 landed).
      reactions: m.reactions ?? {},
      // Bridge 81 · project the attachment envelope (if any) as
      // base64-encoded JSON for the _e2e-decryptor to consume from
      // a data attribute. Base64 keeps the DOM attribute compact
      // and side-steps quoting issues.
      attachment_envelope_b64: (() => {
        const meta = m.attachment_meta;
        if (!meta || typeof meta !== "object") return null;
        const env = (meta as Record<string, unknown>).envelope;
        if (!env || typeof env !== "object") return null;
        try {
          return Buffer.from(JSON.stringify(env), "utf-8").toString("base64");
        } catch {
          return null;
        }
      })(),
      // Bridge 76 · encryption fields · null on legacy plaintext rows
      // and on rows addressed to a different recipient device (the
      // decryptor will drop those from the visible bubble list once
      // Bridge 76b lands the dedupe).
      encrypted: m.encrypted ?? false,
      ciphertext_b64: m.ciphertext ?? null,
      nonce_b64: m.nonce ?? null,
      sender_public_key: m.sender_public_key ?? null,
      sender_device_id: m.sender_device_id ?? null,
      recipient_device_id: m.recipient_device_id ?? null,
      sender_account_id: m.sender_account_id,
      message_group_id: m.message_group_id ?? null,
    };
  });

  return (
    <>
      {needsSafeTradeConsent && (
        <SafeTradeConsentModal
          action={acknowledgeSafeTradeAction}
          nextHref={`/nex-native/chat/peer/${peer.id}`}
          termsVersion={CURRENT_SAFE_TRADE_TERMS_VERSION}
          strings={safeTradeStrings}
        />
      )}
      {/* Bridge 17e · Report affordance moved from the peer chat to
          /nex-native/report/[accountId] · reachable from /friends
          next to Remove / Block · keeps the chat surface clean. */}
      <PortraitBloomShell
        scope="peer-chat"
      /* Free accounts display only the first name on the chat
         header per Founder direction 2026-09-27 · full name lives
         on friend cards + directory. Splits on any whitespace so
         "Maria Santos" → "Maria", "Philip J. Wright" → "Philip".
         Bisnis tier will get full-name rendering when tier gating
         lands (migration 046 pending). */
      displayName={peer.display_name.split(/\s+/)[0] ?? peer.display_name}
      isOfficialPeer={isNexOfficialAccount(peer.id)}
      layoutStyle={peerThemeRow?.layout_style ?? "bubbles"}
      subtitle={profile?.profession ?? null}
      portraitUrl={profile?.avatar_url ?? null}
      presenceKind={presenceKind}
      presenceLabel={presenceLabel}
      rippleColor={themeColours.accent}
      bubbleRimColor={themeColours.bubbleRim}
      composerRimColor={themeColours.composerRim}
      wallpaperUrl={peerThemeRow?.hero_image_url ?? null}
      wallpaperConfig={peerThemeRow?.wallpaper_config ?? null}
      backHref="/nex-native/chat"
      messages={bloomMessages}
      composerAction={bind}
      deleteAction={bindDelete}
      uploadAction={bindUpload}
      pendingAttachment={pendingAttachment}
      encryptedUploadEnabled={!isNexOfficialAccount(peer.id)}
      peerShop={peerShop}
      sendCartOrderAction={sendCartOrderAction}
      productInquiryAction={bindProductInquiry}
      tradeAgreementSellerName={
        peerBusiness
          ? peer.display_name.split(/\s+/)[0] ?? peer.display_name
          : null
      }
      tradeAgreementActivated={!!peerBusiness?.safe_trade_activated}
      likeProductAction={toggleLikeProductAction}
      toggleReactionAction={bindReaction}
      selfAccountId={session.account.id}
      composerPlaceholder={`Message ${peer.display_name}…`}
      headerTag="NEX Chat"
      contacts={contacts}
      pendingInvites={pendingInvites}
      replyTarget={(() => {
        if (!replyId) return null;
        const target = messages.find((m) => m.id === replyId);
        // Silently drop the reply target when the message is gone
        // or has been retracted · quoting a deleted message would
        // leak the original body back into the send flow.
        if (!target || target.deleted_for_everyone) return null;
        return {
          id: target.id,
          body: target.body,
          mine: target.sender_account_id === session.account.id,
          peerName: peer.display_name,
          clearHref: `/nex-native/chat/peer/${peer.id}`,
        };
      })()}
      />
      {/* Bridge 68 · voice-call launcher · disabled for NEX1 support so
          ops isn't paged through WebRTC. Own signalling channel keyed on
          conversation.id. */}
      <PeerCallLauncher
        conversationId={conversation.id}
        selfAccountId={session.account.id}
        selfDisplayName={session.account.display_name}
        peerAccountId={peer.id}
        peerDisplayName={peer.display_name}
        peerAvatarUrl={profile?.avatar_url ?? null}
        disabled={isNexOfficialAccount(peer.id)}
      />
      {/* Bridge 70 · typing indicator · disabled for NEX1 (support
          agents typing is not a signal buyers need). Same conversation
          channel keyed on conversation.id. */}
      <PeerTypingClient
        conversationId={conversation.id}
        selfAccountId={session.account.id}
        selfDisplayName={session.account.display_name}
        peerDisplayName={peer.display_name}
        disabled={isNexOfficialAccount(peer.id)}
      />
      {/* Bridge 71 · live presence · publishes self on global roster,
          renders "Online now" pill when peer is active. Also fires
          window CustomEvents ("nex-peer-presence") for future ring/dot
          consumers. Disabled for NEX1 support. */}
      <PeerPresenceClient
        conversationId={conversation.id}
        selfAccountId={session.account.id}
        selfDisplayName={session.account.display_name}
        peerAccountId={peer.id}
        peerDisplayName={peer.display_name}
        disabled={isNexOfficialAccount(peer.id)}
      />
      {/* Bridge 73 · live read-receipt propagation · broadcasts our
          read cursor on mount so the peer's outgoing ticks flip to
          double-blue instantly. Also enabled for NEX1 so support-
          initiated messages get proper receipts. */}
      <PeerMessageEventsClient
        conversationId={conversation.id}
        selfAccountId={session.account.id}
      />
      {/* Bridge 74 · ensure this browser has a Curve25519 device key
          + its public key is registered on the server. Foundation for
          E2E encryption (Bridges 75-78). Silent · no user-visible UI. */}
      <DeviceKeyHub />
      {/* Bridge 76 · decrypt inbound E2E messages on hydration and
          replace the '(encrypted)' sentinel with plaintext in the
          bubble body · fires delivered-ack on success · Bridge 77
          caches the plaintext to IndexedDB for post-purge survival. */}
      <E2eDecryptor conversationId={conversation.id} />
      {/* Bridge 76 · intercept composer submits · encrypt + POST when
          both parties have device keys · silent plaintext fallback
          when they don't. Disabled for NEX1 per doctrine. */}
      <E2eComposerIntercept
        conversationId={conversation.id}
        peerAccountId={peer.id}
        selfAccountId={session.account.id}
        disabled={isNexOfficialAccount(peer.id)}
      />
      {/* Bridge 79 · surface IDB-only archived messages (Bridge 77
          cached rows the server has since purged via Bridge 78) as a
          floating pill + modal. Non-invasive · doesn't touch the shell. */}
      <ArchivePanel
        conversationId={conversation.id}
        peerDisplayName={peer.display_name}
        selfAccountId={session.account.id}
        disabled={isNexOfficialAccount(peer.id)}
      />
    </>
  );
}
