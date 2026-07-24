"use client";

// Van Wrap Studio — the merchant clicks Generate, the compiler + critic
// + persist + event-bus chain fires, output lands on screen. No
// direct AI wiring in the UI; everything routes through the
// registered Studio App via /api/studio/generate/van-wrap.

import { useState } from "react";
import Link from "next/link";
import { Loader2, Download, ArrowLeft, CheckCircle2, AlertCircle, Car, Zap } from "lucide-react";

const BRAND_YELLOW = "#FFB300";
const BRAND_BLACK  = "#0A0A0A";
const BG_CREAM     = "#FBF6EC";

type GenerationOutcome = {
  ok:           boolean;
  asset_urls?:  string[];
  prompt_used?: string;
  cost_pence?:  number;
  latency_ms?:  number;
  error?:       string;
};

export function VanWrapStudio({
  merchantName,
  brandName,
  brandVersion
}: {
  merchantName: string;
  brandName:    string;
  brandVersion: number;
}) {
  const [userPrompt, setUserPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<GenerationOutcome | null>(null);

  async function generate() {
    setBusy(true); setResult(null);
    try {
      const res = await fetch("/api/studio/generate/van-wrap", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ user_prompt: userPrompt || undefined })
      });
      const json = await res.json() as GenerationOutcome;
      setResult(json);
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : "network_error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: BG_CREAM }}>
      <div className="mx-auto max-w-6xl px-6 py-8">

        <div className="mb-6 flex items-start justify-between">
          <div>
            <Link href="/studio/vault" className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900">
              <ArrowLeft size={11}/> Back to Vault
            </Link>
            <h1 className="mt-2 text-3xl font-black">Van Wrap Studio</h1>
            <p className="mt-1 text-[13px] text-neutral-600">
              {merchantName} · Brand v{brandVersion} · {brandName}
            </p>
          </div>
          <div className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-wider text-neutral-600">
            Powered by Nex
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <aside className="lg:col-span-1">
            <div className="rounded-2xl border border-neutral-200 bg-white p-5">
              <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Optional guidance</p>
              <label className="mt-2 block text-[13px] font-black text-neutral-900">Anything specific?</label>
              <textarea
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                rows={5}
                placeholder="e.g. more focus on emergency plumbing, keep the phone number huge"
                className="mt-2 w-full rounded-lg border border-neutral-300 bg-white p-2 text-[13px] focus:border-neutral-900 focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-neutral-500">
                Leave blank and Nex uses your brand defaults.
              </p>

              <button
                onClick={generate}
                disabled={busy}
                className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-full px-4 py-3 text-[13px] font-black disabled:opacity-40"
                style={{ backgroundColor: BRAND_BLACK, color: BRAND_YELLOW }}
              >
                {busy
                  ? <><Loader2 size={13} className="animate-spin"/> Designing your van (about a minute)</>
                  : <><Car size={13}/> Design my van</>}
              </button>

              <ul className="mt-5 space-y-1 text-[11px] text-neutral-500">
                <li>Uses your brand colours + logo</li>
                <li>Checked for quality before you see it</li>
                <li>Saved to your Brand Vault, download any time</li>
              </ul>
            </div>
          </aside>

          <section className="lg:col-span-2">
            <div className="min-h-[420px] rounded-2xl border border-neutral-200 bg-white p-5">
              {!result && !busy && (
                <div className="flex h-full min-h-[400px] flex-col items-center justify-center text-center">
                  <Car size={40} className="text-neutral-300"/>
                  <p className="mt-4 text-[14px] font-black text-neutral-700">Ready when you are</p>
                  <p className="mt-1 max-w-sm text-[12px] text-neutral-500">
                    Hit Design my van. Takes about a minute. You only see the best one.
                  </p>
                </div>
              )}

              {busy && (
                <div className="flex h-full min-h-[400px] flex-col items-center justify-center text-center">
                  <Loader2 size={40} className="animate-spin text-neutral-400"/>
                  <p className="mt-4 text-[13px] font-black text-neutral-700">Working on it</p>
                  <p className="mt-1 text-[11px] text-neutral-500">Usually done in under a minute</p>
                </div>
              )}

              {result && result.ok && result.asset_urls && (
                <div>
                  <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-[11px] font-black text-green-800">
                    <CheckCircle2 size={12}/> Ready
                  </div>
                  {result.asset_urls.length === 0 && (
                    <p className="text-[13px] text-neutral-600">Image data returned. Preview wiring lands when the storage handoff ships.</p>
                  )}
                  {result.asset_urls.map((u, i) => (
                    <div key={i} className="mb-3 overflow-hidden rounded-xl border border-neutral-200">
                      {u.startsWith("b64:")
                        ? <div className="grid h-64 place-items-center bg-neutral-50 text-[11px] text-neutral-500">base64 payload (id: {u})</div>
                        : <img src={u} alt="Van Wrap" className="w-full"/>}
                    </div>
                  ))}
                  <div className="mt-4 grid grid-cols-3 gap-3 border-t border-neutral-100 pt-4 text-center text-[11px]">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-neutral-500">Cost</p>
                      <p className="text-[15px] font-black">£{((result.cost_pence ?? 0) / 100).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-neutral-500">Time</p>
                      <p className="text-[15px] font-black">{Math.round((result.latency_ms ?? 0) / 1000)}s</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-neutral-500">Saved</p>
                      <p className="text-[15px] font-black">In your Vault</p>
                    </div>
                  </div>

                  {result.prompt_used && (
                    <details className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-[11px] text-neutral-700">
                      <summary className="cursor-pointer font-black text-neutral-900">Show me the brief Nex used</summary>
                      <pre className="mt-2 whitespace-pre-wrap font-mono text-[10px]">{result.prompt_used}</pre>
                    </details>
                  )}

                  <div className="mt-5 flex gap-2">
                    <Link
                      href="/api/studio/export"
                      className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-4 py-2 text-[12px] font-black text-neutral-700"
                    >
                      <Download size={12}/> Export Brand Package
                    </Link>
                    <button
                      onClick={generate}
                      className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-black"
                      style={{ backgroundColor: BRAND_BLACK, color: BRAND_YELLOW }}
                    >
                      <Zap size={12}/> Try again
                    </button>
                  </div>
                </div>
              )}

              {result && !result.ok && (
                <div className="flex h-full min-h-[400px] flex-col items-center justify-center text-center">
                  <AlertCircle size={40} className="text-amber-500"/>
                  <p className="mt-4 text-[14px] font-black text-neutral-900">
                    {result.error === "openai_unavailable" ? "AI unavailable" :
                     result.error === "no_brand_dna_yet"   ? "Brand not set up yet" :
                     "Generation failed"}
                  </p>
                  <p className="mt-1 max-w-sm text-[12px] text-neutral-600">
                    {result.error === "openai_unavailable"
                      ? "AI is down for a moment. Your brief is saved. Try again in a bit."
                      : result.error === "no_brand_dna_yet"
                        ? "Answer the 7 questions first so Nex knows your brand."
                        : result.error ?? "unknown"}
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
