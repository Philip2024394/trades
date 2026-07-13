"use client";

// Canteen invite modal — send an invite to trades on The Network or
// share a public invite link (Facebook-group-style). Mobile-first
// bottom-sheet, cream + yellow-dot brand.

import { useState } from "react";
import { X, Send, Link as LinkIcon, Check, MessageCircle, AlertCircle } from "lucide-react";
import { BRAND_YELLOW, BRAND_BLACK, BRAND_GREEN_DARK } from "@/lib/brand/tokens";

type InviteResult = {
  added: Array<{ slug: string; displayName: string }>;
  alreadyMembers: string[];
  unrecognisedSlugs: string[];
  invalid: string[];
  whatsAppShares: Array<{ phone: string; href: string }>;
};

export function CanteenInviteModal({
  open,
  onClose,
  canteenSlug,
  canteenName
}: {
  open: boolean;
  onClose: () => void;
  canteenSlug: string;
  canteenName: string;
}) {
  const [tab, setTab] = useState<"pick" | "link">("pick");
  const [handles, setHandles] = useState("");
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<InviteResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function submitInvites() {
    const entries = handles.split("\n").map((l) => l.trim()).filter(Boolean);
    if (entries.length === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/canteens/${encodeURIComponent(canteenSlug)}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (data.error === "not-authenticated") setSubmitError("Log in to send invites.");
        else if (data.error === "not-host") setSubmitError("Only the canteen host can invite.");
        else setSubmitError(data.error ?? "invite-failed");
        return;
      }
      setResult({
        added: data.added ?? [],
        alreadyMembers: data.alreadyMembers ?? [],
        unrecognisedSlugs: data.unrecognisedSlugs ?? [],
        invalid: data.invalid ?? [],
        whatsAppShares: data.whatsAppShares ?? []
      });
      setHandles("");
    } finally {
      setSubmitting(false);
    }
  }
  const inviteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/trade-off/yard/canteens/${canteenSlug}?invite=1`
      : `/trade-off/yard/canteens/${canteenSlug}?invite=1`;

  if (!open) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* no-op */ }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:px-4"
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        style={{ maxHeight: "92vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-2 pb-1 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-neutral-300"/>
        </div>

        {/* Header — brand chip + close */}
        <div className="relative border-b border-neutral-200 px-5 pb-4 pt-4 sm:px-6 sm:pt-5">
          <button
            onClick={onClose}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-neutral-100"
            aria-label="Close"
          >
            <X size={16}/>
          </button>
          <div className="flex items-center gap-2">
            <span
              className="block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: BRAND_YELLOW }}
              aria-hidden="true"
            />
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
              Invite to Canteen
            </span>
          </div>
          <div className="mt-1 text-[18px] font-black leading-tight text-neutral-900 sm:text-[20px]">
            {canteenName}
          </div>
          <div className="mt-0.5 text-[12px] text-neutral-500">
            Trades on The Network can join with one tap.
          </div>
        </div>

        {/* Tab strip */}
        <div className="flex border-b border-neutral-200">
          {(["pick", "link"] as const).map((t) => {
            const active = t === tab;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="flex-1 border-b-2 py-2.5 text-[12px] font-black uppercase tracking-wider transition"
                style={{
                  color: active ? BRAND_BLACK : "#6B7280",
                  borderColor: active ? BRAND_YELLOW : "transparent"
                }}
              >
                {t === "pick" ? "Pick trades" : "Share link"}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {tab === "pick" ? (
            <>
              <div className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-neutral-500">
                Handles or WhatsApp numbers
              </div>
              <textarea
                value={handles}
                onChange={(e) => setHandles(e.target.value)}
                rows={4}
                placeholder="one per line — e.g.&#10;@mike-watson&#10;07401 552 118&#10;craig-mcdermott"
                className="w-full rounded-md border border-neutral-200 bg-white p-3 text-[13px] focus:outline-none focus:border-yellow-400"
                style={{ resize: "none" }}
              />
              <p className="mt-2 text-[10px] leading-snug text-neutral-500">
                Handles auto-match against The Network directory. WhatsApp numbers get a click-to-send invite text with the join link.
              </p>
              {submitError && (
                <div className="mt-2 flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-1.5 text-[11px] font-bold text-red-700">
                  <AlertCircle size={12}/>
                  {submitError}
                </div>
              )}
              {result && (
                <div className="mt-3 space-y-2">
                  {result.added.length > 0 && (
                    <div className="rounded-md border p-2.5" style={{ borderColor: BRAND_GREEN_DARK, backgroundColor: "#F0FDF4" }}>
                      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider" style={{ color: BRAND_GREEN_DARK }}>
                        <Check size={11} strokeWidth={3}/>
                        Joined
                      </div>
                      <ul className="flex flex-wrap gap-1">
                        {result.added.map((m) => (
                          <li key={m.slug} className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-neutral-800 shadow-sm">
                            {m.displayName}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.whatsAppShares.length > 0 && (
                    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-2.5">
                      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-neutral-600">
                        <MessageCircle size={11}/>
                        Send via WhatsApp
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {result.whatsAppShares.map((w) => (
                          <a
                            key={w.phone}
                            href={w.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black text-white shadow-sm"
                            style={{ backgroundColor: "#25D366" }}
                          >
                            {w.phone}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  {result.alreadyMembers.length > 0 && (
                    <div className="text-[11px] text-neutral-500">
                      Already members: {result.alreadyMembers.join(", ")}
                    </div>
                  )}
                  {result.unrecognisedSlugs.length > 0 && (
                    <div className="text-[11px] text-red-600">
                      Not found on The Network: {result.unrecognisedSlugs.join(", ")}
                    </div>
                  )}
                  {result.invalid.length > 0 && (
                    <div className="text-[11px] text-neutral-500">
                      Couldn't read: {result.invalid.join(", ")}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-neutral-500">
                Public invite link
              </div>
              <div className="flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-2.5">
                <LinkIcon size={13} className="flex-shrink-0 text-neutral-500"/>
                <code className="min-w-0 flex-1 truncate text-[11px] font-mono text-neutral-700">
                  {inviteUrl}
                </code>
                <button
                  onClick={copy}
                  className="flex-shrink-0 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider"
                  style={{
                    backgroundColor: copied ? BRAND_GREEN_DARK : BRAND_YELLOW,
                    color: copied ? "#FFFFFF" : BRAND_BLACK
                  }}
                >
                  {copied ? (
                    <span className="flex items-center gap-1">
                      <Check size={11} strokeWidth={3}/>
                      Copied
                    </span>
                  ) : (
                    "Copy"
                  )}
                </button>
              </div>
              <p className="mt-2 text-[10px] leading-snug text-neutral-500">
                Anyone with this link can join. Share on WhatsApp groups, forums, or your site.
              </p>

              {/* Quick-share buttons */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Join our canteen on The Network: ${inviteUrl}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full text-[11px] font-black uppercase tracking-wider text-white"
                  style={{ backgroundColor: "#25D366" }}
                >
                  Share via WhatsApp
                </a>
                <a
                  href={`mailto:?subject=${encodeURIComponent(`Join ${canteenName} on The Network`)}&body=${encodeURIComponent(inviteUrl)}`}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-neutral-200 bg-white text-[11px] font-black uppercase tracking-wider text-neutral-700"
                >
                  Email invite
                </a>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 border-t border-neutral-200 bg-white p-4">
          <button
            onClick={onClose}
            className="h-11 flex-shrink-0 rounded-full border border-neutral-200 bg-white px-4 text-[12px] font-black uppercase tracking-wider text-neutral-700"
          >
            Cancel
          </button>
          {tab === "pick" && (
            <button
              onClick={submitInvites}
              disabled={submitting || handles.trim().length === 0}
              className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full text-[13px] font-black uppercase tracking-wider text-neutral-900 shadow-md disabled:opacity-40"
              style={{ backgroundColor: BRAND_YELLOW }}
            >
              <Send size={13} strokeWidth={2.5}/>
              {submitting ? "Sending…" : "Send invites"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
