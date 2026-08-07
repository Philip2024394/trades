// POST /api/nex/composer/assist — NEX Brain assist for composition
// Body: { command, context }
//   commands: "write_newsletter" | "improve_subject" | "shorten" |
//             "rewrite_tone" | "generate_ctas"
//
// This endpoint is a THIN adapter over the future LLMProvider adapter.
// Today it returns a helpful placeholder + an audit event so the UI
// works and adoption metrics track. Wire an LLM adapter later ·
// nothing above this line needs to change.

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AssistCommand = "write_newsletter" | "improve_subject" | "shorten" | "rewrite_tone" | "generate_ctas";
type Body = { command?: AssistCommand; context?: string; tone?: string };

const COMMAND_LABEL: Record<AssistCommand, string> = {
  write_newsletter: "Write a newsletter",
  improve_subject:  "Improve subject line",
  shorten:          "Shorten paragraph",
  rewrite_tone:     "Rewrite in another tone",
  generate_ctas:    "Generate three alternative CTAs",
};

export async function POST(request: Request) {
  let body: Body;
  try { body = await request.json() as Body; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  const command = body.command;
  if (!command || !(command in COMMAND_LABEL)) {
    return NextResponse.json({ ok: false, error: "unknown_command", allowed: Object.keys(COMMAND_LABEL) }, { status: 400 });
  }

  // TODO · wire an LLMProvider adapter here. Interface will be:
  //   const provider = await selectLLM({ requires: ['streaming'], prefer: ['lowCost'] });
  //   const out = await provider.complete({ prompt, system });
  // For now we return an honest placeholder so the UI works.
  const placeholder = deterministicPlaceholder(command, body);

  // Best-effort audit · never fail the request over telemetry.
  void auditAssistUsed(command).catch(() => { /* swallow */ });

  return NextResponse.json({
    ok: true,
    command,
    label: COMMAND_LABEL[command],
    output: placeholder,
    provider: "placeholder",
    provider_note: "LLM provider not yet wired · this is a rule-based placeholder so the UI is testable. Wire an adapter under src/lib/nex/ai/adapters/ and update /api/nex/composer/assist.",
  });
}

function deterministicPlaceholder(cmd: AssistCommand, body: Body): string {
  const ctx = (body.context ?? "").trim();
  switch (cmd) {
    case "write_newsletter":
      return "**Draft newsletter**\n\nHi {{name}},\n\nHere are three things worth your attention this week:\n\n1. A short story with a clear point.\n2. A second story that adds context.\n3. A third story with a call to action.\n\nReply and let us know what resonates.\n\n— The team";
    case "improve_subject": {
      const base = ctx || "Your update";
      const options = [
        `${base} — one thing you should know`,
        `A quick update from us · ${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
        `${base.replace(/[.!?]+$/, "")} (2-min read)`,
      ];
      return options.map((o, i) => `${i + 1}. ${o}`).join("\n");
    }
    case "shorten": {
      if (!ctx) return "(Paste a paragraph in the context field and try again.)";
      const words = ctx.split(/\s+/);
      const target = Math.max(15, Math.round(words.length / 2));
      return words.slice(0, target).join(" ") + (words.length > target ? "…" : "");
    }
    case "rewrite_tone":
      return `**More professional tone**\n\n${ctx || "(Paste text to rewrite)"}\n\n_(Wire an LLM adapter to enable true tone rewriting.)_`;
    case "generate_ctas":
      return [
        "1. See it in action →",
        "2. Try it free — no sign-up",
        "3. Show me how it works",
      ].join("\n");
  }
}

async function auditAssistUsed(command: AssistCommand): Promise<void> {
  try {
    const { emit } = await import("@/lib/nex/events" as string).catch(() => ({ emit: null })) as { emit: null | ((ev: { event_type: string; payload: Record<string, unknown> }) => Promise<void>) };
    if (emit) await emit({ event_type: "composer.ai_assist_used", payload: { command } });
  } catch { /* telemetry never blocks */ }
}
