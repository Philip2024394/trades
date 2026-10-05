// src/app/nex-native/chat/prototypes/depth-cards/page.tsx
//
// Live preview · Prototype 06 · Depth Cards.
// -------------------------------------------
// Renders Maria Santos' seeded Bridge 3 conversation at full mobile
// viewport with the Depth Cards visual language: newest message
// front-and-center at full scale · older messages recede into
// perspective with translate-Y + scale + opacity + z-depth.
//
// Real backend · functional composer.

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as accountService from "@/lib/nex-native/account-service";
import * as peerConversationService from "@/lib/nex-native/peer-conversation-service";
import * as peerMessageService from "@/lib/nex-native/peer-message-service";
import {
  sendPeerMessageAction,
  uploadPeerAttachmentAction,
} from "../../../_actions";
import { listThemeEmojis } from "@/lib/nex-native/theme-emoji-service";
import { PeerComposer } from "../../peer/[accountId]/_composer";
import { DepthDeck, type DeckMessage } from "@/components/nex-native/HauntedHotelDeck";
import { HauntedSmokeClient } from "@/components/nex-native/HauntedHotelSmoke";
import { ChatCoreBoundary } from "@/components/nex-native/surface-health/ChatCoreBoundary";
import { VisualThemeBoundary } from "@/components/nex-native/surface-health/VisualThemeBoundary";
import { OptionalVisualModuleBoundary } from "@/components/nex-native/surface-health/OptionalVisualModuleBoundary";
import { TierOneCanary } from "./_tier-one-canary";
import { resolveFaultInjection } from "./_test-bridge";
import { UniversalChromeOverlay } from "../../../chat-standard/_universal-chrome-overlay";
import { UniversalComposerFooter } from "../../../chat-standard/_universal-composer-footer";
import { UniversalHeaderIconsOverlay } from "../../../chat-standard/_universal-header-icons-overlay";
import { isThemeKillSwitchedSafe } from "@/lib/nex-native/theme-kill-switch";
import { HauntedHotelAtmosphere } from "@/components/nex-native/HauntedHotelAtmosphere";
import { HauntedHotelController } from "@/components/nex-native/HauntedHotelController";
import { ChatActionDots } from "@/components/nex-native/ChatActionDots";
import { PeerCallLauncher } from "../../peer/[accountId]/_call-launcher";
import { HeaderRightCluster } from "../../_header-right-cluster";

const SURFACE_ID = "depth-cards";
const PILOT_THEME_ID = "depth-cards-hotel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MARIA_ID = "d3e7f000-0001-4a00-b000-000000000001";

const NEX = {
  bg: "#020914",
  cyan: "#009FEF",
  cyanDeep: "#063B67",
  orange: "#FF7800",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
};

interface DepthCardsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DepthCardsLivePage(props: DepthCardsPageProps) {
  const resolvedSearchParams = props.searchParams ? await props.searchParams : undefined;
  const faults = resolveFaultInjection(resolvedSearchParams);
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const peer = await accountService.getAccountById(MARIA_ID);
  if (!peer) return <MissingPeerFallback />;

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
  const bindUpload = uploadPeerAttachmentAction.bind(null, peer.id);

  // Load the Haunted Hotel emoji set so the composer picker exposes
  // the 27 labelled bellboy mascots (see nex_theme_emoji rows at
  // theme_id = 'haunted-hotel'). The Mascots tab renders each tile
  // with its label underneath (same contract Joker uses). Fails soft
  // to an empty list — picker then hides the Mascots tab rather than
  // crashing.
  const hauntedHotelEmojis = await listThemeEmojis("haunted-hotel")
    .then((rows) =>
      rows.map((r) => ({
        slug: r.slug,
        imageUrl: r.image_url,
        label: r.label,
      })),
    )
    .catch(() => []);
  const avatarUrl = profile?.avatar_url ?? null;
  const profession = profile?.profession ?? null;
  const displayName = peer.display_name;

  // §12 Item 3 integration · resolve the viewer's effective chat theme
  // (session.account.chat_theme or the sealed default) and check the
  // kill-switch state. When kill-switched, the Tier 2 VisualThemeBoundary
  // renders the SafeFallbackRenderer immediately — no crash required.
  //
  // Finding #2 fix · use the fail-safe wrapper so a kill-switch service
  // outage degrades to "not kill-switched" rather than crashing the
  // pilot render. The wrapper logs a normalized diagnostic for HQ.
  const effectiveThemeId =
    (session.account as { chat_theme?: string | null }).chat_theme ??
    "pink-dream";
  const themeKillSwitched = await isThemeKillSwitchedSafe(effectiveThemeId);

  // Haunted Hotel mock shop catalogue · drives the header shop slider.
  // Prototype-only · not persisted · not a real nex_business row.
  const hauntedHotelShop = {
    name: "The Hotel Curio",
    href: null as string | null,
    products: [
      {
        id: "hh-mock-01",
        kind: "product" as const,
        name: "Candelabra · Hand-cast Bronze",
        description: "Three-stem · 1890s pattern · never leaves its post.",
        price_pence: 24000,
        currency: "GBP",
        image_url: null,
        tags: ["brass", "lighting"],
        stock_status: "in_stock",
      },
      {
        id: "hh-mock-02",
        kind: "product" as const,
        name: "Victorian Door Key · Reclaimed",
        description: "Room 237 · fits one lock only.",
        price_pence: 8500,
        currency: "GBP",
        image_url: null,
        tags: ["keys"],
        stock_status: "in_stock",
      },
      {
        id: "hh-mock-03",
        kind: "product" as const,
        name: "Haunted Mirror · c. 1890",
        description: "Silvered glass · subject to occasional breath.",
        price_pence: 120000,
        currency: "GBP",
        image_url: null,
        tags: ["mirror", "furnishing"],
        stock_status: "in_stock",
      },
      {
        id: "hh-mock-04",
        kind: "product" as const,
        name: "Oil Lamp · Still Working",
        description: "Reservoir full · wick trimmed · burns longer than it should.",
        price_pence: 18000,
        currency: "GBP",
        image_url: null,
        tags: ["lighting"],
        stock_status: "in_stock",
      },
      {
        id: "hh-mock-05",
        kind: "product" as const,
        name: "Guest Register · Vol. III",
        description: "The pages after April 1923 are blank.",
        price_pence: 32000,
        currency: "GBP",
        image_url: null,
        tags: ["paper", "ephemera"],
        stock_status: "in_stock",
      },
    ],
    sections: [],
    isVenue: false,
    context: undefined,
  };

  // Hand off the full history to the client deck. The deck owns the
  // scroll-peels-the-deck gesture + windowing to 6 visible cards at a
  // time.
  const deckMessages: DeckMessage[] = messages.map((m) => ({
    id: m.id,
    body: m.body,
    sender_account_id: m.sender_account_id,
    sent_at: m.sent_at,
    read_at: m.read_at,
  }));

  return (
    <>
      <style>{`
        html, body { background: ${NEX.bg} !important; }
        @keyframes nex-card-in {
          from { opacity: 0; transform: translateY(24px) scale(0.94); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        [data-nex-deck-top] {
          animation: nex-card-in 320ms cubic-bezier(.2,.7,.2,1) both;
        }
        @keyframes nex-replying-swap {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        /* Online-ping · green ring that expands and fades, haunted-hotel header */
        @keyframes nex-online-ping {
          0%   { transform: scale(1);    opacity: 0.85; }
          80%  { transform: scale(1.5);  opacity: 0; }
          100% { transform: scale(1.5);  opacity: 0; }
        }
        /* Spectral Smoke · owner-bubble smoke tendrils rising upward
         * (denser · taller rise · founder-direction "more ghost white
         *  shadow coming up from chat bubble") */
        @keyframes hh-smoke {
          0%   { transform: translateY(0) translateX(0) scale(0.8); opacity: 0; filter: blur(10px); }
          20%  { opacity: 0.85; }
          55%  { opacity: 0.55; filter: blur(18px); }
          100% { transform: translateY(-150px) translateX(14px) scale(2.4); opacity: 0; filter: blur(34px); }
        }
        @keyframes nex-smoke-rise {
          0%   { transform: translateY(20px) translateX(0) scale(0.55); opacity: 0; filter: blur(18px); }
          12%  { opacity: 0.42; }
          55%  { opacity: 0.26; }
          100% { transform: translateY(-320px) translateX(14px) scale(1.75); opacity: 0; filter: blur(34px); }
        }
        @keyframes nex-smoke-drift {
          0%, 100% { transform: translateX(-6px); }
          50%      { transform: translateX(6px); }
        }
      `}</style>
      {/* Haunted Hotel · ghost-energy atmosphere · fixed under the main.
          Two-layer image stack (dark base + lit top with opacity flicker),
          pulsing light haloes, and welding sparks cascading from each
          light. */}
      <HauntedHotelAtmosphere />
      {/* Haunted Hotel · animation controller. Floating 3-dots trigger
          was removed 2026-10-04 · the panel now opens from the
          composer + button's "Animations" option, which dispatches
          "nex-haunted-hotel-open-animations" that the controller
          listens for. */}
      <HauntedHotelController />
      {/* Universal chat-actions dots · founder direction 2026-10-04.
          Lives in the same bottom-right slot the HH controller used,
          now carrying Call / Video / Mic / Camera (sliding pill left
          on tap). Mount tinted to the Haunted Hotel amber accent;
          handlers default to window-event dispatch for later wiring
          to real call + capture flows. */}
      <ChatActionDots accent="#d8a856" />
      {/* PeerCallLauncher · listens for nex-chat-action-call and
          nex-chat-action-video dispatched by ChatActionDots and
          starts the real WebRTC voice/video call. Also renders its
          own top-left phone/video buttons so the call can be
          triggered from either entry point. */}
      <PeerCallLauncher
        conversationId={conversation.id}
        selfAccountId={session.account.id}
        selfDisplayName={session.account.display_name}
        peerAccountId={peer.id}
        peerDisplayName={peer.display_name}
        peerAvatarUrl={null}
      />
      <main
        style={{
          position: "relative",
          minHeight: "100dvh",
          backgroundColor: "transparent",
          color: NEX.text,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          zIndex: 1,
        }}
      >
        {/* Atmosphere blobs removed 2026-10-03. They were leftover
            from the pre-Haunted-Hotel-atmosphere version of this
            surface: a cyan + orange blurred glow pair that stacked
            over the sealed hotel atmosphere and bled a cold-blue
            cast across the viewport. HauntedHotelAtmosphere (lights,
            sparks, candle flicker) already provides the ambient
            lighting · no extra blobs needed. */}

        {/* Header */}
        <header
          style={{
            position: "relative",
            zIndex: 4,
            padding:
              "calc(env(safe-area-inset-top, 0) + 14px) 20px 12px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              position: "relative",
              flexShrink: 0,
              width: 44,
              height: 44,
            }}
          >
            {/* Online status · green rim + outward ping */}
            <span
              aria-hidden
              style={{
                position: "absolute",
                inset: -2,
                borderRadius: "50%",
                border: "2px solid #27e07d",
                boxShadow:
                  "0 0 10px rgba(39,224,125,0.55), inset 0 0 6px rgba(39,224,125,0.3)",
                pointerEvents: "none",
              }}
            />
            <span
              aria-hidden
              style={{
                position: "absolute",
                inset: -2,
                borderRadius: "50%",
                border: "2px solid #27e07d",
                animationName: "nex-online-ping",
                animationDuration: "1.9s",
                animationTimingFunction: "ease-out",
                animationIterationCount: "infinite",
                pointerEvents: "none",
              }}
            />
            <div
              aria-label={`${displayName} · online`}
              role="img"
              style={{
                position: "relative",
                width: 44,
                height: 44,
                borderRadius: "50%",
                overflow: "hidden",
                background: "rgba(10, 6, 4, 0.85)",
              }}
            >
              {avatarUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={avatarUrl}
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              ) : null}
            </div>
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{displayName}</div>
            <div
              style={{
                marginTop: 2,
                fontSize: 12,
                color: NEX.textDim,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {profession ?? "friend"}
            </div>
          </div>

          {/* Haunted Hotel standard chat header · Home / Shop / Cart.
              Same component the Joker viewer uses · drives the in-chat
              shop slider via ShopGridModal. Shop opens as a slider,
              not a page navigation. */}
          <HeaderRightCluster
            peerName={displayName}
            shop={hauntedHotelShop}
            forceShowCart={true}
            themeAccent="#d8a856"
          />
        </header>

        {/* Tier 1 · Chat Core Boundary wraps everything from here down.
            A crash reaching Tier 1 shows a minimal shell and emits a
            surface-health event. The composer remains outside tiers
            below Tier 1 so an optional-chrome failure cannot block
            message send. */}
        <ChatCoreBoundary surface={SURFACE_ID} visual_theme={PILOT_THEME_ID}>
          {/* Dev/test-only Tier 1 canary · throws when the bridge is
              on and ?__inject=core is set · dead in production. */}
          <TierOneCanary __faultInject={faults.core} />

          {/* Tier 2 · Visual Theme Boundary wraps the themed deck only.
              Fallback is the dependency-light SafeFallbackRenderer with
              the raw messages so the conversation survives even if the
              theme bundle disintegrates. */}
          <VisualThemeBoundary
            surface={SURFACE_ID}
            visual_theme={PILOT_THEME_ID}
            fallbackMessages={deckMessages.map((m) => ({
              id: m.id,
              body: m.body,
              sender_account_id: m.sender_account_id,
              sent_at: m.sent_at,
            }))}
            viewerAccountId={session.account.id}
            forceFallback={themeKillSwitched}
            forceFallbackLabel={
              themeKillSwitched
                ? `Theme temporarily unavailable · ${effectiveThemeId}`
                : undefined
            }
          >
            <DepthDeck
              messages={deckMessages}
              viewerAccountId={session.account.id}
              peerAccountId={peer.id}
              displayName={displayName}
              __faultInject={faults.theme}
            />
          </VisualThemeBoundary>

          {/* Tier 3 · Optional Visual Module Boundary wraps the smoke
              overlay. If HauntedSmoke crashes, this tier hides it and
              emits a diagnostic event — the deck and composer continue. */}
          <OptionalVisualModuleBoundary
            surface={SURFACE_ID}
            visual_theme={PILOT_THEME_ID}
            component_module="haunted-smoke"
          >
            <HauntedSmokeClient __faultInject={faults.smoke} />
          </OptionalVisualModuleBoundary>

          {/* Composer · transparent wrapper · hotel bg shows through.
              Deliberately NOT inside Tier 2 or Tier 3 so an optional
              chrome failure cannot block message send. */}
          <div
            style={{
              position: "relative",
              zIndex: 5,
              padding:
                "12px 16px calc(env(safe-area-inset-bottom, 0) + 14px)",
              background: "transparent",
            }}
          >
            <PeerComposer
              action={bind}
              placeholder={`Message ${displayName}…`}
              themeAccent="#d8a856"
              composerBg="rgba(10, 6, 4, 0.72)"
              themeEmojis={hauntedHotelEmojis}
              showAnimationsOption
              uploadAction={bindUpload}
            />
          </div>
        </ChatCoreBoundary>
      </main>
      <UniversalHeaderIconsOverlay accent="#d8a856" />
      <UniversalChromeOverlay accent="#d8a856" deep="#0A0604" />
      <UniversalComposerFooter accent="#d8a856" deep="#0A0604" themeId="haunted-hotel" />
    </>
  );
}

function MissingPeerFallback() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        display: "grid",
        placeItems: "center",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        padding: 32,
      }}
    >
      <div style={{ maxWidth: 400, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🃏</div>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>
          Maria isn&rsquo;t seeded in this environment
        </h1>
        <p
          style={{
            marginTop: 8,
            fontSize: 14,
            color: NEX.textDim,
            lineHeight: 1.55,
          }}
        >
          Run{" "}
          <code
            style={{
              background: "rgba(255,255,255,0.06)",
              padding: "2px 6px",
              borderRadius: 4,
              fontFamily: "ui-monospace, monospace",
              fontSize: 12,
            }}
          >
            NEX_ALLOW_DEV_ADMIN=1 npx tsx scripts/nex-seed-dev-friends.mts
          </code>{" "}
          then reload.
        </p>
        <Link
          href="/nex-native/chat/prototypes"
          style={{
            display: "inline-block",
            marginTop: 20,
            padding: "10px 18px",
            borderRadius: 999,
            background: "rgba(0,159,239,0.15)",
            border: `1px solid ${NEX.cyan}`,
            color: NEX.text,
            textDecoration: "none",
            fontSize: 13,
          }}
        >
          ← Back to gallery
        </Link>
      </div>
    </main>
  );
}
