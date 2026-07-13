// Rate card editor — trade edits their own labour rates. Every save
// updates local state; production replaces this with a Supabase update.
//
// UX principles:
//   1. No Trade Center "recommended" number — every rate is the trade's
//      own choice
//   2. Visibility toggle (private ↔ public) so trades can draft
//   3. Delete + add rows freely
//   4. Live re-render of BenchmarkPanel + RateCardPanel so the trade
//      sees exactly what they're about to publish

"use client";

import { useState } from "react";
import { Plus, Trash2, Save, Eye, EyeOff } from "lucide-react";
import { UNIT_LABEL, type RateCard, type RateCardItem, type RateCardUnit } from "../data/rateCards";

type Props = {
  initial: RateCard;
  onChange: (card: RateCard) => void;
};

const UNIT_OPTIONS: RateCardUnit[] = ["per-m2", "per-lm", "per-hour", "per-day", "per-job", "each"];

export function RateCardEditor({ initial, onChange }: Props) {
  const [card, setCard] = useState<RateCard>(initial);
  const [saved, setSaved] = useState(false);

  function updateCard(patch: Partial<RateCard>) {
    const next = { ...card, ...patch, updatedAtIso: new Date().toISOString() };
    setCard(next);
    setSaved(false);
    onChange(next);
  }

  function updateItem(id: string, patch: Partial<RateCardItem>) {
    updateCard({
      items: card.items.map((it) => (it.id === id ? { ...it, ...patch } : it))
    });
  }

  function removeItem(id: string) {
    updateCard({ items: card.items.filter((it) => it.id !== id) });
  }

  function addItem() {
    const newItem: RateCardItem = {
      id: `i-local-${Date.now()}`,
      label: "New rate",
      unit: "per-m2",
      rateGbp: 0
    };
    updateCard({ items: [...card.items, newItem] });
  }

  function save() {
    // In production: POST to /api/rate-cards. For fixture-mode, keep local.
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`tc.rateCard.${card.ownerTradeSlug}`, JSON.stringify(card));
    }
    setSaved(true);
  }

  return (
    <section
      className="rounded-2xl border bg-white p-5 shadow-sm"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
            Edit your rate card
          </div>
          <p className="mt-0.5 text-[11.5px] leading-snug text-neutral-600">
            Publish your labour rates so customers self-qualify before calling. Trade Center
            never recommends numbers — you set every rate.
          </p>
        </div>

        {/* Visibility toggle */}
        <button
          type="button"
          onClick={() =>
            updateCard({
              visibility: card.visibility === "public" ? "private" : "public",
              publishedAtIso: card.publishedAtIso ?? new Date().toISOString()
            })
          }
          className="inline-flex min-h-[40px] items-center gap-2 rounded-full border bg-white px-4 text-[11px] font-black uppercase tracking-wider shadow-sm"
          style={{
            borderColor: "rgba(139,69,19,0.15)",
            color: card.visibility === "public" ? "#166534" : "#525252"
          }}
        >
          {card.visibility === "public" ? <Eye size={12}/> : <EyeOff size={12}/>}
          {card.visibility === "public" ? "Public" : "Private"}
        </button>
      </header>

      {/* Items */}
      <ul className="mt-5 flex flex-col gap-3">
        {card.items.map((item) => (
          <li
            key={item.id}
            className="grid gap-2 rounded-lg border bg-neutral-50 p-3 md:grid-cols-[minmax(0,1fr)_120px_100px_40px] md:items-start"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={item.label}
                onChange={(e) => updateItem(item.id, { label: e.target.value })}
                placeholder="Rate label (e.g. Skim per m²)"
                className="min-h-[40px] rounded-md border bg-white px-3 text-[13px] font-bold"
                style={{ borderColor: "rgba(139,69,19,0.15)" }}
              />
              <input
                type="text"
                value={item.detail ?? ""}
                onChange={(e) => updateItem(item.id, { detail: e.target.value })}
                placeholder="Short note (optional)"
                className="min-h-[36px] rounded-md border bg-white px-3 text-[12px]"
                style={{ borderColor: "rgba(139,69,19,0.15)" }}
              />
            </div>
            <select
              value={item.unit}
              onChange={(e) => updateItem(item.id, { unit: e.target.value as RateCardUnit })}
              className="min-h-[40px] rounded-md border bg-white px-3 text-[13px]"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              {UNIT_OPTIONS.map((u) => (
                <option key={u} value={u}>{UNIT_LABEL[u]}</option>
              ))}
            </select>
            <div className="flex flex-col gap-1">
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-[13px] text-neutral-500">
                  £
                </span>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={item.rateGbp}
                  onChange={(e) => updateItem(item.id, { rateGbp: parseFloat(e.target.value || "0") })}
                  className="min-h-[40px] w-full rounded-md border bg-white pl-6 pr-2 text-[13px] font-black"
                  style={{ borderColor: "rgba(139,69,19,0.15)" }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => removeItem(item.id)}
              aria-label={`Remove ${item.label}`}
              className="flex h-10 w-10 items-center justify-center rounded-md text-neutral-500 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 size={14}/>
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={addItem}
          className="inline-flex min-h-[44px] items-center justify-center gap-1 rounded-full border bg-white px-5 text-[11.5px] font-black uppercase tracking-wider text-neutral-700 shadow-sm"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        >
          <Plus size={12}/>
          Add rate
        </button>
        <button
          type="button"
          onClick={save}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-6 text-[12px] font-black uppercase tracking-wider text-white shadow-sm"
          style={{ backgroundColor: "#166534" }}
        >
          <Save size={13}/>
          {saved ? "Saved" : "Save rate card"}
        </button>
      </div>

      {/* Job-wide policies */}
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
            Minimum job value (£)
          </span>
          <input
            type="number"
            min={0}
            step={10}
            value={card.minimumJobGbp ?? 0}
            onChange={(e) => updateCard({ minimumJobGbp: parseFloat(e.target.value || "0") || undefined })}
            className="min-h-[40px] rounded-md border bg-white px-3 text-[13px]"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
            VAT
          </span>
          <select
            value={card.vatIncluded ? "included" : "excluded"}
            onChange={(e) => updateCard({ vatIncluded: e.target.value === "included" })}
            className="min-h-[40px] rounded-md border bg-white px-3 text-[13px]"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            <option value="excluded">Prices exclude VAT</option>
            <option value="included">Prices include VAT</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
            Travel policy
          </span>
          <input
            type="text"
            value={card.travelPolicy ?? ""}
            onChange={(e) => updateCard({ travelPolicy: e.target.value })}
            placeholder="Free within 15 miles of your postcode…"
            className="min-h-[40px] rounded-md border bg-white px-3 text-[13px]"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          />
        </label>
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
            Materials policy
          </span>
          <input
            type="text"
            value={card.materialsPolicy ?? ""}
            onChange={(e) => updateCard({ materialsPolicy: e.target.value })}
            placeholder="Priced separately at Trade Center merchant rate…"
            className="min-h-[40px] rounded-md border bg-white px-3 text-[13px]"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          />
        </label>
      </div>
    </section>
  );
}
