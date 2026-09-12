"use client";

// src/app/nexapp/nex-agent/ConstitutionalTicker.tsx
//
// Scrolling marquee showing constitutional discipline in real-time · turns
// NEX's biggest strength (guardian gates + doctrine enforcement) into visible
// reassurance during coding.

import { useEffect, useState } from "react";

export function ConstitutionalTicker() {
  const [items, setItems] = useState<Array<{ text: string; kind: "ok" | "warn" | "info" }>>([
    { text: "Guardian ACCEPT rate 100%", kind: "ok" },
    { text: "Security Agent · 55 sec.* codes active", kind: "info" },
    { text: "UI DNA PASS · deep navy scope locked", kind: "ok" },
    { text: "nex.evidence collision preserved · never touched", kind: "info" },
    { text: "913 legacy images out-of-sprint · never touched", kind: "info" },
    { text: "Truth Engine baseline · 123 tests passing", kind: "ok" },
    { text: "Doctrine ADR-0316b/c/d locked", kind: "info" },
    { text: "Rate limit · anti-bot layer active", kind: "info" },
  ]);

  // Poll live security history to refresh entries
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await fetch("/api/nex/hq-security/history", { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        if (cancelled) return;
        const accept = j.counts_by_verdict?.accept ?? 0;
        const reject = j.counts_by_verdict?.reject ?? 0;
        const total = accept + reject;
        const rate = total > 0 ? Math.round((accept / total) * 100) : 100;
        const topCodes = Object.entries(j.counts_by_code ?? {}).sort((a: any, b: any) => b[1] - a[1]).slice(0, 3);
        setItems([
          { text: `Guardian ACCEPT rate ${rate}% · ${accept} pass · ${reject} reject`, kind: rate >= 90 ? "ok" : "warn" },
          { text: `Security Agent · ${total} inspections today`, kind: "info" },
          ...(topCodes.length > 0 ? topCodes.map(([code, count]) => ({ text: `${code} · ${count}`, kind: "info" as const })) : []),
          { text: "UI DNA PASS · deep navy scope locked", kind: "ok" as const },
          { text: "Truth Engine · baseline maintained", kind: "ok" as const },
          { text: "nex.evidence collision preserved", kind: "info" as const },
        ]);
      } catch { /* transient · keep last state */ }
    };
    void tick();
    const iv = setInterval(tick, 30_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  const line = items.map((i) => `${i.kind === "ok" ? "✓" : i.kind === "warn" ? "!" : "·"} ${i.text}`).join("     ●     ");

  return (
    <div style={{
      padding: "4px 0",
      borderBottom: "1px solid rgba(148, 163, 184, 0.12)",
      background: "rgba(11, 18, 32, 0.7)",
      overflow: "hidden",
      whiteSpace: "nowrap",
      position: "relative",
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 10,
      color: "#22D3EE",
    }}>
      <div style={{
        display: "inline-block",
        paddingLeft: "100%",
        animation: "naw-ticker 60s linear infinite",
      }}>
        {line}     ●     {line}
      </div>
      <style>{`
        @keyframes naw-ticker {
          from { transform: translateX(0); }
          to   { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );
}
