"use client";

// src/app/nex-native/[businessSlug]/[productId]/direct/_share-picker.tsx
//
// Bridge 49b-next · NEX contact picker for the Direct Price share
// flow. Client-only modal · opens when the buyer taps the "👤 Share"
// button on the D6 view. Lists ACTIVE NEX friends (peer chat within
// last 7 days) · shows an editable personal note · submits to
// shareToFriendAction.
//
// Doctrine:
//   · Only NEX friends · never external device share sheet.
//   · Only ACTIVE friends (server enforces the 7-day rule too · this
//     list already filters so the buyer never picks a rejected one).
//   · Personal note pre-fills with a friendly default the buyer can
//     edit or clear.

import { useCallback, useState } from "react";
import { shareToFriendAction } from "../../../_actions";

export interface ActiveFriend {
  readonly id: string;
  readonly name: string;
  readonly handle: string | null;
  readonly avatarUrl: string | null;
  /** How recently they were active in your peer chat · "2h ago" etc. */
  readonly lastActiveLabel: string;
}

interface Props {
  businessId: string;
  productId: string;
  productName: string;
  friendBonusPct: number;
  expiryHours: number;
  activeFriends: ActiveFriend[];
  open: boolean;
  onClose: () => void;
}

const NEX = {
  bg: "#020914",
  panel: "#03101D",
  panelHi: "#04101F",
  textPrimary: "#F2F5F8",
  textSecondary: "#7D9BC0",
  textMute: "rgba(125,155,192,0.65)",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanFaint: "rgba(0, 175, 255, 0.12)",
  orange: "#FF7200",
  orangeStrong: "#FF9033",
};

const DEFAULT_NOTE =
  "This looks great · thought you might appreciate the reward 🎂";

export function ShareToFriendPicker(props: Props) {
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [note, setNote] = useState(DEFAULT_NOTE);

  const reset = useCallback(() => {
    setPickedId(null);
    setNote(DEFAULT_NOTE);
  }, []);

  const close = useCallback(() => {
    reset();
    props.onClose();
  }, [props, reset]);

  if (!props.open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Share with a NEX friend"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
      onClick={(e) => {
        // Click on the backdrop closes · click inside doesn't bubble.
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          maxHeight: "82vh",
          background: NEX.bg,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          border: `1px solid ${NEX.cyan}`,
          borderBottom: "none",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header · Bauhaus discipline */}
        <div
          style={{
            padding: "16px 18px 12px",
            borderBottom: `2px solid ${NEX.cyan}`,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 9,
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                fontWeight: 900,
                color: NEX.cyan,
              }}
            >
              Share · +{props.friendBonusPct}% both sides
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 18,
                fontWeight: 900,
                letterSpacing: "-0.01em",
                textTransform: "uppercase",
                color: NEX.textPrimary,
              }}
            >
              Pick a NEX friend
            </div>
            <div
              style={{
                marginTop: 3,
                fontSize: 11,
                color: NEX.textSecondary,
                lineHeight: 1.4,
              }}
            >
              Only friends you&rsquo;ve chatted with in the last 7 days ·
              you both get the reward if they order in {props.expiryHours}hr.
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close picker"
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: NEX.panel,
              color: NEX.textPrimary,
              border: `1px solid ${NEX.cyanFaint}`,
              fontSize: 16,
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Friend list · scrollable */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px" }}>
          {props.activeFriends.length === 0 ? (
            <div
              style={{
                padding: 24,
                textAlign: "center",
                fontSize: 12,
                color: NEX.textSecondary,
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 8 }} aria-hidden>
                💬
              </div>
              No recently-active NEX friends to share with. Start a
              chat with someone in the last week and they&rsquo;ll show
              up here.
            </div>
          ) : (
            props.activeFriends.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setPickedId(f.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  padding: "10px 12px",
                  background: pickedId === f.id ? "rgba(0,175,255,0.14)" : "transparent",
                  border: `1px solid ${pickedId === f.id ? NEX.cyan : NEX.cyanFaint}`,
                  borderRadius: 12,
                  marginBottom: 6,
                  color: NEX.textPrimary,
                  textAlign: "left",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <div
                  aria-hidden
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    overflow: "hidden",
                    background: NEX.cyanFaint,
                    color: NEX.cyan,
                    display: "grid",
                    placeItems: "center",
                    fontSize: 14,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {f.avatarUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={f.avatarUrl}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <span>{initials(f.name)}</span>
                  )}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "-0.005em" }}>
                    {f.name}
                  </div>
                  <div style={{ fontSize: 10, color: NEX.textSecondary, letterSpacing: "0.02em" }}>
                    Active · {f.lastActiveLabel}
                  </div>
                </div>
                {pickedId === f.id && (
                  <span
                    aria-hidden
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: NEX.cyan,
                      color: "#0B0F1A",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 12,
                      fontWeight: 900,
                    }}
                  >
                    ✓
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        {/* Compose + send · shown only after a friend is picked */}
        {pickedId && (
          <form
            action={shareToFriendAction}
            style={{
              padding: "12px 18px 16px",
              borderTop: `1px solid ${NEX.cyanFaint}`,
              background: NEX.panelHi,
            }}
          >
            <input type="hidden" name="receiver_account_id" value={pickedId} />
            <input type="hidden" name="business_id" value={props.businessId} />
            <input type="hidden" name="product_id" value={props.productId} />
            <label
              style={{
                display: "block",
                fontSize: 9,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                fontWeight: 800,
                color: NEX.textSecondary,
              }}
            >
              Personal note (optional · 200 chars)
              <textarea
                name="personal_note"
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 200))}
                rows={2}
                maxLength={200}
                style={{
                  display: "block",
                  marginTop: 6,
                  width: "100%",
                  padding: "8px 10px",
                  background: NEX.panel,
                  color: NEX.textPrimary,
                  border: `1px solid ${NEX.cyanFaint}`,
                  borderRadius: 8,
                  fontSize: 13,
                  fontFamily: "inherit",
                  letterSpacing: 0,
                  textTransform: "none",
                  fontWeight: 400,
                  resize: "vertical",
                }}
              />
            </label>
            <button
              type="submit"
              style={{
                marginTop: 12,
                width: "100%",
                minHeight: 48,
                background: `linear-gradient(180deg, ${NEX.orangeStrong}, ${NEX.orange})`,
                color: "#0B0F1A",
                border: "none",
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 900,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                cursor: "pointer",
                boxShadow: `0 10px 24px rgba(255,114,0,0.45)`,
              }}
            >
              🎁 Send · both get −{props.friendBonusPct}%
            </button>
            <div
              style={{
                marginTop: 6,
                textAlign: "center",
                fontSize: 9,
                color: NEX.textMute,
                letterSpacing: "0.06em",
              }}
            >
              Sends via NEX chat · {props.expiryHours}hr window
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
