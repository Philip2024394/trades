"use client";

// src/components/nex-directory/NexDiscoveryCard.tsx
//
// PART C (2026-08-24) · Contextual discovery cards interspersed with the
// accommodation grid. NOT an ad wall · framed as "useful things around your stay".
//
// Doctrine (Philip 2026-08-24):
//   · "Data-driven, not hard-coded advertisements."
//   · "If the underlying data does not exist, build the component
//      architecture without fabricating live offers."
//   · Accommodation → Local discovery → Local services → Transport → Food →
//     Activities → Offers. Accommodation is the DOORWAY into the local economy.
//
// Current NEX data reality:
//   · food_business    → HAS real data · we surface it
//   · transport        → 35 records but ALL businesses/operators not drivers ·
//                        Local Delivery gated behind Individual Driver funnel
//   · motorbike rental → no NEX vertical yet · empty state
//   · laundry/spa/etc  → same
//
// So THIS session's cards are:
//   · "Discover local food"      → LIVE (linked into food directory)
//   · "Local rental & transport" → ARCHITECTURAL · says honestly "coming soon
//                                  · NEX is building the local driver network"
//   · "Local services"           → ARCHITECTURAL · same treatment
//
// Every card can be marked as `live` or `future` at the data-source level ·
// no fake pricing · no fake availability.

import Link from "next/link";

export interface DiscoveryCardData {
  id:           string;
  emoji:        string;
  eyebrow:      string;      // e.g. "USEFUL AROUND YOUR STAY"
  title:        string;      // "Discover local food"
  body:         string;      // "Warungs and cafes near your accommodation."
  href?:        string;      // internal or external · omitted for future-state
  cta?:         string;      // "Explore →"
  state:        "live" | "future"; // future-state cards render dimmed + "coming soon"
  countHint?:   string;      // optional "1,600+ places listed" · MUST be real
}

export function NexDiscoveryCard({ card }: { card: DiscoveryCardData }): React.JSX.Element {
  const inner = (
    <div style={{
      overflow: "hidden", borderRadius: 16,
      background: card.state === "live" ? "linear-gradient(135deg, #fff8f0 0%, #fff 100%)" : "#f7f4ee",
      border: card.state === "live" ? "1px solid rgba(255,120,30,0.18)" : "1px dashed rgba(0,0,0,0.12)",
      padding: 16, minHeight: 172,
      display: "flex", flexDirection: "column", gap: 8,
      transition: "transform .18s ease, box-shadow .18s ease",
      cursor: card.state === "live" && card.href ? "pointer" : "default",
      opacity: card.state === "live" ? 1 : 0.75,
    }}>
      <div style={{ fontSize: 28, lineHeight: 1 }}>{card.emoji}</div>
      <div style={{
        fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase",
        color: card.state === "live" ? "#c2410c" : "#8a8776", fontWeight: 700,
      }}>{card.eyebrow}</div>
      <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.25, color: "#111" }}>
        {card.title}
      </div>
      <div style={{ fontSize: 12, color: "#555", lineHeight: 1.45, flex: 1 }}>
        {card.body}
      </div>
      {card.countHint && (
        <div style={{ fontSize: 11, color: "#888", fontWeight: 500 }}>{card.countHint}</div>
      )}
      {card.state === "live" && card.cta && (
        <div style={{
          fontSize: 12, fontWeight: 700, color: "#c2410c",
          marginTop: 4,
        }}>{card.cta}</div>
      )}
      {card.state === "future" && (
        <div style={{
          fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase",
          color: "#888", fontWeight: 700,
        }}>Coming to NEX</div>
      )}
    </div>
  );
  if (card.state === "live" && card.href) {
    return <Link href={card.href} style={{ display: "block", textDecoration: "none" }}>{inner}</Link>;
  }
  return inner;
}
