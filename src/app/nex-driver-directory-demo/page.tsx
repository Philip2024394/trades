// src/app/nex-driver-directory-demo/page.tsx
//
// NEX Driver Directory demo · Philip 2026-08-29.
//
// Shows DriverBikeCard rendered on chat surface with:
//   · Live palette picker (change bike color on the fly · super wow)
//   · Bike model switcher (all 50 taxonomy entries)
//   · Simulated chat context so Philip can see the frosted-glass card
//     exception against the typographic chat background
//
// Not a production page · dev-only · reads /nex-bike-taxonomy manifest.

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ProviderBikeCard } from "@/components/nex/ProviderBikeCard";

type Bike = {
  slug: string;
  brand: string;
  model: string;
  year_range: string;
  cc: number;
  category: "matic"|"maxi"|"sport"|"commuter"|"bebek"|"adventure"|"retro"|"electric";
  base_image: string;
  base_color: string;
  common_colors: string[];
};

const PALETTE: { hex: string; name: string }[] = [
  { hex: "#dc2626", name: "Red"       },
  { hex: "#f97316", name: "Orange"    },
  { hex: "#eab308", name: "Yellow"    },
  { hex: "#22c55e", name: "Green"     },
  { hex: "#06b6d4", name: "Cyan"      },
  { hex: "#3b82f6", name: "Blue"      },
  { hex: "#8b5cf6", name: "Purple"    },
  { hex: "#ec4899", name: "Pink"      },
  { hex: "#78350f", name: "Brown"     },
  { hex: "#f5f5dc", name: "Cream"     },
  { hex: "#94a3b8", name: "Silver"    },
  { hex: "#111827", name: "Black"     },
];

// Fake chat messages so the card is shown in-context
const CHAT_LOG = [
  { who: "user", text: "I need a bike ride to Malioboro please" },
  { who: "nex",  text: "Two drivers close to you. Have a look." },
];

export default function DriverDirectoryDemo() {
  const [taxonomy, setTaxonomy] = useState<Bike[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string>("honda-vario-160-red");
  const [paint, setPaint] = useState<string>("#dc2626");
  const [driverName, setDriverName] = useState("Andi");
  const [driverRating, setDriverRating] = useState(4.9);
  const [plate, setPlate] = useState("B 4218 UYE");
  const [secondaryLanguage, setSecondaryLanguage] = useState("English");
  const [providesRaincoat, setProvidesRaincoat] = useState(true);

  useEffect(() => {
    fetch("/nex-bike-taxonomy.json")
      .then((r) => r.json())
      .then((d) => setTaxonomy(d.bikes ?? []))
      .catch(() => setTaxonomy([]));
  }, []);

  const selected = useMemo(() => taxonomy.find((b) => b.slug === selectedSlug), [taxonomy, selectedSlug]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg, #0a0e18 0%, #050810 100%)",
      color: "rgba(245,245,245,0.9)",
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      padding: "24px 16px 60px",
    }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{
          fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase",
          color: "rgba(249,115,22,0.9)", fontWeight: 700, marginBottom: 4,
        }}>NEX Driver Directory · demo</div>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0, letterSpacing: -0.3 }}>
          Bike recolor + chat listing
        </h1>
        <p style={{ fontSize: 13, color: "rgba(245,245,245,0.55)", marginTop: 6, marginBottom: 24 }}>
          Change bike model + paint color · card recolor happens in canvas at runtime · rider gear, tires, chrome stay untouched. This is the frosted-glass exception rendered inside the typographic chat surface.
        </p>

        {/* Chat context */}
        <div style={{
          padding: "24px 20px",
          borderRadius: 20,
          background: "rgba(15,20,30,0.4)",
          border: "1px solid rgba(255,255,255,0.06)",
          marginBottom: 24,
        }}>
          {CHAT_LOG.map((m, i) => (
            <div key={i} style={{
              display: "flex", gap: 12, marginBottom: 14,
              alignItems: "flex-start",
            }}>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: 1.4,
                textTransform: "uppercase",
                color: m.who === "nex" ? "rgba(249,115,22,0.9)" : "rgba(148,163,184,0.9)",
                minWidth: 42, marginTop: 2,
              }}>{m.who}</span>
              <span style={{ fontSize: 15, lineHeight: 1.5, color: "rgba(245,245,245,0.9)" }}>
                {m.text}
              </span>
            </div>
          ))}

          {/* The card, rendered inline in chat */}
          <div style={{ margin: "14px 0" }}>
            {selected && (
              <ProviderBikeCard
                bikeSlug={selected.slug}
                paintHex={paint}
                providerName={driverName}
                providerRating={driverRating}
                plate={plate}
                yearRange={selected.year_range}
                cc={selected.cc}
                category={selected.category}
                brand={selected.brand}
                model={selected.model}
                secondaryLanguage={secondaryLanguage || undefined}
                providesRaincoat={providesRaincoat}
                onSelect={() => alert(`Requested · ${driverName} · ${selected.brand} ${selected.model}`)}
              />
            )}
          </div>
          <div style={{
            fontSize: 12, color: "rgba(148,163,184,0.7)", marginTop: 4, textAlign: "center",
          }}>Tap the card to select this driver.</div>
        </div>

        {/* Controls */}
        <div style={{
          padding: "18px 20px",
          borderRadius: 16,
          background: "rgba(15,20,30,0.55)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 1.4, textTransform: "uppercase",
            color: "rgba(245,245,245,0.55)", marginBottom: 12,
          }}>Recolor bike</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {PALETTE.map((c) => (
              <button
                key={c.hex}
                onClick={() => setPaint(c.hex)}
                title={c.name}
                style={{
                  width: 30, height: 30, borderRadius: 999,
                  background: c.hex, cursor: "pointer",
                  border: paint === c.hex ? "2px solid white" : "1px solid rgba(255,255,255,0.15)",
                  boxShadow: paint === c.hex ? "0 0 0 3px rgba(255,255,255,0.15)" : "none",
                  transition: "transform 120ms ease",
                }}
              />
            ))}
            <input
              type="color"
              value={paint}
              onChange={(e) => setPaint(e.target.value)}
              style={{
                width: 32, height: 32, padding: 0, border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 999, background: "transparent", cursor: "pointer",
              }}
              title="Custom color"
            />
          </div>

          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 1.4, textTransform: "uppercase",
            color: "rgba(245,245,245,0.55)", marginBottom: 8,
          }}>Bike model ({taxonomy.length} available)</div>
          <select
            value={selectedSlug}
            onChange={(e) => setSelectedSlug(e.target.value)}
            style={{
              width: "100%", padding: "10px 12px", fontSize: 14,
              borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.05)", color: "rgba(245,245,245,0.95)",
              marginBottom: 16,
            }}
          >
            {taxonomy.map((b) => (
              <option key={b.slug} value={b.slug} style={{ background: "#0a0e18" }}>
                {b.brand} {b.model} · {b.cc > 0 ? `${b.cc}cc` : "electric"} · {b.category}
              </option>
            ))}
          </select>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <label style={{ fontSize: 11, color: "rgba(245,245,245,0.55)" }}>
              Driver name
              <input value={driverName} onChange={(e) => setDriverName(e.target.value)}
                style={{ width: "100%", padding: "6px 8px", marginTop: 4,
                  borderRadius: 6, border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.05)", color: "rgba(245,245,245,0.95)",
                  fontSize: 13,
                }} />
            </label>
            <label style={{ fontSize: 11, color: "rgba(245,245,245,0.55)" }}>
              Rating
              <input type="number" step="0.1" min="0" max="5"
                value={driverRating} onChange={(e) => setDriverRating(Number(e.target.value))}
                style={{ width: "100%", padding: "6px 8px", marginTop: 4,
                  borderRadius: 6, border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.05)", color: "rgba(245,245,245,0.95)",
                  fontSize: 13,
                }} />
            </label>
            <label style={{ fontSize: 11, color: "rgba(245,245,245,0.55)" }}>
              Plate
              <input value={plate} onChange={(e) => setPlate(e.target.value)}
                style={{ width: "100%", padding: "6px 8px", marginTop: 4,
                  borderRadius: 6, border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.05)", color: "rgba(245,245,245,0.95)",
                  fontSize: 13, fontFamily: "monospace",
                }} />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10, marginTop: 10 }}>
            <label style={{ fontSize: 11, color: "rgba(245,245,245,0.55)" }}>
              Secondary language (beyond Bahasa Indonesia)
              <select value={secondaryLanguage} onChange={(e) => setSecondaryLanguage(e.target.value)}
                style={{ width: "100%", padding: "7px 8px", marginTop: 4,
                  borderRadius: 6, border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.05)", color: "rgba(245,245,245,0.95)",
                  fontSize: 13,
                }}>
                <option value="" style={{ background: "#0a0e18" }}>— none —</option>
                {["English","Mandarin","Japanese","Korean","Arabic","Dutch","German","French","Jawa","Sunda","Batak","Bali"].map((l) => (
                  <option key={l} value={l} style={{ background: "#0a0e18" }}>{l}</option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: 11, color: "rgba(245,245,245,0.55)", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
              <span style={{ marginBottom: 6 }}>Passenger raincoat</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8, height: 32 }}>
                <input type="checkbox" checked={providesRaincoat}
                  onChange={(e) => setProvidesRaincoat(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: "#22c55e" }} />
                <span style={{ fontSize: 13, color: "rgba(245,245,245,0.9)" }}>
                  {providesRaincoat ? "Provided" : "Not provided"}
                </span>
              </div>
            </label>
          </div>
        </div>

        <div style={{ marginTop: 16, fontSize: 11, color: "rgba(148,163,184,0.6)", textAlign: "center" }}>
          {taxonomy.length === 0 && "Loading taxonomy…"}
          {taxonomy.length > 0 && `Taxonomy: ${taxonomy.length} bikes loaded from /nex-bike-taxonomy.json`}
        </div>
      </div>
    </div>
  );
}
