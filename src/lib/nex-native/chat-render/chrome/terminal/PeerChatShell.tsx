"use client";

// src/lib/nex-native/chat-render/chrome/terminal/PeerChatShell.tsx
//
// Cyber Grid · terminal chrome · RUNTIME peer-chat shell.
// -------------------------------------------------------------------
// The real, feature-carrying implementation of the terminal layout.
// Sealed spec: /nex-native/themes/cyber-grid (preview page).
//
// CORE INVARIANTS HONOURED (see chat-render/README.md doctrine):
//
//   · Every message row carries the same data-nex-msg-* attributes
//     the E2E decryptor (_e2e-decryptor.tsx) hydrates from — so
//     encryption keeps working transparently
//   · Composer form uses the caller's `composerAction` unchanged
//   · Presence pill / call launcher / typing indicator / read
//     receipts are rendered by SIBLING components (Peer{Call,Typing,
//     Presence,Read}Client) on the peer-chat page, NOT by this
//     chrome — chrome only owns the visible chat surface
//
// FEATURES DEFERRED to Phase 2b · rendered as no-ops so terminal-
// theme users don't crash but temporarily lose these affordances:
//
//   · Reactions (long-press) — reactions map is READ (rendered as
//     chips) but not writable from this chrome yet
//   · Delete (retract own message) — long-press has no menu
//   · Reply state UI — replyTarget chip is not shown above composer
//   · Attachment upload UI — pendingAttachment shows as text only
//   · Safe-trade modal — business chat gate not surfaced here
//   · Product inquiry action — deferred; product cards still render
//   · Cart-order card render — deferred; shown as plain text
//
// Any theme that needs those features today should keep
// layout_style='bubbles' or the specific richer layout until Phase
// 2b lands.

import * as React from "react";
import { usePathname } from "next/navigation";
import type { PortraitBloomShellProps } from "@/app/nex-native/chat/_portrait-bloom-shell";
import { TERMINAL_PALETTE as P, TERMINAL_MONO as MONO } from "./palette";

export function TerminalPeerChatShell(
  props: PortraitBloomShellProps,
): React.JSX.Element {
  const [draft, setDraft] = React.useState<string>("");
  const [flash, setFlash] = React.useState<boolean>(false);
  const [shopOpen, setShopOpen] = React.useState<boolean>(false);
  const [mediaOpen, setMediaOpen] = React.useState<boolean>(false);
  const [actionFor, setActionFor] = React.useState<{ id: string; mine: boolean } | null>(null);
  const [pendingSubmit, setPendingSubmit] = React.useState<boolean>(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const formRef = React.useRef<HTMLFormElement>(null);
  const feedEndRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const uploadFormRef = React.useRef<HTMLFormElement>(null);
  const pathname = usePathname();

  // Auto-scroll to the latest message on mount + whenever the
  // message list grows. Terminals show the newest line at the
  // bottom — same convention.
  React.useEffect(() => {
    feedEndRef.current?.scrollIntoView({ block: "end", behavior: "auto" });
  }, [props.messages.length]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    // Compose via the peer-chat page's Server Action · we don't
    // preventDefault so the form submits natively (Server Action).
    // We DO flash + clear the local draft optimistically so the UI
    // matches shell UX (typed text vanishes after Enter).
    if (!draft.trim()) {
      e.preventDefault();
      return;
    }
    setPendingSubmit(true);
    setFlash(true);
    setTimeout(() => {
      setFlash(false);
      setDraft("");
      setPendingSubmit(false);
    }, 260);
  };

  const peerFirstName = props.displayName.trim();
  const stockShown = props.peerShop && props.peerShop.products.length > 0;

  return (
    <>
      <style>{`
        html, body { background: ${P.bg} !important; margin: 0; }
        [data-cg-shell-root] * { box-sizing: border-box; }
        @keyframes cg-portrait-ping {
          0%   { transform: scale(1);    opacity: 0.60; }
          80%  { transform: scale(1.55); opacity: 0; }
          100% { transform: scale(1.55); opacity: 0; }
        }
        [data-cg-shell-root] [data-cg-ping] {
          position: absolute;
          inset: -3px;
          border-radius: 50%;
          border: 2px solid ${P.cursor};
          animation: cg-portrait-ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
          pointer-events: none;
        }
        [data-cg-shell-root] [data-cg-ping-2] { animation-delay: 0.9s; }
        @keyframes cg-cursor-blink {
          0%, 45%   { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        [data-cg-shell-root] [data-cg-cursor] {
          display: inline-block;
          width: 10px;
          height: 16px;
          vertical-align: text-bottom;
          margin-left: 1px;
          background: ${P.cursor};
          box-shadow: 0 0 10px ${P.glow};
          animation: cg-cursor-blink 1.05s steps(1, end) infinite;
        }
      `}</style>

      <main
        data-cg-shell-root
        data-scope={props.scope}
        style={{
          position: "relative",
          minHeight: "100dvh",
          background: P.bg,
          color: P.body,
          fontFamily: MONO,
          fontSize: 14,
          lineHeight: 1.55,
          overflow: "hidden",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0) + 68px)",
        }}
      >
        {/* Wallpaper · when the theme provides one, paint it dim so
            log rows stay legible. */}
        {props.wallpaperUrl && (
          <div
            aria-hidden
            style={{
              position: "fixed",
              inset: 0,
              backgroundImage: `url(${props.wallpaperUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              opacity: 0.42,
              filter: "saturate(1.1) contrast(1.05)",
              pointerEvents: "none",
              zIndex: 0,
            }}
          />
        )}
        <div
          aria-hidden
          style={{
            position: "fixed",
            inset: 0,
            background:
              "radial-gradient(80% 60% at 50% 40%, transparent 0%, rgba(0,0,0,0.55) 100%)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

        {/* Header · avatar with online ping · name + profession
            subtitle · right cluster (back · shop · home). */}
        <header
          style={{
            position: "relative",
            zIndex: 5,
            padding: "calc(env(safe-area-inset-top, 0) + 8px) 14px 8px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            background:
              "linear-gradient(180deg, rgba(5,15,10,0.85) 0%, rgba(5,15,10,0.55) 60%, transparent 100%)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            borderBottom: `1px solid rgba(76,255,122,0.18)`,
          }}
        >
          <div style={{ position: "relative", width: 52, height: 52, flexShrink: 0 }}>
            {props.presenceKind === "online" && (
              <>
                <span aria-hidden data-cg-ping />
                <span aria-hidden data-cg-ping data-cg-ping-2 />
              </>
            )}
            <div
              aria-hidden
              style={{
                position: "relative",
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: props.portraitUrl
                  ? `url(${props.portraitUrl}) center/cover`
                  : `linear-gradient(135deg, ${P.mariaName} 0%, ${P.bg} 100%)`,
                border: `2px solid ${
                  props.presenceKind === "online" ? P.cursor : P.panelDim
                }`,
                boxShadow: `0 0 12px ${P.glow}, inset 0 0 6px rgba(0,0,0,0.35)`,
                display: "grid",
                placeItems: "center",
              }}
            >
              {!props.portraitUrl && (
                <span
                  style={{
                    color: P.body,
                    fontFamily: MONO,
                    fontSize: 20,
                    fontWeight: 700,
                  }}
                >
                  {initials(props.displayName)}
                </span>
              )}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: P.body,
                lineHeight: 1.15,
                fontFamily: MONO,
                display: "flex",
                alignItems: "baseline",
                gap: 8,
              }}
            >
              {peerFirstName}
              {props.isOfficialPeer && (
                <span
                  style={{
                    fontSize: 10,
                    padding: "1px 6px",
                    borderRadius: 3,
                    color: P.cursor,
                    border: `1px solid ${P.cursor}`,
                    letterSpacing: "0.05em",
                  }}
                >
                  NEX · Official
                </span>
              )}
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: P.mariaName,
                marginTop: 2,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                textShadow: `0 0 6px ${P.glow}`,
              }}
            >
              {props.subtitle ?? props.presenceLabel}
            </div>
            {props.contextChip && (
              <div
                style={{
                  marginTop: 3,
                  fontSize: 11,
                  color: P.panelDim,
                }}
              >
                {props.contextChip.label}
                {props.contextChip.sublabel && (
                  <span style={{ marginLeft: 6, color: P.timestamp }}>
                    · {props.contextChip.sublabel}
                  </span>
                )}
              </div>
            )}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexShrink: 0,
            }}
          >
            {stockShown && (
              <button
                type="button"
                onClick={() => setShopOpen(true)}
                aria-label="Open shop"
                style={iconButtonStyle()}
              >
                🛍
              </button>
            )}
            <a
              href={props.backHref}
              aria-label="Back"
              style={{ ...iconButtonStyle(), textDecoration: "none" }}
            >
              &lt;
            </a>
          </div>
        </header>

        {/* Terminal log feed · every message renders as
            `> <name> [HH:MM]: <body>` and carries the E2E
            data-nex-msg-* attributes so the client-side decryptor
            can swap ciphertext → plaintext on hydration. */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            maxWidth: 720,
            margin: "0 auto",
            padding: "12px 18px 24px",
            display: "grid",
            gap: 6,
          }}
        >
          <div
            style={{
              color: P.panelDim,
              fontSize: 12,
              letterSpacing: "0.04em",
              paddingBottom: 8,
              borderBottom: `1px dashed ${P.bannerRule}`,
              marginBottom: 6,
              textShadow: `0 0 8px ${P.glow}`,
            }}
          >
            nex-chat v3 · {peerFirstName} · secure
          </div>

          {props.messages.map((m) => (
            <div
              key={m.id}
              data-nex-bloom-msg
              data-nex-bloom-msg-mine={m.mine ? "true" : undefined}
              data-nex-bloom-msg-deleted={m.deleted_for_everyone ? "true" : undefined}
              data-nex-bloom-msg-layout={props.layoutStyle ?? "terminal"}
              data-nex-msg-id={m.id}
              /* Bridge 76 · encryption payload for client-side
                 decrypt. Read by _e2e-decryptor.tsx which replaces
                 the body text on hydration. */
              data-nex-msg-encrypted={m.encrypted ? "true" : undefined}
              data-nex-msg-ct={m.ciphertext_b64 ?? undefined}
              data-nex-msg-nonce={m.nonce_b64 ?? undefined}
              data-nex-msg-sender-pub={m.sender_public_key ?? undefined}
              data-nex-msg-sender-dev={m.sender_device_id ?? undefined}
              data-nex-msg-sender-acc={m.sender_account_id ?? undefined}
              data-nex-msg-recipient-dev={m.recipient_device_id ?? undefined}
              /* Bridge 77 · sent_at so the decryptor persists the
                 plaintext into IndexedDB with the right timestamp. */
              data-nex-msg-sent-at={m.sent_at}
              /* Bridge 96 Phase 2d · long-press (right-click) opens
                 the terminal action menu: reactions + Reply + Delete
                 (delete only when the message is yours). If the peer
                 chat page hasn't wired any of the corresponding
                 actions, the menu still opens but the missing rows
                 render disabled. */
              onContextMenu={(e) => {
                if (m.deleted_for_everyone) return;
                e.preventDefault();
                setActionFor({ id: m.id, mine: m.mine });
              }}
              style={{
                color: P.body,
                fontFamily: MONO,
                fontSize: 14,
                lineHeight: 1.55,
                display: "block",
                cursor: !m.deleted_for_everyone ? "context-menu" : "default",
              }}
            >
              <TerminalRow msg={m} peerName={peerFirstName} />
            </div>
          ))}
          <div ref={feedEndRef} />
        </div>

        {/* Shop modal · triggered by the header shop icon. */}
        {shopOpen && props.peerShop && (
          <TerminalShopModal
            title={props.peerShop.name}
            products={props.peerShop.products}
            isVenue={props.peerShop.isVenue}
            onClose={() => setShopOpen(false)}
          />
        )}

        {/* Bridge 96 Phase 2b · media modal · triggered by the +
            button in the composer. Terminal-styled tiles for Photo /
            Voice (deferred) / Themes. Photo tile triggers a hidden
            file input which submits via the peer-chat page's
            uploadAction, same server action the bubbles chrome uses,
            so E2E envelope encryption keeps working. */}
        {mediaOpen && (
          <TerminalMediaModal
            onClose={() => setMediaOpen(false)}
            onPhoto={() => {
              setMediaOpen(false);
              fileInputRef.current?.click();
            }}
            uploadEnabled={!!props.uploadAction}
          />
        )}

        {/* Bridge 96 Phase 2d · long-press action menu · reactions
            row + Reply (always) + Delete (own messages only). Reply
            navigates to the current pathname with ?reply=<id> so the
            peer-chat page picks it up and passes replyTarget back to
            this chrome next render. Delete submits via
            props.deleteAction. Reactions submit via
            props.toggleReactionAction. Rows for missing actions
            render disabled — Cyber Grid users don't get a broken UI
            when a feature isn't wired. */}
        {actionFor && (
          <TerminalActionMenu
            messageId={actionFor.id}
            mine={actionFor.mine}
            replyHref={`${pathname ?? ""}?reply=${encodeURIComponent(actionFor.id)}`}
            onClose={() => setActionFor(null)}
            reactionAction={props.toggleReactionAction ?? null}
            deleteAction={props.deleteAction ?? null}
          />
        )}

        {/* Bridge 96 Phase 2b · hidden file-input form · submits to
            the peer-chat page's uploadAction on file pick. Server
            action redirects back with the uploaded URL on the query
            string, at which point pendingAttachment renders above
            the composer. */}
        {props.uploadAction && (
          <form
            ref={uploadFormRef}
            action={props.uploadAction as (fd: FormData) => void}
            encType="multipart/form-data"
            style={{ display: "none" }}
          >
            <input
              ref={fileInputRef}
              type="file"
              name="attachment_file"
              accept="image/*,video/*,audio/*"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  uploadFormRef.current?.requestSubmit();
                }
              }}
            />
          </form>
        )}

        {/* Composer · pinned to viewport bottom · block cursor +
            green `[↵]` when there's text · submits via the peer-chat
            page's Server Action. */}
        <form
          ref={formRef}
          action={props.composerAction as (fd: FormData) => void}
          onSubmit={handleSubmit}
          onClick={() => inputRef.current?.focus()}
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 6,
            padding: "10px 20px calc(env(safe-area-inset-bottom, 0) + 12px)",
            background:
              "linear-gradient(0deg, rgba(5,15,10,0.94) 0%, rgba(5,15,10,0.85) 60%, rgba(5,15,10,0.55) 100%)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            borderTop: `1px dashed ${P.bannerRule}`,
            cursor: "text",
          }}
        >
          {/* Bridge 96 Phase 2d · reply_to_id hidden field so the
              server action receives the quoted message id when a
              reply is in progress. */}
          {props.replyTarget && (
            <input type="hidden" name="reply_to_id" value={props.replyTarget.id} />
          )}
          {/* Bridge 96 Phase 2d · reply-chip strip · shown above the
              composer when props.replyTarget is set (peer-chat page
              resolved ?reply=<id> from URL). Terminal-styled dashed
              emerald frame · [x] button clears via the clearHref
              navigation the peer-chat page provided. The composer
              form below smuggles reply_to_id via a hidden input so
              the sent message carries the quote server-side. */}
          {props.replyTarget && (
            <div
              style={{
                maxWidth: 720,
                margin: "0 auto 6px",
                padding: "6px 10px",
                border: `1px dashed rgba(76,255,122,0.42)`,
                borderLeft: `3px solid ${P.mariaName}`,
                borderRadius: 6,
                background: "rgba(6,18,12,0.6)",
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                fontSize: 12,
                fontFamily: MONO,
                color: P.body,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <span style={{ color: P.chevron, fontWeight: 700, flexShrink: 0 }}>&gt;</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    color: props.replyTarget.mine ? P.philipName : P.mariaName,
                    fontWeight: 600,
                    fontSize: 11,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}
                >
                  replying to {props.replyTarget.mine ? "you" : props.replyTarget.peerName.toLowerCase()}
                </div>
                <div
                  style={{
                    color: P.body,
                    marginTop: 2,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {truncate(props.replyTarget.body, 90)}
                </div>
              </div>
              <a
                href={props.replyTarget.clearHref}
                aria-label="Cancel reply"
                style={{
                  padding: "1px 8px",
                  fontSize: 11,
                  color: P.philipName,
                  textDecoration: "none",
                  border: `1px solid ${P.philipName}55`,
                  borderRadius: 3,
                  flexShrink: 0,
                }}
              >
                [x]
              </a>
            </div>
          )}
          {/* Bridge 96 Phase 2b · pending-attachment preview strip ·
              shown above the composer when the peer-chat page
              resolves a pending attachment from the URL query state.
              Terminal-styled dashed emerald frame · [x] button
              clears via the peer-chat clearHref navigation. */}
          {props.pendingAttachment && (
            <div
              style={{
                maxWidth: 720,
                margin: "0 auto 8px",
                padding: "6px 8px",
                border: `1px dashed rgba(76,255,122,0.42)`,
                borderRadius: 6,
                background: "rgba(6,18,12,0.55)",
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
                fontFamily: MONO,
                color: P.body,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <span style={{ color: P.chevron, fontWeight: 700 }}>&gt;</span>
              <span style={{ color: P.mariaName, fontWeight: 600 }}>
                attach:
              </span>
              <span style={{ color: P.body, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {props.pendingAttachment.kind === "image" && "photo"}
                {props.pendingAttachment.kind === "video" && "video"}
                {props.pendingAttachment.kind === "audio" && "voice note"}
                {props.pendingAttachment.encrypted ? " · encrypted" : ""}
              </span>
              <a
                href={props.pendingAttachment.clearHref}
                aria-label="Remove attachment"
                style={{
                  padding: "1px 8px",
                  fontSize: 11,
                  color: P.philipName,
                  textDecoration: "none",
                  border: `1px solid ${P.philipName}55`,
                  borderRadius: 3,
                }}
              >
                [x]
              </a>
            </div>
          )}
          <div
            style={{
              maxWidth: 720,
              margin: "0 auto",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {/* + button · opens the media modal · matches the bubbles
                composer affordance so users don't lose attachment
                access when their peer is on Cyber Grid. */}
            {props.uploadAction && (
              <button
                type="button"
                aria-label="Add media"
                onClick={(e) => {
                  e.stopPropagation();
                  setMediaOpen(true);
                }}
                style={composerIconStyle()}
              >
                +
              </button>
            )}
            <div
              style={{
                position: "relative",
                flex: 1,
                minWidth: 0,
                display: "flex",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  color: P.body,
                  fontFamily: MONO,
                  fontSize: 14,
                  lineHeight: 1.55,
                  whiteSpace: "pre",
                  overflow: "hidden",
                  textOverflow: "clip",
                  maxWidth: "100%",
                }}
              >
                {draft || (
                  <span style={{ color: P.timestamp }}>
                    {props.composerPlaceholder}
                  </span>
                )}
              </span>
              <span aria-hidden data-cg-cursor />
              <input
                ref={inputRef}
                type="text"
                name="body"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                aria-label={props.composerPlaceholder}
                autoComplete="off"
                required
                disabled={pendingSubmit}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "transparent",
                  caretColor: "transparent",
                  fontFamily: MONO,
                  fontSize: 14,
                  lineHeight: 1.55,
                  padding: 0,
                }}
              />
            </div>
            <button
              type="submit"
              aria-label="Send"
              disabled={draft.trim().length === 0 || pendingSubmit}
              style={{
                fontFamily: MONO,
                fontSize: 12,
                padding: "3px 10px",
                borderRadius: 4,
                cursor:
                  draft.trim().length > 0 && !pendingSubmit
                    ? "pointer"
                    : "default",
                background: "transparent",
                color:
                  flash || draft.trim().length > 0
                    ? P.cursor
                    : P.panelDim,
                border: `1px solid ${
                  flash || draft.trim().length > 0
                    ? P.cursor
                    : "rgba(94,120,102,0.4)"
                }`,
                textShadow:
                  flash || draft.trim().length > 0
                    ? `0 0 8px ${P.glow}`
                    : "none",
                transition:
                  "color 180ms, border-color 180ms, text-shadow 180ms",
              }}
            >
              [↵]
            </button>
          </div>
        </form>
      </main>
    </>
  );
}

// ─── Message row · terminal format ───────────────────────────────────

function TerminalRow({
  msg,
  peerName,
}: {
  msg: PortraitBloomShellProps["messages"][number];
  peerName: string;
}): React.JSX.Element {
  const nameColor = msg.mine ? P.philipName : P.mariaName;
  const nameLabel = msg.mine ? "you" : peerName.toLowerCase();
  const hhmm = new Date(msg.sent_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  if (msg.deleted_for_everyone) {
    return (
      <div>
        <span style={{ color: P.chevron, fontWeight: 700, marginRight: 6 }}>
          &gt;
        </span>
        <span style={{ color: nameColor, fontWeight: 600, marginRight: 6 }}>
          {nameLabel}
        </span>
        <span style={{ color: P.timestamp, marginRight: 8 }}>[{hhmm}]:</span>
        <span style={{ color: P.timestamp, fontStyle: "italic" }}>
          🚫 message deleted
        </span>
      </div>
    );
  }

  const reactions = Object.entries(msg.reactions ?? {}).filter(
    ([, accs]) => accs.length > 0,
  );
  return (
    <div>
      {msg.reply_preview && (
        <div
          style={{
            marginLeft: 24,
            marginBottom: 2,
            paddingLeft: 8,
            borderLeft: `2px dashed ${P.timestamp}`,
            color: P.timestamp,
            fontSize: 12,
          }}
        >
          {msg.reply_preview.mine ? "you" : peerName.toLowerCase()}:{" "}
          {truncate(msg.reply_preview.body, 80)}
        </div>
      )}
      <div>
        <span style={{ color: P.chevron, fontWeight: 700, marginRight: 6 }}>
          &gt;
        </span>
        <span style={{ color: nameColor, fontWeight: 600, marginRight: 6 }}>
          {nameLabel}
        </span>
        <span style={{ color: P.timestamp, marginRight: 8 }}>[{hhmm}]:</span>
        <span>{msg.body}</span>
      </div>
      {reactions.length > 0 && (
        <div
          style={{
            marginLeft: 24,
            marginTop: 2,
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          {reactions.map(([emoji, accs]) => (
            <span
              key={emoji}
              style={{
                fontSize: 12,
                padding: "1px 6px",
                borderRadius: 3,
                background: "rgba(76,255,122,0.06)",
                border: `1px dashed rgba(76,255,122,0.32)`,
                color: P.body,
              }}
            >
              {emoji} {accs.length}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Shop modal · terminal-styled grid ───────────────────────────────

interface ShopProductLite {
  product_id: string;
  name: string;
  price_pence: number;
  currency: string;
  stock_status: string | null;
  image_url: string | null;
  slug: string | null;
}

function TerminalShopModal({
  title,
  products,
  isVenue,
  onClose,
}: {
  title: string;
  products: ShopProductLite[];
  isVenue?: boolean;
  onClose: () => void;
}): React.JSX.Element {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isVenue ? "Menu" : "Shop"}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 40,
        background: "rgba(3,8,6,0.72)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 720,
          maxHeight: "82dvh",
          overflowY: "auto",
          overflowX: "hidden",
          background: P.bg,
          borderTop: `1px dashed ${P.cursor}`,
          borderLeft: `1px dashed rgba(76,255,122,0.4)`,
          borderRight: `1px dashed rgba(76,255,122,0.4)`,
          borderRadius: "10px 10px 0 0",
          boxShadow: `0 -12px 40px rgba(0,0,0,0.65), 0 0 24px ${P.glow}`,
          padding: "14px 18px calc(env(safe-area-inset-bottom, 0) + 18px)",
          display: "grid",
          gap: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            paddingBottom: 8,
            borderBottom: `1px dashed ${P.bannerRule}`,
          }}
        >
          <div style={{ color: P.panelDim, fontSize: 12, letterSpacing: "0.04em" }}>
            <span style={{ color: P.chevron, fontWeight: 700 }}>&gt; </span>
            <span style={{ color: P.mariaName, fontWeight: 600 }}>
              {isVenue ? "menu" : "shop"}
            </span>
            <span>
              {" "}· {title} · {products.length}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close shop"
            style={{
              padding: "3px 10px",
              fontSize: 12,
              color: P.mariaName,
              background: "transparent",
              border: `1px dashed rgba(76,255,122,0.42)`,
              borderRadius: 4,
              cursor: "pointer",
              fontFamily: MONO,
            }}
          >
            [x close]
          </button>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: 10,
            paddingBottom: 4,
          }}
        >
          {products.map((p) => (
            <TerminalShopCard key={p.product_id} product={p} />
          ))}
        </div>
      </div>
    </div>
  );
}

function TerminalShopCard({
  product,
}: {
  product: ShopProductLite;
}): React.JSX.Element {
  const soldOut = product.stock_status === "sold_out";
  const stockColor =
    product.stock_status === "sold_out"
      ? "#FF7373"
      : product.stock_status === "low_stock"
        ? P.philipName
        : P.mariaName;
  const priceLabel = formatMoney(product.currency, product.price_pence);
  return (
    <a
      href={product.slug ? `/nex-native/${product.slug}` : "#"}
      style={{
        display: "grid",
        gridTemplateRows: "84px auto auto auto",
        gap: 6,
        padding: 10,
        borderRadius: 8,
        border: `1px dashed rgba(76,255,122,0.42)`,
        background: "rgba(6,18,12,0.55)",
        textDecoration: "none",
        color: P.body,
        fontFamily: MONO,
        fontSize: 12,
        opacity: soldOut ? 0.72 : 1,
      }}
    >
      <div
        style={{
          position: "relative",
          background: "rgba(76,255,122,0.06)",
          border: `1px solid rgba(76,255,122,0.28)`,
          backgroundImage: product.image_url
            ? `url(${product.image_url})`
            : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          borderRadius: 4,
          display: "grid",
          placeItems: "center",
          overflow: "hidden",
        }}
      >
        {!product.image_url && (
          <span
            aria-hidden
            style={{
              color: P.chevron,
              fontFamily: MONO,
              fontSize: 22,
              letterSpacing: "0.05em",
              textShadow: `0 0 6px ${P.glow}`,
            }}
          >
            [ img ]
          </span>
        )}
      </div>
      <div style={{ color: P.body, fontWeight: 600, lineHeight: 1.25 }}>
        {product.name}
      </div>
      <div style={{ color: P.mariaName, fontWeight: 700 }}>{priceLabel}</div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span style={{ color: stockColor, fontSize: 11 }}>
          {product.stock_status ?? "in_stock"}
        </span>
        <span
          aria-hidden
          style={{
            fontSize: 11,
            padding: "2px 6px",
            borderRadius: 3,
            color: soldOut ? P.panelDim : P.cursor,
            border: `1px solid ${soldOut ? "rgba(94,120,102,0.4)" : P.cursor}`,
            textShadow: soldOut ? "none" : `0 0 6px ${P.glow}`,
          }}
        >
          {soldOut ? "[--]" : "[+ add]"}
        </span>
      </div>
    </a>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

function iconButtonStyle(): React.CSSProperties {
  return {
    width: 34,
    height: 34,
    borderRadius: 8,
    display: "grid",
    placeItems: "center",
    color: P.mariaName,
    background: "rgba(76,255,122,0.06)",
    border: `1px solid rgba(76,255,122,0.32)`,
    fontFamily: MONO,
    fontSize: 14,
    cursor: "pointer",
    boxShadow: `0 0 8px rgba(76,255,122,0.08)`,
    padding: 0,
  };
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function formatMoney(currency: string, minor: number): string {
  const c = currency.toUpperCase();
  if (c === "IDR") {
    return `Rp ${Math.round(minor / 100).toLocaleString("id-ID")}`;
  }
  const symbol = c === "GBP" ? "£" : c === "USD" ? "$" : c === "EUR" ? "€" : `${c} `;
  return `${symbol}${(minor / 100).toFixed(2)}`;
}

// ─── Media modal · terminal-styled attachment picker ─────────────────

function TerminalMediaModal({
  onClose,
  onPhoto,
  uploadEnabled,
}: {
  onClose: () => void;
  onPhoto: () => void;
  uploadEnabled: boolean;
}): React.JSX.Element {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add media"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(3,8,6,0.72)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(340px, calc(100vw - 40px))",
          background: P.bg,
          border: `1px dashed ${P.cursor}`,
          borderRadius: 10,
          boxShadow: `0 20px 50px rgba(0,0,0,0.65), 0 0 24px ${P.glow}`,
          padding: "16px 18px",
          fontFamily: MONO,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            paddingBottom: 8,
            borderBottom: `1px dashed ${P.bannerRule}`,
            marginBottom: 12,
          }}
        >
          <div style={{ color: P.panelDim, fontSize: 12, letterSpacing: "0.04em" }}>
            <span style={{ color: P.chevron, fontWeight: 700 }}>&gt; </span>
            <span style={{ color: P.mariaName, fontWeight: 600 }}>attach</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              padding: "3px 10px",
              fontSize: 11,
              color: P.mariaName,
              background: "transparent",
              border: `1px dashed rgba(76,255,122,0.42)`,
              borderRadius: 4,
              cursor: "pointer",
              fontFamily: MONO,
            }}
          >
            [x]
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
          <MediaTile
            label="Photo / Video"
            hint="pick from device"
            enabled={uploadEnabled}
            onActivate={onPhoto}
          />
          <MediaTile
            label="Voice note"
            hint="coming soon"
            enabled={false}
          />
          <MediaTile
            label="Camera capture"
            hint="coming soon"
            enabled={false}
          />
          <MediaTile
            label="Theme picker"
            hint="/nex-native/chat-themes-library"
            enabled
            href="/nex-native/chat-themes-library"
          />
        </div>
      </div>
    </div>
  );
}

function MediaTile({
  label,
  hint,
  enabled,
  onActivate,
  href,
}: {
  label: string;
  hint: string;
  enabled: boolean;
  onActivate?: () => void;
  href?: string;
}): React.JSX.Element {
  const inner = (
    <>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: enabled ? P.body : P.panelDim,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 10,
          color: enabled ? P.mariaName : P.timestamp,
          marginTop: 2,
        }}
      >
        {hint}
      </div>
    </>
  );
  const style: React.CSSProperties = {
    padding: "12px 10px",
    borderRadius: 6,
    border: `1px dashed ${enabled ? "rgba(76,255,122,0.42)" : "rgba(94,120,102,0.35)"}`,
    background: enabled ? "rgba(76,255,122,0.06)" : "rgba(6,18,12,0.4)",
    cursor: enabled ? "pointer" : "default",
    fontFamily: MONO,
    textDecoration: "none",
    color: P.body,
    display: "block",
    opacity: enabled ? 1 : 0.62,
  };
  if (href) {
    return (
      <a href={href} style={style}>
        {inner}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={onActivate}
      disabled={!enabled}
      style={style}
    >
      {inner}
    </button>
  );
}

// ─── Action menu · long-press on any log row ─────────────────────────
//
// Combines the reaction picker + Reply + Delete affordances into one
// terminal-styled dialog. Rows for missing actions render disabled
// rather than hidden so the terminal-user's mental model of "here's
// what you can do to a message" stays consistent.

const QUICK_REACTIONS = ["❤️", "🔥", "😂", "😢", "👏", "🎉", "👍", "✨"];

function TerminalActionMenu({
  messageId,
  mine,
  replyHref,
  onClose,
  reactionAction,
  deleteAction,
}: {
  messageId: string;
  mine: boolean;
  replyHref: string;
  onClose: () => void;
  reactionAction: ((fd: FormData) => Promise<never> | void | Promise<void>) | null;
  deleteAction: ((fd: FormData) => Promise<never> | void | Promise<void>) | null;
}): React.JSX.Element {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const [confirmDelete, setConfirmDelete] = React.useState<boolean>(false);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Message actions"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(3,8,6,0.72)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          padding: "12px 14px",
          background: P.bg,
          border: `1px dashed ${P.cursor}`,
          borderRadius: 10,
          boxShadow: `0 12px 34px rgba(0,0,0,0.6), 0 0 20px ${P.glow}`,
          display: "grid",
          gap: 10,
          fontFamily: MONO,
          minWidth: 300,
        }}
      >
        {/* Reactions row · disabled state when no action wired. */}
        <div
          style={{
            display: "flex",
            gap: 6,
            justifyContent: "space-between",
            opacity: reactionAction ? 1 : 0.45,
          }}
        >
          {QUICK_REACTIONS.map((emoji) => (
            <form
              key={emoji}
              action={reactionAction as ((fd: FormData) => void) | undefined}
              style={{ display: "inline" }}
            >
              <input type="hidden" name="message_id" value={messageId} />
              <input type="hidden" name="emoji" value={emoji} />
              <button
                type="submit"
                disabled={!reactionAction}
                onClick={() => reactionAction && setTimeout(onClose, 0)}
                aria-label={`React ${emoji}`}
                style={{
                  fontSize: 20,
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  border: `1px solid rgba(76,255,122,0.28)`,
                  background: "rgba(76,255,122,0.06)",
                  cursor: reactionAction ? "pointer" : "default",
                  display: "grid",
                  placeItems: "center",
                  padding: 0,
                }}
              >
                {emoji}
              </button>
            </form>
          ))}
        </div>

        {/* Divider */}
        <div style={{ borderTop: `1px dashed ${P.bannerRule}`, margin: "2px 0" }} />

        {/* Reply · always available · navigates to ?reply=<id> so the
            peer-chat page can pick it up and pass replyTarget on the
            next render. */}
        <a
          href={replyHref}
          onClick={() => setTimeout(onClose, 0)}
          style={actionRowStyle(P.mariaName)}
        >
          <span style={{ color: P.chevron, marginRight: 8 }}>&gt;</span>
          <span style={{ flex: 1 }}>reply</span>
          <span style={{ color: P.panelDim, fontSize: 11 }}>↵</span>
        </a>

        {/* Delete · only when the message is yours AND deleteAction
            is wired. Two-click confirm to avoid accidental retract. */}
        {mine && (
          deleteAction ? (
            confirmDelete ? (
              <form
                action={deleteAction as (fd: FormData) => void}
                style={{ display: "flex", gap: 6 }}
              >
                <input type="hidden" name="message_id" value={messageId} />
                <button
                  type="submit"
                  onClick={() => setTimeout(onClose, 0)}
                  style={{
                    ...actionRowStyle("#FF7373"),
                    flex: 1,
                    border: `1px solid #FF7373`,
                    background: "rgba(255,115,115,0.08)",
                  }}
                >
                  <span style={{ color: "#FF7373", marginRight: 8 }}>&gt;</span>
                  <span style={{ flex: 1 }}>confirm delete for everyone</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  style={{
                    ...actionRowStyle(P.panelDim),
                    background: "transparent",
                    border: `1px solid ${P.panelDim}66`,
                  }}
                >
                  cancel
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                style={actionRowStyle("#FF7373")}
              >
                <span style={{ color: "#FF7373", marginRight: 8 }}>&gt;</span>
                <span style={{ flex: 1 }}>delete for everyone</span>
                <span style={{ color: P.panelDim, fontSize: 11 }}>⇧⌫</span>
              </button>
            )
          ) : (
            <div style={{ ...actionRowStyle(P.panelDim), opacity: 0.45 }}>
              <span style={{ color: P.chevron, marginRight: 8 }}>&gt;</span>
              <span style={{ flex: 1 }}>delete unavailable in preview</span>
            </div>
          )
        )}

        {/* Close · escape key also works. */}
        <button
          type="button"
          onClick={onClose}
          style={{
            ...actionRowStyle(P.body),
            justifyContent: "center",
            background: "transparent",
            border: `1px dashed ${P.bannerRule}`,
          }}
        >
          [x close]
        </button>
      </div>
    </div>
  );
}

function actionRowStyle(color: string): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    padding: "8px 12px",
    fontFamily: MONO,
    fontSize: 13,
    color,
    background: "rgba(76,255,122,0.05)",
    border: `1px solid rgba(76,255,122,0.28)`,
    borderRadius: 6,
    cursor: "pointer",
    textDecoration: "none",
    letterSpacing: "0.02em",
  };
}
