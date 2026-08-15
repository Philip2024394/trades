// NEX App Builder · Chat surface page (Philip 2026-08-14).
//
// Route: /nex-app/app-builder
//
// Human-friendly entry to the App Builder engine. Powered by:
//   - src/lib/app-builder/chat/*   → intent routing + question generation
//   - src/lib/app-builder/workers/* → 6-worker orchestrator
//   - src/lib/app-builder/qa/*      → Playwright QA runner
//   - src/lib/app-builder/blueprint-to-pipeline.ts → real pages

import { AppBuilderChat } from "@/components/nex-app-builder/AppBuilderChat";

export const dynamic = "force-dynamic";
export const metadata = { title: "Build your website · NEX", robots: { index: false } };

export default function AppBuilderChatPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#fff" }}>
      <AppBuilderChat />
    </main>
  );
}
