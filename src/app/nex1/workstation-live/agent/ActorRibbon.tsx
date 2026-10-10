"use client";

// src/app/nexapp/nex-agent/ActorRibbon.tsx
//
// Actor choreography ribbon · shows nex1 · nex2 · nex3 · founder pipeline
// dots for the active task. Dots animate on transition · founder sees the
// choreography at a glance.

interface Step {
  actor: "nex1" | "nex2" | "nex3" | "founder" | "system";
  step_kind: string;
  created_at: string;
}

interface Task { status: string; current_actor: string | null; }

export interface ActorRibbonProps {
  readonly task: Task | null;
  readonly steps: readonly Step[];
  readonly streamState: "idle" | "live" | "closed" | "error";
}

const ACTORS: Array<{ id: Step["actor"]; label: string; color: string }> = [
  { id: "nex1",    label: "NEX1",     color: "#22D3EE" },
  { id: "nex2",    label: "Engineer", color: "#F97316" },
  { id: "nex3",    label: "Claude",   color: "#F59E0B" },
  { id: "founder", label: "Founder",  color: "#EAB308" },
];

const IN_FLIGHT = new Set(["submitted", "clarifying", "planning", "applying", "plan_ready", "plan_approved"]);

export function ActorRibbon({ task, steps, streamState }: ActorRibbonProps) {
  const inFlight = task ? IN_FLIGHT.has(task.status) : false;
  const currentActor = task?.current_actor ?? null;

  // Latest step per actor · timestamp used to compute active dot
  const lastByActor = new Map<Step["actor"], string>();
  for (const s of steps) lastByActor.set(s.actor, s.created_at);

  const totalSteps = steps.length;

  return (
    <div style={{
      padding: "8px 14px 6px",
      borderBottom: "1px solid rgba(148, 163, 184, 0.12)",
      background: "rgba(11, 18, 32, 0.55)",
      display: "flex",
      flexDirection: "column",
      gap: 4,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{
          fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em",
          color: "#94A3B8", fontWeight: 700, marginRight: 4,
        }}>Actors</span>
        {ACTORS.map((a) => {
          const active = currentActor === a.id;
          const hasSteps = lastByActor.has(a.id);
          const dotSize = active ? 10 : 8;
          return (
            <div key={a.id} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span style={{
                display: "inline-block",
                width: dotSize, height: dotSize, borderRadius: "50%",
                background: hasSteps || active ? a.color : "rgba(148, 163, 184, 0.28)",
                boxShadow: active ? `0 0 8px ${a.color}` : "none",
                animation: active ? "naw-actor-pulse 1.6s ease-in-out infinite" : "none",
                transition: "background 0.2s ease, box-shadow 0.2s ease",
              }} />
              <span style={{
                fontSize: 10, color: active ? a.color : "#94A3B8",
                fontWeight: active ? 700 : 500,
                fontFamily: "'JetBrains Mono', monospace",
              }}>{a.label}</span>
            </div>
          );
        })}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace" }}>
          {totalSteps} steps · {inFlight ? "in-flight" : task?.status ?? "idle"} · stream {streamState}
        </span>
      </div>

      {inFlight && (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ display: "inline-flex", gap: 3 }}>
            <span style={{ width: 4, height: 4, borderRadius: 2, background: "#22D3EE", animation: "naw-think 1.2s ease-in-out infinite" }} />
            <span style={{ width: 4, height: 4, borderRadius: 2, background: "#F97316", animation: "naw-think 1.2s ease-in-out infinite 0.2s" }} />
            <span style={{ width: 4, height: 4, borderRadius: 2, background: "#F59E0B", animation: "naw-think 1.2s ease-in-out infinite 0.4s" }} />
          </span>
          <span style={{ fontSize: 10, color: "#F9FAFB" }}>
            {currentActor === "nex1" ? "NEX1 is coding"
              : currentActor === "nex2" ? "Engineer reviewing"
              : currentActor === "nex3" ? "Claude reviewing"
              : "Thinking"}…
          </span>
        </div>
      )}

      <style>{`
        @keyframes naw-actor-pulse {
          0%,100% { transform: scale(1); }
          50%     { transform: scale(1.25); }
        }
      `}</style>
    </div>
  );
}
