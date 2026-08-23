// NEX Contacts · Create Group multi-step flow.
// Extracted from ContactsPanel 2026-08-21 (file split for OOM avoidance).
// Steps: SelectMembers → NameGroup. Each has its own local state; the
// parent orchestrator just switches which one to render.

"use client";

import { useState, type CSSProperties } from "react";
import { NEX } from "@/lib/nexapp/tokens";
import { type MockContact } from "@/lib/nexapp/mockContacts";
import { pickCopy } from "./contactsCopy";
import { Avatar } from "./ContactAvatar";
import {
  cardBaseStyle,
  cardBodyStyle,
  cardTopRowStyle,
  cardBottomRowStyle,
  cardNameStyle,
  cardSnippetStyle,
} from "./ContactCards";

// ── Step header (shared between steps) ─────────────────────
export function StepHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 6 }}>
      <button
        type="button"
        onClick={onBack}
        aria-label="Back"
        style={{
          background: "transparent",
          border: "none",
          color: "rgba(255,255,255,0.65)",
          fontSize: 20,
          cursor: "pointer",
          padding: 0,
          width: 24,
          height: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        ‹
      </button>
      <div style={{ color: NEX.text, fontSize: 15, fontWeight: 600, letterSpacing: -0.1 }}>
        {title}
      </div>
    </div>
  );
}

// ── Step 1 · Select members ────────────────────────────────
export function SelectMembersStep({
  contacts,
  onCancel,
  onNext,
  language,
}: {
  contacts: MockContact[];
  onCancel: () => void;
  onNext: (ids: string[]) => void;
  language: "en" | "id";
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const t = pickCopy(language);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  const count = selected.size;
  const canNext = count >= 2;

  return (
    <div style={stepWrapStyle}>
      <StepHeader title={t.selectMembersTitle} onBack={onCancel} />
      <div style={stepSubtitleStyle}>{t.selectMembersHint.replace("{n}", String(count))}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {contacts.map((c) => {
          const isChecked = selected.has(c.id);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => toggle(c.id)}
              style={{
                ...cardBaseStyle(false),
                background: isChecked ? "rgba(249,115,22,0.10)" : "rgba(255,255,255,0.04)",
                borderColor: isChecked ? NEX.orangeSoft : "rgba(255,255,255,0.08)",
              }}
              aria-pressed={isChecked}
            >
              <Avatar name={c.name} url={c.avatarUrl} status={c.status} />
              <div style={cardBodyStyle}>
                <div style={cardTopRowStyle}>
                  <span style={cardNameStyle}>{c.name}</span>
                </div>
                <div style={cardBottomRowStyle}>
                  <span style={cardSnippetStyle}>{c.publicNexId}</span>
                </div>
              </div>
              <span style={checkboxStyle(isChecked)}>{isChecked ? "✓" : ""}</span>
            </button>
          );
        })}
      </div>
      <div style={stepActionsStyle}>
        <button type="button" onClick={onCancel} style={secondaryBtnStyle}>{t.cancel}</button>
        <button
          type="button"
          onClick={() => onNext(Array.from(selected))}
          disabled={!canNext}
          style={primaryBtnStyle(canNext)}
        >
          {t.next}
        </button>
      </div>
    </div>
  );
}

// ── Step 2 · Name & create ─────────────────────────────────
export function NameGroupStep({
  memberIds,
  contactsById,
  onBack,
  onCreate,
  language,
}: {
  memberIds: string[];
  contactsById: Map<string, MockContact>;
  onBack: () => void;
  onCreate: (name: string, avatarSeed?: string) => void;
  language: "en" | "id";
}) {
  const [name, setName] = useState("");
  const [useCustomAvatar, setUseCustomAvatar] = useState(true);
  const t = pickCopy(language);
  const canCreate = name.trim().length >= 2;
  const memberPreview = memberIds
    .map((id) => contactsById.get(id)?.name.split(" ")[0])
    .filter(Boolean)
    .join(", ");

  function submit() {
    if (!canCreate) return;
    onCreate(name.trim(), useCustomAvatar ? `group-${name}-${Date.now()}` : undefined);
  }

  return (
    <div style={stepWrapStyle}>
      <StepHeader title={t.nameGroupTitle} onBack={onBack} />
      <div style={stepSubtitleStyle}>
        {memberIds.length} {t.membersLower} · {memberPreview}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <label style={connectFormLabelStyle} htmlFor="nex-group-name">
          {t.groupNameLabel}
        </label>
        <input
          id="nex-group-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder={t.groupNamePlaceholder}
          style={connectInputStyle}
          maxLength={50}
          autoFocus
        />
        <label style={autoAvatarCheckboxStyle}>
          <input
            type="checkbox"
            checked={useCustomAvatar}
            onChange={(e) => setUseCustomAvatar(e.target.checked)}
            style={{ accentColor: NEX.orange as string }}
          />
          {t.autoGenerateAvatar}
        </label>
      </div>
      <div style={stepActionsStyle}>
        <button type="button" onClick={onBack} style={secondaryBtnStyle}>{t.back}</button>
        <button type="button" onClick={submit} disabled={!canCreate} style={primaryBtnStyle(canCreate)}>
          {t.create}
        </button>
      </div>
    </div>
  );
}

// ── Styles (only for the two step components) ─────────────

const stepWrapStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const stepSubtitleStyle: CSSProperties = {
  color: "rgba(255,255,255,0.55)",
  fontSize: 12,
  lineHeight: 1.5,
  paddingBottom: 4,
};

const stepActionsStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  paddingTop: 12,
  justifyContent: "flex-end",
};

function primaryBtnStyle(enabled: boolean): CSSProperties {
  return {
    background: enabled ? NEX.orange : "rgba(255,255,255,0.08)",
    color: enabled ? "#0a0a0a" : "rgba(255,255,255,0.35)",
    border: "none",
    borderRadius: 999,
    padding: "10px 20px",
    fontSize: 13,
    fontWeight: 600,
    cursor: enabled ? "pointer" : "not-allowed",
  };
}

const secondaryBtnStyle: CSSProperties = {
  background: "transparent",
  color: "rgba(255,255,255,0.65)",
  border: `1px solid rgba(255,255,255,0.12)`,
  borderRadius: 999,
  padding: "10px 20px",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
};

function checkboxStyle(isChecked: boolean): CSSProperties {
  return {
    width: 22,
    height: 22,
    borderRadius: "50%",
    border: `1.5px solid ${isChecked ? NEX.orange : "rgba(255,255,255,0.20)"}`,
    background: isChecked ? NEX.orange : "transparent",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#0a0a0a",
    fontSize: 14,
    flex: "0 0 auto",
  };
}

const connectFormLabelStyle: CSSProperties = {
  color: "rgba(255,255,255,0.65)",
  fontSize: 12,
  fontWeight: 500,
};

const connectInputStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  background: "rgba(255,255,255,0.04)",
  border: `1px solid rgba(255,255,255,0.12)`,
  borderRadius: 10,
  color: NEX.text,
  fontSize: 14,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  padding: "10px 12px",
  outline: "none",
};

const autoAvatarCheckboxStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  cursor: "pointer",
  color: "rgba(255,255,255,0.65)",
  fontSize: 12,
  userSelect: "none",
};
