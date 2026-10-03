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
import { sendPeerMessageAction } from "../../../_actions";
import { PeerComposer } from "../../peer/[accountId]/_composer";
import { DepthDeck, type DeckMessage } from "./_deck-client";
import { HauntedSmokeClient } from "./_haunted-smoke-client";
import { ChatCoreBoundary } from "@/components/nex-native/surface-health/ChatCoreBoundary";
import { VisualThemeBoundary } from "@/components/nex-native/surface-health/VisualThemeBoundary";
import { OptionalVisualModuleBoundary } from "@/components/nex-native/surface-health/OptionalVisualModuleBoundary";
import { TierOneCanary } from "./_tier-one-canary";
import { resolveFaultInjection } from "./_test-bridge";

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
  const avatarUrl = profile?.avatar_url ?? null;
  const profession = profile?.profession ?? null;
  const displayName = peer.display_name;

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
      <main
        style={{
          position: "relative",
          minHeight: "100dvh",
          backgroundColor: NEX.bg,
          backgroundImage:
            "url(/nex-native/chat/depth-cards-bg.png)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          color: NEX.text,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Subtle atmosphere blobs */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            overflow: "hidden",
            zIndex: 0,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: "-14%",
              bottom: "22%",
              width: 320,
              height: 320,
              borderRadius: "50%",
              background: "rgba(0,159,239,0.12)",
              filter: "blur(60px)",
            }}
          />
          <div
            style={{
              position: "absolute",
              right: "-12%",
              bottom: "10%",
              width: 260,
              height: 260,
              borderRadius: "50%",
              background: "rgba(255,120,0,0.10)",
              filter: "blur(70px)",
            }}
          />
        </div>

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
          <Link
            href="/nex-native/chat"
            aria-label="Back to friends"
            style={{
              flexShrink: 0,
              width: 42,
              height: 42,
              borderRadius: "50%",
              background: "rgba(0,0,0,0.35)",
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: NEX.text,
              display: "grid",
              placeItems: "center",
              textDecoration: "none",
            }}
          >
            <svg
              width={22}
              height={22}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>

          <div
            aria-hidden
            style={{
              flexShrink: 0,
              width: 44,
              height: 44,
              borderRadius: "50%",
              border: `1.5px solid ${NEX.cyan}`,
              boxShadow: "0 0 12px rgba(0,159,239,0.28)",
              overflow: "hidden",
              background: NEX.cyanDeep,
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

          <Link
            href="/nex-native/chat/prototypes"
            style={{
              alignSelf: "center",
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.75)",
              padding: "6px 12px",
              borderRadius: 999,
              background: "rgba(0,0,0,0.35)",
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
              border: "1px solid rgba(255,255,255,0.12)",
              textDecoration: "none",
            }}
          >
            Depth Cards · live
          </Link>
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
            />
          </div>
        </ChatCoreBoundary>
      </main>
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
