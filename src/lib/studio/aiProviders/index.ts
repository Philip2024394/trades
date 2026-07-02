// AI provider registrations — imported side-effect from the API
// route so every request routes through the populated gateway.
//
// Adding a second provider: create the adapter file, import it here,
// call aiGateway.register(). Zero call-site changes elsewhere.

import { aiGateway } from "@/lib/studio/aiGateway";
import { anthropicProvider } from "./anthropic";

// Idempotent — Next.js can double-import during hot reload.
if (!aiGateway.has(anthropicProvider.id)) {
  aiGateway.register(anthropicProvider);
}

export {};
