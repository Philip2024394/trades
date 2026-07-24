// Messenger shell — Phase 1 placeholder.
//
// Independent of the AI. No LLM calls made from this surface. Per
// Platform architecture: Messenger is free forever, no AI credits
// required. Realtime backend + person-to-person + group chat +
// attachments + reactions land in subsequent phases.

import { MessengerShell } from "@/components/nex-app/platform/MessengerShell";

export const dynamic = "force-dynamic";

export default function MessengerPage() {
  return <MessengerShell />;
}
