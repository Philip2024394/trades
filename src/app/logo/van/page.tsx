"use client";

// /logo/van — AI-driven van signwriting builder.
//
// Flow:
//   1  Pick your van angle, van colour, and starter logo
//   2  Fill in business name / phone / trade / strap
//   3  Hit Generate — AI (Claude) drafts the signwriting layout,
//      picking text + strip colours that suit the van paint
//   4  Preview lives on the left; type a prompt on the right to
//      refine ("make the logo bigger", "add Gas Safe strip", "use
//      red instead of black"). Every submit round-trips to the AI
//      and re-renders.
//
// Falls back to a deterministic layout when the Anthropic key isn't
// live, so the page still shows something sensible.

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Sparkles, Loader2, Download, MessageSquare } from "lucide-react";
import { VAN_TEMPLATES, VAN_COLOURS, vanBySlug, vanColourBySlug, type VanColour } from "@/lib/logo/vans";
import { LOGO_STYLES } from "@/lib/logo/catalog";
import { defaultVanLayout, type VanLayout } from "@/lib/logo/vanLayout";
import { VanComposer } from "@/components/logo/VanComposer";

const BRAND_YELLOW = "#FFB300";
const BRAND_BLACK  = "#0A0A0A";

// Flatten every real logo sample so the picker has visual options.
const AVAILABLE_LOGOS = LOGO_STYLES.flatMap((s) =>
  s.samples.map((sample) => ({ styleName: s.name, imageUrl: sample.imageUrl, tradeSlug: sample.tradeSlug }))
);

type Turn = { prompt: string; ok: boolean };

export default function VanPage() {
  const [vanSlug,        setVanSlug]        = useState(VAN_TEMPLATES[0].slug);
  const [colourSlug,     setColourSlug]     = useState<string>("white");
  const [logoUrl,        setLogoUrl]        = useState<string | null>(AVAILABLE_LOGOS[0]?.imageUrl ?? null);
  const [businessName,   setBusinessName]   = useState("Bob's Kitchens");
  const [phone,          setPhone]          = useState("0800 555 1234");
  const [strapLine,      setStrapLine]      = useState("Kitchens · Bathrooms · Fitting");
  const [trade,          setTrade]          = useState("kitchen fitter");
  const [vibe,           setVibe]           = useState<string>("premium");

  const [layout,         setLayout]         = useState<VanLayout | null>(null);
  const [genBusy,        setGenBusy]        = useState(false);
  const [modBusy,        setModBusy]        = useState(false);
  const [aiActive,       setAiActive]       = useState<boolean>(true);
  const [chatInput,      setChatInput]      = useState("");
  const [history,        setHistory]        = useState<Turn[]>([]);
  const [err,            setErr]            = useState<string | null>(null);

  const van    = vanBySlug(vanSlug) ?? VAN_TEMPLATES[0];
  const colour = vanColourBySlug(colourSlug) ?? null;

  async function generate() {
    setGenBusy(true); setErr(null);
    try {
      const res = await fetch("/api/logo/van/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          van_slug:      vanSlug,
          van_colour:    colourSlug,
          business_name: businessName,
          phone,
          logo_url:      logoUrl,
          strap_line:    strapLine,
          trade,
          vibe
        })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "generate_failed");
      setLayout(json.layout as VanLayout);
      setAiActive(json.ai);
      setHistory([]);
    } catch (e) {
      // AI unavailable → deterministic fallback so page still works
      setLayout(defaultVanLayout({ vanSlug, logoUrl, businessName, phone, strapLine }));
      setAiActive(false);
      setErr(e instanceof Error ? e.message : "generate_failed");
    } finally { setGenBusy(false); }
  }

  async function sendPrompt() {
    if (!layout || !chatInput.trim() || modBusy) return;
    const prompt = chatInput.trim();
    setChatInput(""); setModBusy(true); setErr(null);
    try {
      const res = await fetch("/api/logo/van/modify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout, prompt })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setHistory((h) => [...h, { prompt, ok: false }]);
        throw new Error(json.error === "ai_unavailable" ? "AI not live yet. Set ANTHROPIC_API_KEY on Vercel." : (json.error ?? "modify_failed"));
      }
      setLayout(json.layout as VanLayout);
      setHistory((h) => [...h, { prompt, ok: true }]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "modify_failed");
    } finally { setModBusy(false); }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <Link href="/logo/build" className="mb-6 inline-flex items-center gap-1.5 text-[12px] font-black text-neutral-600 hover:text-neutral-900">
        <ArrowLeft size={13}/> Back to Logo Studio
      </Link>

      <div className="mb-6">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">Van Signwriting</p>
        <h1 className="mt-1 text-3xl font-black">Design it with AI. Type to change.</h1>
        <p className="mt-1 text-[13px] text-neutral-600">Pick your van, colour and starter logo. The AI drafts the signwriting. Then chat to refine it.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* PREVIEW */}
        <div>
          {layout ? (
            <VanComposer van={van} colour={colour} layout={layout}/>
          ) : (
            <div className="flex aspect-[16/10] w-full items-center justify-center rounded-2xl border-2 border-dashed border-neutral-300 bg-white">
              <div className="text-center">
                <Sparkles size={22} className="mx-auto mb-2 text-neutral-400"/>
                <p className="text-[13px] font-black text-neutral-600">Set your foundation, hit Generate.</p>
                <p className="mt-1 text-[11px] text-neutral-500">Van + colour + logo become the design brief.</p>
              </div>
            </div>
          )}

          {/* Van thumbnails */}
          <div className="mt-3 flex gap-2">
            {VAN_TEMPLATES.map((v) => (
              <button
                key={v.slug}
                onClick={() => setVanSlug(v.slug)}
                className={
                  "flex-1 overflow-hidden rounded-xl border-2 bg-white p-1 transition " +
                  (v.slug === vanSlug ? "border-neutral-900" : "border-transparent hover:border-neutral-300")
                }
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={v.imageUrl} alt={v.model} className="h-16 w-full object-contain"/>
              </button>
            ))}
          </div>

          {/* Prompt chat under the preview */}
          {layout && (
            <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-3">
              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">
                <MessageSquare size={11}/> Type to change the design
              </p>
              <form onSubmit={(e) => { e.preventDefault(); sendPrompt(); }} className="flex gap-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={aiActive ? "e.g. Make the logo bigger. Add a Gas Safe strip. Use red instead." : "AI offline (needs ANTHROPIC_API_KEY)"}
                  disabled={modBusy || !aiActive}
                  className="flex-1 rounded-full border border-neutral-300 bg-white px-3 py-2 text-[13px] outline-none focus:border-neutral-900 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={modBusy || !chatInput.trim() || !aiActive}
                  className="rounded-full px-4 py-2 text-[12px] font-black transition disabled:opacity-50"
                  style={{ backgroundColor: BRAND_BLACK, color: BRAND_YELLOW }}
                >
                  {modBusy ? <Loader2 size={12} className="animate-spin"/> : "Send"}
                </button>
              </form>
              {history.length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-neutral-100 pt-2">
                  {history.slice(-5).reverse().map((h, i) => (
                    <li key={i} className="text-[11px]">
                      <span className={h.ok ? "text-neutral-600" : "text-red-600"}>&ldquo;{h.prompt}&rdquo;</span>
                    </li>
                  ))}
                </ul>
              )}
              {!aiActive && (
                <p className="mt-2 text-[10px] text-amber-700">
                  AI is offline (fallback layout shown). Once ANTHROPIC_API_KEY is live on Vercel this becomes conversational.
                </p>
              )}
            </div>
          )}

          {err && (
            <div className="mt-3 rounded-xl bg-red-50 p-2 text-[11px] text-red-800">{err}</div>
          )}
        </div>

        {/* FOUNDATION CONTROLS */}
        <div className="space-y-4">
          <Field label="Van colour">
            <div className="flex flex-wrap gap-2">
              {VAN_COLOURS.map((c) => (
                <button
                  key={c.slug}
                  onClick={() => setColourSlug(c.slug)}
                  className={
                    "flex flex-col items-center gap-1 rounded-xl border-2 bg-white p-1.5 transition " +
                    (colourSlug === c.slug ? "border-neutral-900" : "border-transparent hover:border-neutral-300")
                  }
                  title={c.label}
                >
                  <span className="h-8 w-8 rounded-full border border-neutral-200" style={{ backgroundColor: c.hex }}/>
                  <span className="text-[9px] font-black text-neutral-700">{c.label}</span>
                </button>
              ))}
            </div>
          </Field>

          <Field label="Starter logo">
            <div className="grid max-h-56 grid-cols-4 gap-1 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-1">
              {AVAILABLE_LOGOS.length === 0 && (
                <p className="col-span-4 p-3 text-center text-[11px] text-neutral-500">No logos in the catalog yet.</p>
              )}
              {AVAILABLE_LOGOS.map((lg) => (
                <button
                  key={lg.imageUrl}
                  onClick={() => setLogoUrl(lg.imageUrl)}
                  className={
                    "aspect-square overflow-hidden rounded transition " +
                    (logoUrl === lg.imageUrl ? "ring-2 ring-neutral-900" : "hover:ring-1 hover:ring-neutral-300")
                  }
                  title={`${lg.styleName} · ${lg.tradeSlug}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={lg.imageUrl} alt={lg.styleName} className="h-full w-full object-contain"/>
                </button>
              ))}
            </div>
          </Field>

          <Field label="Business name">
            <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-[13px]"/>
          </Field>
          <Field label="Strap line">
            <input value={strapLine} onChange={(e) => setStrapLine(e.target.value)} className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-[13px]" placeholder="e.g. Kitchens · Bathrooms · Fitting"/>
          </Field>
          <Field label="Phone">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-[13px]" placeholder="0800 000 0000"/>
          </Field>
          <Field label="Trade">
            <input value={trade} onChange={(e) => setTrade(e.target.value)} className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-[13px]" placeholder="e.g. plumber, electrician"/>
          </Field>
          <Field label="Vibe">
            <div className="flex flex-wrap gap-1.5">
              {["premium", "no-nonsense", "friendly", "industrial", "traditional"].map((v) => (
                <button
                  key={v}
                  onClick={() => setVibe(v)}
                  className={
                    "rounded-full px-2.5 py-1 text-[11px] font-black transition " +
                    (vibe === v ? "bg-neutral-900 text-white" : "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100")
                  }
                >{v}</button>
              ))}
            </div>
          </Field>

          <button
            onClick={generate}
            disabled={genBusy || !businessName.trim() || !colour}
            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-full py-2.5 text-[13px] font-black transition disabled:opacity-40"
            style={{ backgroundColor: BRAND_BLACK, color: BRAND_YELLOW }}
          >
            {genBusy ? <><Loader2 size={12} className="animate-spin"/> Designing…</> : <><Sparkles size={12}/> {layout ? "Regenerate design" : "Generate design"}</>}
          </button>

          <button
            disabled
            className="mt-1 inline-flex w-full items-center justify-center gap-1.5 rounded-full py-2 text-[11px] font-black opacity-40"
          >
            <Download size={11}/> Download print pack (soon)
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">{label}</p>
      {children}
    </div>
  );
}
