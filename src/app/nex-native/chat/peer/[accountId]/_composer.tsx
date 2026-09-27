"use client";

// src/app/nex-native/chat/peer/[accountId]/_composer.tsx
//
// NEX Chat composer · Aurora Rail + centered media modal.
// -------------------------------------------------------
// Layout (bottom to top):
//   Row 2  ·  [ + | textarea ................ | send ] · aurora pill
//   Row 1  ·  [                      ⋮                ] · plain 3-dot,
//               floats above the pill, right aligned, no circle/rim
//
// Both the + and the ⋮ open the same centered popup: three big
// action buttons (Camera · Video · Voice). Popup dims + blurs the
// rest of the screen and closes on backdrop tap.
//
// Sealed 2026-09-27.

import * as React from "react";
import { useFormStatus } from "react-dom";

const NEX = {
  bg: "#020914",
  panel: "#03101D",
  fieldBg: "rgba(4,20,36,0.90)",
  textPrimary: "#F4F7FC",
  textSecondary: "#8BA9D1",
  textMute: "#526B89",
  cyan: "#009FEF",
  cyanSoft: "rgba(0,159,239,0.65)",
  orange: "#FF7800",
  orangeSoft: "rgba(255,120,0,0.5)",
};

interface PeerComposerProps {
  action: (formData: FormData) => Promise<never> | void | Promise<void>;
  placeholder: string;
  /** Peer's chat theme accent (hex) · paints the composer rim so
   *  the composer belongs to "their space" doctrine sealed
   *  2026-09-27. Falls back to NEX cyan if omitted. */
  themeAccent?: string;
  /** Bridge 5 · when set, the composer shows a "replying to X"
   *  header + sends the message with a reply_to_id. Reply state
   *  lives in the URL (?reply=<id>) so it survives refresh. */
  replyTarget?: {
    id: string;
    body: string;
    mine: boolean;
    peerName: string;
    clearHref: string;
  } | null;
}

export function PeerComposer({
  action,
  placeholder,
  themeAccent,
  replyTarget,
}: PeerComposerProps) {
  const formRef = React.useRef<HTMLFormElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [text, setText] = React.useState("");
  const [modalOpen, setModalOpen] = React.useState(false);
  const [emojiOpen, setEmojiOpen] = React.useState(false);
  const hasText = text.trim().length > 0;

  const insertEmoji = React.useCallback((emoji: string) => {
    const el = textareaRef.current;
    if (!el) {
      setText((prev) => prev + emoji);
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const next = el.value.slice(0, start) + emoji + el.value.slice(end);
    setText(next);
    // Restore cursor after the inserted emoji · defer so React flushes
    // the new value first.
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  }, []);

  const resizeTextarea = React.useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    // Empty state: force the single-line height. scrollHeight of an
    // empty textarea varies by browser + reports a stale value on
    // first mount, which was rendering the pill as ~2 lines tall.
    if (!el.value) {
      el.style.height = "22px";
      return;
    }
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, 112);
    el.style.height = `${Math.max(next, 22)}px`;
  }, []);

  React.useEffect(() => {
    resizeTextarea();
  }, [text, resizeTextarea]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!hasText) return;
        formRef.current?.requestSubmit();
      }
    },
    [hasText],
  );

  return (
    <>
      <style>{`
        /* Hide native scrollbar inside the composer textarea · scroll
           still works when content exceeds max height, just no visible
           bar. */
        [data-nex-peer-composer] textarea {
          scrollbar-width: none;
        }
        [data-nex-peer-composer] textarea::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }
        @keyframes nex-modal-in {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes nex-modal-backdrop-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        [data-nex-media-modal] {
          animation: nex-modal-in 220ms cubic-bezier(.2,.7,.2,1) both;
        }
        [data-nex-media-backdrop] {
          animation: nex-modal-backdrop-in 220ms ease-out both;
        }
      `}</style>

      {modalOpen && (
        <MediaModal onClose={() => setModalOpen(false)} />
      )}
      {emojiOpen && (
        <EmojiModal
          onClose={() => setEmojiOpen(false)}
          onPick={(e) => {
            insertEmoji(e);
            setEmojiOpen(false);
          }}
        />
      )}

      <form
        ref={formRef}
        action={action as (formData: FormData) => void | Promise<void>}
        data-nex-peer-composer
        onSubmit={() => setText("")}
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {/* Bridge 5 · reply header · when the URL carries ?reply=<id>
            the composer shows a "replying to" quote card above the
            pill + smuggles the reply_to_id via a hidden input. */}
        {replyTarget && (
          <>
            <input
              type="hidden"
              name="reply_to_id"
              value={replyTarget.id}
            />
            <div
              style={{
                display: "flex",
                alignItems: "stretch",
                gap: 0,
                padding: "8px 10px 8px 12px",
                borderRadius: 10,
                background: "rgba(0,0,0,0.4)",
                border: `1px solid ${
                  themeAccent
                    ? composerRim(themeAccent)
                    : "rgba(0,159,239,0.5)"
                }`,
                borderLeft: `4px solid ${
                  themeAccent ?? NEX.cyan
                }`,
                marginBottom: -12,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: themeAccent ?? NEX.cyan,
                    marginBottom: 2,
                  }}
                >
                  Replying to {replyTarget.mine ? "yourself" : replyTarget.peerName}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: NEX.textSecondary,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    lineHeight: 1.35,
                  }}
                >
                  {replyTarget.body}
                </div>
              </div>
              <a
                href={replyTarget.clearHref}
                aria-label="Cancel reply"
                title="Cancel reply"
                style={{
                  flexShrink: 0,
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "rgba(0,0,0,0.42)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: NEX.textPrimary,
                  display: "grid",
                  placeItems: "center",
                  textDecoration: "none",
                  alignSelf: "center",
                  marginLeft: 8,
                }}
              >
                <ReplyCancelIcon />
              </a>
            </div>
          </>
        )}

        {/* Row 1 · plain 3-dot pushed to the viewport right edge, 20px
            of breathing room above the pill. No circle, no border, no
            aurora · just the dots. */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginRight: -16,
            marginBottom: -6,
          }}
        >
          <button
            type="button"
            aria-label="More actions"
            onClick={() => setModalOpen(true)}
            style={{
              width: 44,
              height: 36,
              background: "transparent",
              border: "none",
              color: NEX.text,
              padding: 0,
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
            }}
          >
            <DotsIcon />
          </button>
        </div>

        {/* Row 2 · glass input rectangle · matches the outgoing
            chat bubble family. Rim adopts the peer's chat theme so
            the composer belongs to the peer's chat space, not a
            neutral universal element. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            minHeight: 44,
            padding: "4px 6px 4px 6px",
            borderRadius: 14,
            background: "rgba(12,32,58,0.62)",
            backdropFilter: "blur(24px) saturate(1.2)",
            WebkitBackdropFilter: "blur(24px) saturate(1.2)",
            border: `1px solid ${composerRim(themeAccent ?? NEX.cyan)}`,
            boxShadow: `0 0 14px ${composerGlow(themeAccent ?? NEX.cyan)}, 0 6px 20px rgba(0,0,0,0.45)`,
          }}
        >
            <PlusButton onClick={() => setModalOpen(true)} />
            <textarea
              ref={textareaRef}
              name="body"
              required
              maxLength={4000}
              placeholder={placeholder}
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{
                flex: 1,
                width: "100%",
                minHeight: 22,
                maxHeight: 112,
                padding: "0 6px",
                background: "transparent",
                color: NEX.textPrimary,
                border: "none",
                outline: "none",
                fontSize: 16,
                lineHeight: 1.35,
                fontFamily: "inherit",
                resize: "none",
                overflow: "auto",
              }}
            />
            <EmojiButton onClick={() => setEmojiOpen(true)} />
            <SendButton armed={hasText} />
        </div>
      </form>
    </>
  );
}

function EmojiButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Insert emoji"
      onClick={onClick}
      style={{
        flexShrink: 0,
        width: 36,
        height: 36,
        borderRadius: "50%",
        background: "transparent",
        border: "none",
        color: NEX.textSecondary,
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
        padding: 0,
        marginRight: 2,
      }}
    >
      <SmileIcon />
    </button>
  );
}

function PlusButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Add photo, video, or voice"
      onClick={onClick}
      style={{
        flexShrink: 0,
        width: 36,
        height: 36,
        borderRadius: "50%",
        // Dark glass · reads as secondary action without competing
        // with the orange send button on the right. Pure black would
        // vanish against the dark navy backdrop.
        background: "rgba(0,0,0,0.42)",
        border: "1px solid rgba(255,255,255,0.10)",
        color: NEX.textPrimary,
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
        padding: 0,
        marginRight: 6,
      }}
    >
      <PlusIcon />
    </button>
  );
}

function SendButton({ armed }: { armed: boolean }) {
  const { pending } = useFormStatus();
  const active = armed && !pending;
  return (
    <button
      type="submit"
      aria-label={pending ? "Sending message" : "Send message"}
      disabled={!armed || pending}
      style={{
        flexShrink: 0,
        width: 36,
        height: 36,
        borderRadius: "50%",
        // Always orange · opacity + scale carry the enabled state.
        background: NEX.orange,
        color: "#0B0F1A",
        border: `1px solid ${NEX.orangeSoft}`,
        display: "grid",
        placeItems: "center",
        cursor: pending ? "wait" : armed ? "pointer" : "not-allowed",
        transition:
          "opacity 220ms ease, transform 120ms ease, box-shadow 220ms ease",
        transform: active ? "scale(1)" : "scale(0.92)",
        opacity: active ? 1 : pending ? 0.85 : 0.4,
        boxShadow: active
          ? "0 6px 18px rgba(255,120,0,0.35)"
          : "none",
        marginLeft: 4,
        padding: 0,
      }}
    >
      {pending ? (
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: NEX.textPrimary,
            animation: "nex-composer-pulse 1s ease-in-out infinite",
          }}
        />
      ) : (
        <SendIcon />
      )}
      <style>{`
        @keyframes nex-composer-pulse {
          0%, 100% { opacity: 0.35; transform: scale(1); }
          50%      { opacity: 1;    transform: scale(1.3); }
        }
      `}</style>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Centered media modal
// ---------------------------------------------------------------------------

function MediaModal({ onClose }: { onClose: () => void }) {
  // Close on Escape
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div
        data-nex-media-backdrop
        role="button"
        aria-label="Close media menu"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(2,9,20,0.72)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          zIndex: 100,
        }}
      />
      <div
        data-nex-media-modal
        role="dialog"
        aria-modal="true"
        aria-label="Add media"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(320px, calc(100vw - 40px))",
          padding: "22px 20px 20px",
          background: NEX.panel,
          border: `1px solid ${NEX.cyanSoft}`,
          borderRadius: 24,
          boxShadow:
            "0 24px 60px rgba(0,0,0,0.65), 0 0 40px rgba(0,159,239,0.14)",
          zIndex: 101,
          color: NEX.textPrimary,
          fontFamily: "inherit",
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: NEX.cyan,
            textAlign: "center",
            marginBottom: 4,
            fontWeight: 600,
          }}
        >
          NEX · Add media
        </div>
        <div
          style={{
            fontSize: 12,
            color: NEX.textSecondary,
            textAlign: "center",
            marginBottom: 18,
          }}
        >
          Pick a source to add to your message
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 12,
          }}
        >
          <ModalOption icon={<CameraIcon size={26} />} label="Camera" onClose={onClose} />
          <ModalOption icon={<VideoIcon size={26} />} label="Video" onClose={onClose} />
          <ModalOption icon={<MicIcon size={26} />} label="Voice" onClose={onClose} />
          <ModalOption
            icon={<PaletteIcon size={26} />}
            label="Themes"
            onClose={onClose}
            href="/nex-native/settings/theme"
          />
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Emoji picker · centered modal grid
// ---------------------------------------------------------------------------

// Nature-themed expression set · sealed 2026-09-27.
// -------------------------------------------------
// Users still need to convey feelings — happy, sad, laughing, in
// love, tired, angry — but not through generic smileys. This set
// uses animal faces + emotional nature objects to carry the same
// emotional range while staying inside the mountain-moon-star
// theme world. Cat faces map cleanly to normal smiley emotions
// (Unicode ships them exactly for this purpose · 😸😹😻😼🙀😿😾).
// Lanterns / candles / fireworks carry warmth + celebration. Rain
// + wilted flowers + fallen leaves carry sadness. Every glyph
// belongs to the same environment as the chat wallpaper.
const EMOJI_SET: readonly string[] = [
  // Happy / smiling / playful animals — the main "smiley" row
  "😸", "😹", "😻", "😼", "🐰", "🦊", "🐻", "🐨",
  // Curious / calm / wise
  "🦉", "🐧", "🐢", "🦔", "🐿️", "🐹", "🐭", "🐦",
  // Peaceful / loving / gentle
  "🕊️", "🐝", "🦋", "🐞", "🐬", "🦌", "🐺", "🐇",
  // Sad / weary / angry (nature's negative moods)
  "😿", "😾", "🙀", "🥀", "🍂", "🍁", "🌧️", "⛈️",
  // Moon + stars — for wonder, dreams, awe
  "🌙", "🌕", "🌛", "🌜", "⭐", "✨", "🌟", "💫",
  // Celebration + energy + warmth
  "🌠", "☄️", "🌌", "🌈", "🎆", "🎇", "🔥", "💧",
  // Camping / lanterns / warmth / adventure
  "🏕️", "⛺", "🔦", "🕯️", "🏮", "🪔", "🌡️", "🧭",
  // Flowers · love, gratitude, blooming
  "🌹", "🌷", "🌸", "🌺", "🌻", "🌼", "🌿", "🌱",
];

function EmojiModal({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (emoji: string) => void;
}) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div
        data-nex-media-backdrop
        role="button"
        aria-label="Close emoji picker"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(2,9,20,0.72)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          zIndex: 100,
        }}
      />
      <style>{`
        [data-nex-emoji-scroll] {
          scrollbar-width: none;
        }
        [data-nex-emoji-scroll]::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }
      `}</style>
      <div
        data-nex-media-modal
        role="dialog"
        aria-modal="true"
        aria-label="Pick an emoji"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(340px, calc(100vw - 40px))",
          maxHeight: "60vh",
          padding: "18px 16px",
          background: NEX.panel,
          border: `1px solid ${NEX.cyanSoft}`,
          borderRadius: 24,
          boxShadow:
            "0 24px 60px rgba(0,0,0,0.65), 0 0 40px rgba(0,159,239,0.14)",
          zIndex: 101,
          color: NEX.textPrimary,
          fontFamily: "inherit",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: NEX.cyan,
            textAlign: "center",
            marginBottom: 12,
            fontWeight: 600,
          }}
        >
          NEX · Pick an emoji
        </div>
        <div
          data-nex-emoji-scroll
          style={{
            flex: 1,
            overflowY: "auto",
            display: "grid",
            gridTemplateColumns: "repeat(8, 1fr)",
            gap: 4,
            paddingRight: 4,
          }}
        >
          {EMOJI_SET.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onPick(emoji)}
              style={{
                width: "100%",
                aspectRatio: "1 / 1",
                background: "transparent",
                border: "none",
                borderRadius: 8,
                fontSize: 22,
                cursor: "pointer",
                padding: 0,
                lineHeight: 1,
                display: "grid",
                placeItems: "center",
                transition: "background 120ms ease, transform 100ms ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(0,159,239,0.12)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function ModalOption({
  icon,
  label,
  onClose,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  onClose: () => void;
  /** Optional destination · when supplied the option acts as a Link
   *  and hard-navigates on tap. Without href it's a "coming soon"
   *  stub that just closes the modal. */
  href?: string;
}) {
  const sharedStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    padding: "14px 8px",
    borderRadius: 14,
    background: "rgba(0,159,239,0.08)",
    border: "1px solid rgba(0,159,239,0.3)",
    color: NEX.textPrimary,
    cursor: "pointer",
    transition: "background 180ms ease, transform 120ms ease",
    textDecoration: "none",
  };
  if (href) {
    return (
      <a
        href={href}
        aria-label={label}
        title={label}
        onClick={onClose}
        style={sharedStyle}
      >
        {renderOptionInner(icon, label)}
      </a>
    );
  }
  return (
    <button
      type="button"
      aria-label={`${label} (coming soon)`}
      title={`${label} · coming soon`}
      onClick={onClose}
      style={sharedStyle}
    >
      {renderOptionInner(icon, label)}
    </button>
  );
}

function renderOptionInner(icon: React.ReactNode, label: string) {
  return (
    <>
      <span
        style={{
          width: 46,
          height: 46,
          borderRadius: "50%",
          background: "rgba(0,159,239,0.14)",
          border: "1px solid rgba(0,159,239,0.5)",
          color: NEX.cyan,
          display: "grid",
          placeItems: "center",
        }}
      >
        {icon}
      </span>
      <span
        style={{
          fontSize: 11,
          letterSpacing: "0.06em",
          fontWeight: 600,
          color: NEX.textPrimary,
        }}
      >
        {label}
      </span>
    </>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

const strokeProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function PlusIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" aria-hidden {...strokeProps}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function DotsIcon() {
  // Running-light animation · three blue dots pulse in sequence so
  // the composer's 3-dot menu button reads as "alive" · Founder
  // direction 2026-09-27 "running light through the dots dancing blue".
  return (
    <>
      <svg
        width={26}
        height={26}
        viewBox="0 0 24 24"
        aria-hidden
      >
        <circle cx="12" cy="5" r="2.2" fill="#009FEF" data-nex-dot="0" />
        <circle cx="12" cy="12" r="2.2" fill="#009FEF" data-nex-dot="1" />
        <circle cx="12" cy="19" r="2.2" fill="#009FEF" data-nex-dot="2" />
      </svg>
      <style>{`
        @keyframes nex-dot-dance {
          0%, 100% {
            opacity: 0.32;
            transform: scale(1);
            filter: none;
          }
          50% {
            opacity: 1;
            transform: scale(1.14);
            filter: drop-shadow(0 0 4px #00CFFF);
          }
        }
        [data-nex-dot] {
          animation: nex-dot-dance 1.2s ease-in-out infinite;
          transform-origin: center;
        }
        [data-nex-dot="0"] { animation-delay: 0s; }
        [data-nex-dot="1"] { animation-delay: 0.18s; }
        [data-nex-dot="2"] { animation-delay: 0.36s; }
      `}</style>
    </>
  );
}

function CameraIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...strokeProps}>
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function VideoIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...strokeProps}>
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function PaletteIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...strokeProps}>
      <path d="M12 2a10 10 0 100 20c1.66 0 3-1.34 3-3v-1a2 2 0 012-2h1c2.76 0 5-2.24 5-5A10 10 0 0012 2z" />
      <circle cx="7.5" cy="10.5" r="1.2" fill="currentColor" />
      <circle cx="12" cy="7" r="1.2" fill="currentColor" />
      <circle cx="16.5" cy="10.5" r="1.2" fill="currentColor" />
      <circle cx="9.5" cy="15.5" r="1.2" fill="currentColor" />
    </svg>
  );
}

function MicIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...strokeProps}>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M19 10v2a7 7 0 01-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" aria-hidden {...strokeProps} strokeWidth={2.2}>
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22 11 13 2 9 22 2z" />
    </svg>
  );
}

function composerRim(hex: string): string {
  const rgb = _hexToRgb(hex);
  return `rgba(${rgb.r},${rgb.g},${rgb.b},0.85)`;
}
function composerGlow(hex: string): string {
  const rgb = _hexToRgb(hex);
  return `rgba(${rgb.r},${rgb.g},${rgb.b},0.18)`;
}
function _hexToRgb(hex: string): { r: number; g: number; b: number } {
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

function ReplyCancelIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" aria-hidden {...strokeProps} strokeWidth={2.4}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function SmileIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" aria-hidden {...strokeProps} strokeWidth={1.9}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  );
}
