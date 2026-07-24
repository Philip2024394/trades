// /admin/design-os/keys — API key status dashboard.
// Shows which Trade OS environment keys are set, gives copy-paste
// commands to set the missing ones. Never displays actual key values.

import Link from "next/link";
import { CheckCircle2, AlertCircle, Copy } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Trade OS API Keys — Admin" };

type KeyStatus = {
  name:         string;
  purpose:      string;
  required_by:  string[];
  set:          boolean;
  last4:        string | null;
  set_command:  string;
};

async function loadStatus(): Promise<{ keys: KeyStatus[]; critical_ready: boolean } | null> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3008"}/api/admin/design-os/keys`, {
      cache: "no-store",
      headers: { cookie: "" }
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.ok ? json : null;
  } catch {
    // Server-side self-fetch not reliable in dev — compute inline instead.
    return computeInline();
  }
}

function computeInline() {
  const check = (name: string) => ({
    name,
    set:   !!process.env[name],
    last4: process.env[name]?.slice(-4) ?? null
  });
  const spec: Array<Pick<KeyStatus, "name" | "purpose" | "required_by" | "set_command">> = [
    { name: "OPENAI_API_KEY",        purpose: "GPT Image 1 + GPT-5 reasoning",         required_by: ["Van Wrap", "Discovery Agent", "Critic"], set_command: "vercel env add OPENAI_API_KEY production" },
    { name: "ANTHROPIC_API_KEY",     purpose: "Claude Opus 4.7 for Nex",               required_by: ["Nex widget", "Memory", "Proactive engine"], set_command: "vercel env add ANTHROPIC_API_KEY production" },
    { name: "CRON_SECRET",           purpose: "Gates every /api/cron/* endpoint",      required_by: ["nex-proactive", "washer-replenish", "beacon-sla"], set_command: "vercel env add CRON_SECRET production" },
    { name: "STRIPE_SECRET_KEY",     purpose: "Bundle checkout + subscriptions",       required_by: ["Bundle checkout"], set_command: "vercel env add STRIPE_SECRET_KEY production" },
    { name: "STRIPE_WEBHOOK_SECRET", purpose: "Stripe webhook signature verification", required_by: ["Stripe webhook route"], set_command: "vercel env add STRIPE_WEBHOOK_SECRET production" },
    { name: "RECRAFT_API_KEY",       purpose: "Vector logo generation (Phase 2)",      required_by: ["Logo App vectors"], set_command: "vercel env add RECRAFT_API_KEY production" },
    { name: "VECTORIZER_API_KEY",    purpose: "Raster → SVG for £99 Own It tier",      required_by: ["Own It export"], set_command: "vercel env add VECTORIZER_API_KEY production" }
  ];
  const keys: KeyStatus[] = spec.map((s) => ({ ...s, ...check(s.name) }));
  const critical_ready = keys.filter((k) => ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "CRON_SECRET"].includes(k.name)).every((k) => k.set);
  return { keys, critical_ready };
}

export default async function TradeOSKeysPage() {
  const status = (await loadStatus()) ?? computeInline();
  const setCount = status.keys.filter((k) => k.set).length;

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-black">Trade OS · API Keys</h1>
          <p className="mt-1 text-[12px] text-neutral-500">
            {setCount} of {status.keys.length} set. Never enter keys in a browser field. Use the CLI or Vercel dashboard.
          </p>
        </div>
        <div className={"rounded-full px-3 py-1.5 text-[11px] font-black " + (status.critical_ready ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800")}>
          {status.critical_ready ? "Critical keys ready" : "Missing critical keys"}
        </div>
      </div>

      <div className="space-y-3">
        {status.keys.map((k) => (
          <div key={k.name} className={"rounded-2xl border p-4 " + (k.set ? "border-green-200 bg-green-50/40" : "border-amber-200 bg-amber-50/40")}>
            <div className="flex items-start gap-3">
              {k.set ? <CheckCircle2 size={18} className="mt-0.5 text-green-700"/> : <AlertCircle size={18} className="mt-0.5 text-amber-700"/>}
              <div className="flex-1">
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="text-[14px] font-black">{k.name}</h2>
                  {k.set && k.last4 && (
                    <span className="text-[10px] font-mono text-neutral-500">…{k.last4}</span>
                  )}
                </div>
                <p className="mt-0.5 text-[12px] text-neutral-700">{k.purpose}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wider text-neutral-500">
                  Required by: {k.required_by.join(" · ")}
                </p>
                {!k.set && (
                  <div className="mt-3 rounded-lg border border-neutral-300 bg-white p-2 font-mono text-[11px]">
                    <div className="flex items-center gap-2">
                      <Copy size={11} className="text-neutral-400"/>
                      <code className="flex-1">{k.set_command}</code>
                    </div>
                    <p className="mt-1 text-[10px] font-sans text-neutral-500">
                      Run in terminal — Vercel prompts for value. Repeat with `preview` if you want preview URLs to work too.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-4">
        <h3 className="text-[13px] font-black">Why no browser input for keys?</h3>
        <p className="mt-1 text-[12px] leading-relaxed text-neutral-700">
          API keys entered via browser fields land in browser history, browser autofill databases, and often HTTP logs. The Vercel CLI + dashboard route them straight into isolated environment storage. Set once via the command above, they persist across every deploy and never surface in any log we could accidentally publish.
        </p>
      </div>

      <div className="mt-4 flex gap-3">
        <Link href="/admin" className="text-[12px] font-black text-neutral-600 hover:text-neutral-900">← Back to admin</Link>
        <Link href="/admin/nex" className="text-[12px] font-black text-neutral-600 hover:text-neutral-900">Nex observatory →</Link>
      </div>
    </div>
  );
}
