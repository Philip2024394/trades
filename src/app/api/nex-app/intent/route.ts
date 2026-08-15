// NEX Front Door · POST /api/nex-app/intent (Philip 2026-08-14 · Phase 18).
//
// Rule-based intent classifier for the /nex-app front door. Returns one of:
//   - "owner"    · person wants to build a business app
//   - "customer" · person wants to find/talk to a business
//   - "ambiguous" · we honestly can't tell · both buttons still available
//
// NO LLM (per NEX Core Dependency Rule). Deterministic patterns. When
// signals are contradictory OR too weak, we say ambiguous · NEX never guesses.

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OWNER_PATTERNS: RegExp[] = [
  /\b(?:build|make|create|launch|start|set\s*up)\s+(?:a|an|my|our|the)?\s*(?:business|app|website|shop|store|chat|store\s+for|app\s+for)\b/i,
  /\b(?:my|our)\s+(?:own\s+)?(?:business|company|app|website|shop|store|firm)\b/i,
  /\bi(?:'m|\s+am)?\s+(?:a|an|the)\s+(?:owner|founder|tradesperson|electrician|plumber|joiner|carpenter|photographer|kitchen\s+fitter|staircase\s+maker|manufacturer)\b/i,
  /\bfor\s+my\s+(?:staircase|kitchen|joinery|electrical|plumbing|photography|design|business|company|shop)\b/i,
  /\bapp\s+for\s+my\b/i,
  /\bget\s+(?:my|our)\s+business\s+online\b/i
];

const CUSTOMER_PATTERNS: RegExp[] = [
  /\b(?:looking|need|want|hoping)\s+(?:for|to\s+find|to\s+hire|to\s+book|to\s+get)\b/i,
  /\b(?:find|hire|book|contact|talk\s+to)\s+(?:a|an|the)\s+(?:business|company|tradesperson|staircase|kitchen|plumber|electrician|joiner)\b/i,
  /\b(?:quote|estimate)\s+for\b/i,
  /\bcan\s+(?:someone|anyone)\s+(?:help|do|build|install|fix|make)\b/i,
  /\bhelp\s+me\s+(?:with|find|choose)\b/i,
  /\bhow\s+much\s+(?:for|is|does|would)\b/i
];

export type IntentResult = {
  intent: "owner" | "customer" | "ambiguous";
  ownerSignals: number;
  customerSignals: number;
  route: string | null;    // suggested next route (null if ambiguous)
  message: string;         // conversational NEX reply
};

export function classifyIntent(text: string): IntentResult {
  const t = text.trim();
  if (t.length === 0) return { intent: "ambiguous", ownerSignals: 0, customerSignals: 0, route: null, message: "Tell me a bit more · are you looking for a business, or wanting to create your own?" };
  const ownerSignals = OWNER_PATTERNS.reduce((n, r) => n + (r.test(t) ? 1 : 0), 0);
  const customerSignals = CUSTOMER_PATTERNS.reduce((n, r) => n + (r.test(t) ? 1 : 0), 0);
  if (ownerSignals > 0 && customerSignals === 0) {
    return {
      intent: "owner",
      ownerSignals, customerSignals,
      route: "/nex-app/app-builder",
      message: "Got it · you want your own business app. I'll take you to the Builder · you can describe what you do in plain English and I'll build the app around it."
    };
  }
  if (customerSignals > 0 && ownerSignals === 0) {
    return {
      intent: "customer",
      ownerSignals, customerSignals,
      route: null,   // Deferred · Phase 18+ · customer discovery/search flow
      message: "Understood · you're looking to find or talk to a business. We're still building the discovery flow · in the meantime you can open one of the demo businesses below."
    };
  }
  return {
    intent: "ambiguous",
    ownerSignals, customerSignals,
    route: null,
    message: "I can't tell for sure yet · pick one of the two buttons below so we route you to the right place."
  };
}

export async function POST(req: Request): Promise<Response> {
  let body: { text?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 }); }
  const result = classifyIntent(String(body.text ?? ""));
  return NextResponse.json({ ok: true, ...result });
}
