"use client";

// BeaconClaimComposeModal — the canonical "trade-contacts-customer"
// form for beacon leads. Every WhatsApp handoff on the platform now
// goes through this pattern:
//   1. Trade sees customer details (name, city, brief) + WhatsApp #
//   2. Message is pre-filled with a professional template
//   3. Trade can edit before sending
//   4. Submit → deducts 1 washer + opens WhatsApp with the message
//
// Per Philip 2026-07-17: "all enquires that are submited to trades
// must go through the whats app form and then submit form to open
// whats app with professionally message and customer details".

import { useState } from "react";
import { X, MessageCircle } from "lucide-react";
import { createPortal } from "react-dom";

export type ComposeModalProps = {
  open:          boolean;
  onClose:       () => void;
  onSubmitted:   (whatsappHref: string) => void;
  merchantSlug:  string;
  editToken:     string;
  beaconId:      string;
  customerName:  string;
  customerCity:  string | null;
  customerWhatsapp: string | null;
  description:   string;
  tradeName:     string;
};

function defaultTemplate(input: {
  tradeName:    string;
  customerName: string;
  customerCity: string | null;
  description:  string;
}): string {
  const firstName = (input.customerName.split(/\s+/)[0] || input.customerName).trim();
  const cityBit   = input.customerCity ? ` ${input.customerCity} ` : " ";
  const brief     = input.description.slice(0, 160) + (input.description.length > 160 ? "…" : "");
  return `Hi ${firstName}, ${input.tradeName} here from The Network. I saw your${cityBit}enquiry — "${brief}". I'd be happy to quote for this. What's a good time for a quick chat / to see any photos or measurements you have?`;
}

export function BeaconClaimComposeModal(props: ComposeModalProps) {
  const [message, setMessage] = useState(() =>
    defaultTemplate({
      tradeName:    props.tradeName,
      customerName: props.customerName,
      customerCity: props.customerCity,
      description:  props.description
    })
  );
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  if (!props.open) return null;
  if (typeof document === "undefined") return null;

  async function submit() {
    if (submitting) return;
    if (message.trim().length < 20) {
      setError("Please write a proper message (20+ characters) — customers respond better to a real intro.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/beacon/claim", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          beacon_id:      props.beaconId,
          slug:           props.merchantSlug,
          edit_token:     props.editToken,
          custom_message: message.trim()
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(
          data.error === "no-washers"      ? "You're out of washers — top up in /washers before claiming leads." :
          data.error === "sla-expired"     ? "This lead just expired." :
          data.error === "already-claimed" ? "You've already claimed this lead." :
          data.error === "not-ready"       ? "Your account needs WhatsApp connected + at least 1 washer to claim." :
          "Claim failed — try again."
        );
        setSubmitting(false);
        return;
      }
      props.onSubmitted(data.whatsapp_href as string);
    } catch {
      setError("Network error — try again.");
      setSubmitting(false);
    }
  }

  const waDigits = (props.customerWhatsapp ?? "").replace(/\D/g, "");

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(10,10,10,0.55)" }}
      onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl" role="dialog" aria-modal="true">
        <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#7A5B00]">
              Message customer via WhatsApp
            </p>
            <p className="text-[13px] font-black text-neutral-900">
              1 washer will be deducted on send
            </p>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
          >
            <X size={15} strokeWidth={2.4}/>
          </button>
        </div>

        <div className="space-y-4 p-4">
          {/* Customer details — read-only */}
          <div className="rounded-lg border p-3" style={{ borderColor: "rgba(0,0,0,0.08)", backgroundColor: "#FBF6EC" }}>
            <p className="text-[10px] font-black uppercase tracking-wider text-[#7A5B00]">Customer</p>
            <p className="mt-0.5 text-[13px] font-black text-neutral-900">
              {props.customerName}{props.customerCity ? ` · ${props.customerCity}` : ""}
            </p>
            {waDigits.length >= 8 && (
              <p className="mt-1 font-mono text-[11px] text-neutral-600">+{waDigits}</p>
            )}
            <p className="mt-2 text-[11px] italic leading-snug text-neutral-700">
              &ldquo;{props.description}&rdquo;
            </p>
          </div>

          {/* Editable message */}
          <div>
            <label className="block">
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
                  Your WhatsApp message
                </span>
                <span className="text-[10px] font-bold text-neutral-400">
                  {message.length}/800
                </span>
              </div>
              <textarea
                rows={6}
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 800))}
                className="mt-1 w-full resize-y rounded-md border px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-yellow-400"
                style={{ borderColor: "rgba(0,0,0,0.15)" }}
                placeholder="Introduce yourself, mention their project, ask what they need to know."
              />
            </label>
            <p className="mt-1 text-[10px] leading-snug text-neutral-500">
              Personalise before sending — customers respond better to real intros than canned messages.
            </p>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-[11px] font-bold text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t px-4 py-3" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
          <button
            type="button"
            onClick={props.onClose}
            className="text-[11px] font-black uppercase tracking-wider text-neutral-500 transition hover:text-neutral-900"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-[11px] font-black uppercase tracking-wider text-white transition disabled:opacity-60"
            style={{ backgroundColor: "#166534" }}
          >
            <MessageCircle size={13} strokeWidth={2.6}/>
            {submitting ? "Sending…" : "Send WhatsApp · 1 washer"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
