"use client";

// src/components/nex-app/shell/ControlCenterPanel.tsx
//
// NEX Control Center · Phase D+ · Center-panel redesign
// Philip 2026-09-06 · CEREMONIAL AUTHORIZATION
//
// §4 · §5 · §6 · Distinct concept from /nex-live's CreatorEntry panel.
// This panel manages the USER'S NEX WORLD.
//
// Layout:
//   · absolute inset-0 backdrop (scoped to phone-frame ancestor · §44
//     no desktop leakage)
//   · Card CENTERED (both axes) · rounded-3xl · white surface with a
//     calm dark drop shadow · not a slide-in sheet
//   · Groups list with §4 taxonomy · items are one of:
//       - "link"        · navigates to a real destination
//       - "expand"      · reveals inline controls (radio circles, etc.)
//       - "unavailable" · disabled with honest "Not available yet" chip
//
// Immutable contracts preserved for the browser proofs + unit tests:
//   · data-testid="nex-control-center-panel"
//   · data-scope="phone-frame"
//   · absolute inset-0 (NOT fixed · Phase D §44)
//   · role="dialog" · aria-label="NEX Control Center"
//   · 5 §4 group labels: Account · Conversation · Privacy · Your World · NEX
//   · "Not available yet" chip on every unshipped destination
//   · href="/nex-app/live" for Live in your city
//   · Footer honesty: "NEX never fabricates a destination."
//   · Escape close + focus restore · outside-click close · min 44px targets
//
// Disappearing Messages is the demonstration expand row: radio circles
// for the retention window (Never / 30s / 5m / 1h / 24h / 7d). The
// choice is stored on this device only (localStorage) with an honest
// caveat · it does not (yet) apply to any real message store.

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronRight, ChevronDown, X } from "lucide-react";

type Availability = "AVAILABLE" | "NOT_YET_AVAILABLE";
type ItemKind = "link" | "expand" | "unavailable";

type Item = {
  id: string;
  label: string;
  href?: string | null;
  availability: Availability;
  kind: ItemKind;
  /** Optional inline description shown under the label */
  hint?: string;
};

type Group = { id: string; label: string; items: Item[] };

const GROUPS: ReadonlyArray<Group> = [
  {
    id: "account",
    label: "Account",
    items: [
      { id: "nex_id_account", label: "NEX ID & Account", availability: "NOT_YET_AVAILABLE", kind: "unavailable" },
      { id: "security",       label: "Security",         availability: "NOT_YET_AVAILABLE", kind: "unavailable" },
    ],
  },
  {
    id: "conversation",
    label: "Conversation",
    items: [
      { id: "disappearing_messages", label: "Disappearing Messages", availability: "AVAILABLE",                                    kind: "expand", hint: "Remembered on this device" },
      { id: "notifications",         label: "Notifications",                                    availability: "NOT_YET_AVAILABLE", kind: "unavailable" },
    ],
  },
  {
    id: "privacy",
    label: "Privacy",
    items: [
      { id: "privacy_safety", label: "Privacy & Safety", availability: "NOT_YET_AVAILABLE", kind: "unavailable" },
    ],
  },
  {
    id: "your_world",
    label: "Your World",
    items: [
      { id: "live_in_your_city",   label: "Live in your city",       href: "/nex-app/live", availability: "AVAILABLE",         kind: "link" },
      { id: "saved",               label: "Saved",                                          availability: "NOT_YET_AVAILABLE", kind: "unavailable" },
      { id: "business",            label: "Business",                                       availability: "NOT_YET_AVAILABLE", kind: "unavailable" },
      { id: "marketing_analytics", label: "Marketing & Analytics",                          availability: "NOT_YET_AVAILABLE", kind: "unavailable" },
    ],
  },
  {
    id: "nex",
    label: "NEX",
    items: [
      { id: "nex_preferences", label: "NEX Preferences", availability: "NOT_YET_AVAILABLE", kind: "unavailable" },
      { id: "help_support",    label: "Help & Support",  availability: "NOT_YET_AVAILABLE", kind: "unavailable" },
      { id: "settings",        label: "Settings",        availability: "NOT_YET_AVAILABLE", kind: "unavailable" },
    ],
  },
];

// ── Disappearing Messages · radio options ─────────────────────────
type DisappearOptionId = "never" | "30s" | "5m" | "1h" | "24h" | "7d";
const DISAPPEAR_OPTIONS: ReadonlyArray<{ id: DisappearOptionId; label: string }> = [
  { id: "never", label: "Never" },
  { id: "30s",   label: "After 30 seconds" },
  { id: "5m",    label: "After 5 minutes" },
  { id: "1h",    label: "After 1 hour" },
  { id: "24h",   label: "After 24 hours" },
  { id: "7d",    label: "After 7 days" },
];
const DISAPPEAR_STORAGE_KEY = "nex.control-center.disappearing-messages";

export type ControlCenterPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  panelId: string;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  /** Visual variant per surface it mounts inside.
   *  · "light" (default) fits the /nex-app light cream shell.
   *  · "glass" fits the /nexapp NEX chassis interior (dark tinted).
   */
  variant?: "light" | "glass";
};

export function ControlCenterPanel({ isOpen, onClose, panelId, returnFocusRef, variant = "light" }: ControlCenterPanelProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const firstItemRef = useRef<HTMLAnchorElement | HTMLButtonElement | null>(null);

  // Inline-expand state · at most one item expanded at a time (feels calmer)
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  // Disappearing Messages preference · loaded once from localStorage
  const [disappear, setDisappear] = useState<DisappearOptionId>("never");
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(DISAPPEAR_STORAGE_KEY);
      if (raw && DISAPPEAR_OPTIONS.some((o) => o.id === raw)) {
        setDisappear(raw as DisappearOptionId);
      }
    } catch { /* localStorage blocked · silent */ }
  }, []);
  const chooseDisappear = useCallback((id: DisappearOptionId) => {
    setDisappear(id);
    try { window.localStorage.setItem(DISAPPEAR_STORAGE_KEY, id); } catch { /* ignore */ }
  }, []);

  const disappearLabel = useMemo(
    () => DISAPPEAR_OPTIONS.find((o) => o.id === disappear)?.label ?? "Never",
    [disappear],
  );

  // Escape closes + restores focus
  useEffect(() => {
    if (!isOpen) return;
    const handler = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        onClose();
        returnFocusRef?.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose, returnFocusRef]);

  // Outside-click closes · guarded so entry buttons don't fight the toggle
  useEffect(() => {
    if (!isOpen) return;
    const handler = (ev: MouseEvent | TouchEvent) => {
      const target = ev.target as Node | null;
      if (!target || !rootRef.current) return;
      if (rootRef.current.contains(target)) return;
      const entries = document.querySelectorAll("[data-control-center-entry]");
      for (const entry of Array.from(entries)) {
        if (entry.contains(target)) return;
      }
      onClose();
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [isOpen, onClose]);

  // Focus first available item on open
  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => firstItemRef.current?.focus(), 40);
    return () => clearTimeout(t);
  }, [isOpen]);

  const navigate = useCallback(() => onClose(), [onClose]);

  if (!isOpen) return null;

  let firstItemAssigned = false;

  // Variant tokens · light (cream phone shell) or glass (chassis interior)
  const isGlass = variant === "glass";
  const T = isGlass
    ? {
        backdrop:      "bg-black/40 backdrop-blur-md",
        card:          "bg-neutral-950/70 backdrop-blur-2xl border border-white/10 text-white",
        cardShadow:    "shadow-[0_24px_80px_-16px_rgba(0,0,0,0.7),0_4px_16px_-4px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)]",
        headerLabel:   "text-white/50",
        headerTitle:   "text-white",
        closeBtn:      "bg-white/10 hover:bg-white/20 text-white/80",
        groupLabel:    "text-white/40",
        groupWrap:     "bg-white/[0.04] border border-white/10",
        rowDivider:    "border-b border-white/10",
        rowSurface:    "bg-transparent",
        rowLink:       "hover:bg-white/[0.06] active:bg-white/[0.10] focus-visible:ring-white/40",
        rowExpandBtn:  "hover:bg-white/[0.06] active:bg-white/[0.10] focus-visible:ring-white/40",
        rowExpandBody: "bg-black/30 border-t border-white/10",
        rowExpandOpt:  "hover:bg-white/[0.06] active:bg-white/[0.10] focus-visible:ring-white/40",
        label:         "text-white/95",
        labelMuted:    "text-white/40",
        hint:          "text-white/40",
        chevron:       "text-white/40",
        radioIdle:     "border-white/30 bg-white/5",
        radioSelected: "border-white bg-white",
        radioCheck:    "text-neutral-900",
        radioLabel:    "text-white/80",
        radioLabelSel: "text-white font-semibold",
        chipUnavail:   "text-white/45 bg-white/10",
        footer:        "text-white/40",
        emStrong:      "text-white/60",
      }
    : {
        backdrop:      "bg-black/55 backdrop-blur-md",
        card:          "bg-white text-neutral-900",
        cardShadow:    "shadow-[0_24px_80px_-16px_rgba(0,0,0,0.55),0_4px_16px_-4px_rgba(0,0,0,0.35)]",
        headerLabel:   "text-neutral-400",
        headerTitle:   "text-neutral-900",
        closeBtn:      "bg-neutral-100 hover:bg-neutral-200 text-neutral-800",
        groupLabel:    "text-neutral-400",
        groupWrap:     "bg-neutral-50 border border-neutral-200/70",
        rowDivider:    "border-b border-neutral-200/70",
        rowSurface:    "bg-white",
        rowLink:       "hover:bg-neutral-100 active:bg-neutral-200 focus-visible:ring-neutral-400",
        rowExpandBtn:  "hover:bg-neutral-50 active:bg-neutral-100 focus-visible:ring-neutral-400",
        rowExpandBody: "bg-neutral-50/60 border-t border-neutral-200/70",
        rowExpandOpt:  "hover:bg-white active:bg-neutral-100 focus-visible:ring-neutral-400",
        label:         "text-neutral-900",
        labelMuted:    "text-neutral-400",
        hint:          "text-neutral-400",
        chevron:       "text-neutral-400",
        radioIdle:     "border-neutral-300 bg-white",
        radioSelected: "border-neutral-900 bg-neutral-900",
        radioCheck:    "text-white",
        radioLabel:    "text-neutral-700",
        radioLabelSel: "text-neutral-900 font-semibold",
        chipUnavail:   "text-neutral-400 bg-neutral-100",
        footer:        "text-neutral-400",
        emStrong:      "text-neutral-500",
      };

  return (
    <div
      ref={rootRef}
      id={panelId}
      role="dialog"
      aria-modal="false"
      aria-label="NEX Control Center"
      data-testid="nex-control-center-panel"
      data-scope="phone-frame"
      data-variant={variant}
      className={[
        "absolute inset-0 z-50 flex items-center justify-center",
        T.backdrop,
        "px-4 py-6",
        "animate-[nex-cc-fade_140ms_ease-out]",
      ].join(" ")}
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div
        className={[
          "relative w-full max-w-[400px] max-h-[92%]",
          "rounded-3xl overflow-hidden flex flex-col",
          T.card,
          T.cardShadow,
          "animate-[nex-cc-pop_180ms_cubic-bezier(0.22,1.36,0.44,1)]",
        ].join(" ")}
      >
        {/* Header · calm brand mark + close */}
        <div className="flex items-start justify-between px-5 pt-5 pb-3">
          <div>
            <div className={`text-[10px] uppercase tracking-[0.18em] font-semibold ${T.headerLabel}`}>
              NEX
            </div>
            <div className={`text-[20px] font-semibold tracking-tight leading-tight mt-0.5 ${T.headerTitle}`}>
              Control Center
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-full h-9 w-9 grid place-items-center transition-colors ${T.closeBtn}`}
            aria-label="Close Control Center"
            data-testid="nex-control-center-close"
          >
            <X size={16} strokeWidth={2.2} />
          </button>
        </div>

        {/* Scrollable groups */}
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {GROUPS.map((group) => (
            <section key={group.id} className="px-3 pt-3 pb-1">
              <h3 className={`text-[10px] uppercase tracking-[0.16em] font-semibold px-2 mb-1 ${T.groupLabel}`}>
                {group.label}
              </h3>
              <div className={`rounded-2xl overflow-hidden ${T.groupWrap}`}>
                {group.items.map((item, idx) => {
                  const isFirst = !firstItemAssigned && item.availability === "AVAILABLE";
                  if (isFirst) firstItemAssigned = true;
                  const isLast = idx === group.items.length - 1;
                  const rowClass = [
                    "flex items-center justify-between gap-3 min-h-[52px] px-4 py-2.5",
                    isLast ? "" : T.rowDivider,
                  ].join(" ");

                  // ── kind: link (navigates) ────────────────────────
                  if (item.kind === "link" && item.href) {
                    return (
                      <Link
                        key={item.id}
                        ref={isFirst ? (firstItemRef as React.RefObject<HTMLAnchorElement>) : undefined}
                        href={item.href}
                        onClick={navigate}
                        className={`${rowClass} ${T.rowSurface} ${T.rowLink} focus:outline-none focus-visible:ring-2`}
                        data-testid={`nex-control-center-item-${item.id}`}
                        data-availability={item.availability}
                      >
                        <span className={`text-[14.5px] font-medium ${T.label}`}>{item.label}</span>
                        <ChevronRight size={16} className={T.chevron} aria-hidden />
                      </Link>
                    );
                  }

                  // ── kind: expand (inline dropdown with controls) ──
                  if (item.kind === "expand") {
                    const isOpenRow = expandedItem === item.id;
                    return (
                      <div key={item.id} className={T.rowSurface}>
                        <button
                          ref={isFirst ? (firstItemRef as React.RefObject<HTMLButtonElement>) : undefined}
                          type="button"
                          aria-expanded={isOpenRow}
                          aria-controls={`${panelId}-expand-${item.id}`}
                          onClick={() => setExpandedItem(isOpenRow ? null : item.id)}
                          className={`${rowClass} w-full text-left ${T.rowExpandBtn} focus:outline-none focus-visible:ring-2`}
                          data-testid={`nex-control-center-item-${item.id}`}
                          data-availability={item.availability}
                        >
                          <div className="min-w-0 flex-1">
                            <div className={`text-[14.5px] font-medium ${T.label}`}>{item.label}</div>
                            {item.hint && !isOpenRow && (
                              <div className={`text-[11px] mt-0.5 ${T.hint}`}>
                                {item.id === "disappearing_messages" ? disappearLabel : item.hint}
                              </div>
                            )}
                          </div>
                          <ChevronDown
                            size={16}
                            className={`${T.chevron} transition-transform ${isOpenRow ? "rotate-180" : ""}`}
                            aria-hidden
                          />
                        </button>

                        {isOpenRow && item.id === "disappearing_messages" && (
                          <div
                            id={`${panelId}-expand-${item.id}`}
                            role="radiogroup"
                            aria-label="Disappearing Messages retention"
                            className={`px-2 py-2 ${T.rowExpandBody}`}
                            data-testid="nex-control-center-expand-disappearing_messages"
                          >
                            {DISAPPEAR_OPTIONS.map((opt) => {
                              const selected = opt.id === disappear;
                              return (
                                <button
                                  key={opt.id}
                                  type="button"
                                  role="radio"
                                  aria-checked={selected}
                                  onClick={() => chooseDisappear(opt.id)}
                                  className={`flex items-center gap-3 w-full min-h-[44px] px-3 rounded-lg focus:outline-none focus-visible:ring-2 ${T.rowExpandOpt}`}
                                  data-testid={`nex-cc-disappearing-option-${opt.id}`}
                                >
                                  <span
                                    aria-hidden
                                    className={[
                                      "grid place-items-center h-5 w-5 rounded-full border-2 transition-colors",
                                      selected ? T.radioSelected : T.radioIdle,
                                    ].join(" ")}
                                  >
                                    {selected && <Check size={12} strokeWidth={3} className={T.radioCheck} />}
                                  </span>
                                  <span className={`text-[14px] ${selected ? T.radioLabelSel : T.radioLabel}`}>
                                    {opt.label}
                                  </span>
                                </button>
                              );
                            })}
                            <div className={`text-[10.5px] px-3 pt-2 pb-1 leading-snug ${T.footer}`}>
                              Your choice is remembered on this device. NEX does not yet apply it to conversation storage — that ships with a later slice.
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }

                  // ── kind: unavailable (honest chip) ────────────────
                  return (
                    <div
                      key={item.id}
                      className={`${rowClass} ${T.rowSurface}`}
                      data-testid={`nex-control-center-item-${item.id}`}
                      data-availability={item.availability}
                    >
                      <span className={`text-[14.5px] ${T.labelMuted}`}>{item.label}</span>
                      <span className={`text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 whitespace-nowrap ${T.chipUnavail}`}>
                        Not available yet
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          {/* Honesty footer · §4 immutable */}
          <div className={`px-5 pt-4 pb-4 text-[10.5px] leading-snug ${T.footer}`}>
            Items marked <em className={`not-italic font-semibold ${T.emStrong}`}>Not available yet</em> ship in later authorised slices.
            NEX never fabricates a destination.
          </div>
        </div>

        <style>{`
          @keyframes nex-cc-fade { from { opacity: 0; } to { opacity: 1; } }
          @keyframes nex-cc-pop {
            from { opacity: 0; transform: translateY(6px) scale(0.96); }
            to   { opacity: 1; transform: translateY(0) scale(1); }
          }
        `}</style>
      </div>
    </div>
  );
}
