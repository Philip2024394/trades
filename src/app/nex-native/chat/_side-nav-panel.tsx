"use client";

// src/app/nex-native/chat/_side-nav-panel.tsx
//
// Right-rail floating navigation for the chat surface.
// ----------------------------------------------------
// Consolidates the header's home + contacts buttons into a compact
// vertical rail docked to the right edge · reserves a slot for the
// shop button that Bridge 11 (Product-in-chat) will wire up.
//
// Sealed 2026-09-27 · Founder direction "floating side panel on the
// right side screen with round button with icon · move the home
// button + contacts button here".
//
// Layout:
//   right: 10px · top: below header · 44px round buttons stacked
//   vertically with 8px gaps · inside a frosted-glass pill so the
//   rail reads as one control cluster instead of loose icons.
//
// Bubble compression:
//   Message bubbles use `alignSelf: flex-end` inside a flex column
//   at maxWidth 78% (mine) / calc(78% + 35px) (theirs). The rail is
//   `position: fixed` on the right edge · doesn't participate in
//   the flow · so bubble width is unaffected.
//
// Buttons rendered (top to bottom):
//   · Home       · always visible · link to /nex-native/chat
//   · Shop       · visible only when peerHasShop=true · placeholder
//                  modal for now · Bridge 11 will replace with an
//                  inline product picker
//   · Contacts   · always visible · opens the same drawer the header
//                  used to own (accepted friends + pending invites)
//   · Invite pip · little orange badge on Contacts when there are
//                  pending invites waiting for the viewer

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  acceptFriendInviteAction,
  declineFriendInviteAction,
} from "../_actions";

const NEX = {
  panel: "#03101D",
  panelSolid: "rgba(3,16,29,0.96)",
  railBg: "rgba(3,16,29,0.72)",
  cyan: "#009FEF",
  cyanSoft: "rgba(0,159,239,0.5)",
  cyanFaint: "rgba(0,159,239,0.14)",
  cyanBorder: "rgba(0,159,239,0.35)",
  orange: "#FF7800",
  orangeSoft: "rgba(255,120,0,0.5)",
  green: "#16D66B",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  cyanDeep: "#063B67",
};

export interface SideNavContact {
  id: string;
  name: string;
  profession: string | null;
  avatarUrl: string | null;
  href: string;
  isCurrent: boolean;
}

export interface PendingInvite {
  otherAccountId: string;
  name: string;
  avatarUrl: string | null;
  profession: string | null;
}

interface SideNavPanelProps {
  contacts: SideNavContact[];
  pendingInvites: PendingInvite[];
}

export function SideNavPanel({
  contacts,
  pendingInvites,
}: SideNavPanelProps) {
  const [contactsOpen, setContactsOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!contactsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContactsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [contactsOpen]);

  const inviteCount = pendingInvites.length;

  return (
    <>
      <style>{`
        @keyframes nex-nav-fade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes nex-nav-slide-in {
          from { opacity: 0; transform: translateX(6px) scale(0.98); }
          to   { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes nex-nav-panel-in {
          from { opacity: 0; transform: translateY(-6px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* Rail · fixed to viewport right at vertical center. Narrow
          (36px buttons) with white icons so it reads as a subtle
          overlay chip rather than a heavy nav bar. Founder direction
          2026-09-27 · "movedown center · reduce width · icons white". */}
      <div
        role="toolbar"
        aria-label="Chat side navigation"
        style={{
          position: "fixed",
          right: 8,
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          padding: 4,
          background: NEX.railBg,
          border: `1px solid ${NEX.cyanBorder}`,
          borderRadius: 22,
          backdropFilter: "blur(14px) saturate(1.2)",
          WebkitBackdropFilter: "blur(14px) saturate(1.2)",
          boxShadow:
            "0 12px 32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05)",
          zIndex: 5,
          animation: "nex-nav-slide-in 260ms cubic-bezier(.2,.7,.2,1) both",
        }}
      >
        <RailLink
          href="/nex-native/chat"
          ariaLabel="Back to all chats"
          title="Home"
        >
          <HomeIcon />
        </RailLink>

        <RailButton
          ariaLabel="Show chat contacts"
          title="Contacts"
          onClick={() => setContactsOpen(true)}
          badge={inviteCount}
        >
          <ContactsIcon />
        </RailButton>
      </div>

      {contactsOpen && mounted &&
        createPortal(
          <ContactsDrawer
            contacts={contacts}
            pendingInvites={pendingInvites}
            onClose={() => setContactsOpen(false)}
          />,
          document.body,
        )}
    </>
  );
}

function RailButton({
  ariaLabel,
  title,
  onClick,
  badge,
  children,
}: {
  ariaLabel: string;
  title: string;
  onClick: () => void;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={title}
      onClick={onClick}
      style={{
        position: "relative",
        width: 36,
        height: 36,
        borderRadius: "50%",
        background: "transparent",
        border: "none",
        color: NEX.text, // white
        padding: 0,
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
        transition: "background 160ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.10)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      {children}
      {typeof badge === "number" && badge > 0 && (
        <span
          aria-label={`${badge} pending`}
          style={{
            position: "absolute",
            top: 2,
            right: 2,
            minWidth: 16,
            height: 16,
            borderRadius: 999,
            padding: "0 4px",
            background: NEX.orange,
            color: "#0B0F1A",
            fontSize: 10,
            fontWeight: 700,
            display: "grid",
            placeItems: "center",
            boxShadow: "0 0 6px rgba(255,120,0,0.7)",
          }}
        >
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </button>
  );
}

function RailLink({
  href,
  ariaLabel,
  title,
  children,
}: {
  href: string;
  ariaLabel: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      title={title}
      style={{
        width: 36,
        height: 36,
        borderRadius: "50%",
        background: "transparent",
        color: NEX.text, // white
        display: "grid",
        placeItems: "center",
        textDecoration: "none",
        transition: "background 160ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.10)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      {children}
    </Link>
  );
}

function ContactsDrawer({
  contacts,
  pendingInvites,
  onClose,
}: {
  contacts: SideNavContact[];
  pendingInvites: PendingInvite[];
  onClose: () => void;
}) {
  return (
    <>
      <div
        role="button"
        aria-label="Close contacts"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(2,9,20,0.55)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          zIndex: 999,
          animation: "nex-nav-fade 200ms ease-out both",
        }}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Chat contacts and pending invites"
        style={{
          position: "fixed",
          top: "calc(env(safe-area-inset-top, 0) + 100px)",
          right: 64,
          width: "min(340px, calc(100vw - 84px))",
          maxHeight: "min(70vh, 640px)",
          background: NEX.panelSolid,
          border: `1px solid ${NEX.cyanSoft}`,
          borderRadius: 20,
          zIndex: 1000,
          padding: 0,
          overflow: "hidden",
          animation: "nex-nav-panel-in 220ms cubic-bezier(.2,.7,.2,1) both",
          display: "flex",
          flexDirection: "column",
          boxShadow:
            "0 24px 60px rgba(0,0,0,0.65), 0 0 40px rgba(0,159,239,0.14)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 14px 10px",
            borderBottom: "1px solid rgba(0,159,239,0.14)",
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: NEX.cyan,
              fontWeight: 600,
            }}
          >
            Your chats
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "rgba(0,0,0,0.42)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: NEX.text,
              cursor: "pointer",
              padding: 0,
              display: "grid",
              placeItems: "center",
            }}
          >
            <CloseIcon />
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {pendingInvites.length > 0 && (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "0 2px 4px",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: NEX.orange,
                    boxShadow: `0 0 6px ${NEX.orange}`,
                  }}
                />
                <span
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: NEX.orange,
                    fontWeight: 600,
                  }}
                >
                  Waiting for you
                </span>
              </div>
              {pendingInvites.map((inv) => (
                <InviteRow key={inv.otherAccountId} invite={inv} />
              ))}
              <div
                aria-hidden
                style={{
                  margin: "10px 0 6px",
                  height: 1,
                  background: "rgba(0,159,239,0.14)",
                }}
              />
            </>
          )}

          {contacts.length === 0 && pendingInvites.length === 0 ? (
            <div
              style={{
                padding: "24px 12px",
                textAlign: "center",
                color: NEX.textDim,
                fontSize: 13,
                lineHeight: 1.55,
              }}
            >
              No chats yet. Add a friend to start.
            </div>
          ) : (
            <>
              {contacts.length > 0 && (
                <div
                  style={{
                    padding: "0 2px 4px",
                    fontSize: 10,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: NEX.textMute,
                    fontWeight: 600,
                  }}
                >
                  Your chats
                </div>
              )}
              {contacts.map((c) => (
                <ContactRow
                  key={c.id}
                  contact={c}
                  onNavigate={onClose}
                />
              ))}
            </>
          )}
        </div>

        <div
          style={{
            padding: "10px 12px 12px",
            borderTop: "1px solid rgba(0,159,239,0.14)",
          }}
        >
          <Link
            href="/nex-native/chat"
            onClick={onClose}
            style={{
              display: "block",
              padding: "10px",
              borderRadius: 10,
              background: "rgba(0,159,239,0.10)",
              border: `1px solid ${NEX.cyanBorder}`,
              color: NEX.cyan,
              textDecoration: "none",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textAlign: "center",
              textTransform: "uppercase",
            }}
          >
            All chats →
          </Link>
        </div>
      </aside>
    </>
  );
}

function ContactRow({
  contact: c,
  onNavigate,
}: {
  contact: SideNavContact;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={c.href}
      onClick={onNavigate}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 10px",
        borderRadius: 12,
        background: c.isCurrent ? NEX.cyanFaint : "transparent",
        border: c.isCurrent
          ? `1px solid ${NEX.cyanSoft}`
          : "1px solid transparent",
        color: NEX.text,
        textDecoration: "none",
        transition: "background 160ms ease",
      }}
    >
      <ContactAvatar
        name={c.name}
        avatarUrl={c.avatarUrl}
        highlighted={c.isCurrent}
      />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {c.name}
        </div>
        {c.profession && (
          <div
            style={{
              marginTop: 1,
              fontSize: 10,
              color: NEX.textDim,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {c.profession}
          </div>
        )}
      </div>
      {c.isCurrent && (
        <span
          aria-label="Currently in this chat"
          style={{
            flexShrink: 0,
            fontSize: 9,
            letterSpacing: "0.14em",
            fontWeight: 700,
            padding: "3px 8px",
            borderRadius: 999,
            background: "rgba(0,159,239,0.24)",
            color: NEX.cyan,
          }}
        >
          HERE
        </span>
      )}
    </Link>
  );
}

function InviteRow({ invite }: { invite: PendingInvite }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 10px",
        borderRadius: 12,
        background: "rgba(255,120,0,0.08)",
        border: "1px solid rgba(255,120,0,0.35)",
      }}
    >
      <ContactAvatar name={invite.name} avatarUrl={invite.avatarUrl} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: NEX.text,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {invite.name}
        </div>
        <div
          style={{
            marginTop: 1,
            fontSize: 10,
            color: NEX.textDim,
            letterSpacing: "0.04em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {invite.profession
            ? `${invite.profession} · wants to connect`
            : "wants to connect"}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <form action={acceptFriendInviteAction}>
          <input
            type="hidden"
            name="other_account_id"
            value={invite.otherAccountId}
          />
          <button
            type="submit"
            aria-label={`Accept invite from ${invite.name}`}
            title="Accept"
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: NEX.green,
              border: "none",
              color: "#0B0F1A",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              padding: 0,
              boxShadow: "0 4px 10px rgba(22,214,107,0.35)",
            }}
          >
            <CheckIcon />
          </button>
        </form>
        <form action={declineFriendInviteAction}>
          <input
            type="hidden"
            name="other_account_id"
            value={invite.otherAccountId}
          />
          <button
            type="submit"
            aria-label={`Decline invite from ${invite.name}`}
            title="Decline"
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "rgba(0,0,0,0.42)",
              border: "1px solid rgba(255,255,255,0.14)",
              color: NEX.textDim,
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              padding: 0,
            }}
          >
            <CloseIcon />
          </button>
        </form>
      </div>
    </div>
  );
}

function ContactAvatar({
  name,
  avatarUrl,
  highlighted,
}: {
  name: string;
  avatarUrl: string | null;
  highlighted?: boolean;
}) {
  return (
    <div
      aria-hidden
      style={{
        flexShrink: 0,
        width: 40,
        height: 40,
        borderRadius: "50%",
        background: NEX.cyanDeep,
        border: highlighted
          ? `2px solid ${NEX.cyan}`
          : "1px solid rgba(255,255,255,0.08)",
        overflow: "hidden",
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
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "grid",
            placeItems: "center",
            color: NEX.cyan,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {initials(name)}
        </div>
      )}
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.charAt(0) ?? "";
  const last =
    parts.length > 1 ? parts[parts.length - 1]?.charAt(0) ?? "" : "";
  return (first + last).toUpperCase() || "?";
}

function HomeIcon() {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 12l9-9 9 9" />
      <path d="M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10" />
    </svg>
  );
}

function ContactsIcon() {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      aria-hidden
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
