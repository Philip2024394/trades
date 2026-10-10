"use client";

// src/app/nexapp/nex-agent/PluginsPanel.tsx
//
// Plugins panel · replaces the Code feed when the Plugins tab is selected.
// Grid of square plugin buttons · click one → detail card with description +
// benefits + [Add] and [Close] buttons.
//   - Add · composes a prompt for NEX1 to integrate the plugin
//   - Close · flips back to the grid

import { useState } from "react";
import {
  PLUGIN_CATALOG, pluginsByCategory, categoryLabel,
  type Plugin, type PluginCategory,
} from "@/lib/nex-agent/plugin-catalog";

export interface PluginsPanelProps {
  readonly onAdd: (plugin: Plugin) => void;
}

export function PluginsPanel({ onAdd }: PluginsPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<PluginCategory | "all">("all");

  const selected = selectedId ? PLUGIN_CATALOG.find((p) => p.id === selectedId) ?? null : null;
  const grouped = pluginsByCategory();
  const filteredGroups = categoryFilter === "all" ? grouped : grouped.filter((g) => g.category === categoryFilter);
  const totalCount = filteredGroups.reduce((n, g) => n + g.plugins.length, 0);

  if (selected) {
    return (
      <div className="naw-plugin-detail">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <div className="naw-plugin-detail-icon" title={selected.brand}>{selected.icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--naw-cyan, #22D3EE)", fontWeight: 700 }}>
              {selected.brand} · {categoryLabel(selected.category)}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--naw-soft-white, #F9FAFB)" }}>{selected.name}</div>
            <div style={{ fontSize: 11, color: "var(--naw-slate, #94A3B8)", marginTop: 2 }}>{selected.tagline}</div>
          </div>
          <span className={`naw-plugin-complexity-chip complexity-${selected.setupComplexity}`}>{selected.setupComplexity} setup</span>
        </div>

        <div className="naw-plugin-description">{selected.description}</div>

        <div style={{ marginTop: 12 }}>
          <div className="naw-side-label">Benefits</div>
          <ul className="naw-plugin-benefits">
            {selected.benefits.map((b, i) => (
              <li key={i} className="naw-plugin-benefit-item">
                <span className="naw-plugin-benefit-tick">✓</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>

        <div style={{ marginTop: 12 }}>
          <div className="naw-side-label">Recommended for</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {selected.recommendedFor.map((r) => (
              <span key={r} className="naw-plugin-recommended-chip">{r}</span>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
          <button
            type="button"
            className="naw-btn-primary"
            style={{ flex: 1 }}
            onClick={() => { onAdd(selected); setSelectedId(null); }}
          >➕ Add to project</button>
          <button
            type="button"
            className="naw-btn-secondary"
            onClick={() => setSelectedId(null)}
            style={{ flex: 1 }}
          >← Close</button>
        </div>

        <div style={{ marginTop: 10, fontSize: 9, color: "var(--naw-slate, #94A3B8)", fontFamily: "'JetBrains Mono', monospace" }}>
          "Add" composes a prompt for NEX1 · Master AI Engineer + Claude review · Security Agent scans before commit · no keys installed on your behalf
        </div>
      </div>
    );
  }

  return (
    <div className="naw-plugins-panel">
      <div className="naw-plugins-header">
        <span style={{ fontSize: 11, color: "var(--naw-slate, #94A3B8)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
          {totalCount} plugins · founder-vetted for world-class apps
        </span>
      </div>

      <div className="naw-plugin-filters">
        <button
          type="button"
          className={`naw-screen-tiny-btn ${categoryFilter === "all" ? "active-filter" : ""}`}
          onClick={() => setCategoryFilter("all")}
          style={categoryFilter === "all" ? { background: "rgba(34,211,238,0.16)", color: "var(--naw-cyan)" } : undefined}
        >all</button>
        {grouped.map((g) => (
          <button
            key={g.category}
            type="button"
            className={`naw-screen-tiny-btn ${categoryFilter === g.category ? "active-filter" : ""}`}
            onClick={() => setCategoryFilter(g.category)}
            style={categoryFilter === g.category ? { background: "rgba(34,211,238,0.16)", color: "var(--naw-cyan)" } : undefined}
            title={g.label}
          >{g.label.split(" · ")[0]}</button>
        ))}
      </div>

      {filteredGroups.map((group) => (
        <div key={group.category} className="naw-plugins-group">
          <div className="naw-plugins-group-header">
            <span>{group.label}</span>
            <span style={{ color: "var(--naw-slate, #94A3B8)", fontFamily: "'JetBrains Mono', monospace" }}>{group.plugins.length}</span>
          </div>
          <div className="naw-plugins-grid">
            {group.plugins.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedId(p.id)}
                className={`naw-plugin-btn ${p.featured ? "featured" : ""}`}
                title={p.tagline}
              >
                <span className="naw-plugin-btn-icon" aria-hidden="true">{p.icon}</span>
                <span className="naw-plugin-btn-name">{p.name}</span>
                <span className="naw-plugin-btn-brand">{p.brand}</span>
                {p.featured && <span className="naw-plugin-btn-star" title="Featured">★</span>}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div style={{ marginTop: 10, fontSize: 9, color: "var(--naw-slate, #94A3B8)", fontFamily: "'JetBrains Mono', monospace", textAlign: "center" }}>
        Click any plugin to read what it does · then Add or Close
      </div>
    </div>
  );
}
