// src/app/nex1/chat/page.tsx
//
// NEX1 · Code Chat workspace route · Phase 2 · GAP C · 2026-09-17.
//
// Mounts the `Nex1WorkstationChat` component at a real Next.js route so the
// user can reach the NEX1 native-intelligence chat surface directly.
//
// EXPLICIT ROUTING · this page mounts ONLY the NEX1-native chat component,
// which itself talks ONLY to /api/nex1/chat/turn (verified in Fix 24 doctrine).
// It does NOT replace, redirect, or import from the existing consumer NEX
// chat surfaces (NexAppShell / NexWorkspaceChat / NexPolishedChat / ChatSurface).
//
// This route is additive: the consumer product flow at /nexapp remains unchanged.

import Nex1WorkstationChat from "@/components/nex1/Nex1WorkstationChat";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "NEX1 · Code Chat",
  description:
    "NEX1 native coding workspace · zero-LLM deterministic intelligence · text + voice.",
};

export default function Nex1ChatPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#050505",
        color: "#e8e8e8",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "24px 16px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 960, marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, margin: 0, opacity: 0.85 }}>NEX1 · Code Chat</h1>
        <p style={{ fontSize: 12, margin: "6px 0 0", opacity: 0.55 }}>
          Native zero-LLM coding workspace. Text now · voice via same intelligence path.
        </p>
      </div>
      <div style={{ width: "100%", maxWidth: 960, flex: 1 }}>
        <Nex1WorkstationChat />
      </div>
    </main>
  );
}
