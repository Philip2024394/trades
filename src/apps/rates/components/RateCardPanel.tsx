// Public rate card preview — how the customer sees the trade's rates.
// Rendered on the trade's public profile page + a live preview inside
// the RateCardEditor so trades can see their own view.

import { PoundSterling, MapPin, ShieldCheck, Info } from "lucide-react";
import { UNIT_LABEL, type RateCard } from "../data/rateCards";

type Props = {
  card: RateCard;
};

function formatGbp(v: number): string {
  return v % 1 === 0 ? `£${v}` : `£${v.toFixed(2)}`;
}

export function RateCardPanel({ card }: Props) {
  const isPublic = card.visibility === "public";

  return (
    <section
      className="rounded-2xl border bg-white p-5 shadow-sm"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
            Rate card · Published by the trade
          </div>
          <div className="mt-1 text-[16px] font-black text-neutral-900">
            {card.tradeName}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11.5px] text-neutral-600">
            <span>{card.discipline}</span>
            <span className="inline-flex items-center gap-1">
              <MapPin size={11}/> {card.region}
            </span>
          </div>
        </div>
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
          style={{
            backgroundColor: isPublic ? "#166534" : "#F5F0E4",
            color: isPublic ? "#FFFFFF" : "#525252"
          }}
        >
          <ShieldCheck size={10} strokeWidth={2.5}/>
          {isPublic ? "Public" : "Private"}
        </span>
      </header>

      {/* Items list */}
      <ul className="mt-4 flex flex-col divide-y" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
        {card.items.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-3 py-3">
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-black text-neutral-900">{item.label}</div>
              {item.detail && (
                <div className="mt-0.5 text-[11px] leading-snug text-neutral-500">
                  {item.detail}
                </div>
              )}
              {item.minimumGbp && (
                <div className="mt-0.5 text-[10.5px] text-neutral-500">
                  Minimum {formatGbp(item.minimumGbp)}
                </div>
              )}
            </div>
            <div className="flex-shrink-0 text-right">
              <div className="text-[16px] font-black text-neutral-900">
                {formatGbp(item.rateGbp)}
              </div>
              <div className="text-[10.5px] text-neutral-500">
                {UNIT_LABEL[item.unit]}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Meta */}
      <div className="mt-4 flex flex-col gap-2 text-[11.5px] text-neutral-600">
        {card.minimumJobGbp && (
          <div className="flex items-start gap-2">
            <PoundSterling size={11} className="mt-0.5 flex-shrink-0 text-neutral-500"/>
            <span>Minimum job value {formatGbp(card.minimumJobGbp)}.</span>
          </div>
        )}
        {card.travelPolicy && (
          <div className="flex items-start gap-2">
            <MapPin size={11} className="mt-0.5 flex-shrink-0 text-neutral-500"/>
            <span>{card.travelPolicy}</span>
          </div>
        )}
        {card.materialsPolicy && (
          <div className="flex items-start gap-2">
            <Info size={11} className="mt-0.5 flex-shrink-0 text-neutral-500"/>
            <span>{card.materialsPolicy}</span>
          </div>
        )}
        <div className="text-[10px] text-neutral-500">
          {card.vatIncluded ? "Prices include VAT." : "Prices exclude VAT."}
          {" "}Last updated {new Date(card.updatedAtIso).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}.
        </div>
      </div>

      {/* Constitution disclaimer — Trade Center never recommends rates */}
      <p className="mt-4 rounded-md bg-neutral-50 p-2.5 text-[10px] leading-snug text-neutral-500">
        Rates published by {card.tradeName.split(" ·")[0]}. Trade Center hosts these rates
        — we do not recommend or set any pricing.
      </p>
    </section>
  );
}
