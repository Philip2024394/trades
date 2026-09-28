// src/app/nex-native/[businessSlug]/_floating-chat-button.tsx
//
// Bridge 16c · Floating "Chat with seller" button.
// -----------------------------------------------
// Fixed-position round button pinned to the bottom-right of every
// visitor-facing shop surface (shop landing, menu page, product
// detail page). One tap opens the peer chat with the owner.
//
// Server Component · no client state · pure Link. Anonymous
// visitors get redirected to /sign-in when they land on the chat
// page (handled by the peer chat page itself). Signed-in visitors
// go straight into the JIT safe-trade consent modal on first
// commerce chat entry.
//
// Not shown to the owner viewing their own shop · avoids the
// awkward "chat with yourself" UX. Caller checks ownership.

import Link from "next/link";

export function FloatingChatButton({
  ownerAccountId,
  sellerFirstName,
  isOwnerViewing = false,
}: {
  ownerAccountId: string;
  /** Used only for the accessible label · "Chat with Priya". */
  sellerFirstName: string;
  /** When true (viewer IS the shop owner) the button doesn't
   *  render · avoids "chat with yourself". */
  isOwnerViewing?: boolean;
}) {
  if (isOwnerViewing) return null;

  return (
    <>
      {/* Wrapper anchors to the viewport, not the parent · so the
          button floats even inside scrolling containers. */}
      <div
        data-nex-floating-chat
        aria-hidden={false}
        style={{
          position: "fixed",
          right: "calc(env(safe-area-inset-right, 0) + 20px)",
          bottom: "calc(env(safe-area-inset-bottom, 0) + 20px)",
          zIndex: 60,
          pointerEvents: "none",
        }}
      >
        <Link
          href={`/nex-native/chat/peer/${ownerAccountId}`}
          aria-label={`Chat with ${sellerFirstName}`}
          title={`Chat with ${sellerFirstName}`}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 64,
            height: 64,
            borderRadius: 999,
            background:
              "linear-gradient(180deg, #FF9033 0%, #FF7200 100%)",
            border: "1px solid rgba(255,114,0,0.60)",
            color: "#0B0F1A",
            fontSize: 26,
            textDecoration: "none",
            boxShadow:
              "0 18px 42px rgba(255,114,0,0.42), 0 6px 14px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.35)",
            pointerEvents: "auto",
            transition: "transform 120ms ease-out",
            fontFamily:
              "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          }}
        >
          <span aria-hidden style={{ lineHeight: 1 }}>
            💬
          </span>
        </Link>
        {/* Small "Chat" label chip beneath · reinforces the affordance
            without cluttering the round button. Rendered as a
            separate element so a11y and pointer events stay clean. */}
        <div
          aria-hidden
          style={{
            marginTop: 6,
            fontSize: 9,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#FF7200",
            fontWeight: 800,
            textAlign: "center",
            textShadow: "0 1px 6px rgba(0,0,0,0.6)",
            pointerEvents: "none",
          }}
        >
          Chat
        </div>
      </div>
    </>
  );
}
