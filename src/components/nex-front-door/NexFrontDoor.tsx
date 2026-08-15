// NEX Front Door · client component (Philip 2026-08-14 · Phase 18).
//
// The intelligent entry surface at /nex-app. Light conversational welcome
// PLUS two obvious buttons so nobody gets lost. Free-text intent goes
// through /api/nex-app/intent for rule-based classification.
//
// Constitutional rules:
//   - Buttons ALWAYS visible · they guarantee deterministic routing
//   - Conversational input is a convenience layer over the buttons
//   - Ambiguous input → NEX says so honestly, doesn't guess
//   - "Powered by NEX™" not shown here · this IS NEX's front door

"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

type Turn =
  | { role: "nex"; text: string; route?: string | null }
  | { role: "you"; text: string };

export function NexFrontDoor() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([
    { role: "nex", text: "Welcome to NEX. What are you looking for?" }
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [turns, busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    setInput("");
    setTurns((h) => [...h, { role: "you", text }]);
    try {
      const res = await fetch("/api/nex-app/intent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text })
      }).then((r) => r.json());
      setTurns((h) => [...h, { role: "nex", text: res.message ?? "Pick one of the buttons below.", route: res.route }]);
      if (res.route) {
        // Small delay so the reply is readable before navigating
        setTimeout(() => router.push(res.route), 800);
      }
    } catch {
      setTurns((h) => [...h, { role: "nex", text: "Network hiccup · pick one of the buttons below." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Conversational surface */}
      <div ref={scrollRef} style={{ maxHeight: 260, overflowY: "auto", padding: "8px 0", marginBottom: 14 }}>
        {turns.map((t, i) => (
          <div key={i} style={{ display: "flex", justifyContent: t.role === "you" ? "flex-end" : "flex-start", marginBottom: 8 }}>
            <div style={{
              background: t.role === "you" ? "#F97316" : "#f4f4f5",
              color: t.role === "you" ? "#fff" : "#1a1a1a",
              padding: "8px 12px",
              borderRadius: 10,
              maxWidth: "80%",
              fontSize: 14,
              whiteSpace: "pre-wrap"
            }}>{t.text}</div>
          </div>
        ))}
        {busy && <div style={{ padding: "4px 0", fontSize: 12, color: "#9ca3af" }}>NEX is thinking…</div>}
      </div>

      {/* Free-text input */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <input
          data-testid="nex-front-door-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          placeholder="Tell NEX what you're looking for…"
          disabled={busy}
          style={{ flex: 1, padding: "12px 14px", fontSize: 15, border: "1px solid #d4d4d4", borderRadius: 10, outline: "none" }}
        />
        <button
          onClick={send}
          disabled={busy || !input.trim()}
          style={{ padding: "12px 22px", fontSize: 15, fontWeight: 600, background: "#1a1a1a", color: "#fff", border: "none", borderRadius: 10, cursor: busy ? "wait" : "pointer" }}
        >
          Ask
        </button>
      </div>

      {/* Buttons · guarantee deterministic routing */}
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
        <button
          onClick={() => router.push("/nex-app/discover")}
          data-testid="nex-front-door-customer"
          style={{ padding: "18px 20px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, cursor: "pointer", textAlign: "left" }}
        >
          <div style={{ fontSize: 24, marginBottom: 4 }}>💬</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a" }}>Find a business / talk to a business</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Browse or chat with a business already on NEX.</div>
        </button>
        <button
          onClick={() => router.push("/nex-app/app-builder")}
          data-testid="nex-front-door-owner"
          style={{ padding: "18px 20px", background: "#F97316", border: "1px solid #F97316", borderRadius: 12, cursor: "pointer", textAlign: "left", color: "#fff" }}
        >
          <div style={{ fontSize: 24, marginBottom: 4 }}>✨</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Create my own business app</div>
          <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>Describe your business and NEX builds an app around it.</div>
        </button>
      </div>
    </div>
  );
}
