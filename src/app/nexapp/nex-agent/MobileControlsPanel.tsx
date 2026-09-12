"use client";

// src/app/nexapp/nex-agent/MobileControlsPanel.tsx
//
// Mobile controls moved from the top preview strip into the far-left sidebar.
// This gives the LEFT preview its FULL height. Sidebar section is collapsible.

import type { PhoneModel } from "@/lib/nex-agent/phone-models";
import { BEZEL_COLORS, groupedModels, customBezelColor } from "@/lib/nex-agent/phone-models";
import { useState } from "react";

export interface MobileControlsPanelProps {
  readonly phoneModelId: string;
  readonly setPhoneModelId: (id: string) => void;
  readonly customMobile: { w: number; h: number };
  readonly setCustomMobile: (v: { w: number; h: number }) => void;
  readonly showBezel: boolean;
  readonly setShowBezel: (v: boolean) => void;
  readonly bezelColorId: string;
  readonly setBezelColorId: (v: string) => void;
  readonly useCustomBezel: boolean;
  readonly setUseCustomBezel: (v: boolean) => void;
  readonly customBezelHex: string;
  readonly setCustomBezelHex: (v: string) => void;
  readonly showCutoutOutline: boolean;
  readonly setShowCutoutOutline: (v: boolean) => void;
  readonly visible: boolean;   // only render when viewport === "mobile"
}

export function MobileControlsPanel(p: MobileControlsPanelProps) {
  const [expanded, setExpanded] = useState<boolean>(true);
  if (!p.visible) return null;
  return (
    <section className="naw-side-section">
      <button
        type="button"
        className="naw-side-section-header"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className="naw-side-section-icon" style={{ color: "#F97316" }}>◧</span>
        <span className="naw-side-section-title">Mobile Frame</span>
        <span className="naw-side-section-toggle">{expanded ? "▼" : "▶"}</span>
      </button>
      {expanded && (
        <div className="naw-side-section-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>

          <div>
            <div className="naw-side-label">Model</div>
            <select
              className="naw-mobile-select"
              style={{ width: "100%" }}
              value={p.phoneModelId}
              onChange={(e) => p.setPhoneModelId(e.target.value)}
            >
              {groupedModels().map(({ brand, models }) => (
                <optgroup key={brand} label={brand}>
                  {models.map((m: PhoneModel) => (
                    <option key={m.id} value={m.id}>{m.name} · {m.width}×{m.height}</option>
                  ))}
                </optgroup>
              ))}
              <option value="custom">Custom dimensions →</option>
            </select>
          </div>

          {p.phoneModelId === "custom" && (
            <div>
              <div className="naw-side-label">Custom W × H</div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="number"
                  className="naw-mobile-dim-input"
                  style={{ flex: 1 }}
                  value={p.customMobile.w}
                  min={100} max={2000}
                  onChange={(e) => p.setCustomMobile({ ...p.customMobile, w: Math.max(100, Math.min(2000, Number(e.target.value) || 390)) })}
                />
                <span style={{ color: "var(--naw-slate)" }}>×</span>
                <input
                  type="number"
                  className="naw-mobile-dim-input"
                  style={{ flex: 1 }}
                  value={p.customMobile.h}
                  min={100} max={4000}
                  onChange={(e) => p.setCustomMobile({ ...p.customMobile, h: Math.max(100, Math.min(4000, Number(e.target.value) || 844)) })}
                />
              </div>
            </div>
          )}

          <div>
            <label className={`naw-mobile-toggle ${p.showBezel ? "on" : ""}`} style={{ width: "100%", justifyContent: "center" }}>
              <input type="checkbox" checked={p.showBezel} onChange={(e) => p.setShowBezel(e.target.checked)} />
              {p.showBezel ? "◧ Frame ON" : "◧ Frame OFF"}
            </label>
          </div>

          {p.showBezel && (
            <div>
              <div className="naw-side-label">Color</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                {BEZEL_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`naw-bezel-swatch ${!p.useCustomBezel && p.bezelColorId === c.id ? "selected" : ""}`}
                    style={{ background: c.outer, width: "100%", aspectRatio: "1/1" }}
                    onClick={() => { p.setUseCustomBezel(false); p.setBezelColorId(c.id); }}
                    aria-label={`Bezel color · ${c.label}`}
                    title={c.label}
                  />
                ))}
                <label
                  className={`naw-bezel-swatch ${p.useCustomBezel ? "selected" : ""}`}
                  style={{
                    background: p.useCustomBezel ? customBezelColor(p.customBezelHex).outer : "conic-gradient(from 0deg, #ef4444, #f59e0b, #22c55e, #22d3ee, #a855f7, #ef4444)",
                    position: "relative",
                    cursor: "pointer",
                    width: "100%", aspectRatio: "1/1",
                  }}
                  title={`Custom color · ${p.customBezelHex.toUpperCase()}`}
                >
                  <input
                    type="color"
                    value={p.customBezelHex}
                    onChange={(e) => { p.setCustomBezelHex(e.target.value); p.setUseCustomBezel(true); }}
                    style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }}
                    aria-label="Pick custom bezel color"
                  />
                  <span style={{
                    position: "absolute", inset: 0, display: "flex",
                    alignItems: "center", justifyContent: "center",
                    fontSize: 12, color: "#fff", textShadow: "0 0 3px rgba(0,0,0,0.8)",
                    pointerEvents: "none",
                  }}>◈</span>
                </label>
              </div>
            </div>
          )}

          <div>
            <label className={`naw-mobile-toggle ${p.showCutoutOutline ? "on" : ""}`} style={{ width: "100%", justifyContent: "center" }} title="Show red outline of the camera/notch cutout">
              <input type="checkbox" checked={p.showCutoutOutline} onChange={(e) => p.setShowCutoutOutline(e.target.checked)} />
              {p.showCutoutOutline ? "◈ Cutout ON" : "◈ Cutout OFF"}
            </label>
          </div>
        </div>
      )}
    </section>
  );
}
