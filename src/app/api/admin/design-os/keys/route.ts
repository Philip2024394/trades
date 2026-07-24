// GET /api/admin/design-os/keys
// Returns which Trade OS environment keys are set + which aren't.
// Never returns the key values — only presence + last-4 fingerprint
// for confirmation. Admin auth required.

import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type KeyStatus = {
  name:         string;
  purpose:      string;
  required_by:  string[];
  set:          boolean;
  last4:        string | null;
  set_command:  string;
};

export async function GET(): Promise<NextResponse> {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ ok: false, error: "not_admin" }, { status: 401 });
  }

  const keys: KeyStatus[] = [
    {
      name:        "OPENAI_API_KEY",
      purpose:     "GPT Image 1 generation + GPT-5 reasoning for design agents",
      required_by: ["Van Wrap App", "Business Discovery Agent", "Design Critic", "All Studio image generators"],
      set:         !!process.env.OPENAI_API_KEY,
      last4:       last4(process.env.OPENAI_API_KEY),
      set_command: "vercel env add OPENAI_API_KEY production"
    },
    {
      name:        "ANTHROPIC_API_KEY",
      purpose:     "Claude Opus 4.7 — powers Nex agent, chat, memory summariser",
      required_by: ["Nex widget", "Nex memory", "Nex proactive engine", "Design compiler fallback reasoning"],
      set:         !!process.env.ANTHROPIC_API_KEY,
      last4:       last4(process.env.ANTHROPIC_API_KEY),
      set_command: "vercel env add ANTHROPIC_API_KEY production"
    },
    {
      name:        "CRON_SECRET",
      purpose:     "Shared secret gating every /api/cron/* endpoint",
      required_by: ["nex-proactive cron", "washer-replenish cron", "beacon-sla cron"],
      set:         !!process.env.CRON_SECRET,
      last4:       last4(process.env.CRON_SECRET),
      set_command: "vercel env add CRON_SECRET production"
    },
    {
      name:        "STRIPE_SECRET_KEY",
      purpose:     "Bundle checkout + subscription billing (V2 Q9 bundles)",
      required_by: ["Bundle checkout API", "Subscription webhooks"],
      set:         !!process.env.STRIPE_SECRET_KEY,
      last4:       last4(process.env.STRIPE_SECRET_KEY),
      set_command: "vercel env add STRIPE_SECRET_KEY production"
    },
    {
      name:        "STRIPE_WEBHOOK_SECRET",
      purpose:     "Verifies incoming Stripe webhook signatures",
      required_by: ["Stripe webhook route"],
      set:         !!process.env.STRIPE_WEBHOOK_SECRET,
      last4:       last4(process.env.STRIPE_WEBHOOK_SECRET),
      set_command: "vercel env add STRIPE_WEBHOOK_SECRET production"
    },
    {
      name:        "RECRAFT_API_KEY",
      purpose:     "Recraft v3 — native vector logo generation (V3 Q13, Phase 2)",
      required_by: ["Logo App vector output"],
      set:         !!process.env.RECRAFT_API_KEY,
      last4:       last4(process.env.RECRAFT_API_KEY),
      set_command: "vercel env add RECRAFT_API_KEY production"
    },
    {
      name:        "VECTORIZER_API_KEY",
      purpose:     "Vectorizer.AI — raster → SVG conversion for £99 Own It tier",
      required_by: ["Own It tier export pipeline"],
      set:         !!process.env.VECTORIZER_API_KEY,
      last4:       last4(process.env.VECTORIZER_API_KEY),
      set_command: "vercel env add VECTORIZER_API_KEY production"
    }
  ];

  const critical      = keys.filter((k) => ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "CRON_SECRET"].includes(k.name));
  const criticalReady = critical.every((k) => k.set);

  return NextResponse.json({
    ok:              true,
    keys,
    critical_ready:  criticalReady,
    summary: {
      total:      keys.length,
      set:        keys.filter((k) => k.set).length,
      unset:      keys.filter((k) => !k.set).length
    }
  });
}

function last4(v: string | undefined): string | null {
  if (!v || v.length < 4) return null;
  return v.slice(-4);
}
