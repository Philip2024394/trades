"use client";

// InvitationModal — opened from a canteen card in invite mode. Shows
// the trade the owner picked, lets them tick which of their projects
// this trade is being invited to (opt-in — no defaults), previews the
// WhatsApp message, then sends via wa.me.
//
// On send: POSTs /api/homeowner/invitations → 1 washer deducted →
// wa.me URL returned → we window.open() → owner hits send inside
// WhatsApp. Success closes the modal + updates the invite context.

import { useMemo, useState } from "react";
import { X, MessageCircle, Send, Check, MapPin, Wallet } from "lucide-react";

const BRAND_GREEN  = "#166534";
const BRAND_YELLOW = "#FFB300";

export type InviteProject = {
  id:              string;
  title:           string;
  city:            string | null;
  budgetMin?:      number | null;
  budgetMax?:      number | null;
};

type Props = {
  /** Pass one of these — id OR slug. Slug flow used from canteens
   *  directory (Canteen.hostSlug); id flow used from SiteBook panel
   *  (member.listing_id UUID). */
  tradeListingId?: string;
  tradeSlug?:      string | null;
  tradeName:       string;
  projects:        InviteProject[];
  onClose:         () => void;
  onSent?:         (invitationId: string) => void;
};

function formatBudget(min?: number | null, max?: number | null): string | null {
  if (!min && !max) return null;
  const fmt = (n: number) => n >= 1000 ? `£${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `£${n}`;
  if (min && max && min !== max) return `${fmt(min)}–${fmt(max)}`;
  return fmt((max || min) as number);
}

export function InvitationModal({ tradeListingId, tradeName, tradeSlug, projects, onClose, onSent }: Props) {
  const [picked, setPicked] = useState<Set<string>>(new Set());   // opt-in
  const [busy,   setBusy]   = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  const canSend = picked.size > 0 && !busy;

  const pickedProjectTitles = useMemo(
    () => projects.filter((p) => picked.has(p.id)).map((p) => p.title),
    [projects, picked]
  );

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function send() {
    if (!canSend) return;
    setBusy(true); setError(null);
    try {
      const res  = await fetch("/api/homeowner/invitations", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          tradeListingId,
          tradeSlug:  tradeSlug ?? undefined,
          projectIds: Array.from(picked)
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!data.ok) {
        setError(prettyError(data.error));
        setBusy(false);
        return;
      }
      if (typeof window !== "undefined") window.open(data.waUrl, "_blank", "noopener");
      onSent?.(data.invitationId);
      onClose();
    } catch {
      setError("Network error. Try again.");
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:px-4"
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        style={{ maxHeight: "92vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-2 pb-1 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-neutral-300"/>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full shadow-md transition active:scale-[0.95]"
          style={{ backgroundColor: BRAND_YELLOW, color: "#0A0A0A" }}
          aria-label="Close"
        >
          <X size={16} strokeWidth={2.8}/>
        </button>

        {/* Header */}
        <div className="border-b p-5" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
          <p className="text-[10.5px] font-black uppercase tracking-[0.22em]" style={{ color: BRAND_GREEN }}>
            Invite to your project
          </p>
          <h2 className="mt-1 text-[19px] font-black leading-tight text-neutral-900">
            {tradeName}
          </h2>
          {tradeSlug && (
            <p className="mt-0.5 text-[11px] font-bold text-neutral-500">the-network.app/trade/{tradeSlug}</p>
          )}
        </div>

        {/* Project multi-select — opt-in */}
        <div className="flex-1 overflow-y-auto p-5">
          <p className="text-[10.5px] font-black uppercase tracking-[0.22em] text-neutral-500">
            Which projects? · pick 1 or more
          </p>
          {projects.length === 0 ? (
            <div className="mt-3 rounded-lg border-2 border-dashed border-neutral-200 p-4 text-center text-[12px] text-neutral-500">
              You don&rsquo;t have any active projects yet. Create one first.
            </div>
          ) : (
            <div className="mt-2 space-y-2">
              {projects.map((p) => {
                const on     = picked.has(p.id);
                const budget = formatBudget(p.budgetMin, p.budgetMax);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggle(p.id)}
                    className={
                      "flex w-full items-start gap-3 rounded-xl border-2 p-3 text-left transition " +
                      (on ? "shadow-md" : "hover:brightness-95")
                    }
                    style={{
                      borderColor:     BRAND_YELLOW,
                      backgroundColor: on ? "#FFF7E0" : "#FFFBEB"
                    }}
                    aria-pressed={on}
                  >
                    <span
                      className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2"
                      style={{
                        borderColor:     "#0A0A0A",
                        backgroundColor: on ? BRAND_YELLOW : "white"
                      }}
                    >
                      {on && <Check size={12} strokeWidth={3} color="#0A0A0A"/>}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-black text-neutral-900">{p.title}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-500">
                        {p.city && <span className="inline-flex items-center gap-1"><MapPin size={10}/> {p.city}</span>}
                        {budget && <span className="inline-flex items-center gap-1"><Wallet size={10}/> {budget}</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Cost + preview */}
          <div className="mt-5 rounded-xl bg-neutral-50 p-3">
            <p className="text-[10.5px] font-black uppercase tracking-[0.22em] text-neutral-500">
              What happens next
            </p>
            <ol className="mt-2 space-y-1 text-[12px] leading-relaxed text-neutral-700">
              <li>1. WhatsApp opens with the invitation pre-written.</li>
              <li>2. You hit send in WhatsApp. <span className="font-black">1 washer</span> deducted.</li>
              <li>3. {tradeName} taps the link → sees the brief → accepts or declines.</li>
              <li>4. On accept, they appear in your Trades &amp; Suppliers panel as a member.</li>
            </ol>
            {pickedProjectTitles.length > 0 && (
              <p className="mt-3 text-[11px] font-bold text-neutral-600">
                Inviting to: {pickedProjectTitles.map((t) => `"${t}"`).join(", ")}
              </p>
            )}
          </div>

          {error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[12px] font-bold text-red-800">{error}</p>
          )}
        </div>

        {/* Footer actions */}
        <div className="border-t p-4" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="inline-flex h-11 items-center justify-center rounded-full border border-neutral-300 bg-white px-4 text-[11.5px] font-black uppercase tracking-wider text-neutral-700 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={send}
              disabled={!canSend}
              className="ml-auto inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-[11.5px] font-black uppercase tracking-wider text-white shadow-sm transition hover:brightness-95 disabled:opacity-50"
              style={{ backgroundColor: BRAND_GREEN }}
            >
              <MessageCircle size={13}/>
              {busy ? "Preparing…" : <>Send via WhatsApp <Send size={13}/></>}
            </button>
          </div>
          <p className="mt-2 text-center text-[10.5px] text-neutral-500">
            WhatsApp opens pre-filled. Hit send there to invite {tradeName}.
          </p>
        </div>
      </div>
    </div>
  );
}

function prettyError(code: string): string {
  switch (code) {
    case "no-projects-selected":     return "Pick at least one project first.";
    case "missing-trade":            return "No trade selected.";
    case "trade-not-found":          return "Trade not found.";
    case "trade-no-whatsapp":        return "This trade doesn't have a WhatsApp number on file.";
    case "project-ownership-mismatch":return "One of the projects isn't yours.";
    case "quota-exceeded":           return "You're out of WhatsApp reveals. Top up a pack or go Pro to keep inviting.";
    case "not-authed":               return "Please sign in first.";
    default:                         return "Couldn't send the invitation. Try again.";
  }
}
