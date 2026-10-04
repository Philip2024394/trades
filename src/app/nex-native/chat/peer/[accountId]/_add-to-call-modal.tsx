"use client";

// Add-to-call picker · opens over the active call overlay, lists
// the viewer's friends as landscape contact cards (matching the
// Call Center picker style), and upgrades the active 1:1 into a
// group call when one is tapped.

import * as React from "react";
import { listContactsForAddAction, type AddPickContact } from "./_list-contacts-for-add-action";
import { inviteToGroupCallAction } from "./_add-to-call-action";

export interface AddToCallModalProps {
  currentPeerAccountId: string;
  currentPeerDisplayName: string;
  mediaType: "audio" | "video";
  /** Fired when the group session is created and chat invites are
   *  dispatched · the launcher hangs up the current 1:1 and routes
   *  the viewer to /call/g/{sessionId}. */
  onInvited: (sessionId: string, inviteeDisplayName: string) => void;
  onClose: () => void;
}

const COLOR = {
  overlay: "rgba(2, 5, 15, 0.72)",
  card: "#121737",
  cardBorder: "rgba(255,255,255,0.08)",
  cardBorderStrong: "rgba(255,255,255,0.14)",
  text: "#F2F5FA",
  textDim: "#A6ADC2",
  textMuted: "#6B7490",
  orange: "#FF8A2A",
  orangeSoft: "rgba(255,138,42,0.18)",
  green: "#22C55E",
  greenSoft: "rgba(34,197,94,0.18)",
  blue: "#3B82F6",
  blueSoft: "rgba(59,130,246,0.18)",
};

export function AddToCallModal(props: AddToCallModalProps): React.JSX.Element {
  const [contacts, setContacts] = React.useState<AddPickContact[] | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await listContactsForAddAction(props.currentPeerAccountId);
      if (!cancelled) setContacts(list);
    })();
    return () => { cancelled = true; };
  }, [props.currentPeerAccountId]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props]);

  async function onPick(c: AddPickContact): Promise<void> {
    if (busyId) return;
    setErr(null);
    setBusyId(c.id);
    const r = await inviteToGroupCallAction({
      currentPeerAccountId: props.currentPeerAccountId,
      inviteeAccountId: c.id,
      mediaType: props.mediaType,
    });
    if (!r.ok) {
      setBusyId(null);
      setErr(r.reason);
      return;
    }
    props.onInvited(r.sessionId, r.inviteeDisplayName);
  }

  const tint = props.mediaType === "video" ? COLOR.blue : COLOR.green;
  const tintSoft = props.mediaType === "video" ? COLOR.blueSoft : COLOR.greenSoft;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add to call"
      onClick={props.onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: COLOR.overlay,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        zIndex: 1100,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: 16,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 460,
          background: COLOR.card,
          border: `1px solid ${COLOR.cardBorderStrong}`,
          borderRadius: 22,
          padding: "20px 16px 18px",
          maxHeight: "80dvh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
          color: COLOR.text,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <span
            aria-hidden
            style={{
              width: 34,
              height: 34,
              borderRadius: 999,
              background: tintSoft,
              color: tint,
              display: "grid",
              placeItems: "center",
              border: `1px solid ${tint}44`,
            }}
          >
            <PlusUserIcon />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Add to call</div>
            <div style={{ fontSize: 12, color: COLOR.textDim }}>
              Pick a friend to invite · ends your call with {props.currentPeerDisplayName}
            </div>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            aria-label="Close"
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              background: "rgba(255,255,255,0.06)",
              border: "none",
              color: COLOR.textDim,
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
            }}
          >
            <CloseIcon />
          </button>
        </div>

        {err && (
          <div
            style={{
              marginBottom: 10,
              padding: "8px 10px",
              borderRadius: 10,
              background: "rgba(239,68,68,0.14)",
              border: "1px solid rgba(239,68,68,0.35)",
              color: "#FFB4C0",
              fontSize: 12.5,
            }}
          >
            {err}
          </div>
        )}

        {contacts === null ? (
          <div
            style={{
              padding: "28px 10px",
              textAlign: "center",
              color: COLOR.textDim,
              fontSize: 13,
            }}
          >
            Loading contacts…
          </div>
        ) : contacts.length === 0 ? (
          <div
            style={{
              padding: "28px 10px",
              textAlign: "center",
              color: COLOR.textDim,
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            No other friends to invite.
            <br />
            <span style={{ color: COLOR.textMuted }}>
              Add friends from the Friends page.
            </span>
          </div>
        ) : (
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: "4px 0 0",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {contacts.map((c) => {
              const busy = busyId === c.id;
              const disabled = busyId !== null && !busy;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    disabled={disabled || busy}
                    onClick={() => void onPick(c)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: "12px 14px",
                      borderRadius: 16,
                      background: busy ? tintSoft : "rgba(255,255,255,0.03)",
                      border: `1px solid ${busy ? tint : COLOR.cardBorder}`,
                      color: COLOR.text,
                      textAlign: "left",
                      opacity: disabled ? 0.45 : 1,
                      cursor: disabled || busy ? "not-allowed" : "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    <AvatarCircle
                      name={c.displayName}
                      avatarUrl={c.avatarUrl}
                      size={56}
                    />
                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          letterSpacing: "-0.005em",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {c.displayName}
                      </div>
                      {c.profession && (
                        <div
                          style={{
                            fontSize: 12.5,
                            color: COLOR.text,
                            opacity: 0.86,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {c.profession}
                        </div>
                      )}
                      {(c.headline || c.locationLabel) && (
                        <div
                          style={{
                            fontSize: 11.5,
                            color: COLOR.textDim,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {c.headline && c.locationLabel
                            ? `${c.headline} · ${c.locationLabel}`
                            : (c.headline ?? c.locationLabel)}
                        </div>
                      )}
                    </div>
                    <span
                      aria-hidden
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 999,
                        background: tintSoft,
                        color: tint,
                        border: `1px solid ${tint}44`,
                        display: "grid",
                        placeItems: "center",
                        flex: "none",
                      }}
                    >
                      {busy ? <HourglassIcon /> : <PlusUserIcon />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div
          style={{
            fontSize: 10.5,
            color: COLOR.textMuted,
            marginTop: 12,
            textAlign: "center",
            lineHeight: 1.4,
          }}
        >
          Everyone gets a chat invite with the join link · group calls
          hold up to 4 people.
        </div>
      </div>
    </div>
  );
}

function AvatarCircle({
  name,
  avatarUrl,
  size,
}: {
  name: string;
  avatarUrl: string | null;
  size: number;
}): React.JSX.Element {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("") || "·";
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: avatarUrl
          ? `url(${avatarUrl}) center/cover`
          : "linear-gradient(145deg, rgba(255,138,42,0.4), rgba(59,130,246,0.35))",
        display: "grid",
        placeItems: "center",
        color: COLOR.text,
        fontSize: Math.round(size * 0.3),
        fontWeight: 700,
        flex: "none",
        border: `2px solid ${COLOR.cardBorder}`,
      }}
    >
      {avatarUrl ? "" : initials}
    </span>
  );
}

function PlusUserIcon(): React.JSX.Element {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={1.9}
         strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx={9} cy={7} r={4} />
      <line x1={19} y1={8} x2={19} y2={14} />
      <line x1={16} y1={11} x2={22} y2={11} />
    </svg>
  );
}
function CloseIcon(): React.JSX.Element {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={2}
         strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1={18} y1={6} x2={6} y2={18} />
      <line x1={6} y1={6} x2={18} y2={18} />
    </svg>
  );
}
function HourglassIcon(): React.JSX.Element {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={1.9}
         strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 2h12M6 22h12M6 2v6l6 4-6 4v6M18 2v6l-6 4 6 4v6" />
    </svg>
  );
}
