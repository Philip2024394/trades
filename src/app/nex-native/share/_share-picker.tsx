"use client";

// src/app/nex-native/share/_share-picker.tsx
//
// Bridge 17f · Share picker with editable message + emoji shortcuts.
// -----------------------------------------------------------------
// Client-owned wrapper for the /share page's friend list. The
// message text is client state so all friend Send buttons share a
// single editor · pick a friend, edit the note, tap Send · that
// friend's pre-bound Server Action fires with the current text.
//
// Emoji quick-pick appends common share-emojis to the textarea
// cursor. The five defaults cover the emotional range Founder asked
// for: keen / love / fire / shop / hey.

import { useRef, useState } from "react";

const NEX = {
  panel: "#050f1e",
  panelSoft: "rgba(6, 15, 28, 0.72)",
  border: "rgba(139, 169, 209, 0.14)",
  borderStrong: "rgba(139, 169, 209, 0.24)",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  cyan: "#00AFFF",
  orange: "#FF7200",
  orangeSoft: "rgba(255,114,0,0.6)",
};

const EMOJI_SHORTCUTS = ["👀", "🔥", "💚", "🛍", "😍", "🙌", "✨", "💯"];

export interface ShareFriend {
  id: string;
  firstName: string;
  displayName: string;
  avatarUrl: string | null;
  profession: string | null;
  action: (formData: FormData) => Promise<never> | void;
}

export function SharePicker({
  productId,
  productName,
  friends,
  currentUserFirstName,
}: {
  productId: string;
  productName: string;
  friends: ShareFriend[];
  currentUserFirstName: string;
}) {
  void currentUserFirstName; // reserved for a future "from Philip · " prefix
  const [message, setMessage] = useState<string>(
    `Just seen and it looks keen 👀 · what do you think of the ${productName}?`,
  );
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  function insertEmoji(emoji: string) {
    const el = textareaRef.current;
    if (!el) {
      setMessage((prev) => prev + " " + emoji);
      return;
    }
    const start = el.selectionStart ?? message.length;
    const end = el.selectionEnd ?? message.length;
    const next = message.slice(0, start) + emoji + message.slice(end);
    setMessage(next);
    // Restore cursor position just after the inserted emoji.
    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + emoji.length;
      el.setSelectionRange(cursor, cursor);
    });
  }

  return (
    <>
      {/* Message editor */}
      <div
        style={{
          marginBottom: 22,
          padding: "14px 16px",
          borderRadius: 14,
          background: NEX.panelSoft,
          border: `1px solid ${NEX.borderStrong}`,
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: NEX.textMute,
            fontWeight: 700,
            marginBottom: 8,
          }}
        >
          Your note
        </div>
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          maxLength={1000}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 10,
            background: "rgba(0,0,0,0.35)",
            border: `1px solid ${NEX.border}`,
            color: NEX.text,
            fontSize: 13,
            fontFamily: "inherit",
            lineHeight: 1.55,
            outline: "none",
            resize: "vertical",
          }}
        />
        <div
          style={{
            marginTop: 10,
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
          }}
        >
          {EMOJI_SHORTCUTS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => insertEmoji(e)}
              aria-label={`Add ${e}`}
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                background: "rgba(0,0,0,0.32)",
                border: `1px solid ${NEX.border}`,
                color: NEX.text,
                fontSize: 18,
                lineHeight: 1,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      {/* Friend list */}
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.28em",
          textTransform: "uppercase",
          color: NEX.textMute,
          fontWeight: 700,
          marginBottom: 10,
        }}
      >
        Send to
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {friends.map((f) => (
          <FriendRow key={f.id} friend={f} productId={productId} message={message} />
        ))}
      </div>
    </>
  );
}

function FriendRow({
  friend,
  productId,
  message,
}: {
  friend: ShareFriend;
  productId: string;
  message: string;
}) {
  return (
    <form
      action={friend.action}
      style={{
        display: "grid",
        gridTemplateColumns: "40px 1fr auto",
        gap: 12,
        alignItems: "center",
        padding: "12px 14px",
        borderRadius: 12,
        background: NEX.panelSoft,
        border: `1px solid ${NEX.border}`,
      }}
    >
      <input type="hidden" name="product_id" value={productId} />
      <input
        type="hidden"
        name="back"
        value={`/nex-native/share?product=${productId}`}
      />
      <input type="hidden" name="body" value={message} readOnly />

      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: friend.avatarUrl
            ? `url(${friend.avatarUrl}) center/cover`
            : "linear-gradient(135deg, #143552 0%, #052041 100%)",
          border: `1px solid ${NEX.border}`,
          display: "grid",
          placeItems: "center",
          color: NEX.textDim,
          fontSize: 14,
          fontWeight: 700,
        }}
        aria-hidden
      >
        {!friend.avatarUrl &&
          (friend.firstName[0] ?? "?").toUpperCase()}
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "-0.003em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {friend.firstName}
        </div>
        {friend.profession && (
          <div
            style={{
              fontSize: 11,
              color: NEX.textDim,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {friend.profession}
          </div>
        )}
      </div>
      <button
        type="submit"
        style={{
          padding: "8px 14px",
          borderRadius: 10,
          background: "linear-gradient(180deg, #FF9033 0%, #FF7200 100%)",
          border: `1px solid ${NEX.orangeSoft}`,
          color: "#0B0F1A",
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          cursor: "pointer",
          fontFamily: "inherit",
          boxShadow:
            "0 6px 14px rgba(255,114,0,0.30), inset 0 1px 0 rgba(255,255,255,0.28)",
        }}
      >
        Send
      </button>
    </form>
  );
}
