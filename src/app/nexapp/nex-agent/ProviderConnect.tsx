"use client";

// src/app/nexapp/nex-agent/ProviderConnect.tsx
//
// Header-level provider connect dropdown + modal wizard.
// Founder picks a backend provider (Supabase · Firebase · Neon · etc.) ·
// clicks Connect · follows the step-by-step wizard · then "Send to NEX1"
// composes a prompt so NEX1 scaffolds every file.

import { useState } from "react";
import {
  PROVIDER_CATALOG,
  providersByCategory,
  providerById,
  type DatabaseProvider,
} from "@/lib/nex-agent/provider-catalog";

export interface ProviderConnectProps {
  readonly onSendToNex: (prompt: string) => void;
}

export function ProviderConnect({ onSendToNex }: ProviderConnectProps) {
  const [selectedId, setSelectedId] = useState<string>("");
  const [wizardOpen, setWizardOpen] = useState<boolean>(false);

  const selected = selectedId ? providerById(selectedId) : null;
  const groups = providersByCategory();

  return (
    <>
      <div className="naw-provider-picker">
        <span className="naw-provider-picker-label">Provider</span>
        <select
          className="naw-provider-select"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          <option value="">— Choose backend/DB —</option>
          {groups.map((g) => (
            <optgroup key={g.category} label={g.label}>
              {g.providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.icon} {p.brand} · {p.name}{p.featured ? " ★" : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <button
          type="button"
          className="naw-provider-connect-btn"
          onClick={() => setWizardOpen(true)}
          disabled={!selected}
          title={selected ? `Open ${selected.name} connect wizard` : "Pick a provider first"}
          style={selected ? undefined : { opacity: 0.4, cursor: "not-allowed" }}
        >Connect →</button>
      </div>

      {wizardOpen && selected && (
        <ProviderWizard
          provider={selected}
          onClose={() => setWizardOpen(false)}
          onSendToNex={(p) => { onSendToNex(p); setWizardOpen(false); }}
        />
      )}
    </>
  );
}

function ProviderWizard({
  provider,
  onClose,
  onSendToNex,
}: {
  provider: DatabaseProvider;
  onClose: () => void;
  onSendToNex: (prompt: string) => void;
}) {
  const [stepIdx, setStepIdx] = useState<number>(0);
  const step = provider.steps[stepIdx];

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-label={`Connect ${provider.name}`}
      style={{
        position: "fixed", inset: 0, zIndex: 250,
        background: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(6px)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        paddingTop: "8vh",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(680px, 92vw)",
          background: "rgba(11, 18, 32, 0.98)",
          border: "1px solid rgba(34, 211, 238, 0.4)",
          borderRadius: 16,
          boxShadow: "0 40px 90px rgba(0, 0, 0, 0.65)",
          overflow: "hidden",
          maxHeight: "84vh",
          display: "flex", flexDirection: "column",
          color: "#F9FAFB",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        {/* Header · icon · brand · tagline · close */}
        <div style={{ padding: 16, borderBottom: "1px solid rgba(148, 163, 184, 0.16)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 12,
            background: "linear-gradient(180deg, rgba(34,211,238,0.16), rgba(249,115,22,0.06))",
            border: "1px solid rgba(34, 211, 238, 0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24, color: "#22D3EE",
            boxShadow: "0 0 12px rgba(34, 211, 238, 0.25)",
          }}>{provider.icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "#22D3EE", fontWeight: 700 }}>
              Connect · {provider.brand}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{provider.name}</div>
            <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>{provider.tagline}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent", border: "1px solid rgba(148, 163, 184, 0.28)",
              borderRadius: 8, color: "#94A3B8", cursor: "pointer",
              padding: "6px 10px", fontSize: 12,
            }}
            aria-label="Close wizard"
          >Close ✕</button>
        </div>

        {/* Progress dots */}
        <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(148, 163, 184, 0.1)", display: "flex", alignItems: "center", gap: 8 }}>
          {provider.steps.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStepIdx(i)}
              aria-label={`Step ${i + 1}`}
              style={{
                width: i === stepIdx ? 24 : 8, height: 8,
                borderRadius: 4,
                background: i === stepIdx ? "#22D3EE" : i < stepIdx ? "rgba(34, 197, 94, 0.65)" : "rgba(148, 163, 184, 0.25)",
                border: "none",
                cursor: "pointer",
                transition: "all 0.2s ease",
                padding: 0,
              }}
            />
          ))}
          <span style={{ marginLeft: "auto", fontSize: 10, color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace" }}>
            Step {stepIdx + 1} of {provider.steps.length}
          </span>
        </div>

        {/* Body · scrolls */}
        <div style={{ overflow: "auto", flex: 1, padding: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#F9FAFB", marginBottom: 6 }}>
            {step.title}
          </div>
          <div style={{ fontSize: 12, color: "#F9FAFB", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
            {step.body}
          </div>
          {step.ctaUrl && (
            <a
              href={step.ctaUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                marginTop: 10, padding: "6px 12px",
                background: "linear-gradient(180deg, #F97316, #EA580C)",
                color: "white", borderRadius: 8,
                fontSize: 12, fontWeight: 700,
                textDecoration: "none", letterSpacing: "0.04em", textTransform: "uppercase",
              }}
            >{step.ctaLabel ?? "Open"} ↗</a>
          )}

          {/* On the last step · show env vars + install command + pricing */}
          {stepIdx === provider.steps.length - 1 && (
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div className="naw-side-label" style={{ marginBottom: 6 }}>Install command</div>
                <pre style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(148, 163, 184, 0.2)", borderRadius: 6, padding: 10, fontSize: 11, color: "#22D3EE", fontFamily: "'JetBrains Mono', monospace", margin: 0, overflowX: "auto" }}>
                  {provider.installCommand}
                </pre>
              </div>
              <div>
                <div className="naw-side-label" style={{ marginBottom: 6 }}>Environment variables · add to .env.local (never commit)</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {provider.envVars.map((e) => (
                    <div key={e.name} style={{
                      background: "rgba(0,0,0,0.3)",
                      border: `1px solid ${e.secret ? "rgba(239, 68, 68, 0.35)" : "rgba(148, 163, 184, 0.18)"}`,
                      borderRadius: 6, padding: "8px 10px",
                    }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        <code style={{ color: "#22D3EE", fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                          {e.name}
                        </code>
                        {e.secret && (
                          <span style={{
                            fontSize: 8, textTransform: "uppercase", letterSpacing: "0.06em",
                            background: "rgba(239, 68, 68, 0.15)", color: "#EF4444",
                            border: "1px solid rgba(239, 68, 68, 0.35)",
                            borderRadius: 4, padding: "1px 6px", fontWeight: 800,
                          }}>secret · server-only</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 4 }}>{e.description}</div>
                      {e.example && (
                        <div style={{ fontSize: 10, color: "#64748B", fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>
                          example: {e.example}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#94A3B8" }}>
                <span style={{ fontWeight: 700, color: "var(--naw-success, #22C55E)" }}>💰</span>
                <span>{provider.pricing}</span>
              </div>
              <a href={provider.docsUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#22D3EE" }}>
                Full docs · {provider.docsUrl.replace(/^https?:\/\//, "").slice(0, 60)}
              </a>
            </div>
          )}
        </div>

        {/* Footer · prev / next / send-to-nex */}
        <div style={{ padding: 14, borderTop: "1px solid rgba(148, 163, 184, 0.16)", display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={() => setStepIdx((n) => Math.max(0, n - 1))}
            disabled={stepIdx === 0}
            className="naw-btn-secondary"
            style={{ opacity: stepIdx === 0 ? 0.4 : 1 }}
          >← Prev</button>
          {stepIdx < provider.steps.length - 1 ? (
            <button
              type="button"
              onClick={() => setStepIdx((n) => Math.min(provider.steps.length - 1, n + 1))}
              className="naw-btn-primary"
              style={{ marginLeft: "auto" }}
            >Next →</button>
          ) : (
            <button
              type="button"
              onClick={() => onSendToNex(provider.promptTemplate)}
              className="naw-btn-primary"
              style={{ marginLeft: "auto" }}
            >Send to NEX1 ↗</button>
          )}
        </div>
      </div>
    </div>
  );
}
