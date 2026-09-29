"use client";

// src/app/nex-native/chat/peer/[accountId]/_archive-panel.tsx
//
// Bridge 79 · Archived-history reveal for the peer chat page.
// -----------------------------------------------------------
// When Bridge 78 purges delivered-encrypted rows from the server, the
// plaintext still lives in this device's IndexedDB cache (Bridge 77).
// Server render can't show those messages any more · this component
// reads IDB and, if any messages exist that ARE NOT present in the
// current server-rendered DOM, surfaces them via a floating pill and
// modal.
//
// v1 approach: dedicated "Archived history" affordance rather than
// inline merge. Keeps the existing shell rendering untouched and
// avoids fighting React over DOM children. Future work can inline
// the archived rows into the main message list.
//
// The reveal is opt-in — the pill announces the count, the modal
// shows the content. Nothing is auto-injected into the main scroll.

import * as React from "react";
import {
  getMessagesForConversation,
  type CachedMessage,
} from "@/lib/nex-native/crypto/message-store";

export interface ArchivePanelProps {
  conversationId: string;
  peerDisplayName: string;
  selfAccountId: string;
  disabled?: boolean;
}

export function ArchivePanel(props: ArchivePanelProps): React.JSX.Element | null {
  const [archived, setArchived] = React.useState<CachedMessage[]>([]);
  const [open, setOpen] = React.useState(false);
  const [checked, setChecked] = React.useState(false);

  const scan = React.useCallback(async () => {
    const cached = await getMessagesForConversation(props.conversationId);
    if (cached.length === 0) {
      setArchived([]);
      setChecked(true);
      return;
    }
    // Diff against the DOM. Any cached message whose id isn't rendered
    // as a bubble is "archived" from the current server response.
    const visibleIds = new Set<string>();
    document
      .querySelectorAll<HTMLElement>("[data-nex-msg-id]")
      .forEach((el) => {
        const id = el.dataset.nexMsgId;
        if (id) visibleIds.add(id);
      });
    const missing = cached
      .filter((m) => !visibleIds.has(m.id))
      .sort(
        (a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime(),
      );
    setArchived(missing);
    setChecked(true);
  }, [props.conversationId]);

  React.useEffect(() => {
    if (props.disabled) return;
    let cancelled = false;
    // Wait one tick for the decryptor to finish + the DOM to settle,
    // then scan. Re-scan on DOM mutations so newly-arrived server rows
    // shrink the archived count in real time.
    const runOnce = () => { if (!cancelled) void scan(); };
    const initial = setTimeout(runOnce, 500);
    const obs = new MutationObserver(runOnce);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => {
      cancelled = true;
      clearTimeout(initial);
      obs.disconnect();
    };
  }, [props.disabled, scan]);

  if (props.disabled) return null;
  if (!checked) return null;
  if (archived.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Open ${archived.length} archived message${archived.length === 1 ? "" : "s"}`}
        style={{
          position: "fixed",
          top: "calc(env(safe-area-inset-top, 0) + 90px)",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 5,
          padding: "6px 12px",
          borderRadius: 999,
          border: "1px solid rgba(139,169,209,0.35)",
          background: "rgba(4,20,36,0.85)",
          color: "#DDE9FA",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.06em",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
          backdropFilter: "blur(6px)",
        }}
      >
        📥 {archived.length} archived · tap to view
      </button>
      {open && (
        <ArchiveModal
          peerDisplayName={props.peerDisplayName}
          selfAccountId={props.selfAccountId}
          messages={archived}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function ArchiveModal({
  peerDisplayName,
  selfAccountId,
  messages,
  onClose,
}: {
  peerDisplayName: string;
  selfAccountId: string;
  messages: CachedMessage[];
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
      aria-label="Archived messages"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(2,9,20,0.85)",
        backdropFilter: "blur(14px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding:
          "calc(env(safe-area-inset-top, 0) + 20px) 16px calc(env(safe-area-inset-bottom, 0) + 20px)",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 520,
          maxHeight: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#050f1e",
          border: "1px solid rgba(139,169,209,0.30)",
          borderRadius: 16,
          boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
          color: "#F4F7FC",
          overflow: "hidden",
        }}
      >
        <header
          style={{
            padding: "16px 18px",
            borderBottom: "1px solid rgba(139,169,209,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                color: "#8BA9D1",
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              Archived history · {peerDisplayName}
            </div>
            <div style={{ fontSize: 13, color: "#DDE9FA" }}>
              {messages.length} message{messages.length === 1 ? "" : "s"} · stored on this device
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              border: "1px solid rgba(139,169,209,0.25)",
              background: "transparent",
              color: "#DDE9FA",
              cursor: "pointer",
              fontSize: 16,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </header>
        <ol
          style={{
            listStyle: "none",
            margin: 0,
            padding: "16px 18px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {messages.map((m) => {
            const mine = m.sender_account_id === selfAccountId;
            return (
              <li
                key={m.id}
                style={{
                  alignSelf: mine ? "flex-end" : "flex-start",
                  maxWidth: "84%",
                  padding: "8px 12px",
                  borderRadius: 14,
                  background: mine
                    ? "rgba(0,159,239,0.14)"
                    : "rgba(139,169,209,0.10)",
                  border: `1px solid ${mine ? "rgba(0,159,239,0.35)" : "rgba(139,169,209,0.20)"}`,
                  fontSize: 14,
                  lineHeight: 1.4,
                  color: "#F4F7FC",
                  wordBreak: "break-word",
                }}
              >
                <div>{m.body}</div>
                <div
                  style={{
                    fontSize: 10,
                    color: "#8BA9D1",
                    marginTop: 4,
                    display: "flex",
                    gap: 6,
                    alignItems: "center",
                  }}
                >
                  <span>{formatArchiveTime(m.sent_at)}</span>
                  {m.from_encrypted && <span title="Originally encrypted">🔒</span>}
                </div>
              </li>
            );
          })}
        </ol>
        <footer
          style={{
            padding: "10px 18px",
            borderTop: "1px solid rgba(139,169,209,0.15)",
            fontSize: 11,
            color: "#526B89",
            textAlign: "center",
          }}
        >
          Stored locally on this device · never re-uploaded
        </footer>
      </div>
    </div>
  );
}

function formatArchiveTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
