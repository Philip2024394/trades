// GET /api/nex/email/config — NEX Email Runtime config surface
//
// One endpoint feeds the Communications Centre + future Email Mission
// Control page. Composes:
//   · known adapters (registered · which is active · which are planned)
//   · active provider capabilities
//   · health probe
//   · env-var status (RESEND_API_KEY · NEX_EMAIL_DEFAULT_FROM · masked)
//   · queue snapshot
//
// SECURITY · same rules as /api/nex/storage/overview:
//   · Secrets never in cleartext · last 4 chars + length only.

import { NextResponse } from "next/server";
import { getEmail, isEmailHealthy, knownAdapters } from "@/lib/nex/email/registry";
import { getEmailQueue } from "@/lib/nex/email/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function maskSecret(v: string): { present: true; last4: string; length: number; masked: true } {
  return { present: true, last4: v.slice(-4), length: v.length, masked: true };
}

const TRACKED_ENV = [
  { name: "NEX_EMAIL_PROVIDER",       secret: false, purpose: "Which adapter the registry picks (default: resend)" },
  { name: "NEX_EMAIL_DEFAULT_FROM",   secret: false, purpose: "Fallback From address when a message omits `from`" },
  { name: "RESEND_API_KEY",           secret: true,  purpose: "Resend adapter API key" },
] as const;

export async function GET() {
  const adapter = getEmail();
  const health = await isEmailHealthy();
  const queue = getEmailQueue().snapshot();

  const env = TRACKED_ENV.map((e) => {
    const raw = process.env[e.name];
    if (!raw) return { name: e.name, purpose: e.purpose, secret: e.secret, present: false };
    if (e.secret) return { name: e.name, purpose: e.purpose, secret: true, ...maskSecret(raw) };
    return { name: e.name, purpose: e.purpose, secret: false, present: true, value: raw };
  });

  return NextResponse.json({
    ok: true,
    runtime: "nex-email",
    active_provider: adapter.name,
    active_capabilities: adapter.capabilities,
    adapters: knownAdapters(),
    health,
    queue,
    env,
    dev_mode: process.env.NODE_ENV !== "production",
    generated_at: new Date().toISOString(),
  });
}
