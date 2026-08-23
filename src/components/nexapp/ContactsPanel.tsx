// NEX Contacts panel — Priority 4 first visual cut (orchestrator only).
//
// Renders inside the conversation frame when the CONTACTS corner is
// tapped. Per pinned `project_nex_four_corners_functional_model`, this
// is an interaction STATE inside the chat area, NOT a separate route.
//
// FILE-SPLIT ARCHITECTURE (Philip 2026-08-21 · after 3× OOM during
// initial compile of the monolithic 900-line version on 8 GB Victus):
//   · contactsCopy.ts       — EN + ID copy (no React, tiny leaf)
//   · ContactAvatar.tsx     — Avatar + GroupAvatar
//   · ContactCards.tsx      — ContactCard + GroupCard + shared card styles
//   · CreateGroupSteps.tsx  — SelectMembersStep + NameGroupStep + StepHeader
//   · ContactActionSheet.tsx — long-press action sheet
//   · ContactsPanel.tsx     — THIS FILE · orchestrator + view routing +
//                             list layout + own-NEX-ID footer strip
// Each module compiles independently → smaller per-file webpack heap
// peak → OOM avoided. When the 16 GB upgrade lands OR Next 16.3+ ships
// the memory-eviction improvements, we can consolidate if desired —
// but split-by-concern is also just cleaner architecture.
//
// PHASE 1 SCOPE (this iteration):
//   · landscape contact + group cards with mock data
//   · large orange dashed "+ Create Group" action card
//   · secondary "Connect NEX ID" link
//   · warm empty state (no contacts)
//   · inline 2-step Create Group flow (select → name → create)
//   · long-press → action sheet (Message · View profile · Block · Report)
//   · Block/Unblock toggle (session-local · no persistence)
//
// Deferred to Priority 4+ (per pinned doctrine):
//   · tap-to-open-conversation wiring
//   · real backend persistence
//   · invitation-via-WhatsApp/SMS
//   · unread badge auto-updates from real messaging

"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { NEX } from "@/lib/nexapp/tokens";
import { normalisePublicNexId } from "@/lib/nex-identity";
import {
  MOCK_CONTACTS,
  MOCK_GROUPS,
  pravatarUrl,
  type MockContact,
  type MockGroup,
} from "@/lib/nexapp/mockContacts";
import { pickCopy } from "./contactsCopy";
import { ContactCard, GroupCard } from "./ContactCards";
import { ContactActionSheet } from "./ContactActionSheet";
import {
  SelectMembersStep,
  NameGroupStep,
  StepHeader,
} from "./CreateGroupSteps";

type View =
  | { name: "list" }
  | { name: "select-members" }
  | { name: "name-group"; selectedIds: string[] }
  | { name: "connect-id" };

type ActionSheetState =
  | { open: false }
  | { open: true; contact: MockContact };

export function ContactsPanel({
  myNexId,
  myName,
  onClose,
  language,
}: {
  myNexId: string;
  myName: string;
  onClose: () => void;
  language: "en" | "id";
}) {
  const t = pickCopy(language);

  // Session-local state — mock data doesn't persist. Real backend
  // hooks slot in here when Priority 4 NEX-to-NEX ships.
  const [contacts, setContacts] = useState<MockContact[]>(() => [...MOCK_CONTACTS]);
  const [groups, setGroups] = useState<MockGroup[]>(() => [...MOCK_GROUPS]);
  const [view, setView] = useState<View>({ name: "list" });
  const [actionSheet, setActionSheet] = useState<ActionSheetState>({ open: false });
  const [connectInput, setConnectInput] = useState("");
  const [connectMessage, setConnectMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // `onClose` is currently just for the NEX-corner-tap-to-close flow;
  // the panel closes when the parent flips cornerPanel to null. Kept
  // in the props so a future "explicit close button" has a wiring
  // point without prop-drilling further.
  void onClose;

  const contactsById = useMemo(() => {
    const map = new Map<string, MockContact>();
    contacts.forEach((c) => map.set(c.id, c));
    return map;
  }, [contacts]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }

  return (
    <div style={rootStyle}>
      <div style={titleStyle}>CONTACTS</div>

      <div className="nex-no-scrollbar" style={contentStyle}>
        {view.name === "list" && (
          <ListView
            contacts={contacts}
            groups={groups}
            language={language}
            onCreateGroup={() => setView({ name: "select-members" })}
            onOpenConnectId={() => {
              setConnectInput("");
              setConnectMessage(null);
              setView({ name: "connect-id" });
            }}
            onTapContact={(c) => {
              if (c.blocked) setActionSheet({ open: true, contact: c });
              else showToast(t.toastConversationSoon);
            }}
            onLongPressContact={(c) => setActionSheet({ open: true, contact: c })}
            onTapGroup={() => showToast(t.toastGroupSoon)}
            myNexId={myNexId}
          />
        )}

        {view.name === "select-members" && (
          <SelectMembersStep
            contacts={contacts.filter((c) => !c.blocked)}
            onCancel={() => setView({ name: "list" })}
            onNext={(ids) => setView({ name: "name-group", selectedIds: ids })}
            language={language}
          />
        )}

        {view.name === "name-group" && (
          <NameGroupStep
            memberIds={view.selectedIds}
            contactsById={contactsById}
            onBack={() => setView({ name: "select-members" })}
            onCreate={(name, avatarSeed) => {
              const newGroup: MockGroup = {
                id: `g-${Date.now()}`,
                name,
                avatarUrl: avatarSeed ? pravatarUrl(avatarSeed) : undefined,
                memberIds: view.selectedIds,
                lastSender: myName,
                lastMessage: t.groupCreatedFirstLine,
                lastActivityAt: new Date().toISOString(),
                unread: 0,
              };
              setGroups((prev) => [newGroup, ...prev]);
              showToast(t.toastGroupCreated);
              setView({ name: "list" });
            }}
            language={language}
          />
        )}

        {view.name === "connect-id" && (
          <ConnectIdStep
            input={connectInput}
            message={connectMessage}
            onChange={setConnectInput}
            onSubmit={() => {
              const normalised = normalisePublicNexId(connectInput);
              if (!normalised) {
                setConnectMessage(t.connectInvalid);
                return;
              }
              setConnectMessage(t.connectPlaceholderReply.replace("{id}", normalised));
            }}
            onBack={() => setView({ name: "list" })}
            language={language}
          />
        )}
      </div>

      {toast && <div style={toastStyle}>{toast}</div>}

      {actionSheet.open && (
        <ContactActionSheet
          contact={actionSheet.contact}
          onClose={() => setActionSheet({ open: false })}
          onToggleBlock={() => {
            const targetId = actionSheet.contact.id;
            const wasBlocked = actionSheet.contact.blocked === true;
            setContacts((prev) =>
              prev.map((c) => (c.id === targetId ? { ...c, blocked: !c.blocked } : c))
            );
            setActionSheet({ open: false });
            showToast(wasBlocked ? t.toastUnblocked : t.toastBlocked);
          }}
          language={language}
        />
      )}
    </div>
  );
}

// ── List view · pure presentation, extracted from the orchestrator ─
function ListView({
  contacts,
  groups,
  language,
  onCreateGroup,
  onOpenConnectId,
  onTapContact,
  onLongPressContact,
  onTapGroup,
  myNexId,
}: {
  contacts: MockContact[];
  groups: MockGroup[];
  language: "en" | "id";
  onCreateGroup: () => void;
  onOpenConnectId: () => void;
  onTapContact: (c: MockContact) => void;
  onLongPressContact: (c: MockContact) => void;
  onTapGroup: (g: MockGroup) => void;
  myNexId: string;
}) {
  const t = pickCopy(language);
  const hasAnyContent = contacts.length > 0 || groups.length > 0;
  return (
    <>
      <button type="button" onClick={onCreateGroup} style={createGroupCardStyle}>
        <span style={createGroupIconStyle}>+</span>
        <span style={createGroupLabelStyle}>{t.createGroup}</span>
      </button>

      <button type="button" onClick={onOpenConnectId} style={connectLinkStyle}>
        <span aria-hidden style={{ fontSize: 14, opacity: 0.7 }}>⚡</span>
        {t.connectAction}
      </button>

      {!hasAnyContent && (
        <div style={emptyWrapStyle}>
          <div style={emptyKickerStyle}>{t.emptyKicker}</div>
          <div style={emptyMessageStyle}>{t.emptyMessage}</div>
        </div>
      )}

      {groups.length > 0 && (
        <>
          <div style={sectionHeaderStyle}>{t.groupsSection}</div>
          {groups.map((g) => (
            <GroupCard key={g.id} group={g} onTap={() => onTapGroup(g)} />
          ))}
        </>
      )}

      {contacts.length > 0 && (
        <>
          <div style={sectionHeaderStyle}>{t.contactsSection}</div>
          {contacts.map((c) => (
            <ContactCard
              key={c.id}
              contact={c}
              onTap={() => onTapContact(c)}
              onLongPress={() => onLongPressContact(c)}
            />
          ))}
        </>
      )}

      <div style={ownIdFooterStyle}>
        <div style={ownIdLabelStyle}>{t.yourNexId}</div>
        <div style={ownIdValueStyle}>{myNexId}</div>
      </div>
    </>
  );
}

// ── Connect NEX ID sub-view ────────────────────────────────
function ConnectIdStep({
  input,
  message,
  onChange,
  onSubmit,
  onBack,
  language,
}: {
  input: string;
  message: string | null;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  language: "en" | "id";
}) {
  const t = pickCopy(language);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <StepHeader title={t.connectStepTitle} onBack={onBack} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label style={connectFormLabelStyle} htmlFor="nex-connect-id">{t.connectLabel}</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            id="nex-connect-id"
            type="text"
            value={input}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onSubmit(); }}
            placeholder="NEX-XXXX-XXXX"
            style={connectInputStyle}
            spellCheck={false}
            autoCapitalize="characters"
            autoFocus
          />
          <button type="button" onClick={onSubmit} style={connectSubmitStyle}>
            {t.connectBtn}
          </button>
        </div>
        {message && <div style={connectMessageStyle}>{message}</div>}
        <div style={connectFooterStyle}>{t.soon}</div>
      </div>
    </div>
  );
}

// ── Styles · orchestrator only (card + step styles live in their files) ─

const rootStyle: CSSProperties = {
  position: "relative",
  flex: 1,
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  gap: 6,
  padding: "10px 8px 8px",
  overflow: "hidden",
};

const titleStyle: CSSProperties = {
  color: NEX.orange,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 2.5,
  textAlign: "center",
  padding: "2px 60px 6px",
  lineHeight: 1,
};

const contentStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  paddingRight: 2,
};

const createGroupCardStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  padding: "16px 12px",
  borderRadius: 14,
  background: "rgba(249, 115, 22, 0.06)",
  border: `1.5px dashed ${NEX.orange}`,
  color: NEX.orange,
  fontSize: 15,
  fontWeight: 700,
  letterSpacing: -0.1,
  cursor: "pointer",
  transition: "background 140ms ease",
};

const createGroupIconStyle: CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  lineHeight: 1,
};

const createGroupLabelStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  letterSpacing: -0.1,
};

const connectLinkStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "transparent",
  border: "none",
  color: "rgba(255,255,255,0.65)",
  fontSize: 12.5,
  padding: "6px 10px",
  cursor: "pointer",
  alignSelf: "flex-start",
};

const sectionHeaderStyle: CSSProperties = {
  color: "rgba(255,255,255,0.40)",
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: 1.8,
  padding: "6px 4px 2px",
  textTransform: "uppercase",
};

const emptyWrapStyle: CSSProperties = {
  padding: "10px 12px 4px",
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const emptyKickerStyle: CSSProperties = {
  color: NEX.text,
  fontSize: 14,
  fontWeight: 600,
};

const emptyMessageStyle: CSSProperties = {
  color: "rgba(255,255,255,0.55)",
  fontSize: 12.5,
  lineHeight: 1.5,
};

const ownIdFooterStyle: CSSProperties = {
  marginTop: "auto",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 12px",
  borderRadius: 12,
  background: "linear-gradient(180deg, rgba(249,115,22,0.06) 0%, rgba(249,115,22,0.02) 100%)",
  border: `1px solid ${NEX.orangeSoft}`,
};

const ownIdLabelStyle: CSSProperties = {
  color: NEX.orange,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 1.5,
};

const ownIdValueStyle: CSSProperties = {
  color: NEX.text,
  fontSize: 13,
  fontWeight: 700,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  letterSpacing: 0.8,
};

// Connect step styles (only used by ConnectIdStep)
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

const connectSubmitStyle: CSSProperties = {
  background: NEX.orange,
  color: "#0a0a0a",
  border: "none",
  borderRadius: 10,
  padding: "10px 16px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const connectMessageStyle: CSSProperties = {
  color: "rgba(255,255,255,0.65)",
  fontSize: 11.5,
  lineHeight: 1.5,
  padding: "6px 2px 0",
};

const connectFooterStyle: CSSProperties = {
  color: "rgba(255,255,255,0.35)",
  fontSize: 11,
  lineHeight: 1.5,
  paddingTop: 8,
};

const toastStyle: CSSProperties = {
  position: "absolute",
  left: "50%",
  transform: "translateX(-50%)",
  bottom: 24,
  background: "rgba(20,20,20,0.95)",
  color: NEX.text,
  padding: "8px 14px",
  borderRadius: 999,
  fontSize: 12,
  border: `1px solid rgba(255,255,255,0.10)`,
  boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
  zIndex: 15,
};
