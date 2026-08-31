// src/app/nex-ride-status-demo/page.tsx · Philip 2026-08-29
//
// Demo of RideStatusCard walking through all 7 phases · with driver-bike
// recolor · in chat context.

"use client";

import React, { useEffect, useState } from "react";
import { RideStatusCard, type RideStatusPhase, type RideServiceKind } from "@/components/nex/RideStatusCard";

const PHASES: { phase: RideStatusPhase; eta: number | undefined }[] = [
  { phase: "assigning",  eta: undefined },
  { phase: "confirmed",  eta: 720 },
  { phase: "en_route",   eta: 480 },
  { phase: "nearby",     eta: 150 },
  { phase: "arriving",   eta: 45 },
  { phase: "riding",     eta: undefined },
  { phase: "completed",  eta: undefined },
];

const PALETTE = [
  { hex: "#dc2626", name: "Red" }, { hex: "#f97316", name: "Orange" },
  { hex: "#eab308", name: "Yellow" }, { hex: "#22c55e", name: "Green" },
  { hex: "#3b82f6", name: "Blue" }, { hex: "#8b5cf6", name: "Purple" },
  { hex: "#f5f5dc", name: "Cream" }, { hex: "#111827", name: "Black" },
];

type Bike = { slug: string; brand: string; model: string; cc: number; category: string };

export default function RideStatusDemo() {
  const [phaseIdx, setPhaseIdx] = useState(2);
  const [serviceKind, setServiceKind] = useState<RideServiceKind>("ride");
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [bikes, setBikes] = useState<Bike[]>([]);
  const [bikeSlug, setBikeSlug] = useState("honda-vario-160-red");
  const [paintHex, setPaintHex] = useState("#22c55e");
  const current = PHASES[phaseIdx];

  useEffect(() => {
    fetch("/api/nex/bike-models").then((r) => r.json()).then((d) => setBikes(d.bikes ?? []));
  }, []);

  useEffect(() => {
    if (!autoAdvance) return;
    const t = setInterval(() => {
      setPhaseIdx((i) => (i + 1) % PHASES.length);
    }, 4000);
    return () => clearInterval(t);
  }, [autoAdvance]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#ffffff",
      color: "#0a0e18",
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      padding: "24px 16px 60px",
    }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{
          fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase",
          color: "rgba(249,115,22,0.9)", fontWeight: 700, marginBottom: 4,
        }}>NEX ride status · demo</div>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0, letterSpacing: -0.3 }}>
          Cinematic booking-status card
        </h1>
        <p style={{ fontSize: 13, color: "#6b7280", marginTop: 6, marginBottom: 20 }}>
          Walk through the 7 phases · bike bobs, dust puffs behind rear wheel, speed lines when close. Bike model + color come from driver&apos;s registered profile · recolor happens live in canvas.
        </p>

        {/* Card */}
        <div style={{ marginBottom: 24 }}>
          <RideStatusCard
            phase={current.phase}
            serviceKind={serviceKind}
            driverFirstName="Andi"
            plate="B 4218 UYE"
            etaSeconds={current.eta}
            bikeSlug={serviceKind === "food" ? undefined : bikeSlug}
            paintHex={serviceKind === "food" ? undefined : paintHex}
            onTap={() => alert(`Phase: ${current.phase}`)}
          />
        </div>

        {/* Phase stepper */}
        <div style={{
          padding: "16px 18px", borderRadius: 14,
          background: "#f9fafb",
          border: "1px solid #e5e7eb",
          marginBottom: 12,
        }}>
          <div style={{
            fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase",
            color: "#6b7280", marginBottom: 10,
          }}>Phase</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {PHASES.map((p, i) => (
              <button key={p.phase} onClick={() => setPhaseIdx(i)} style={{
                padding: "6px 11px", fontSize: 12, fontWeight: 600,
                borderRadius: 999, cursor: "pointer",
                background: i === phaseIdx ? "#f97316" : "#ffffff",
                color: i === phaseIdx ? "#ffffff" : "#0a0e18",
                border: i === phaseIdx ? "1px solid #f97316" : "1px solid #e5e7eb",
                boxShadow: i === phaseIdx ? "0 4px 12px rgba(249,115,22,0.28)" : "0 1px 3px rgba(0,0,0,0.06)",
              }}>{p.phase}</button>
            ))}
          </div>
          <label style={{
            display: "flex", alignItems: "center", gap: 8,
            marginTop: 12, fontSize: 12, color: "#4b5563",
          }}>
            <input type="checkbox" checked={autoAdvance} onChange={(e) => setAutoAdvance(e.target.checked)}
              style={{ accentColor: "#f97316" }} />
            Auto-advance every 4s (watch the sequence)
          </label>
        </div>

        {/* Service kind */}
        <div style={{
          padding: "16px 18px", borderRadius: 14,
          background: "#f9fafb",
          border: "1px solid #e5e7eb",
          marginBottom: 12,
        }}>
          <div style={{
            fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase",
            color: "#6b7280", marginBottom: 10,
          }}>Service kind</div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["ride","parcel","food"] as RideServiceKind[]).map((k) => (
              <button key={k} onClick={() => setServiceKind(k)} style={{
                padding: "6px 14px", fontSize: 12, fontWeight: 600,
                borderRadius: 8, cursor: "pointer", textTransform: "capitalize",
                background: k === serviceKind ? "#f97316" : "#ffffff",
                color: k === serviceKind ? "#ffffff" : "#0a0e18",
                border: k === serviceKind ? "1px solid #f97316" : "1px solid #e5e7eb",
                boxShadow: k === serviceKind ? "0 4px 12px rgba(249,115,22,0.28)" : "0 1px 3px rgba(0,0,0,0.06)",
              }}>{k}</button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 8 }}>
            Ride/parcel → uses taxonomy bike + recolor. Food → uses static food-delivery bike (no motion, no recolor).
          </div>
        </div>

        {/* Bike + paint */}
        {serviceKind !== "food" && (
          <div style={{
            padding: "16px 18px", borderRadius: 14,
            background: "rgba(15,20,30,0.55)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}>
            <div style={{
              fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase",
              color: "#6b7280", marginBottom: 10,
            }}>Driver&apos;s bike + paint</div>
            <select value={bikeSlug} onChange={(e) => setBikeSlug(e.target.value)}
              style={{
                width: "100%", padding: "9px 10px", fontSize: 14,
                borderRadius: 8, border: "1px solid #e5e7eb",
                background: "#ffffff", color: "#0a0e18",
                marginBottom: 12,
              }}>
              {bikes.map((b) => (
                <option key={b.slug} value={b.slug} style={{ background: "#0a0e18" }}>
                  {b.brand} {b.model} · {b.cc > 0 ? `${b.cc}cc` : "electric"} · {b.category}
                </option>
              ))}
            </select>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {PALETTE.map((c) => (
                <button key={c.hex} onClick={() => setPaintHex(c.hex)} title={c.name}
                  style={{
                    width: 30, height: 30, borderRadius: 999,
                    background: c.hex, cursor: "pointer",
                    border: paintHex === c.hex ? "2px solid #0a0e18" : "1px solid #d1d5db",
                    boxShadow: paintHex === c.hex ? "0 0 0 3px rgba(10,14,24,0.12)" : "0 1px 2px rgba(0,0,0,0.08)",
                  }}
                />
              ))}
              <input type="color" value={paintHex} onChange={(e) => setPaintHex(e.target.value)}
                style={{ width: 32, height: 32, padding: 0, borderRadius: 999,
                  border: "1px solid #d1d5db", background: "transparent", cursor: "pointer" }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
