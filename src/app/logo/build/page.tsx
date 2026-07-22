"use client";

// /logo/build — the 4-step logo builder.
//
// State lives in this one page. Each step is a section rendered in
// place with a progress indicator across the top. No sidebar, no
// menu, one direction. Mobile-first, big tap targets.
//
// Steps:
//   1  Pick trade
//   2  Pick style (opens preview modal on tap)
//   3  Name + generate
//   4  Preview + tweak + buy

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as Icons from "lucide-react";
import { LOGO_STYLES, LOGO_TRADES, styleBySlug, tradeBySlug, supplyBySlug } from "@/lib/logo/catalog";
import { StylePreviewTile } from "@/components/logo/StylePreviewTile";
import { StyleModal } from "@/components/logo/StyleModal";

const BRAND_YELLOW = "#FFB300";
const BRAND_BLACK  = "#0A0A0A";

type Step = 1 | 2 | 3 | 4;

export default function LogoBuilderPage() {
  const params = useSearchParams();
  const [step, setStep]           = useState<Step>(1);
  const [tradeSlug, setTradeSlug] = useState<string | null>(null);
  const [styleSlug, setStyleSlug] = useState<string | null>(null);
  const [sampleUrl, setSampleUrl] = useState<string | null>(null);
  const [previewSlug, setPreviewSlug] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState("");

  // URL params — the style page hands off with ?style=X&trade=Y&sample=URL
  // so we can jump the user straight to the name step with everything
  // pre-picked. Trade lookup falls through supply too so supply slugs
  // land in the same field.
  useEffect(() => {
    const s = params?.get("style");
    const t = params?.get("trade");
    const p = params?.get("sample");
    if (s && styleBySlug(s)) setStyleSlug(s);
    if (t && (tradeBySlug(t) || supplyBySlug(t))) setTradeSlug(t);
    if (p) setSampleUrl(p);
    if (s && t && p) setStep(3);   // land at name step, previous picks done
  }, [params]);

  const style = styleSlug ? styleBySlug(styleSlug) : null;
  const trade = tradeSlug ? (tradeBySlug(tradeSlug) ?? supplyBySlug(tradeSlug)) : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <ProgressBar step={step} onJump={(s) => setStep(s)} tradeSlug={tradeSlug} styleSlug={styleSlug} businessName={businessName}/>

      {/* Step 1 — trade */}
      {step === 1 && (
        <Section
          eyebrow="Step 1 of 4"
          title="What trade are you in?"
          subtitle="Pick one. It shapes the tool icon and helps us match the right style."
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {LOGO_TRADES.map((t) => {
              const Icon = (Icons as unknown as Record<string, React.ComponentType<{ size?: number; strokeWidth?: number }>>)[t.icon] ?? Icons.Circle;
              const selected = tradeSlug === t.slug;
              return (
                <button
                  key={t.slug}
                  onClick={() => setTradeSlug(t.slug)}
                  className={
                    "flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border bg-white p-3 text-center transition hover:shadow-md " +
                    (selected ? "border-neutral-900 ring-2 ring-neutral-900" : "border-neutral-200")
                  }
                >
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-xl"
                    style={{ backgroundColor: selected ? BRAND_BLACK : "#f4efe4", color: selected ? BRAND_YELLOW : BRAND_BLACK }}
                  >
                    <Icon size={20} strokeWidth={2.2}/>
                  </span>
                  <span className="text-[12px] font-black">{t.label}</span>
                </button>
              );
            })}
          </div>
          <NextRow disabled={!tradeSlug} onNext={() => setStep(2)} onBack={null}/>
        </Section>
      )}

      {/* Step 2 — style */}
      {step === 2 && (
        <Section
          eyebrow="Step 2 of 4"
          title="Pick a style."
          subtitle="Tap any card to see it bigger. Change your mind any time."
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {LOGO_STYLES.map((s) => (
              <div
                key={s.slug}
                className={
                  "rounded-2xl p-1 transition " +
                  (styleSlug === s.slug ? "bg-neutral-900" : "")
                }
              >
                <StylePreviewTile style={s} size="md" tradeSlug={tradeSlug} onClick={() => setPreviewSlug(s.slug)} ariaLabel={`Preview ${s.name}`}/>
              </div>
            ))}
          </div>
          <NextRow disabled={!styleSlug} onNext={() => setStep(3)} onBack={() => setStep(1)}/>
          {styleSlug && style && (
            <p className="mt-3 text-center text-[12px] text-neutral-600">
              Selected: <span className="font-black">{style.name}</span>
            </p>
          )}
        </Section>
      )}

      {/* Step 3 — name */}
      {step === 3 && (
        <Section
          eyebrow="Step 3 of 4"
          title="What's your business called?"
          subtitle={trade ? `We'll set it up as a ${trade.label.toLowerCase()} logo in the ${style?.name ?? "chosen"} style.` : ""}
        >
          <div className="mx-auto max-w-md">
            <input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Bob's Kitchens"
              maxLength={40}
              className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-4 text-center text-[18px] font-black shadow-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/20"
              autoFocus
            />
            <p className="mt-2 text-center text-[11px] text-neutral-500">Between 2 and 40 characters. You can change it before buying.</p>
          </div>
          <NextRow disabled={businessName.trim().length < 2} onNext={() => setStep(4)} onBack={() => setStep(2)} nextLabel="Generate my logo"/>
        </Section>
      )}

      {/* Step 4 — preview + buy (placeholder — engine wires next) */}
      {step === 4 && style && trade && (
        <Section
          eyebrow="Step 4 of 4"
          title="Here it is."
          subtitle="Tweak the colour, tool or effect. Buy when it feels right."
        >
          <div className="grid gap-6 md:grid-cols-[1fr_260px]">
            <div>
              <div className="relative overflow-hidden rounded-3xl border border-neutral-200 shadow-lg">
                <StylePreviewTile style={style} size="lg" tradeSlug={tradeSlug} imageUrl={sampleUrl ?? undefined}/>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-6">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/70">Live preview</p>
                  <p className="text-2xl font-black text-white">{businessName}</p>
                  <p className="text-[11px] text-white/70">{trade.label} · {style.name}</p>
                </div>
              </div>
              <p className="mt-2 text-center text-[11px] text-neutral-500">
                Real AI-generated preview lands when the engine is wired. For now this is the style template with your name overlay.
              </p>
            </div>

            <div className="space-y-3">
              <TweakGroup label="Colour" options={["Yellow", "Black", "Green", "Blue"]}/>
              <TweakGroup label="Tool"   options={["Default", "Hammer", "Spanner", "Roller"]}/>
              <TweakGroup label="Effect" options={["Chrome", "Matte", "Gold", "Flat"]}/>
              <div className="mt-4 rounded-2xl border border-neutral-900 bg-neutral-900 p-4 text-white">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/60">Most popular</p>
                <p className="mt-1 text-[14px] font-black">Trade Kit</p>
                <p className="mt-0.5 text-3xl font-black">£14.99</p>
                <button
                  className="mt-3 w-full rounded-full py-2 text-[12px] font-black transition hover:brightness-95"
                  style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
                >
                  Buy Trade Kit
                </button>
                <Link href="/logo#pricing" className="mt-2 block text-center text-[11px] text-white/70 underline">See all tiers</Link>
              </div>
            </div>
          </div>
          <NextRow disabled={true} onNext={() => {}} onBack={() => setStep(3)} nextLabel="Checkout (stub)"/>
        </Section>
      )}

      {/* Preview modal */}
      {previewSlug && (
        <StyleModal
          style={styleBySlug(previewSlug)!}
          tradeSlug={tradeSlug}
          onClose={() => setPreviewSlug(null)}
          onSelect={(slug) => { setStyleSlug(slug); setPreviewSlug(null); }}
          onNavigate={(slug) => setPreviewSlug(slug)}
        />
      )}
    </div>
  );
}

function Section({ eyebrow, title, subtitle, children }: { eyebrow: string; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <div className="mb-6 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">{eyebrow}</p>
        <h1 className="mt-1 text-2xl font-black sm:text-3xl">{title}</h1>
        {subtitle && <p className="mx-auto mt-2 max-w-lg text-[13px] text-neutral-600">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function ProgressBar({ step, onJump, tradeSlug, styleSlug, businessName }: { step: Step; onJump: (s: Step) => void; tradeSlug: string | null; styleSlug: string | null; businessName: string }) {
  const done = [true, !!tradeSlug, !!tradeSlug && !!styleSlug, !!tradeSlug && !!styleSlug && businessName.trim().length >= 2];
  return (
    <div className="mx-auto flex max-w-md items-center justify-between">
      {[1, 2, 3, 4].map((n) => {
        const enabled = done[n - 1];
        const current = step === n;
        return (
          <button
            key={n}
            onClick={() => enabled && onJump(n as Step)}
            disabled={!enabled}
            className={
              "flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-black transition " +
              (current ? "" : enabled ? "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100" : "border border-neutral-200 bg-neutral-50 text-neutral-400")
            }
            style={current ? { backgroundColor: BRAND_BLACK, color: BRAND_YELLOW } : undefined}
            aria-label={`Step ${n}`}
          >
            {n}
          </button>
        );
      }).flatMap((btn, i) => i < 3 ? [btn, <div key={`d${i}`} className="mx-1 h-px flex-1 bg-neutral-200"/>] : [btn])}
    </div>
  );
}

function NextRow({ disabled, onNext, onBack, nextLabel }: { disabled: boolean; onNext: () => void; onBack: (() => void) | null; nextLabel?: string }) {
  return (
    <div className="mt-8 flex items-center justify-between gap-3">
      {onBack ? (
        <button onClick={onBack} className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-[12px] font-black text-neutral-700 hover:bg-neutral-50">
          ← Back
        </button>
      ) : <span/>}
      <button
        onClick={onNext}
        disabled={disabled}
        className="rounded-full px-5 py-2.5 text-[13px] font-black transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
        style={{ backgroundColor: BRAND_BLACK, color: BRAND_YELLOW }}
      >
        {nextLabel ?? "Next →"}
      </button>
    </div>
  );
}

function TweakGroup({ label, options }: { label: string; options: string[] }) {
  const [selected, setSelected] = useState(0);
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-3">
      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt, i) => (
          <button
            key={opt}
            onClick={() => setSelected(i)}
            className={
              "rounded-full px-2.5 py-1 text-[11px] font-black transition " +
              (selected === i ? "bg-neutral-900 text-white" : "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100")
            }
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
