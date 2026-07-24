"use client";

// Discovery Wizard — renders the 7 canonical questions per V3 Q11.
// Business language, not designer jargon. Anti-pattern questions
// ("describe your branding") explicitly avoided.

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { DISCOVERY_QUESTIONS, type DiscoveryAnswers } from "@/lib/design/agents/discovery";

const BRAND_YELLOW = "#FFB300";
const BRAND_BLACK  = "#0A0A0A";
const BG_CREAM     = "#FBF6EC";

export function DiscoveryWizard({ merchantName, trade }: { merchantName: string; trade: string }) {
  const [answers, setAnswers] = useState<DiscoveryAnswers>({});
  const [step, setStep]       = useState(0);
  const [tradeInput, setTradeInput] = useState(trade);
  const [busy, setBusy]       = useState(false);
  const [done, setDone]       = useState<null | { fingerprint: string; ai_used: boolean }>(null);
  const [err, setErr]         = useState<string | null>(null);

  const current = DISCOVERY_QUESTIONS[step];
  const isLast  = step === DISCOVERY_QUESTIONS.length - 1;

  async function submit() {
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/studio/discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trade: tradeInput || "trade", answers })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "discovery_failed");
      setDone({ fingerprint: json.fingerprint, ai_used: json.ai_used });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "discovery_failed");
    } finally { setBusy(false); }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center" style={{ backgroundColor: BG_CREAM, minHeight: "100vh" }}>
        <CheckCircle2 size={48} className="mx-auto mb-3 text-green-600"/>
        <h1 className="text-3xl font-black">Brand saved</h1>
        <p className="mt-2 text-[14px] text-neutral-700">
          Everything Nex builds from here uses your brand (van, cards, workwear, website).
        </p>
        <p className="mt-1 text-[10px] font-mono text-neutral-400">
          fingerprint · {done.fingerprint.slice(0, 12)}…{done.ai_used ? " · AI inference on" : " · deterministic fallback"}
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/studio/vault" className="rounded-full px-5 py-2.5 text-[13px] font-black" style={{ backgroundColor: BRAND_BLACK, color: BRAND_YELLOW }}>
            Open Brand Vault
          </Link>
          <Link href="/studio/studios/van-wrap" className="rounded-full border border-neutral-300 bg-white px-5 py-2.5 text-[13px] font-black text-neutral-700">
            Design your van
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12" style={{ backgroundColor: BG_CREAM, minHeight: "100vh" }}>
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">
        Welcome {merchantName.split(" ")[0]} · Business Discovery
      </p>
      <div className="mb-8 mt-1 flex items-center gap-1">
        {DISCOVERY_QUESTIONS.map((_, i) => (
          <span
            key={i}
            className={"h-1.5 flex-1 rounded-full transition " + (i <= step ? "bg-neutral-900" : "bg-neutral-200")}
          />
        ))}
      </div>

      {step === 0 && !tradeInput && (
        <div className="mb-4">
          <label className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">Your trade</label>
          <input
            value={tradeInput}
            onChange={(e) => setTradeInput(e.target.value)}
            placeholder="e.g. joinery, plumbing, electrical"
            className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-[13px]"
          />
        </div>
      )}

      <div className="mb-8">
        <p className="text-[11px] font-black uppercase tracking-wider text-neutral-500">Question {step + 1} of {DISCOVERY_QUESTIONS.length}</p>
        <h1 className="mt-1 text-2xl font-black leading-tight sm:text-3xl">{current.label}</h1>
        <textarea
          value={answers[current.id] ?? ""}
          onChange={(e) => setAnswers({ ...answers, [current.id]: e.target.value })}
          rows={4}
          className="mt-4 w-full rounded-xl border border-neutral-300 bg-white p-3 text-[14px] focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
          placeholder="Your answer…"
          autoFocus
        />
        {!current.required && (
          <p className="mt-1 text-[11px] text-neutral-500">Optional. Skip if you don't have one.</p>
        )}
      </div>

      {err && <div className="mb-4 rounded-lg bg-red-50 p-3 text-[12px] text-red-800">{err}</div>}

      <div className="flex items-center justify-between">
        <button
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
          className="text-[12px] font-black text-neutral-500 hover:text-neutral-900 disabled:opacity-30"
        >
          ← Back
        </button>
        {isLast ? (
          <button
            onClick={submit}
            disabled={busy || (current.required && !answers[current.id])}
            className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[13px] font-black disabled:opacity-40"
            style={{ backgroundColor: BRAND_BLACK, color: BRAND_YELLOW }}
          >
            {busy ? <Loader2 size={13} className="animate-spin"/> : <>Finish <ArrowRight size={13}/></>}
          </button>
        ) : (
          <button
            onClick={() => setStep(step + 1)}
            disabled={current.required && !answers[current.id]}
            className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[13px] font-black disabled:opacity-40"
            style={{ backgroundColor: BRAND_BLACK, color: BRAND_YELLOW }}
          >
            Next <ArrowRight size={13}/>
          </button>
        )}
      </div>
    </div>
  );
}
