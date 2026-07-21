"use client";

// ContactGate — trade-facing washer-gate for revealing an apprentice's
// WhatsApp contact. Pressed once, POSTs /api/apprenticeships/[id]/contact
// which debits 1 washer and returns the contact. Subsequent presses
// on the same trade+request pair are free (idempotent).

import { useState } from "react";
import Link from "next/link";
import { MessageCircle, Loader2, AlertTriangle, Lock, CircleCheck } from "lucide-react";

type Result =
  | { ok: true;  contact: { fullName: string; whatsapp: string; city: string | null }; alreadyPaid?: boolean; balance?: number; cost?: number }
  | { ok: false; error: string; balance?: number; cost?: number };

export function ContactGate({ requestId, firstName }: { requestId: string; firstName: string }) {
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<Result | null>(null);

  async function reveal() {
    if (loading) return;
    setLoading(true);
    const res  = await fetch(`/api/apprenticeships/${requestId}/contact`, { method: "POST" });
    const json = await res.json().catch(() => ({ ok: false, error: "bad-response" }));
    setResult(json);
    setLoading(false);
  }

  if (result?.ok) {
    const waHref = `https://wa.me/${result.contact.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi ${firstName} — I saw your apprenticeship application on The Networkers. Keen to chat.`)}`;
    return (
      <div className="rounded-2xl border-2 p-5 shadow-sm md:p-6" style={{ borderColor: "#22C55E", backgroundColor: "#F0FDF4" }}>
        <div className="flex items-center gap-2">
          <CircleCheck size={16} strokeWidth={2.6} className="text-green-700"/>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-green-800">
            {result.alreadyPaid ? "You already paid for this contact" : "Contact revealed"}
          </p>
        </div>
        <p className="mt-2 text-[15px] font-black text-neutral-900">{result.contact.fullName}</p>
        <p className="mt-1 text-[13.5px] tabular-nums text-neutral-800">{result.contact.whatsapp}</p>
        {result.contact.city && <p className="mt-0.5 text-[11.5px] text-neutral-600">{result.contact.city}</p>}
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex h-11 items-center justify-center gap-1.5 rounded-lg px-5 text-[12px] font-black uppercase tracking-wider text-white shadow-md active:scale-[0.97]"
          style={{ backgroundColor: "#166534" }}
        >
          <MessageCircle size={13} strokeWidth={2.6}/>
          Message {firstName} on WhatsApp
        </a>
        {!result.alreadyPaid && (
          <p className="mt-3 text-[11px] text-neutral-500">
            Washer balance: <strong className="tabular-nums text-neutral-800">{result.balance ?? "—"}</strong>
          </p>
        )}
      </div>
    );
  }

  if (result?.ok === false && result.error === "insufficient-balance") {
    return (
      <div className="rounded-2xl border-2 p-5 shadow-sm md:p-6" style={{ borderColor: "#EF4444", backgroundColor: "#FEF2F2" }}>
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-700"/>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-red-800">Not enough washers</p>
        </div>
        <p className="mt-2 text-[13px] text-red-900">
          You have <strong className="tabular-nums">{result.balance ?? 0}</strong> washers · this contact costs <strong className="tabular-nums">{result.cost ?? 1}</strong>.
        </p>
        <Link
          href="/trade-off/washers"
          className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-lg px-4 text-[11.5px] font-black uppercase tracking-wider text-white shadow-sm"
          style={{ backgroundColor: "#0A0A0A" }}
        >
          Top up washers
        </Link>
      </div>
    );
  }

  if (result?.ok === false && result.error === "auth-required") {
    return (
      <div className="rounded-2xl border-2 p-5 shadow-sm md:p-6" style={{ borderColor: "rgba(139,69,19,0.20)" }}>
        <p className="text-[13px] text-neutral-800">
          Sign in as a verified trade to see {firstName}'s contact.
        </p>
        <Link
          href="/trade-off/login"
          className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-lg px-4 text-[11.5px] font-black uppercase tracking-wider text-white shadow-sm"
          style={{ backgroundColor: "#0A0A0A" }}
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (result?.ok === false) {
    return (
      <div className="rounded-2xl border-2 p-5 shadow-sm md:p-6" style={{ borderColor: "#EF4444", backgroundColor: "#FEF2F2" }}>
        <p className="text-[13px] text-red-900">Something went wrong: {result.error}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 p-5 shadow-sm md:p-6" style={{ borderColor: "#FFB300", backgroundColor: "#FFFDF6" }}>
      <div className="flex items-center gap-2">
        <Lock size={16} className="text-neutral-900"/>
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-900">Reveal contact — 1 washer</p>
      </div>
      <p className="mt-2 text-[13.5px] leading-relaxed text-neutral-800">
        We charge 1 washer to reveal {firstName}'s WhatsApp. That's it — no repeat fees, no commission. It's just enough friction to keep speculative outreach off {firstName}'s phone.
      </p>
      <button
        type="button"
        onClick={reveal}
        disabled={loading}
        className="mt-4 inline-flex h-11 items-center justify-center gap-1.5 rounded-lg px-5 text-[12px] font-black uppercase tracking-wider text-neutral-900 shadow-md active:scale-[0.97] disabled:opacity-50"
        style={{ backgroundColor: "#FFB300" }}
      >
        {loading ? <><Loader2 size={13} className="animate-spin"/> Revealing</> : <><MessageCircle size={13} strokeWidth={2.6}/> Reveal & message {firstName} (1 washer)</>}
      </button>
    </div>
  );
}
