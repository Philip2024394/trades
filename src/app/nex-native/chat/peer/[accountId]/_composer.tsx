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
import { createPortal, useFormStatus } from "react-dom";
import {
  MediaCapture,
  type MediaCaptureHandle,
  type CaptureKind,
} from "./_media-capture";
import { MediaRecorderModal } from "./_media-recorder";

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
  /** Optional override for the composer bar's background colour.
   *  Defaults to the sealed `rgba(12,32,58,0.62)` dark-navy that pairs
   *  with the NEX-cyan default rim. Haunted Hotel passes a warm dark
   *  (rgba(10,6,4,0.72)) so the composer reads as part of the hotel
   *  palette rather than cyan-themed. Pass any valid CSS color. */
  composerBg?: string;
  /** When true, the Add-media modal (opened from the + button) shows
   *  an "Animations" option. Tapping it dispatches the custom window
   *  event "nex-haunted-hotel-open-animations" which the
   *  HauntedHotelController listens for to open its FX panel. Used by
   *  the Haunted Hotel theme surface so the Animations entry point
   *  lives in the + button instead of a separate floating 3-dots. */
  showAnimationsOption?: boolean;
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
  /** Bridge 8+9 · Server Action bound to peer id · takes a form
   *  with `attachment_file` and redirects back with the uploaded
   *  URL on the query string. When omitted, Camera/Video/Voice
   *  buttons in the media modal fall back to their "coming soon"
   *  state. */
  uploadAction?: (
    formData: FormData,
  ) => Promise<never> | void | Promise<void>;
  /** Bridge 8+9 · pending attachment resolved server-side from
   *  ?attachment_url + ?attachment_type. When set, the composer
   *  shows a preview thumbnail above the pill and smuggles the
   *  URL + type into the send form. */
  pendingAttachment?: {
    url: string;
    kind: "image" | "video" | "audio";
    clearHref: string;
    /** Bridge 88 · true when the pending attachment came in through
     *  the encrypted-upload path · composer smuggles this into the
     *  send form so E2eComposerIntercept knows to look up the content
     *  key from sessionStorage. */
    encrypted?: boolean;
  } | null;
  /** Bridge 88 · when true, the media-capture flow routes files
   *  through the client-side encrypted upload path. Disable for
   *  NEX1 (support chat is not E2E per doctrine). */
  encryptedUploadEnabled?: boolean;
  /** Bridge ThemeEmoji-B · sealed 2026-10-01 · per-theme emoji set
   *  loaded from nex_theme_emoji (Migration 116). When non-empty,
   *  the composer's emoji picker renders these image tiles instead
   *  of the default 40-emoji hardcoded array. Click inserts ":slug:"
   *  · a future message renderer expands that back to the image. */
  themeEmojis?:
    | { slug: string; imageUrl: string; label: string }[]
    | null;
  /** Bridge ThemeSticker · sealed 2026-10-01 · per-theme sticker set
   *  loaded from nex_theme_sticker (Migration 118). When non-empty,
   *  the composer's picker renders a dedicated "Stickers" tab with
   *  portrait tiles. Selecting a sticker SENDS it immediately as a
   *  peer-message with attachment_type='sticker' — stickers are
   *  NEVER inserted as inline text or emoji tokens. */
  themeStickers?:
    | {
        slug: string;
        imageUrl: string;
        label: string;
        stickerType: "static" | "animated";
        aspectRatio: number;
      }[]
    | null;
  /** Server Action that sends a sticker-type peer message. Picker
   *  calls this directly when a sticker tile is tapped · unlike text
   *  + emojis which route through the composer form. */
  sendStickerAction?: (formData: FormData) => Promise<void> | void;
  /** Optional per-theme send-button artwork. When provided, the
   *  circular send button renders this image inside the existing
   *  36×36 footprint instead of the default orange background +
   *  paper-plane glyph. Pending + disabled states are preserved. */
  themeSendButtonUrl?: string | null;
}

export function PeerComposer({
  action,
  placeholder,
  themeAccent,
  composerBg,
  showAnimationsOption,
  replyTarget,
  uploadAction,
  pendingAttachment,
  encryptedUploadEnabled,
  themeEmojis,
  themeStickers,
  sendStickerAction,
  themeSendButtonUrl,
}: PeerComposerProps) {
  const formRef = React.useRef<HTMLFormElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const mediaCaptureRef = React.useRef<MediaCaptureHandle | null>(null);
  // Attachment-file input · a plain hidden <input type="file"> that
  // the paperclip button on the left of the input bar triggers. Any
  // mime type is accepted; the file is posted through the same
  // uploadAction the camera/video/voice flows use.
  const attachInputRef = React.useRef<HTMLInputElement | null>(null);
  const [text, setText] = React.useState("");
  const [modalOpen, setModalOpen] = React.useState(false);
  const [emojiOpen, setEmojiOpen] = React.useState(false);
  const [recorderKind, setRecorderKind] = React.useState<CaptureKind | null>(
    null,
  );
  // Bridge ThemeEmoji-C · sealed 2026-10-01. When the founder taps a
  // theme emoji tile in the picker, we don't want to see the ":slug:"
  // text splatted into the textarea. Instead the tile gets pinned as
  // an image chip inside the composer pill · reads as if the emoji
  // lives IN the input bar. On send we serialize the chips back into
  // the body as ":slug:" markers · the bubble renderer resolves them
  // back into images so both sides see identical output.
  const [pendingThemeEmojis, setPendingThemeEmojis] = React.useState<
    { slug: string; imageUrl: string; label: string }[]
  >([]);
  const themeEmojiIndex = React.useMemo(() => {
    const m = new Map<string, { slug: string; imageUrl: string; label: string }>();
    for (const t of themeEmojis ?? []) m.set(t.slug, t);
    return m;
  }, [themeEmojis]);
  const hasText = text.trim().length > 0;
  const hasPendingEmojis = pendingThemeEmojis.length > 0;
  // Send is armed whenever there's text, a pending attachment, or at
  // least one pinned theme-emoji chip.
  const canSend = hasText || !!pendingAttachment || hasPendingEmojis;

  /** Desktop check · true when we should prefer the in-browser
   *  recorder (getUserMedia + MediaRecorder) over the native
   *  camera app that mobile OSes launch via the file input's
   *  `capture` attribute. Rough heuristic on viewport width ·
   *  the recorder's own fallback handles unsupported browsers. */
  const preferRecorder = React.useCallback(() => {
    if (typeof window === "undefined") return false;
    if (!navigator.mediaDevices?.getUserMedia) return false;
    return window.innerWidth >= 768;
  }, []);

  const handleCapturePick = React.useCallback(
    (kind: CaptureKind) => {
      setModalOpen(false);
      if (preferRecorder()) {
        // Desktop · open the in-browser recorder modal.
        setRecorderKind(kind);
        return;
      }
      // Mobile · trigger the hidden file input · OS opens native
      // camera / recorder for a higher-fidelity capture.
      requestAnimationFrame(() => {
        mediaCaptureRef.current?.open(kind);
      });
    },
    [preferRecorder],
  );

  // Universal ChatActionDots (bottom-right 3-dots) dispatches these
  // events when the user taps Mic or Camera in the sliding action
  // pill. Route them into the same capture flow the + button's
  // MediaModal uses · one capture pipeline, two entry points.
  React.useEffect(() => {
    const onMic = () => handleCapturePick("voice");
    const onCamera = () => handleCapturePick("camera");
    const onVideo = () => handleCapturePick("video");
    window.addEventListener("nex-chat-action-mic", onMic);
    window.addEventListener("nex-chat-action-camera", onCamera);
    window.addEventListener("nex-chat-action-video", onVideo);
    return () => {
      window.removeEventListener("nex-chat-action-mic", onMic);
      window.removeEventListener("nex-chat-action-camera", onCamera);
      window.removeEventListener("nex-chat-action-video", onVideo);
    };
  }, [handleCapturePick]);

  /** Send a File that came out of the recorder · we POST it via
   *  the same upload Server Action by building a FormData and
   *  submitting a hidden form. Redirect chain matches the file-
   *  input flow · attachment_url lands on the URL, composer picks
   *  it up as pendingAttachment. */
  const recorderSend = React.useCallback(
    (file: File) => {
      if (!uploadAction) return;
      // Server Actions accept FormData directly · we don't need a
      // real <form> submit path. Build the FormData and invoke.
      // The action redirects on success · the browser navigates
      // and this recorder unmounts on the next render.
      const fd = new FormData();
      fd.set("attachment_file", file);
      Promise.resolve(uploadAction(fd)).catch((e) => {
        const msg = e instanceof Error ? e.message : String(e);
        // NEXT_REDIRECT is Next's internal navigation signal · expected.
        if (!msg.includes("NEXT_REDIRECT")) {
          // eslint-disable-next-line no-console
          console.error("uploadAction failed:", e);
        }
      });
      setRecorderKind(null);
    },
    [uploadAction],
  );

  const insertEmoji = React.useCallback(
    (emoji: string) => {
      // Bridge ThemeEmoji-C · sealed 2026-10-01. Theme emojis arrive as
      // ":slug:" values from the picker · route those into the pending-
      // chip state so the founder sees the actual image inside the
      // composer pill rather than raw text. Unicode emojis fall through
      // to the textarea insert-at-caret behaviour unchanged.
      const themeMatch = /^:([a-z0-9-]{1,40}):$/.exec(emoji);
      if (themeMatch) {
        const slug = themeMatch[1]!;
        const tile = themeEmojiIndex.get(slug);
        if (tile) {
          setPendingThemeEmojis((prev) => [...prev, tile]);
          return;
        }
        // Unknown slug · fall back to text-insert so we never silently
        // drop the pick.
      }
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
    },
    [themeEmojiIndex],
  );

  const removePendingEmoji = React.useCallback((index: number) => {
    setPendingThemeEmojis((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Bridge ThemeEmoji-C · assemble the wire-format `body` from typed
  // text + pinned theme-emoji chips. Chips serialize as ":slug:" tokens
  // separated by single spaces and prepended to the typed text so the
  // reader's cursor lands on the text portion. When there is no text
  // the body is chips only, which is legitimate ("react-only" message).
  const composeBody = React.useCallback((): string => {
    const chipStr = pendingThemeEmojis.map((t) => `:${t.slug}:`).join(" ");
    if (!chipStr) return text;
    if (!text) return chipStr;
    return `${chipStr} ${text}`;
  }, [pendingThemeEmojis, text]);

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
        if (!canSend) return;
        formRef.current?.requestSubmit();
      }
    },
    [canSend],
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
        <MediaModal
          onClose={() => setModalOpen(false)}
          onPickCapture={handleCapturePick}
          captureEnabled={!!uploadAction}
          showAnimationsOption={!!showAnimationsOption}
        />
      )}
      {uploadAction && (
        <MediaCapture
          ref={mediaCaptureRef}
          uploadAction={uploadAction}
          encryptedUploadEnabled={encryptedUploadEnabled}
        />
      )}
      {recorderKind && (
        <MediaRecorderModal
          kind={recorderKind}
          onClose={() => setRecorderKind(null)}
          onSend={recorderSend}
          onFallbackToFileInput={() => {
            const k = recorderKind;
            setRecorderKind(null);
            requestAnimationFrame(() => mediaCaptureRef.current?.open(k));
          }}
        />
      )}
      {emojiOpen && (
        <EmojiModal
          themeEmojis={themeEmojis ?? null}
          themeStickers={themeStickers ?? null}
          sendStickerAction={sendStickerAction}
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
        onSubmit={() => {
          // Clear both the typed text AND the pending emoji chips ·
          // the hidden `body` input has already been read by the form
          // submitter, so this only resets what the founder sees.
          setText("");
          setPendingThemeEmojis([]);
          // Theme-aware broadcast · lets ambient controllers (e.g. the
          // Joker-theme bats-on-send burst) react to a send without
          // being coupled to the composer internals.
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("nex-joker-send"));
          }
        }}
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {/* Bridge ThemeEmoji-C · the wire-format body. The textarea
         *  itself is no longer named `body` so the Server Action reads
         *  from this hidden field instead. When there are no pinned
         *  emoji chips this evaluates to the exact typed text · so the
         *  regular chat path is byte-identical to before the change. */}
        <input type="hidden" name="body" value={composeBody()} />
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

        {/* Bridge 8+9 · pending attachment preview · rendered above
            the pill when the URL carries ?attachment_url. Hidden
            inputs smuggle the URL + kind into the send form. */}
        {pendingAttachment && (
          <>
            <input
              type="hidden"
              name="attachment_url"
              value={pendingAttachment.url}
            />
            <input
              type="hidden"
              name="attachment_type"
              value={pendingAttachment.kind}
            />
            {/* Bridge 88 · flag the send form so E2eComposerIntercept
                looks up the stashed content key in sessionStorage
                instead of routing this attachment through the
                plaintext server action. */}
            {pendingAttachment.encrypted && (
              <input
                type="hidden"
                name="attachment_encrypted"
                value="1"
              />
            )}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: 8,
                borderRadius: 12,
                background: "rgba(0,0,0,0.4)",
                border: `1px solid ${
                  themeAccent
                    ? composerRim(themeAccent)
                    : "rgba(0,159,239,0.5)"
                }`,
                marginBottom: -12,
              }}
            >
              <AttachmentPreview
                url={pendingAttachment.url}
                kind={pendingAttachment.kind}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: themeAccent ?? NEX.cyan,
                  }}
                >
                  {pendingAttachment.kind === "image"
                    ? "Photo ready"
                    : pendingAttachment.kind === "video"
                      ? "Video ready"
                      : "Voice note ready"}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: NEX.textSecondary,
                    marginTop: 2,
                  }}
                >
                  Type a caption or send as-is
                </div>
              </div>
              <a
                href={pendingAttachment.clearHref}
                aria-label="Discard attachment"
                title="Discard attachment"
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
                }}
              >
                <ReplyCancelIcon />
              </a>
            </div>
          </>
        )}

        {/* Sealed 2026-10-01 · composer Row 1 (floating 3-dot above
            the pill) retired · the + button inside the pill opens the
            same "More actions" modal, so there's no feature loss.
            Removing the second 3-dot also removes a visual conflict
            with the Joker animations controller 3-dot (bottom-right)
            — only ONE 3-dot should live on-screen at a time, and it
            belongs to the theme's animation panel. */}

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
            background: composerBg ?? "rgba(12,32,58,0.62)",
            backdropFilter: "blur(24px) saturate(1.2)",
            WebkitBackdropFilter: "blur(24px) saturate(1.2)",
            border: `1px solid ${composerRim(themeAccent ?? NEX.cyan)}`,
            boxShadow: `0 0 14px ${composerGlow(themeAccent ?? NEX.cyan)}, 0 6px 20px rgba(0,0,0,0.45)`,
          }}
        >
            <PlusButton onClick={() => setModalOpen(true)} />
            {/* Attachment-file button · founder direction 2026-10-04.
                Left-side paperclip opens a generic file picker that
                accepts any mime, then posts the file via uploadAction
                (same path camera / video / voice capture use). Only
                rendered when an uploadAction is wired. */}
            {uploadAction && (
              <>
                <input
                  ref={attachInputRef}
                  type="file"
                  accept="*/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.currentTarget.files?.[0];
                    if (!f) return;
                    const fd = new FormData();
                    fd.append("attachment_file", f);
                    uploadAction(fd);
                    // Reset so the same file can be re-picked.
                    e.currentTarget.value = "";
                  }}
                />
                <AttachButton
                  onClick={() => attachInputRef.current?.click()}
                  accent={themeAccent ?? NEX.cyan}
                />
              </>
            )}
            {/* Bridge ThemeEmoji-C · pinned theme-emoji chips render
             *  inline before the textarea so the picked emoji reads as
             *  if it is inside the input bar. Each chip is tappable ·
             *  tap × to unpin. The body serialization prepends the
             *  chips as ":slug:" markers to the outgoing message. */}
            {hasPendingEmojis && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  flexShrink: 0,
                  maxWidth: "60%",
                  overflowX: "auto",
                  scrollbarWidth: "none",
                }}
              >
                {pendingThemeEmojis.map((tile, i) => (
                  <span
                    key={`${tile.slug}-${i}`}
                    style={{
                      position: "relative",
                      flex: "0 0 auto",
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      background: "rgba(0,159,239,0.14)",
                      border: "1px solid rgba(0,159,239,0.35)",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={tile.imageUrl}
                      alt={tile.label || tile.slug}
                      width={22}
                      height={22}
                      style={{
                        width: 22,
                        height: 22,
                        objectFit: "contain",
                        pointerEvents: "none",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => removePendingEmoji(i)}
                      aria-label={`Remove ${tile.label || tile.slug}`}
                      title="Remove"
                      style={{
                        position: "absolute",
                        top: -6,
                        right: -6,
                        width: 16,
                        height: 16,
                        padding: 0,
                        borderRadius: "50%",
                        border: "none",
                        background: "rgba(2,9,20,0.92)",
                        color: NEX.textPrimary,
                        fontSize: 10,
                        lineHeight: 1,
                        cursor: "pointer",
                        display: "grid",
                        placeItems: "center",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <textarea
              ref={textareaRef}
              maxLength={4000}
              placeholder={placeholder}
              rows={1}
              value={text}
              /* Bridge 70 · marker so PeerTypingClient can attach an
                 input listener + broadcast typing pings without needing
                 the composer to know the conversationId. Non-invasive
                 (attribute-only) so business/NEX1 chats are unaffected. */
              data-nex-composer-textarea
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
            <EmojiButton
              onClick={() => setEmojiOpen(true)}
              themeAccent={themeAccent ?? null}
            />
            <SendButton armed={canSend} themeSendButtonUrl={themeSendButtonUrl ?? null} />
        </div>
      </form>
    </>
  );
}

function EmojiButton({
  onClick,
  themeAccent,
}: {
  onClick: () => void;
  themeAccent?: string | null;
}) {
  // Sealed 2026-10-01 · the emoji trigger is now an accent-coloured
  // dot rather than a smile glyph. Picks up the active peer's chat
  // theme accent so the composer gets a scarce, electric bite of
  // theme colour (Joker · acid green dot; Night Sky · blue; etc.)
  // without crowding the pill with iconography. The dot is also the
  // smallest tap-target chrome possible, leaving the composer line
  // visually quiet.
  const dot = themeAccent ?? NEX.cyan;
  const dotRgb = hexToRgbTriple(dot);
  const glow = `rgba(${dotRgb},0.55)`;
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
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
        padding: 0,
        marginRight: 2,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: dot,
          boxShadow: `0 0 8px ${glow}, 0 0 2px ${glow}`,
        }}
      />
    </button>
  );
}

/** Parse #RRGGBB into "r,g,b" so we can build rgba() glows at any
 *  alpha without a second helper import. Falls back to NEX cyan on
 *  parse failure so the composer never crashes on a malformed hex. */
function hexToRgbTriple(hex: string): string {
  const clean = (hex || "").replace(/^#/, "");
  const full =
    clean.length === 3
      ? clean.split("").map((c) => c + c).join("")
      : clean;
  const n = parseInt(full || "009FEF", 16);
  if (Number.isNaN(n)) return "0,159,239";
  return `${(n >> 16) & 0xff},${(n >> 8) & 0xff},${n & 0xff}`;
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

function SendButton({
  armed,
  themeSendButtonUrl,
}: {
  armed: boolean;
  themeSendButtonUrl?: string | null;
}) {
  const { pending } = useFormStatus();
  const active = armed && !pending;
  const useImage = !!themeSendButtonUrl;
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
        // Themed send button swaps the orange disc + paper plane for
        // the theme's own artwork (e.g. the Joker-theme Batman roundel).
        // When no theme asset is set the button falls back to the
        // founder-approved orange + glyph layout.
        background: useImage ? "transparent" : NEX.orange,
        color: "#0B0F1A",
        border: useImage ? "none" : `1px solid ${NEX.orangeSoft}`,
        display: "grid",
        placeItems: "center",
        cursor: pending ? "wait" : armed ? "pointer" : "not-allowed",
        transition:
          "opacity 220ms ease, transform 120ms ease, box-shadow 220ms ease",
        transform: active ? "scale(1)" : "scale(0.92)",
        opacity: active ? 1 : pending ? 0.85 : 0.4,
        boxShadow: active
          ? useImage
            ? "0 6px 18px rgba(255,220,70,0.35)"
            : "0 6px 18px rgba(255,120,0,0.35)"
          : "none",
        marginLeft: 4,
        padding: 0,
        overflow: "hidden",
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
      ) : useImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={themeSendButtonUrl!}
          alt=""
          aria-hidden
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            display: "block",
            pointerEvents: "none",
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

function MediaModal({
  onClose,
  onPickCapture,
  captureEnabled,
  showAnimationsOption,
}: {
  onClose: () => void;
  onPickCapture?: (kind: CaptureKind) => void;
  /** When true, Camera / Video / Voice trigger real capture flows;
   *  when false, they fall back to the "coming soon" no-op stubs. */
  captureEnabled?: boolean;
  /** When true, the modal shows an extra "Animations" option that
   *  dispatches the "nex-haunted-hotel-open-animations" window event.
   *  Only passed by the Haunted Hotel theme surface. */
  showAnimationsOption?: boolean;
}) {
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
            fontSize: 11,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: NEX.cyan,
            textAlign: "center",
            marginBottom: 4,
            fontWeight: 600,
          }}
        >
          Add media
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
          <ModalOption
            icon={<CameraIcon size={26} />}
            label="Camera"
            onClose={onClose}
            onActivate={
              captureEnabled ? () => onPickCapture?.("camera") : undefined
            }
          />
          <ModalOption
            icon={<VideoIcon size={26} />}
            label="Video"
            onClose={onClose}
            onActivate={
              captureEnabled ? () => onPickCapture?.("video") : undefined
            }
          />
          <ModalOption
            icon={<MicIcon size={26} />}
            label="Voice"
            onClose={onClose}
            onActivate={
              captureEnabled ? () => onPickCapture?.("voice") : undefined
            }
          />
          <ModalOption
            icon={<PaletteIcon size={26} />}
            label="Themes"
            onClose={onClose}
            href="/nex-native/chat-themes-library"
          />
          {showAnimationsOption && (
            <ModalOption
              icon={<AnimationsIcon size={26} />}
              label="Animations"
              onClose={onClose}
              onActivate={() => {
                // Replaces the Haunted Hotel's floating 3-dots entry
                // point · HauntedHotelController listens for this
                // event and opens its FX panel.
                window.dispatchEvent(
                  new CustomEvent("nex-haunted-hotel-open-animations"),
                );
                onClose();
              }}
            />
          )}
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
  themeEmojis,
  themeStickers,
  sendStickerAction,
}: {
  onClose: () => void;
  onPick: (emoji: string) => void;
  /** Bridge ThemeEmoji-B · when non-empty, the picker renders these
   *  image tiles instead of the default EMOJI_SET. Click inserts
   *  ":slug:" text into the composer. */
  themeEmojis?:
    | { slug: string; imageUrl: string; label: string }[]
    | null;
  /** Bridge ThemeSticker · when non-empty, the picker exposes a
   *  "Stickers" tab rendering portrait tiles. Tapping a sticker
   *  posts a FormData payload to `sendStickerAction` which sends
   *  a peer message with attachment_type='sticker'. */
  themeStickers?:
    | {
        slug: string;
        imageUrl: string;
        label: string;
        stickerType: "static" | "animated";
        aspectRatio: number;
      }[]
    | null;
  sendStickerAction?: (formData: FormData) => Promise<void> | void;
}) {
  const hasMascots = !!themeEmojis && themeEmojis.length > 0;
  const hasStickers =
    !!themeStickers && themeStickers.length > 0 && !!sendStickerAction;
  // Sealed 2026-10-01 · three tabs: Emoji (universal) · Mascots
  // (theme-specific image tiles) · Stickers (big portrait tiles).
  // Mascots / Stickers tabs only render when the backing content
  // exists so themes without them don't show empty tabs. Legacy
  // callers that passed `useTheme` emoji inline keep working ·
  // mascots moves them to their own tab.
  type PickerTabKey = "emoji" | "mascots" | "stickers";
  // Default to the theme-specific tab when it exists, so themes that
  // shipped a custom set (haunted-hotel, joker) land the user on
  // their own content first rather than on the generic emoji
  // fallback. Theme-neutral viewers (no stickers, no mascots) still
  // open on the universal Emoji tab.
  const [tab, setTab] = React.useState<PickerTabKey>(
    hasStickers ? "stickers" : hasMascots ? "mascots" : "emoji",
  );
  // Sealed 2026-10-01 · the EmojiModal was nested inside <main> and
  // the shell's HeaderRightCluster (a sibling of main, z-6) painted
  // ABOVE main's children regardless of their own z-index. Portal
  // the modal to document.body so it escapes main's painting layer
  // and stacks above every chat chrome element.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) return null;

  const tabCount = 1 + (hasMascots ? 1 : 0) + (hasStickers ? 1 : 0);

  return createPortal(
    <>
      <style>{`
        [data-nex-emoji-scroll] {
          scrollbar-width: none;
        }
        [data-nex-emoji-scroll]::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }
        /* Full-page takeover · fades in from a slight downward offset
           so it reads as rising from the composer area · no container
           chrome · content sits directly on the alley wallpaper. */
        @keyframes nex-emoji-modal-in {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      {/* Full-screen takeover · sealed 2026-10-01 · no container
          chrome. Backdrop IS the content surface: alley wallpaper
          fills the whole viewport with the same light vignette the
          3-dots panel + shop slider use. Tab bar + content grid sit
          directly on the wallpaper · round × top-right closes.
          Backdrop tap closes · the inner content div stops
          propagation so grid taps don't bubble. */}
      <div
        data-nex-media-modal
        role="dialog"
        aria-modal="true"
        aria-label="Pick an emoji, mascot, or sticker"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          width: "100vw",
          height: "100dvh",
          background:
            "linear-gradient(180deg, rgba(6,15,28,0.18) 0%, rgba(3,10,20,0.32) 100%), url(/nex-themes/joker-shop-bg.png) center center / cover no-repeat",
          zIndex: 101,
          color: NEX.textPrimary,
          fontFamily: "inherit",
          display: "flex",
          flexDirection: "column",
          padding:
            "calc(env(safe-area-inset-top, 0) + 76px) 18px 24px",
          overflowY: "auto",
          animation:
            "nex-emoji-modal-in 220ms cubic-bezier(.2,.7,.2,1) both",
        }}
      >
        {/* Round × close · top-right · matches the 3-dots panel */}
        <button
          type="button"
          aria-label="Close picker"
          onClick={onClose}
          style={{
            position: "absolute",
            top: "calc(env(safe-area-inset-top, 0) + 16px)",
            right: 16,
            width: 36,
            height: 36,
            padding: 0,
            borderRadius: "50%",
            background:
              "linear-gradient(180deg, #0a1a30 0%, #020914 100%)",
            border: "1px solid rgba(0,159,239,0.65)",
            color: "#009FEF",
            cursor: "pointer",
            display: "grid",
            placeItems: "center",
            boxShadow:
              "0 4px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)",
            zIndex: 2,
          }}
        >
          <svg
            width={14}
            height={14}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Inner content wrapper · stops click propagation so taps on
            tabs/tiles don't trigger the backdrop close. Max-width
            keeps the grid readable on desktop. */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "100%",
            maxWidth: 480,
            marginLeft: "auto",
            marginRight: "auto",
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minHeight: 0,
          }}
        >
        {/* Tab bar · segmented control · 1-3 columns depending on
            what content types are available for this chat. */}
        <div
          role="tablist"
          aria-label="Picker tabs"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${tabCount}, 1fr)`,
            gap: 4,
            padding: 4,
            marginBottom: 12,
            background: "rgba(0,0,0,0.35)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 12,
          }}
        >
          <PickerTab
            active={tab === "emoji"}
            onClick={() => setTab("emoji")}
            label="Emoji"
          />
          {hasMascots && (
            <PickerTab
              active={tab === "mascots"}
              onClick={() => setTab("mascots")}
              label="Mascots"
            />
          )}
          {hasStickers && (
            <PickerTab
              active={tab === "stickers"}
              onClick={() => setTab("stickers")}
              label="Stickers"
            />
          )}
        </div>

        {tab === "emoji" && (
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
                  borderRadius: 10,
                  fontSize: 22,
                  cursor: "pointer",
                  padding: 0,
                  lineHeight: 1,
                  display: "grid",
                  placeItems: "center",
                  transition:
                    "background 120ms ease, transform 100ms ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background =
                    "rgba(0,159,239,0.14)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {tab === "mascots" && hasMascots && (
          <div
            data-nex-emoji-scroll
            style={{
              flex: 1,
              overflowY: "auto",
              display: "grid",
              // 5 columns · bigger tiles so each image mascot reads
              // at a glance · 25 jokers land in a clean 5×5 grid.
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: 8,
              paddingRight: 4,
            }}
          >
            {themeEmojis!.map((em) => (
              <button
                key={em.slug}
                type="button"
                title={em.label || em.slug}
                aria-label={em.label || em.slug}
                onClick={() => onPick(`:${em.slug}:`)}
                style={{
                  width: "100%",
                  aspectRatio: "1 / 1",
                  background: "transparent",
                  border: "none",
                  borderRadius: 10,
                  cursor: "pointer",
                  padding: 4,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  transition:
                    "background 120ms ease, transform 100ms ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background =
                    "rgba(0,159,239,0.14)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={em.imageUrl}
                  alt={em.label || em.slug}
                  style={{
                    flex: 1,
                    minHeight: 0,
                    width: "100%",
                    objectFit: "contain",
                    display: "block",
                  }}
                />
                <span
                  aria-hidden={!em.label}
                  style={{
                    height: 11,
                    lineHeight: "11px",
                    fontSize: 9,
                    letterSpacing: "0.02em",
                    color: "rgba(180,195,220,0.85)",
                    textAlign: "center",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    width: "100%",
                    flexShrink: 0,
                    marginTop: 2,
                    textShadow:
                      "0 0 2px rgba(0,0,0,0.9), 0 1px 2px rgba(0,0,0,0.5)",
                  }}
                >
                  {em.label || ""}
                </span>
              </button>
            ))}
          </div>
        )}

        {tab === "stickers" &&
          (hasStickers ? (
            <StickersGrid
              stickers={themeStickers!}
              sendStickerAction={sendStickerAction!}
              onPicked={onClose}
            />
          ) : (
            <MascotEmpty />
          ))}
        </div>
      </div>
    </>,
    document.body,
  );
}

// Bridge ThemeSticker · sealed 2026-10-01. Portrait tiles for the
// Stickers tab · 3-column grid so the natural ~0.72 aspect ratio
// renders cleanly without distortion. Tapping a sticker POSTs a
// FormData payload to sendStickerAction (Server Action) and closes
// the picker · stickers are a DEDICATED content type, never routed
// through the emoji-token insert path.
function StickersGrid({
  stickers,
  sendStickerAction,
  onPicked,
}: {
  stickers: Array<{
    slug: string;
    imageUrl: string;
    label: string;
    stickerType: "static" | "animated";
    aspectRatio: number;
  }>;
  sendStickerAction: (formData: FormData) => Promise<void> | void;
  onPicked: () => void;
}) {
  return (
    <div
      data-nex-emoji-scroll
      style={{
        flex: 1,
        overflowY: "auto",
        display: "grid",
        // 2 columns per founder direction 2026-10-01 · each sticker
        // uses more of the container width so the portrait artwork
        // reads at its intended size instead of being pinched.
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: 10,
        paddingRight: 4,
      }}
    >
      {stickers.map((sticker) => (
        <form
          key={sticker.slug}
          action={sendStickerAction}
          onSubmit={() => {
            // Close the picker immediately · the Server Action is
            // already queued by this point so the sticker send
            // completes in the background.
            setTimeout(() => onPicked(), 0);
          }}
          style={{ margin: 0 }}
        >
          {/* Sealed security boundary 2026-10-01 · the browser MUST
              only post the sticker slug. image_url, label, type, and
              aspect are DB-resolved server-side in
              sendPeerStickerAction · never trusted from here. See
              nex_trust_scan_doctrine (reporter-identity doctrine
              applies to any client-authored payload). */}
          <input
            type="hidden"
            name="theme_sticker_slug"
            value={sticker.slug}
          />
          <button
            type="submit"
            aria-label={`Send sticker ${sticker.label || sticker.slug}`}
            title={sticker.label || sticker.slug}
            style={{
              // Sealed 2026-10-01 · stickers fill the full height and
              // width of their tile · no padding, no border frame, no
              // background fill. The sticker artwork IS the chrome.
              display: "block",
              width: "100%",
              aspectRatio: sticker.aspectRatio,
              background: "transparent",
              border: "none",
              borderRadius: 12,
              padding: 0,
              overflow: "hidden",
              cursor: "pointer",
              transition: "transform 120ms ease, filter 120ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.03)";
              e.currentTarget.style.filter =
                "drop-shadow(0 0 14px rgba(0,159,239,0.45))";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.filter = "none";
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sticker.imageUrl}
              alt={sticker.label || sticker.slug}
              style={{
                display: "block",
                width: "100%",
                height: "100%",
                // Cover · the button's aspect-ratio matches the sticker's
                // native aspect, so cover == exact edge-to-edge fill
                // with no letterbox and no crop in practice.
                objectFit: "cover",
                pointerEvents: "none",
              }}
            />
          </button>
        </form>
      ))}
    </div>
  );
}

function PickerTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        padding: "9px 10px",
        borderRadius: 8,
        background: active
          ? "linear-gradient(180deg, rgba(0,159,239,0.28) 0%, rgba(0,159,239,0.18) 100%)"
          : "transparent",
        border: active
          ? `1px solid ${NEX.cyanSoft}`
          : "1px solid transparent",
        color: active ? NEX.textPrimary : "rgba(180, 195, 220, 0.7)",
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        cursor: "pointer",
        transition: "all 160ms ease",
        boxShadow: active
          ? "0 0 18px rgba(0,159,239,0.22), inset 0 1px 0 rgba(255,255,255,0.06)"
          : "none",
      }}
    >
      {label}
    </button>
  );
}

function MascotEmpty() {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 24px",
        textAlign: "center",
        gap: 10,
      }}
    >
      <div style={{ fontSize: 56, lineHeight: 1 }} aria-hidden>
        🦉
      </div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: NEX.textPrimary,
          letterSpacing: "0.02em",
        }}
      >
        Mascots · coming soon
      </div>
      <div
        style={{
          fontSize: 12,
          color: "rgba(155, 175, 205, 0.85)",
          lineHeight: 1.55,
          maxWidth: 260,
        }}
      >
        Send an animated NEX mascot as your reply. Unlocking with{" "}
        <span style={{ color: "#FF7800", fontWeight: 700 }}>NEX Bisnis</span>
        {" "}when the mascot library ships.
      </div>
    </div>
  );
}

function ModalOption({
  icon,
  label,
  onClose,
  href,
  onActivate,
}: {
  icon: React.ReactNode;
  label: string;
  onClose: () => void;
  /** Optional destination · when supplied the option acts as a Link
   *  and hard-navigates on tap. */
  href?: string;
  /** Optional handler · when supplied, the option acts as a button
   *  and calls onActivate on click (closing the modal too). Takes
   *  precedence over href. Used for Camera / Video / Voice which
   *  trigger a file input rather than navigating. */
  onActivate?: () => void;
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
  if (onActivate) {
    return (
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={() => {
          onActivate();
        }}
        style={sharedStyle}
      >
        {renderOptionInner(icon, label)}
      </button>
    );
  }
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

// Attachment-file button · paperclip icon, matches PlusButton size.
function AttachButton({ onClick, accent }: { onClick: () => void; accent: string }) {
  return (
    <button
      type="button"
      aria-label="Attach file"
      title="Attach file"
      onClick={onClick}
      style={{
        width: 36,
        height: 36,
        padding: 0,
        marginRight: 4,
        borderRadius: 999,
        display: "grid",
        placeItems: "center",
        background: "transparent",
        border: `1px solid ${accent}66`,
        color: accent,
        cursor: "pointer",
        flexShrink: 0,
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M20.5 11.5l-7.3 7.3a5 5 0 1 1-7-7l7.3-7.3a3.5 3.5 0 0 1 5 5L11.3 16.8a2 2 0 1 1-2.8-2.8l6.5-6.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function PlusIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" aria-hidden {...strokeProps}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function DotsIcon({ color = "#009FEF" }: { color?: string }) {
  // Running-light animation · three dots pulse in sequence so the
  // composer's 3-dot menu button reads as "alive" · Founder direction
  // 2026-09-27 "running light through the dots dancing blue" · repainted
  // 2026-10-01 to inherit the peer's chat_theme accent so Joker's dots
  // read green, Night Sky's read blue, Pink Dream's read pink · ONE NEX
  // IDENTITY doctrine.
  //
  // The pulse's drop-shadow uses the same accent via a CSS variable so
  // the glow stays theme-consistent without needing per-theme keyframes.
  return (
    <span
      style={
        // Scope the CSS variable to this instance so multiple composers
        // (unlikely but not impossible in prototypes) don't fight over
        // a single global.
        { display: "inline-grid", placeItems: "center", ["--nex-dot-color" as string]: color } as React.CSSProperties
      }
    >
      <svg
        width={26}
        height={26}
        viewBox="0 0 24 24"
        aria-hidden
      >
        <circle cx="12" cy="5" r="2.2" fill={color} data-nex-dot="0" />
        <circle cx="12" cy="12" r="2.2" fill={color} data-nex-dot="1" />
        <circle cx="12" cy="19" r="2.2" fill={color} data-nex-dot="2" />
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
            filter: drop-shadow(0 0 4px var(--nex-dot-color, #00CFFF));
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
    </span>
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

function AnimationsIcon({ size = 20 }: { size?: number }) {
  // Little sparkle · same spirit as the floating 3-dots the Haunted
  // Hotel used before this entry point moved to the + button.
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3l1.6 5 5 1.6-5 1.6L12 16.2 10.4 11.2 5.4 9.6l5-1.6L12 3z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M19 14l.8 2.4 2.4.8-2.4.8L19 20.4 18.2 18l-2.4-.8 2.4-.8L19 14z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
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

function AttachmentPreview({
  url,
  kind,
}: {
  url: string;
  kind: "image" | "video" | "audio";
}) {
  const wrap: React.CSSProperties = {
    flexShrink: 0,
    width: 46,
    height: 46,
    borderRadius: 10,
    overflow: "hidden",
    background: "rgba(0,0,0,0.35)",
    border: "1px solid rgba(255,255,255,0.08)",
    display: "grid",
    placeItems: "center",
  };
  if (kind === "image") {
    return (
      <div style={wrap}>
        <img
          src={url}
          alt="Photo attachment"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
    );
  }
  if (kind === "video") {
    return (
      <div style={wrap}>
        <video
          src={url}
          muted
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
    );
  }
  // Audio · glyph placeholder · no thumb possible without waveform work.
  return (
    <div
      style={{
        ...wrap,
        fontSize: 22,
        color: NEX.cyan,
      }}
      aria-hidden
    >
      🎙️
    </div>
  );
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
