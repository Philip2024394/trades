// NEX Contacts · Long-press action sheet.
// Extracted from ContactsPanel 2026-08-21 (file split for OOM avoidance).

"use client";

import type { CSSProperties } from "react";
import { NEX } from "@/lib/nexapp/tokens";
import { type MockContact } from "@/lib/nexapp/mockContacts";
import { pickCopy } from "./contactsCopy";
import { Avatar } from "./ContactAvatar";

export function ContactActionSheet({
  contact,
  onClose,
  onToggleBlock,
  language,
}: {
  contact: MockContact;
  onClose: () => void;
  onToggleBlock: () => void;
  language: "en" | "id";
}) {
  const t = pickCopy(language);
  return (
    <>
      <div role="presentation" onClick={onClose} style={backdropStyle} />
      <div role="dialog" aria-label={`Actions for ${contact.name}`} style={sheetStyle}>
        <div style={sheetHeaderStyle}>
          <Avatar name={contact.name} url={contact.avatarUrl} size={36} />
          <div>
            <div style={{ color: NEX.text, fontSize: 14, fontWeight: 600 }}>{contact.name}</div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>{contact.publicNexId}</div>
          </div>
        </div>
        <SheetItem label={t.actMessage} onClick={onClose} />
        <SheetItem label={t.actViewProfile} onClick={onClose} />
        <SheetItem
          label={contact.blocked ? t.actUnblock : t.actBlock}
          onClick={onToggleBlock}
          tone={contact.blocked ? "positive" : "warn"}
        />
        <SheetItem label={t.actReport} onClick={onClose} tone="warn" />
        <SheetItem label={t.cancel} onClick={onClose} tone="muted" />
      </div>
    </>
  );
}

function SheetItem({
  label,
  onClick,
  tone,
}: {
  label: string;
  onClick: () => void;
  tone?: "warn" | "positive" | "muted";
}) {
  const color =
    tone === "warn" ? "#ef4444" :
    tone === "positive" ? "#22c55e" :
    tone === "muted" ? "rgba(255,255,255,0.55)" :
    NEX.text;
  return (
    <button type="button" onClick={onClick} style={{ ...sheetItemStyle, color }}>
      {label}
    </button>
  );
}

const backdropStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  zIndex: 10,
};

const sheetStyle: CSSProperties = {
  position: "absolute",
  left: 12,
  right: 12,
  bottom: 12,
  zIndex: 11,
  background: "#111",
  borderRadius: 14,
  padding: 8,
  border: `1px solid rgba(255,255,255,0.10)`,
  boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
};

const sheetHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 8px 12px",
  borderBottom: `1px solid rgba(255,255,255,0.08)`,
  marginBottom: 4,
};

const sheetItemStyle: CSSProperties = {
  display: "block",
  width: "100%",
  background: "transparent",
  border: "none",
  padding: "12px 10px",
  fontSize: 14,
  textAlign: "left",
  cursor: "pointer",
  borderRadius: 8,
};
