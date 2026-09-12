// src/components/nexapp/NexWorkspaceBusinessOnboarding.tsx · Philip 2026-09-05
//
// NEX BUSINESS M1-A · Conversational Business Onboarding Workspace
//
// Reuses the shell-mounted NexComposer for owner input (composer submit
// is routed to acceptOwnerReply() by NexAppShell when this artifact is
// active). Renders NEX/owner message bubbles + review card locally using
// the same visual language as the universal chat surface — no fake AI ·
// no simulated inference · no production persistence.
//
// Composes with (all locked · pinned in MEMORY.md):
//   · doctrine_nex_one_universal_chat (reuses shell composer · one chat mode)
//   · doctrine_nex_owner_controlled_reply (NEX asks · owner answers)
//   · doctrine_nex_business_brain_specialist_employees (structured facts ready)
//   · doctrine_nex_universal_business_product_taxonomy (classification_status: pending)
//   · doctrine_nex_japan_first_class_market (Japan handled naturally · no special-case)
//   · doctrine_nex_marketing_owner_experience_language (calm employee tone)
//   · doctrine_nex_pwa_offline_first (localStorage-only draft · survives offline)
//
// This workspace touches ZERO backend · ZERO taxonomy · ZERO workforce.

"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  ArrowLeft, Check, RefreshCw, Pencil, Plus, X as XIcon,
  Sparkles, ChevronRight,
} from "lucide-react";

import {
  subscribe, getSessionState, ensureSessionLoaded,
  editSingleFact, addListItem, removeListItem, confirmProfile,
  resetSession, openReview,
  SINGLE_FACT_KEYS, LIST_FACT_KEYS, FACT_LABEL,
  BUSINESS_PROFILE_DRAFT_KEY,
  minimumProfileMet, missingMinimumKeys,
  type SingleFactKey, type ListFactKey, type OnboardingMessage,
  type OnboardingSessionState,
} from "@/lib/nexapp/mockBusinessOnboarding";

// ── Design tokens · same as other v6 chassis workspaces ───────────────

const T = {
  bg:         "#050506",
  surface:    "rgba(20, 20, 24, 0.72)",
  surfaceHi:  "rgba(28, 28, 34, 0.88)",
  surfaceLo:  "rgba(14, 14, 18, 0.85)",
  border:     "rgba(255, 255, 255, 0.06)",
  borderMed:  "rgba(255, 255, 255, 0.10)",
  borderHi:   "rgba(255, 255, 255, 0.16)",
  textPri:    "rgba(245, 245, 246, 0.98)",
  textSec:    "rgba(178, 178, 184, 0.88)",
  textDim:    "rgba(130, 130, 138, 0.75)",
  textMute:   "rgba(100, 100, 108, 0.65)",
  orange:     "#f97316",
  orangeSoft: "rgba(249, 115, 22, 0.10)",
  orangeMid:  "rgba(249, 115, 22, 0.35)",
  orangeSolid:"#f97316",
  green:      "#22c55e",
  greenSoft:  "rgba(34, 197, 94, 0.10)",
  greenMid:   "rgba(34, 197, 94, 0.35)",
  amber:      "#f59e0b",
  amberSoft:  "rgba(245, 158, 11, 0.10)",
  amberMid:   "rgba(245, 158, 11, 0.35)",
};

const G = {
  hPad:      16,
  headerH:   82,
  radius:    14,
  radiusS:   10,
};

// ── Props ─────────────────────────────────────────────────────────────

export interface NexWorkspaceBusinessOnboardingProps {
  onBack?: () => void;
}

// ── Component ──────────────────────────────────────────────────────────

// Server snapshot (SSR-safe) — before useSyncExternalStore mounts on the
// client it may run against a snapshot that doesn't exist yet. We return
// a stable empty state.
const EMPTY_STATE: OnboardingSessionState = {
  draft: {
    version: 1,
    companyIdentity: { value: null, source: null, createdAt: null, updatedAt: null, status: "not_provided", confidence: null },
    businessRole:    { value: null, source: null, createdAt: null, updatedAt: null, status: "not_provided", confidence: null },
    industry:        { value: null, source: null, createdAt: null, updatedAt: null, status: "not_provided", confidence: null },
    products:  { items: [], status: "not_provided" },
    services:  { items: [], status: "not_provided" },
    markets:   { items: [], status: "not_provided" },
    locations: { items: [], status: "not_provided" },
    goals:     { items: [], status: "not_provided" },
    confirmed: false,
    confirmedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  messages: [],
  currentAsk: "companyIdentity",
  reviewOpen: false,
};

function useSessionState(): OnboardingSessionState {
  return useSyncExternalStore(subscribe, getSessionState, () => EMPTY_STATE);
}

export function NexWorkspaceBusinessOnboarding({ onBack }: NexWorkspaceBusinessOnboardingProps) {
  const s = useSessionState();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [editingSingle, setEditingSingle] = useState<SingleFactKey | null>(null);
  const [editingListAdd, setEditingListAdd] = useState<ListFactKey | null>(null);
  const [confirmedFlash, setConfirmedFlash] = useState(false);

  // Load persisted draft (or seed opening message) on mount
  useEffect(() => {
    ensureSessionLoaded();
  }, []);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [s.messages.length]);

  const minimumMet = useMemo(() => minimumProfileMet(s.draft), [s.draft]);
  const missing    = useMemo(() => missingMinimumKeys(s.draft), [s.draft]);

  const onUiStub = useCallback((label: string) => {
    console.log(`[NexWorkspaceBusinessOnboarding] ${label} · UI stub · no backend`);
  }, []);

  const handleConfirm = useCallback(() => {
    confirmProfile();
    setConfirmedFlash(true);
    onUiStub("profile confirmed locally · nex.business-profile.draft.v1 · Marketing Employee not activated · nothing sent");
    setTimeout(() => setConfirmedFlash(false), 3200);
  }, [onUiStub]);

  const handleReset = useCallback(() => {
    if (typeof window !== "undefined" && !window.confirm("Start onboarding from the beginning? Your current draft will be cleared.")) return;
    resetSession();
    onUiStub("session reset · localStorage cleared");
  }, [onUiStub]);

  return (
    <section
      aria-label="NEX Business Onboarding workspace"
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        maxWidth: "100%",
        height: "100%",
        minWidth: 0,
        minHeight: 0,
        boxSizing: "border-box",
        color: T.textPri,
        background: T.bg,
        overflow: "hidden",
      }}
    >
      <Header
        onBack={onBack}
        onReset={handleReset}
        onReview={() => openReview()}
        canReview={s.messages.length >= 3 && !s.reviewOpen}
        reviewOpen={s.reviewOpen}
      />

      {/* Scrolling transcript */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          overflowY: "auto",
          overflowX: "hidden",
          padding: `12px ${G.hPad}px 20px`,
          boxSizing: "border-box",
          width: "100%",
          maxWidth: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {s.messages.length === 0 && (
          <div style={{ color: T.textDim, fontSize: 12, textAlign: "center", padding: "24px 0" }}>
            Loading your onboarding session…
          </div>
        )}

        {s.messages.map((m) => (
          <MessageBubble key={m.id} msg={m} />
        ))}

        {s.reviewOpen && (
          <ReviewCard
            state={s}
            editingSingle={editingSingle}
            setEditingSingle={setEditingSingle}
            editingListAdd={editingListAdd}
            setEditingListAdd={setEditingListAdd}
            minimumMet={minimumMet}
            missing={missing}
            onConfirm={handleConfirm}
            confirmedFlash={confirmedFlash}
          />
        )}
      </div>

      {/* Bottom footnote · calm · states the truth about persistence */}
      <div
        style={{
          flex: "0 0 auto",
          padding: `8px ${G.hPad}px 10px`,
          borderTop: `1px solid ${T.border}`,
          fontSize: 10.5,
          color: T.textMute,
          textAlign: "center",
          letterSpacing: 0.25,
          lineHeight: 1.5,
          background: T.surfaceLo,
          boxSizing: "border-box",
        }}
      >
        Draft is local only. Persistence lands in M1-B. Nothing sent. Use the composer below to reply.
      </div>
    </section>
  );
}

// ── Header ────────────────────────────────────────────────────────────

function Header({
  onBack, onReset, onReview, canReview, reviewOpen,
}: {
  onBack?: () => void;
  onReset: () => void;
  onReview: () => void;
  canReview: boolean;
  reviewOpen: boolean;
}) {
  return (
    <header
      style={{
        flex: `0 0 ${G.headerH}px`,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: `0 ${G.hPad}px`,
        borderBottom: `1px solid ${T.border}`,
        boxSizing: "border-box",
        minWidth: 0,
      }}
    >
      <button
        type="button"
        aria-label="Back to Business"
        onClick={() => onBack?.()}
        style={{
          appearance: "none",
          background: "transparent",
          border: "none",
          padding: 0,
          width: 40,
          height: 40,
          borderRadius: 10,
          color: T.orange,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <ArrowLeft size={22} strokeWidth={2} />
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: -0.005,
            lineHeight: 1.15,
            color: T.textPri,
          }}
        >
          Tell NEX about your business
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: T.textDim,
            lineHeight: 1.2,
            marginTop: 2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          Local draft only · reply with the composer
        </div>
      </div>

      {canReview && (
        <button
          type="button"
          aria-label="Review draft"
          onClick={onReview}
          style={{
            appearance: "none",
            height: 34,
            padding: "0 12px",
            borderRadius: 10,
            background: T.orangeSoft,
            border: `1px solid ${T.orangeMid}`,
            color: T.orange,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 0.15,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            flexShrink: 0,
          }}
        >
          Review
        </button>
      )}

      <button
        type="button"
        aria-label="Start again"
        onClick={onReset}
        style={{
          appearance: "none",
          height: 34,
          width: 34,
          borderRadius: 10,
          background: "transparent",
          border: `1px solid ${T.borderMed}`,
          color: T.textDim,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
        title="Start again"
      >
        <RefreshCw size={14} strokeWidth={2} />
      </button>
    </header>
  );
}

// ── Message bubbles (NEX + owner styling · visually consistent w/ chat) ─

function MessageBubble({ msg }: { msg: OnboardingMessage }) {
  if (msg.role === "system") {
    return (
      <div
        style={{
          padding: "10px 12px",
          background: T.amberSoft,
          border: `1px solid ${T.amberMid}`,
          borderRadius: G.radiusS,
          color: T.amber,
          fontSize: 12,
          lineHeight: 1.5,
          maxWidth: "100%",
          alignSelf: "stretch",
          minWidth: 0,
          boxSizing: "border-box",
        }}
      >
        {msg.text}
      </div>
    );
  }
  const isNex = msg.role === "nex";
  return (
    <div
      style={{
        display: "flex",
        justifyContent: isNex ? "flex-start" : "flex-end",
        width: "100%",
        minWidth: 0,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          maxWidth: "82%",
          minWidth: 0,
          padding: "10px 14px",
          background: isNex ? T.surface : T.orangeSoft,
          border: `1px solid ${isNex ? T.borderMed : T.orangeMid}`,
          borderRadius: isNex ? "14px 14px 14px 4px" : "14px 14px 4px 14px",
          color: isNex ? T.textPri : T.textPri,
          fontSize: 13.5,
          lineHeight: 1.5,
          letterSpacing: 0.05,
          wordBreak: "break-word",
          boxSizing: "border-box",
        }}
      >
        {isNex && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginBottom: 3, fontSize: 10, letterSpacing: 1.4, color: T.orange, textTransform: "uppercase" as const, fontWeight: 700 }}>
            <Sparkles size={10} strokeWidth={2.4} />
            NEX
          </div>
        )}
        <div>{msg.text}</div>
      </div>
    </div>
  );
}

// ── Review card · calm summary + edit affordances + confirm ─────────

function ReviewCard({
  state, editingSingle, setEditingSingle, editingListAdd, setEditingListAdd,
  minimumMet, missing, onConfirm, confirmedFlash,
}: {
  state: OnboardingSessionState;
  editingSingle: SingleFactKey | null;
  setEditingSingle: (k: SingleFactKey | null) => void;
  editingListAdd: ListFactKey | null;
  setEditingListAdd: (k: ListFactKey | null) => void;
  minimumMet: boolean;
  missing: string[];
  onConfirm: () => void;
  confirmedFlash: boolean;
}) {
  return (
    <div
      style={{
        marginTop: 8,
        padding: 14,
        background: T.surfaceHi,
        border: `1px solid ${state.draft.confirmed ? T.greenMid : T.borderHi}`,
        borderRadius: G.radius,
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1.6, color: T.textMute, textTransform: "uppercase" as const }}>
            Review
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.textPri, marginTop: 3, lineHeight: 1.2, letterSpacing: -0.005 }}>
            Here's what I've got
          </div>
        </div>
        {state.draft.confirmed && (
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              padding: "3px 8px",
              borderRadius: 999,
              color: T.green,
              background: T.greenSoft,
              border: `1px solid ${T.greenMid}`,
              letterSpacing: 0.3,
              textTransform: "uppercase" as const,
            }}
          >
            Saved locally
          </span>
        )}
      </div>

      {/* Single-value facts */}
      {SINGLE_FACT_KEYS.map((k) => (
        <SingleFactRow
          key={k}
          k={k}
          value={state.draft[k].value}
          status={state.draft[k].status}
          isEditing={editingSingle === k}
          onStartEdit={() => setEditingSingle(k)}
          onCancelEdit={() => setEditingSingle(null)}
          onSaveEdit={(v) => { editSingleFact(k, v); setEditingSingle(null); }}
          onClear={() => { editSingleFact(k, null); setEditingSingle(null); }}
        />
      ))}

      {/* List facts */}
      {LIST_FACT_KEYS.map((k) => (
        <ListFactBlock
          key={k}
          k={k}
          items={state.draft[k].items.map((it) => ({ id: it.id, value: it.value, status: it.status }))}
          isAdding={editingListAdd === k}
          onStartAdd={() => setEditingListAdd(k)}
          onCancelAdd={() => setEditingListAdd(null)}
          onSaveAdd={(v) => { addListItem(k, v); setEditingListAdd(null); }}
          onRemove={(id) => removeListItem(k, id)}
        />
      ))}

      {/* Minimum-met chip + Confirm */}
      <div
        style={{
          marginTop: 4,
          padding: "10px 12px",
          borderRadius: G.radiusS,
          background: minimumMet ? T.greenSoft : T.amberSoft,
          border: `1px solid ${minimumMet ? T.greenMid : T.amberMid}`,
          color: minimumMet ? T.green : T.amber,
          fontSize: 11.5,
          lineHeight: 1.4,
        }}
      >
        {minimumMet
          ? "You've given NEX enough to start. Confirm to save this draft locally."
          : `Still needed: ${missing.map(prettyMissing).join(", ")}. Keep chatting with NEX below, or add via the review card.`}
      </div>

      <div style={{ display: "flex", gap: 10, minWidth: 0 }}>
        <button
          type="button"
          onClick={() => { /* Close review — user can keep chatting. openReview stays true visually until next message. */ }}
          style={{
            appearance: "none",
            flex: 1,
            height: 42,
            borderRadius: 12,
            background: "transparent",
            border: `1px solid ${T.borderMed}`,
            color: T.textSec,
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: 0.2,
            cursor: "pointer",
            boxSizing: "border-box",
          }}
        >
          Keep chatting
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!minimumMet || state.draft.confirmed}
          style={{
            appearance: "none",
            flex: 2,
            height: 42,
            borderRadius: 12,
            background: minimumMet && !state.draft.confirmed ? T.orangeSolid : T.surfaceLo,
            border: `1px solid ${minimumMet && !state.draft.confirmed ? T.orangeSolid : T.borderMed}`,
            color: minimumMet && !state.draft.confirmed ? "#0b0b0d" : T.textDim,
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: 0.2,
            cursor: minimumMet && !state.draft.confirmed ? "pointer" : "not-allowed",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            boxSizing: "border-box",
          }}
        >
          {state.draft.confirmed ? "Confirmed · saved locally" : "Confirm"}
          {!state.draft.confirmed && <Check size={15} strokeWidth={2.4} />}
        </button>
      </div>

      {confirmedFlash && (
        <div style={{ fontSize: 11, color: T.green, textAlign: "center", letterSpacing: 0.3, marginTop: 4 }}>
          Saved to <code style={{ background: T.surfaceLo, padding: "1px 5px", borderRadius: 4, fontSize: 10.5 }}>{BUSINESS_PROFILE_DRAFT_KEY}</code>
        </div>
      )}
    </div>
  );
}

function prettyMissing(k: string): string {
  switch (k) {
    case "companyIdentity":         return "company";
    case "businessRole":            return "role";
    case "industry":                return "industry";
    case "productOrService":        return "at least one product or service";
    case "marketOrLocationOrGoal":  return "a market, location, or goal";
    default:                        return k;
  }
}

// ── Row primitives for the review card ────────────────────────────────

function SingleFactRow({
  k, value, status, isEditing, onStartEdit, onCancelEdit, onSaveEdit, onClear,
}: {
  k: SingleFactKey;
  value: string | null;
  status: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (v: string) => void;
  onClear: () => void;
}) {
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => { setDraft(value ?? ""); }, [value, isEditing]);
  const notProvided = status === "not_provided" || !value;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "10px 12px",
        background: T.surfaceLo,
        border: `1px solid ${T.border}`,
        borderRadius: G.radiusS,
        minWidth: 0,
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, color: T.textMute, textTransform: "uppercase" as const }}>
            {FACT_LABEL[k]}
          </div>
          {!isEditing && (
            <div style={{ fontSize: 13, color: notProvided ? T.textDim : T.textPri, marginTop: 3, lineHeight: 1.4, fontStyle: notProvided ? "italic" : "normal" }}>
              {notProvided ? "Not provided yet" : value}
            </div>
          )}
        </div>
        {!isEditing && (
          <button
            type="button"
            aria-label={`Edit ${FACT_LABEL[k]}`}
            onClick={onStartEdit}
            style={iconBtn()}
          >
            <Pencil size={12} strokeWidth={2} />
          </button>
        )}
      </div>
      {isEditing && (
        <div style={{ display: "flex", gap: 6, minWidth: 0 }}>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Enter ${FACT_LABEL[k]}`}
            autoFocus
            style={inputStyle()}
          />
          <button type="button" onClick={() => onSaveEdit(draft)} style={smallBtn("save")}>
            <Check size={13} strokeWidth={2.4} />
          </button>
          <button type="button" onClick={onCancelEdit} style={smallBtn("cancel")}>
            <XIcon size={13} strokeWidth={2.4} />
          </button>
          {value && (
            <button type="button" onClick={onClear} style={smallBtn("clear")} title="Clear">
              <XIcon size={13} strokeWidth={2} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ListFactBlock({
  k, items, isAdding, onStartAdd, onCancelAdd, onSaveAdd, onRemove,
}: {
  k: ListFactKey;
  items: Array<{ id: string; value: string; status: string }>;
  isAdding: boolean;
  onStartAdd: () => void;
  onCancelAdd: () => void;
  onSaveAdd: (v: string) => void;
  onRemove: (id: string) => void;
}) {
  const [draft, setDraft] = useState("");
  useEffect(() => { if (!isAdding) setDraft(""); }, [isAdding]);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "10px 12px",
        background: T.surfaceLo,
        border: `1px solid ${T.border}`,
        borderRadius: G.radiusS,
        minWidth: 0,
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, color: T.textMute, textTransform: "uppercase" as const }}>
            {FACT_LABEL[k]}
          </div>
        </div>
        <button
          type="button"
          aria-label={`Add ${FACT_LABEL[k]}`}
          onClick={onStartAdd}
          style={iconBtn()}
        >
          <Plus size={12} strokeWidth={2.4} />
        </button>
      </div>

      {items.length === 0 && !isAdding && (
        <div style={{ fontSize: 12, color: T.textDim, fontStyle: "italic", lineHeight: 1.4 }}>
          None provided yet
        </div>
      )}

      {items.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
          {items.map((it) => (
            <span
              key={it.id}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "4px 8px",
                background: T.surface,
                border: `1px solid ${T.borderMed}`,
                borderRadius: 999,
                fontSize: 12,
                color: T.textPri,
                maxWidth: "100%",
              }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>{it.value}</span>
              <button
                type="button"
                aria-label={`Remove ${it.value}`}
                onClick={() => onRemove(it.id)}
                style={{
                  appearance: "none",
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  color: T.textDim,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <XIcon size={11} strokeWidth={2.2} />
              </button>
            </span>
          ))}
        </div>
      )}

      {isAdding && (
        <div style={{ display: "flex", gap: 6, marginTop: 4, minWidth: 0 }}>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Add to ${FACT_LABEL[k]}`}
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter" && draft.trim()) { onSaveAdd(draft); } }}
            style={inputStyle()}
          />
          <button type="button" onClick={() => draft.trim() && onSaveAdd(draft)} style={smallBtn("save")}>
            <Check size={13} strokeWidth={2.4} />
          </button>
          <button type="button" onClick={onCancelAdd} style={smallBtn("cancel")}>
            <XIcon size={13} strokeWidth={2.4} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Small style helpers ──────────────────────────────────────────────

function iconBtn(): React.CSSProperties {
  return {
    appearance: "none",
    width: 26,
    height: 26,
    borderRadius: 8,
    background: T.surface,
    border: `1px solid ${T.borderMed}`,
    color: T.textSec,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  };
}

function inputStyle(): React.CSSProperties {
  return {
    flex: 1,
    minWidth: 0,
    height: 34,
    padding: "0 10px",
    borderRadius: 8,
    background: T.bg,
    border: `1px solid ${T.orangeMid}`,
    color: T.textPri,
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
    appearance: "none",
  };
}

function smallBtn(variant: "save" | "cancel" | "clear"): React.CSSProperties {
  const isSave = variant === "save";
  return {
    appearance: "none",
    width: 34,
    height: 34,
    borderRadius: 8,
    background: isSave ? T.orangeSoft : "transparent",
    border: `1px solid ${isSave ? T.orangeMid : T.borderMed}`,
    color: isSave ? T.orange : T.textSec,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  };
}
