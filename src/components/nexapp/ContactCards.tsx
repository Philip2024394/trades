// NEX Contacts · Card components (landscape row layout).
// Extracted from ContactsPanel 2026-08-21 for smaller compile units.
// Shared card styles live here since only these components use them.

"use client";

import type { CSSProperties } from "react";
import { NEX } from "@/lib/nexapp/tokens";
import { formatRelativeTime, type MockContact, type MockGroup } from "@/lib/nexapp/mockContacts";
import { Avatar, GroupAvatar } from "./ContactAvatar";

export function ContactCard({
  contact,
  onTap,
  onLongPress,
}: {
  contact: MockContact;
  onTap: () => void;
  onLongPress: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onTap}
      onContextMenu={(e) => { e.preventDefault(); onLongPress(); }}
      style={cardBaseStyle(contact.blocked === true)}
      aria-label={`Open conversation with ${contact.name}${contact.blocked ? " (blocked)" : ""}`}
    >
      <Avatar name={contact.name} url={contact.avatarUrl} status={contact.status} />
      <div style={cardBodyStyle}>
        <div style={cardTopRowStyle}>
          <span style={cardNameStyle}>{contact.name}</span>
          <span style={cardTimeStyle}>{formatRelativeTime(contact.lastActivityAt)}</span>
        </div>
        <div style={cardBottomRowStyle}>
          <span style={cardSnippetStyle}>
            {contact.blocked ? "Blocked" : contact.lastMessage}
          </span>
          {contact.unread > 0 && !contact.blocked && (
            <span style={unreadChipStyle}>{contact.unread}</span>
          )}
        </div>
      </div>
    </button>
  );
}

export function GroupCard({
  group,
  onTap,
}: {
  group: MockGroup;
  onTap: () => void;
}) {
  const memberCount = group.memberIds.length;
  return (
    <button
      type="button"
      onClick={onTap}
      style={cardBaseStyle(false)}
      aria-label={`Open group ${group.name}`}
    >
      <GroupAvatar url={group.avatarUrl} memberCount={memberCount} />
      <div style={cardBodyStyle}>
        <div style={cardTopRowStyle}>
          <span style={cardNameStyle}>
            <span aria-hidden style={{ marginRight: 6, opacity: 0.8 }}>👥</span>
            {group.name}
          </span>
          <span style={cardTimeStyle}>{formatRelativeTime(group.lastActivityAt)}</span>
        </div>
        <div style={cardBottomRowStyle}>
          <span style={cardSnippetStyle}>
            {memberCount} members · {group.lastSender}: {group.lastMessage}
          </span>
          {group.unread > 0 && (
            <span style={unreadChipStyle}>{group.unread}</span>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Shared card styles (exported so CreateGroupSteps can reuse) ─
export function cardBaseStyle(blocked: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 12,
    background: blocked ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.04)",
    border: `1px solid rgba(255,255,255,0.08)`,
    borderRadius: 14,
    padding: "10px 12px",
    cursor: "pointer",
    color: NEX.text,
    opacity: blocked ? 0.55 : 1,
    textAlign: "left",
    transition: "background 140ms ease, border-color 140ms ease",
    width: "100%",
  };
}

export const cardBodyStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

export const cardTopRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
};

export const cardBottomRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
};

export const cardNameStyle: CSSProperties = {
  color: NEX.text,
  fontSize: 14,
  fontWeight: 600,
  letterSpacing: -0.1,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  display: "inline-flex",
  alignItems: "center",
};

export const cardTimeStyle: CSSProperties = {
  color: "rgba(255,255,255,0.40)",
  fontSize: 10.5,
  fontWeight: 500,
  flex: "0 0 auto",
};

export const cardSnippetStyle: CSSProperties = {
  color: "rgba(255,255,255,0.55)",
  fontSize: 12,
  lineHeight: 1.35,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  flex: 1,
  minWidth: 0,
};

const unreadChipStyle: CSSProperties = {
  background: NEX.orange,
  color: "#0a0a0a",
  fontSize: 10,
  fontWeight: 700,
  padding: "2px 7px",
  borderRadius: 999,
  minWidth: 20,
  textAlign: "center",
  flex: "0 0 auto",
};
