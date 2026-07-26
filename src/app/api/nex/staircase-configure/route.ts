// POST /api/nex/staircase-configure
//
// Natural-language configurator endpoint. User types "make the balusters cream" /
// "add LED lights" / "make it wider" — this endpoint parses intent against the
// available options and returns the config changes to apply, plus a friendly
// reply. The client applies the changes and shows the reply.
//
// Body:
// {
//   userMessage: string,
//   currentConfig: Record<categoryId, optionId>,
//   categories: [{ id, label, options: [{ id, label, description? }] }]
// }
// Response:
// { ok: true, reply: string, configChanges: [{ categoryId, optionId }] }
// or
// { ok: false, error: string, fallbackReply?: string }
//
// Falls back to a deterministic keyword-match if ANTHROPIC_API_KEY is missing,
// so the endpoint stays useful in local dev without secrets.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { completeJson } from "@/lib/llm/anthropic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OptionShape    = { id: string; label: string; description?: string };
type CategoryShape  = { id: string; label: string; options: OptionShape[] };
type ConfigChange   = { categoryId: string; optionId: string };
type ModelResponse  = { reply: string; configChanges: ConfigChange[] };

export async function POST(req: NextRequest) {
  let body: {
    userMessage?: unknown;
    currentConfig?: unknown;
    categories?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const userMessage = typeof body.userMessage === "string" ? body.userMessage.trim() : "";
  if (!userMessage) {
    return NextResponse.json({ ok: false, error: "empty_message" }, { status: 400 });
  }

  const categories = normaliseCategories(body.categories);
  const currentConfig = normaliseConfig(body.currentConfig, categories);
  if (categories.length === 0) {
    return NextResponse.json({ ok: false, error: "no_categories" }, { status: 400 });
  }

  // Try LLM path first. Falls back to keyword match if no API key or model fails.
  const llmResult = await parseWithLLM(userMessage, currentConfig, categories);
  if (llmResult) {
    const filtered = filterValidChanges(llmResult.configChanges, currentConfig, categories);
    return NextResponse.json({
      ok: true,
      reply: llmResult.reply,
      configChanges: filtered,
      source: "llm",
    });
  }

  const fallback = keywordMatch(userMessage, currentConfig, categories);
  return NextResponse.json({
    ok: true,
    reply: fallback.reply,
    configChanges: fallback.configChanges,
    source: "fallback",
  });
}

// ─── LLM path ───────────────────────────────────────────────────

async function parseWithLLM(
  userMessage: string,
  currentConfig: Record<string, string>,
  categories: CategoryShape[]
): Promise<ModelResponse | null> {
  const catalog = categories
    .map((cat) => {
      const opts = cat.options
        .map((o) => `    - ${o.id}: ${o.label}${o.description ? ` (${o.description})` : ""}`)
        .join("\n");
      return `- ${cat.id} — ${cat.label}\n${opts}`;
    })
    .join("\n");

  const currentSummary = Object.entries(currentConfig)
    .map(([cid, oid]) => {
      const cat = categories.find((c) => c.id === cid);
      const opt = cat?.options.find((o) => o.id === oid);
      return `- ${cat?.label ?? cid}: ${opt?.label ?? oid}`;
    })
    .join("\n");

  const system = [
    "You are Nex, a friendly and expert staircase configurator assistant.",
    "The user is designing a staircase interactively and will describe changes in natural language.",
    "Your job is to translate their request into exact config changes against the available options,",
    "and reply with a short friendly confirmation (1 sentence, under 25 words).",
    "",
    "Rules:",
    "- Only use categoryId and optionId values from the AVAILABLE OPTIONS list — never invent new ones.",
    "- If the user asks for something not available, reply naturally explaining what IS possible and return an empty configChanges array.",
    "- If the user asks a general question rather than a config change, answer briefly and return empty configChanges.",
    "- Multiple simultaneous changes are allowed (e.g. 'change to walnut and add LED' → two entries).",
    "- Always return valid JSON matching the schema.",
    "",
    "Response schema (must be valid JSON, no extra prose):",
    '{ "reply": string, "configChanges": [{ "categoryId": string, "optionId": string }] }',
  ].join("\n");

  const cachedSystem = [
    "AVAILABLE OPTIONS (categoryId → options):",
    catalog,
  ].join("\n");

  const messages = [
    {
      role: "user" as const,
      content: [
        "CURRENT SELECTION:",
        currentSummary || "(nothing configured yet)",
        "",
        `USER SAID: "${userMessage}"`,
        "",
        "Respond with JSON only.",
      ].join("\n"),
    },
  ];

  const result = await completeJson<ModelResponse>({
    system,
    cachedSystem,
    messages,
    maxTokens: 400,
  });
  if (!result || !Array.isArray(result.configChanges) || typeof result.reply !== "string") {
    return null;
  }
  return result;
}

// ─── Fallback keyword matcher ───────────────────────────────────

function keywordMatch(
  userMessage: string,
  currentConfig: Record<string, string>,
  categories: CategoryShape[]
): ModelResponse {
  const msg = userMessage.toLowerCase();
  const changes: ConfigChange[] = [];

  // Score each option by how many of its label words appear in the user message.
  for (const cat of categories) {
    let bestOpt: OptionShape | null = null;
    let bestScore = 0;
    for (const opt of cat.options) {
      const tokens = opt.label
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length > 2);
      let score = 0;
      for (const t of tokens) if (msg.includes(t)) score++;
      if (score > bestScore) {
        bestScore = score;
        bestOpt = opt;
      }
    }
    if (bestOpt && bestScore >= 1 && currentConfig[cat.id] !== bestOpt.id) {
      changes.push({ categoryId: cat.id, optionId: bestOpt.id });
    }
  }

  if (changes.length === 0) {
    return {
      reply:
        "I'm not sure what to change from that. Try naming the part (balusters, newels, lighting, timber species) and the new option.",
      configChanges: [],
    };
  }

  const parts = changes.map((c) => {
    const cat = categories.find((cc) => cc.id === c.categoryId);
    const opt = cat?.options.find((o) => o.id === c.optionId);
    return `${cat?.label ?? c.categoryId} → ${opt?.label ?? c.optionId}`;
  });
  return {
    reply: `Done. Updated ${parts.join(" · ")}.`,
    configChanges: changes,
  };
}

// ─── Validators / normalisers ───────────────────────────────────

function normaliseCategories(raw: unknown): CategoryShape[] {
  if (!Array.isArray(raw)) return [];
  const out: CategoryShape[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as {
      id?: unknown;
      label?: unknown;
      options?: unknown;
    };
    if (typeof r.id !== "string" || typeof r.label !== "string" || !Array.isArray(r.options)) continue;
    const options: OptionShape[] = [];
    for (const o of r.options) {
      if (!o || typeof o !== "object") continue;
      const oo = o as { id?: unknown; label?: unknown; description?: unknown };
      if (typeof oo.id !== "string" || typeof oo.label !== "string") continue;
      options.push({
        id: oo.id,
        label: oo.label,
        description: typeof oo.description === "string" ? oo.description : undefined,
      });
    }
    if (options.length > 0) out.push({ id: r.id, label: r.label, options });
  }
  return out;
}

function normaliseConfig(raw: unknown, categories: CategoryShape[]): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== "object") return out;
  const r = raw as Record<string, unknown>;
  for (const cat of categories) {
    const v = r[cat.id];
    if (typeof v === "string" && cat.options.some((o) => o.id === v)) out[cat.id] = v;
  }
  return out;
}

function filterValidChanges(
  changes: ConfigChange[],
  currentConfig: Record<string, string>,
  categories: CategoryShape[]
): ConfigChange[] {
  const out: ConfigChange[] = [];
  for (const c of changes) {
    if (typeof c?.categoryId !== "string" || typeof c?.optionId !== "string") continue;
    const cat = categories.find((cc) => cc.id === c.categoryId);
    if (!cat) continue;
    if (!cat.options.some((o) => o.id === c.optionId)) continue;
    if (currentConfig[c.categoryId] === c.optionId) continue; // no-op change
    out.push({ categoryId: c.categoryId, optionId: c.optionId });
  }
  return out;
}
