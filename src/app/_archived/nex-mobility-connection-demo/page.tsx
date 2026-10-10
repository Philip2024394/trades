// src/app/nex-mobility-connection-demo/page.tsx · Philip 2026-08-29
//
// Demo of the NEX Mobility Connection State Machine.
// Replaces /nex-ride-status-demo (deprecated).

"use client";

import React, { useEffect, useState } from "react";
import { MobilityConnection } from "@/components/nex/mobility/MobilityConnection";
import type { MobilityLiveMode } from "@/lib/nex/mobility/useRealVsEstimated";

function ensureDeviceId(): string {
  if (typeof window === "undefined") return "device:preview-ssr";
  let id = localStorage.getItem("nex_device_id");
  if (!id || !id.startsWith("device:")) {
    id = "device:" + (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2));
    localStorage.setItem("nex_device_id", id);
  }
  return id;
}

export default function MobilityConnectionDemoPage() {
  const [learnerRef, setLearnerRef] = useState<string>("");
  const [liveMode, setLiveMode] = useState<MobilityLiveMode>("off");

  useEffect(() => { setLearnerRef(ensureDeviceId()); }, []);

  return (
    <div style={{
      minHeight: "100dvh",
      background: "#ffffff",
      color: "#0a0e18",
      fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, Segoe UI, Roboto, sans-serif",
      paddingTop:    "max(env(safe-area-inset-top), 16px)",
      paddingBottom: "max(env(safe-area-inset-bottom), 40px)",
    }}>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "0 4px" }}>
        {learnerRef && (
          <MobilityConnection
            learnerRef={learnerRef}
            city="Yogyakarta"
            liveMode={liveMode}
          />
        )}
      </div>

      {/* Dev-only live-mode toggle · outside the state machine surface */}
      <div style={{
        position: "fixed", bottom: 12, right: 12,
        background: "#0a0e18", color: "#fff",
        padding: "8px 12px", borderRadius: 10,
        fontSize: 11, letterSpacing: 0.5,
        display: "flex", alignItems: "center", gap: 8,
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
      }}>
        <span style={{ opacity: 0.6 }}>live mode:</span>
        {(["off","demo-live"] as MobilityLiveMode[]).map((m) => (
          <button key={m} onClick={() => setLiveMode(m)}
            style={{
              padding: "4px 8px", fontSize: 10, fontWeight: 700,
              background: liveMode === m ? "#f97316" : "transparent",
              color: liveMode === m ? "#fff" : "#94a3b8",
              border: `1px solid ${liveMode === m ? "#f97316" : "#334155"}`,
              borderRadius: 6, cursor: "pointer", textTransform: "uppercase",
            }}>{m}</button>
        ))}
      </div>
    </div>
  );
}
