// src/components/nex-head-quarters/WorkMapHeroCard.tsx
//
// Prominent hero card that appears at the top of the HQ Reception page.
// Founder clicks this to reach the Master Work & Architecture Map.
//
// Reads the JSON canonical source · surfaces active-build + next-best so
// the founder sees NEX's current pulse before diving in.

import Link from "next/link";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Map as MapIcon, ArrowRight, Activity, Zap } from "lucide-react";

interface Capability {
  id: string;
  name: string;
  status: string;
  build_sequence_number: number | null;
  impact_score: number;
  impact_boost_to: string[];
  is_currently_building: boolean;
  retro_benefits_available: unknown[];
}

interface WorkMapSummary {
  map_version: string;
  last_updated: string;
  active_build: string | null;
  next_suggested_build: string | null;
  capabilities: Capability[];
}

async function loadSummary(): Promise<WorkMapSummary | null> {
  try {
    const filePath = join(process.cwd(), "docs", "nex-work-map.json");
    const raw = await readFile(filePath, "utf8");
    const map = JSON.parse(raw) as WorkMapSummary;
    return map;
  } catch {
    return null;
  }
}

export default async function WorkMapHeroCard() {
  const summary = await loadSummary();
  if (!summary) return null;

  const active = summary.capabilities.find((c) => c.id === summary.active_build);
  const next = summary.capabilities.find((c) => c.id === summary.next_suggested_build);
  const total = summary.capabilities.length;
  const activeCount = summary.capabilities.filter((c) => c.status === "ACTIVE").length;
  const retroCount = summary.capabilities.reduce(
    (n, c) => n + (c.retro_benefits_available?.length ?? 0),
    0,
  );

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes wm-hero-heartbeat {
            0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.6); }
            25%      { transform: scale(1.12); box-shadow: 0 0 0 10px rgba(239, 68, 68, 0.3); }
            50%      { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
            75%      { transform: scale(1.08); box-shadow: 0 0 0 6px rgba(239, 68, 68, 0.2); }
          }
          @keyframes wm-hero-glow {
            0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.35); }
            50%      { box-shadow: 0 0 0 12px rgba(16, 185, 129, 0); }
          }
          .wm-heart { animation: wm-hero-heartbeat 1.4s ease-in-out infinite; }
          .wm-glow  { animation: wm-hero-glow 2.4s ease-in-out infinite; }
        `,
      }} />
      <Link
        href="/nex-head-quarters/work-map"
        style={{ textDecoration: "none" }}
      >
        <div
          style={{
            margin: "16px 24px 0 24px",
            padding: "18px 24px",
            borderRadius: 14,
            background:
              "linear-gradient(90deg, #ecfdf5 0%, #d1fae5 50%, #a7f3d0 100%)",
            border: "3px solid #10b981",
            boxShadow: "0 4px 16px rgba(16, 185, 129, 0.2)",
            display: "grid",
            gridTemplateColumns: "auto 1fr auto",
            alignItems: "center",
            gap: 20,
            cursor: "pointer",
          }}
          className="wm-glow"
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 14,
              background: "#059669",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MapIcon size={36} strokeWidth={2.2} />
          </div>

          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.18em",
                color: "#065f46",
                fontWeight: 800,
                textTransform: "uppercase",
              }}
            >
              NEX Master Work & Architecture Map
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
                color: "#064e3b",
                marginTop: 2,
                letterSpacing: "-0.01em",
              }}
            >
              Click here to see NEX's live progress
            </div>

            <div
              style={{
                marginTop: 10,
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                fontSize: 12,
              }}
            >
              {active && (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    background: "#ffffff",
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid #fca5a5",
                  }}
                >
                  <span
                    className="wm-heart"
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      background: "#dc2626",
                      color: "#ffffff",
                      fontSize: 12,
                      fontWeight: 800,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {active.build_sequence_number}
                  </span>
                  <span style={{ color: "#7f1d1d" }}>
                    <Activity size={11} style={{ display: "inline", marginRight: 2 }} strokeWidth={2.5} />
                    <strong>Building now:</strong> {active.name}
                  </span>
                </div>
              )}
              {next && (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    background: "#ffffff",
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid #6ee7b7",
                  }}
                >
                  <span
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      background: "#059669",
                      color: "#ffffff",
                      fontSize: 12,
                      fontWeight: 800,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {next.build_sequence_number}
                  </span>
                  <span style={{ color: "#064e3b" }}>
                    <Zap size={11} style={{ display: "inline", marginRight: 2 }} strokeWidth={2.5} />
                    <strong>Next best:</strong> {next.name}
                  </span>
                </div>
              )}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: "#ffffff",
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                  color: "#374151",
                }}
              >
                <strong>{activeCount}</strong>/{total} capabilities active
              </div>
              {retroCount > 0 && (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: "#fef2f2",
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid #fca5a5",
                    color: "#991b1b",
                    fontWeight: 700,
                  }}
                >
                  🔴 {retroCount} retro-benefit{retroCount > 1 ? "s" : ""} available
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: "#065f46",
              fontWeight: 800,
              fontSize: 14,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              whiteSpace: "nowrap",
            }}
          >
            Open map <ArrowRight size={18} strokeWidth={2.5} />
          </div>
        </div>
      </Link>
    </>
  );
}
