"use client";

// src/app/nex-native/chat/_reactions.tsx
//
// Bridge 72 · Message reactions UI.
// Bridge ThemeEmoji-C · sealed 2026-10-01.
// ------------------------------------------------
// Two pieces:
//   · ReactionsChipRow · renders below the bubble · one pill per
//     emoji with its count · tap to toggle · self's own emojis get
//     a subtle blue rim so the user can tell what they picked. When
//     the reaction key is a theme-emoji slug (`:joker-01:`), the pill
//     renders an <img> tile instead of the literal text.
//   · ReactionAddButton + ReactionPickerModal · a small "+😊" chip
//     that opens a compact horizontal-scroll strip anchored to the
//     bubble. Tiles come from the active theme's emoji set (when
//     present) followed by the unicode quick set as a fallback tail
//     · so you always get hearts/thumbs even in the Joker theme.
//
// Both talk to the same bound Server Action (`toggleMessageReactionAction`
// bound with peerAccountId · takes message_id + emoji form fields).
// The server accepts either a whitelisted unicode value or a well-
// formed `:slug:` value · see peer-message-reactions.ts.

import * as React from "react";
import type { NexPeerMessageReactions } from "@/lib/nex-native/peer-message-reactions";
import {
  NEX_PEER_MESSAGE_QUICK_REACTIONS,
  isThemeEmojiReaction,
} from "@/lib/nex-native/peer-message-reactions";

const NEX = {
  chipBg: "rgba(4,20,36,0.72)",
  chipBorder: "rgba(139,169,209,0.25)",
  chipBorderMine: "rgba(0,159,239,0.55)",
  chipText: "#DDE9FA",
  addBg: "rgba(4,20,36,0.55)",
  addBorder: "rgba(139,169,209,0.30)",
  addText: "#8BA9D1",
  pickerBg: "rgba(4,20,36,0.96)",
  pickerBorder: "rgba(139,169,209,0.30)",
};

export interface ThemeEmojiTile {
  slug: string;
  imageUrl: string;
  label: string;
}

/** Build a slug → imageUrl lookup so the chip row can resolve
 *  `:slug:` reactions to their image asset without a per-render loop. */
function buildThemeEmojiIndex(
  tiles: readonly ThemeEmojiTile[] | null | undefined,
): Map<string, ThemeEmojiTile> {
  const m = new Map<string, ThemeEmojiTile>();
  if (!tiles) return m;
  for (const t of tiles) m.set(t.slug, t);
  return m;
}

/** Extract the slug from a `:slug:` reaction key. Returns null when the
 *  key is not a theme-emoji reaction. */
function slugFromReactionKey(key: string): string | null {
  if (!isThemeEmojiReaction(key)) return null;
  return key.slice(1, -1);
}

export interface ReactionsRowProps {
  messageId: string;
  selfAccountId: string;
  reactions: NexPeerMessageReactions;
  /** Bridge Reactions-Order · migration 117 · sealed 2026-10-01 ·
   *  emoji keys in insertion order · the LAST entry is treated as
   *  "newest" and painted as a large stamp overlapping the bubble
   *  corner opposite the tail. When empty (older rows before the
   *  migration + backfill) we fall back to Object.keys(reactions). */
  reactionsOrder?: readonly string[];
  toggleAction: (formData: FormData) => Promise<never> | void | Promise<void>;
  /** Align the row under the correct bubble edge. */
  mine: boolean;
  /** Bridge ThemeEmoji-C · when present, the picker renders the theme's
   *  emoji tiles first (as images) and existing `:slug:` reaction chips
   *  resolve to the matching image. Empty/undefined ⇒ unicode-only. */
  themeEmojis?: readonly ThemeEmojiTile[] | null;
}

export function ReactionsChipRow(props: ReactionsRowProps): React.JSX.Element {
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const themeIndex = React.useMemo(
    () => buildThemeEmojiIndex(props.themeEmojis),
    [props.themeEmojis],
  );

  // Only keep emojis that still have at least one reactor. This
  // guards against stale reactions_order entries or reactions rows
  // where a list got emptied without the order array being cleaned.
  const orderedKeys = React.useMemo<string[]>(() => {
    const source =
      props.reactionsOrder && props.reactionsOrder.length > 0
        ? props.reactionsOrder
        : Object.keys(props.reactions);
    return source.filter((emoji) => {
      const ids = props.reactions[emoji];
      return Array.isArray(ids) && ids.length > 0;
    });
  }, [props.reactions, props.reactionsOrder]);

  const hasReactions = orderedKeys.length > 0;
  // Bridge Reactions-Order · Founder direction 2026-10-01 · the LAST
  // entry (newest) is rendered separately by <BubbleTopRightReaction>
  // inside the bubble itself (see _portrait-bloom-shell.tsx). This row
  // only handles the OLDER reactions · newer-first · bottom-left of
  // the message column.
  const olderEmojis = orderedKeys.slice(0, -1).reverse();

  return (
    <>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 4,
          marginTop: hasReactions ? 3 : 0,
          // Bridge Reactions-Order · Founder direction 2026-10-01 ·
          // older reactions always demote to the LOWER-LEFT of the
          // bubble, side by side · newer-first · regardless of whether
          // this is your bubble or the peer's. Pairs with the big
          // stamp which always sits top-right.
          alignSelf: "flex-start",
        }}
      >
        {/* Add-reaction smile · founder direction 2026-10-01 · ALWAYS
            under every bubble on the LEFT side at full visibility ·
            older reactions chips follow to its right. */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setPickerOpen(true);
          }}
          aria-label="Add reaction"
          title="Add reaction"
          data-nex-reaction-add
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 22,
            height: 22,
            padding: 0,
            borderRadius: 999,
            background: NEX.addBg,
            border: `1px solid ${NEX.addBorder}`,
            color: NEX.addText,
            cursor: "pointer",
            fontSize: 13,
            lineHeight: 1,
            opacity: 1,
            transition: "opacity 140ms ease",
            backdropFilter: "blur(6px)",
          }}
        >
          <SmileIcon />
        </button>
        {olderEmojis.map((emoji) => {
          const ids = props.reactions[emoji] ?? [];
          const selfIn = ids.includes(props.selfAccountId);
          return (
            <ReactionChipForm
              key={emoji}
              messageId={props.messageId}
              emoji={emoji}
              count={ids.length}
              selfSelected={selfIn}
              toggleAction={props.toggleAction}
              themeIndex={themeIndex}
            />
          );
        })}
      </div>
      {pickerOpen && (
        <ReactionPickerModal
          messageId={props.messageId}
          toggleAction={props.toggleAction}
          onClose={() => setPickerOpen(false)}
          themeEmojis={props.themeEmojis ?? null}
        />
      )}
    </>
  );
}

function SmileIcon(): React.JSX.Element {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={1.9}
         strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx={12} cy={12} r={10} />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1={9} y1={9} x2={9.01} y2={9} />
      <line x1={15} y1={9} x2={15.01} y2={9} />
    </svg>
  );
}

function ReactionChipForm({
  messageId,
  emoji,
  count,
  selfSelected,
  toggleAction,
  themeIndex,
}: {
  messageId: string;
  emoji: string;
  count: number;
  selfSelected: boolean;
  toggleAction: (formData: FormData) => Promise<never> | void | Promise<void>;
  themeIndex: Map<string, ThemeEmojiTile>;
}): React.JSX.Element {
  // Bridge ThemeEmoji-C · resolve `:slug:` reactions to their image
  // asset. Unresolved slugs fall back to rendering the raw string so
  // history keeps flowing even if a theme retires an emoji.
  const slug = slugFromReactionKey(emoji);
  const tile = slug ? themeIndex.get(slug) : undefined;

  return (
    <form action={toggleAction} style={{ margin: 0 }}>
      <input type="hidden" name="message_id" value={messageId} />
      <input type="hidden" name="emoji" value={emoji} />
      <button
        type="submit"
        aria-label={
          tile
            ? `Toggle ${tile.label} · ${count}`
            : `Toggle ${emoji} · ${count}`
        }
        title={
          selfSelected
            ? "Remove your reaction"
            : `React with ${tile ? tile.label : emoji}`
        }
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "2px 8px 2px 6px",
          borderRadius: 999,
          background: NEX.chipBg,
          border: `1px solid ${selfSelected ? NEX.chipBorderMine : NEX.chipBorder}`,
          color: NEX.chipText,
          cursor: "pointer",
          fontSize: 11,
          fontWeight: 700,
          lineHeight: 1,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          backdropFilter: "blur(6px)",
        }}
      >
        {tile ? (
          <img
            src={tile.imageUrl}
            alt={tile.label}
            aria-hidden
            width={16}
            height={16}
            style={{
              display: "inline-block",
              width: 16,
              height: 16,
              objectFit: "contain",
            }}
          />
        ) : (
          <span aria-hidden style={{ fontSize: 13 }}>{emoji}</span>
        )}
        <span>{count}</span>
      </button>
    </form>
  );
}

/** Bridge Reactions-Order · sealed 2026-10-01 · Founder direction ·
 *  the newest emoji on a bubble renders INSIDE the bubble at the
 *  top-right corner · no frame, no border, no background pill · just
 *  the glyph or theme-emoji image sitting on top of the bubble
 *  content. Absolutely positioned · the bubble content div in the
 *  shell is position:relative so the offsets anchor there. Tap
 *  toggles the caller's reaction. Older reactions sit below the
 *  bubble on the message column's left side (see ReactionsChipRow).
 *
 *  This component is rendered directly by the shell inside the
 *  bubble content div · NOT by ReactionsChipRow · so it lives at the
 *  layer where the bubble geometry is known. */
export function BubbleTopRightReaction({
  messageId,
  emoji,
  count,
  selfSelected,
  toggleAction,
  themeEmojis,
}: {
  messageId: string;
  emoji: string;
  count: number;
  selfSelected: boolean;
  toggleAction: (formData: FormData) => Promise<never> | void | Promise<void>;
  themeEmojis?: readonly ThemeEmojiTile[] | null;
}): React.JSX.Element {
  const themeIndex = React.useMemo(
    () => buildThemeEmojiIndex(themeEmojis),
    [themeEmojis],
  );
  const slug = slugFromReactionKey(emoji);
  const tile = slug ? themeIndex.get(slug) : undefined;

  return (
    <form
      action={toggleAction}
      style={{
        margin: 0,
        position: "absolute",
        top: 4,
        right: 6,
        // Above the bubble text/attachments so the emoji is always
        // legible even when text runs to the edge.
        zIndex: 4,
        // Compact hit area but no frame.
        lineHeight: 0,
      }}
    >
      <input type="hidden" name="message_id" value={messageId} />
      <input type="hidden" name="emoji" value={emoji} />
      <button
        type="submit"
        aria-label={
          tile
            ? `Toggle ${tile.label} · ${count}`
            : `Toggle ${emoji} · ${count}`
        }
        title={
          selfSelected
            ? "Remove your reaction"
            : `React with ${tile ? tile.label : emoji}`
        }
        style={{
          // NO frame: transparent background, no border, no shadow.
          // Founder direction 2026-10-01 · "no imoji frame circle".
          display: "inline-flex",
          alignItems: "center",
          gap: 2,
          padding: 0,
          background: "transparent",
          border: "none",
          color: NEX.chipText,
          cursor: "pointer",
          fontSize: 12,
          fontWeight: 700,
          lineHeight: 1,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        {tile ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tile.imageUrl}
            alt={tile.label}
            aria-hidden
            width={30}
            height={30}
            style={{
              display: "inline-block",
              width: 30,
              height: 30,
              objectFit: "contain",
              // Subtle drop shadow so the glyph reads against any
              // bubble background · replaces the removed frame.
              filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))",
            }}
          />
        ) : (
          <span
            aria-hidden
            style={{
              fontSize: 24,
              lineHeight: 1,
              filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))",
            }}
          >
            {emoji}
          </span>
        )}
        {count > 1 && (
          <span
            style={{
              marginLeft: 1,
              textShadow: "0 1px 2px rgba(0,0,0,0.7)",
            }}
          >
            {count}
          </span>
        )}
      </button>
    </form>
  );
}

export interface ReactionAddButtonProps {
  messageId: string;
  mine: boolean;
  toggleAction: (formData: FormData) => Promise<never> | void | Promise<void>;
  themeEmojis?: readonly ThemeEmojiTile[] | null;
}

export function ReactionAddButton(props: ReactionAddButtonProps): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const anchorRef = React.useRef<HTMLButtonElement | null>(null);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label="Add reaction"
        title="Add reaction"
        data-nex-reaction-add
        style={{
          position: "absolute",
          top: -8,
          [props.mine ? "left" : "right"]: -8,
          width: 22,
          height: 22,
          borderRadius: 999,
          background: NEX.addBg,
          border: `1px solid ${NEX.addBorder}`,
          color: NEX.addText,
          fontSize: 12,
          lineHeight: 1,
          padding: 0,
          cursor: "pointer",
          display: "grid",
          placeItems: "center",
          opacity: 0,
          transition: "opacity 140ms ease, transform 120ms ease",
          zIndex: 3,
          backdropFilter: "blur(6px)",
        }}
      >
        😊
      </button>
      {open && (
        <ReactionPickerModal
          messageId={props.messageId}
          toggleAction={props.toggleAction}
          onClose={() => setOpen(false)}
          themeEmojis={props.themeEmojis ?? null}
        />
      )}
    </>
  );
}

/** Bridge ThemeEmoji-C · compact one-row horizontal-scroll strip.
 *  Replaces the older centered-in-viewport modal per the founder-
 *  sealed Joker acceptance spec §1: reaction pickers must NOT be
 *  full-screen modals · they must feel like a floating rail attached
 *  to the bubble. Backdrop remains tappable so any tap outside the
 *  rail dismisses. */
function ReactionPickerModal({
  messageId,
  toggleAction,
  onClose,
  themeEmojis,
}: {
  messageId: string;
  toggleAction: (formData: FormData) => Promise<never> | void | Promise<void>;
  onClose: () => void;
  themeEmojis: readonly ThemeEmojiTile[] | null;
}): React.JSX.Element {
  // Close on ESC · backdrop tap handled by the outer transparent layer.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const hasTheme = !!(themeEmojis && themeEmojis.length > 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pick a reaction"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 900,
        // Dim the backdrop lightly so the rail reads as a floating
        // strip · not a full-screen modal.
        background: "rgba(0,0,0,0.25)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        style={{
          // Compact one-row rail · horizontal-scroll when the theme
          // supplies more tiles than fit. `max-width: min(92vw,…)` so
          // the strip never bleeds past the phone frame edges.
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 10px",
          borderRadius: 999,
          background: NEX.pickerBg,
          border: `1px solid ${NEX.pickerBorder}`,
          boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
          maxWidth: "min(92vw, 520px)",
          overflowX: "auto",
          overflowY: "hidden",
          whiteSpace: "nowrap",
          // Hide the scrollbar so the rail reads clean · scroll still
          // works via touch drag / trackpad.
          scrollbarWidth: "none",
          // Required for horizontal pan on iOS Safari · without
          // `touch-action: pan-x` the browser hands the gesture to
          // the backdrop (which closes the modal) instead of the
          // scroll container. `WebkitOverflowScrolling: 'touch'`
          // enables inertial momentum.
          touchAction: "pan-x",
          WebkitOverflowScrolling: "touch",
          overscrollBehaviorX: "contain",
        }}
      >
        {/* Theme emojis first · these are the identity of the theme so
            they take priority in the rail. Fall back to unicode when a
            theme has no set defined. */}
        {hasTheme &&
          themeEmojis!.map((tile) => (
            <form
              key={tile.slug}
              action={toggleAction}
              onSubmit={() => {
                // Defer close so React finishes dispatching the server
                // action before the form unmounts. Without the defer,
                // the picker closes before the submit event completes
                // and the reaction never reaches the server.
                setTimeout(() => onClose(), 0);
              }}
              style={{ margin: 0, flex: "0 0 auto" }}
            >
              <input type="hidden" name="message_id" value={messageId} />
              <input type="hidden" name="emoji" value={`:${tile.slug}:`} />
              <button
                type="submit"
                aria-label={`React with ${tile.label}`}
                title={tile.label}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  padding: 4,
                  display: "grid",
                  placeItems: "center",
                  transition: "transform 120ms ease, background 120ms ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "scale(1.15)";
                  e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <img
                  src={tile.imageUrl}
                  alt={tile.label}
                  width={32}
                  height={32}
                  style={{
                    width: 32,
                    height: 32,
                    objectFit: "contain",
                    pointerEvents: "none",
                  }}
                />
              </button>
            </form>
          ))}

        {/* Divider between theme tiles + unicode fallbacks · only when
            the theme actually supplies its own set. */}
        {hasTheme && (
          <span
            aria-hidden
            style={{
              flex: "0 0 auto",
              width: 1,
              height: 24,
              background: "rgba(139,169,209,0.25)",
              margin: "0 4px",
            }}
          />
        )}

        {/* Unicode quick set · always tail-appended so hearts + thumbs
            remain one-tap-away even inside Joker. */}
        {NEX_PEER_MESSAGE_QUICK_REACTIONS.map((emoji) => (
          <form
            key={emoji}
            action={toggleAction}
            onSubmit={() => {
              setTimeout(() => onClose(), 0);
            }}
            style={{ margin: 0, flex: "0 0 auto" }}
          >
            <input type="hidden" name="message_id" value={messageId} />
            <input type="hidden" name="emoji" value={emoji} />
            <button
              type="submit"
              aria-label={`React with ${emoji}`}
              title={emoji}
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                border: "none",
                background: "transparent",
                color: "#F4F7FC",
                fontSize: 26,
                lineHeight: 1,
                cursor: "pointer",
                transition: "transform 120ms ease, background 120ms ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.2)";
                e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.background = "transparent";
              }}
            >
              {emoji}
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
