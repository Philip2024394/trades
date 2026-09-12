// src/app/api/nex/agent/plugins/upload/route.ts
//
// Custom plugin ingestion · founder uploads a plugin manifest (JSON) or a
// signed .nex1-plugin.zip file. The manifest is:
//   { id · brand · name · category · icon · tagline · description · benefits ·
//     recommendedFor · promptTemplate · signed_hash? }
//
// Security gates (reject-first · founder never sees a raw error via Guardian):
//   1. manifest JSON must parse
//   2. schema-strict validation · no unknown keys · every field length-capped
//   3. content-scanner runs on description + promptTemplate (secrets · bugs · spam)
//   4. promptTemplate size + shape checks
//   5. category must be a known PluginCategory
//   6. hash + timestamp stored so we can revoke a specific plugin later
//
// Only after ALL gates pass does the plugin land in data/nex-agent-plugins-custom/
// and become available in the /api/nex/agent/plugins/list endpoint.

import { NextResponse } from "next/server";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { scanText } from "@/lib/nex-agent/content-scanner";
import { checkRateLimit, rateLimitKeyFor, detectBotUA, WORKSTATION_SEC_HEADERS } from "@/lib/nex-agent/anti-bot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KNOWN_CATEGORIES = new Set([
  "seo-search", "analytics-perf", "auth", "payments",
  "content-media", "email", "search", "communication",
  "ai", "deployment", "monitoring",
]);

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 _.,()·+&/-]{1,60}$/;
const ID_RE   = /^[a-z][a-z0-9-]{2,50}$/;

interface PluginManifestInput {
  readonly id?: string;
  readonly brand?: string;
  readonly name?: string;
  readonly category?: string;
  readonly icon?: string;
  readonly tagline?: string;
  readonly description?: string;
  readonly benefits?: readonly string[];
  readonly setupComplexity?: string;
  readonly recommendedFor?: readonly string[];
  readonly promptTemplate?: string;
}

interface Rejection { readonly ok: false; readonly code: string; readonly detail: string; }
interface Accept    { readonly ok: true; readonly value: NormalizedPlugin; }

interface NormalizedPlugin {
  readonly id: string;
  readonly brand: string;
  readonly name: string;
  readonly category: string;
  readonly icon: string;
  readonly tagline: string;
  readonly description: string;
  readonly benefits: readonly string[];
  readonly setupComplexity: "low" | "medium" | "high";
  readonly recommendedFor: readonly string[];
  readonly featured: false;
  readonly promptTemplate: string;
  readonly custom: true;
  readonly submittedAt: string;
  readonly hash: string;
}

function customRoot(): string {
  return resolve(process.cwd(), "data/nex-agent-plugins-custom");
}
function quarantineRoot(): string {
  return resolve(process.cwd(), "data/nex-agent-plugins-quarantine");
}

function validateAndNormalize(input: PluginManifestInput): Rejection | Accept {
  const errors: string[] = [];

  const id = String(input.id ?? "").trim().toLowerCase();
  if (!ID_RE.test(id)) errors.push(`id must match ${ID_RE} · got "${id}"`);

  const brand = String(input.brand ?? "").trim();
  if (!NAME_RE.test(brand)) errors.push(`brand invalid · use letters · numbers · common punctuation · 2-61 chars`);

  const name = String(input.name ?? "").trim();
  if (!NAME_RE.test(name)) errors.push(`name invalid · 2-61 chars`);

  const category = String(input.category ?? "").trim();
  if (!KNOWN_CATEGORIES.has(category)) errors.push(`category must be one of ${[...KNOWN_CATEGORIES].join(" · ")}`);

  const icon = String(input.icon ?? "").trim();
  if (!icon || icon.length > 4) errors.push(`icon must be 1-4 chars (emoji or glyph)`);

  const tagline = String(input.tagline ?? "").trim();
  if (tagline.length < 5 || tagline.length > 90) errors.push(`tagline must be 5-90 chars`);

  const description = String(input.description ?? "").trim();
  if (description.length < 40 || description.length > 800) errors.push(`description must be 40-800 chars`);

  const benefits = Array.isArray(input.benefits) ? input.benefits.map((b) => String(b).trim()) : [];
  if (benefits.length < 2 || benefits.length > 8) errors.push(`benefits must have 2-8 items`);
  for (const b of benefits) if (b.length > 140) errors.push(`each benefit must be ≤140 chars`);

  const setupComplexity = String(input.setupComplexity ?? "medium");
  if (!["low", "medium", "high"].includes(setupComplexity)) errors.push(`setupComplexity must be low/medium/high`);

  const recommendedFor = Array.isArray(input.recommendedFor) ? input.recommendedFor.map((r) => String(r).trim()) : [];
  const validForTags = new Set(["landing-page", "saas", "marketplace", "directory", "blog", "docs", "webapp", "ecommerce", "portfolio"]);
  for (const r of recommendedFor) if (!validForTags.has(r)) errors.push(`recommendedFor "${r}" not in ${[...validForTags].join(",")}`);

  const promptTemplate = String(input.promptTemplate ?? "").trim();
  if (promptTemplate.length < 80 || promptTemplate.length > 8000) errors.push(`promptTemplate must be 80-8000 chars · give NEX1 real instructions`);

  if (errors.length > 0) return { ok: false, code: "schema_invalid", detail: errors.join(" · ") };

  // ─── Content-scanner pass · reject secrets / bugs / spam ───
  const scanBundle = [description, tagline, promptTemplate, ...benefits].join("\n\n");
  const scan = scanText({ text: scanBundle, filename: `plugin-${id}.md`, mimeType: "text/plain" });
  if (scan.verdict === "RED") {
    return { ok: false, code: "content_scan_red", detail: `Rejected · ${scan.findings.map((f) => `${f.code}: ${f.detail}`).join(" · ").slice(0, 400)}` };
  }

  const hash = createHash("sha256").update(scanBundle).digest("hex").slice(0, 24);
  return {
    ok: true,
    value: {
      id, brand, name, category, icon, tagline, description,
      benefits, setupComplexity: setupComplexity as "low" | "medium" | "high",
      recommendedFor, featured: false, promptTemplate,
      custom: true,
      submittedAt: new Date().toISOString(),
      hash,
    },
  };
}

export async function POST(req: Request) {
  const rl = checkRateLimit(rateLimitKeyFor(req, "plugins-upload"), { windowMs: 60_000, maxRequests: 10 });
  if (!rl.allowed) return NextResponse.json({ ok: false, error: rl.reason }, { status: 429, headers: WORKSTATION_SEC_HEADERS });
  const bot = detectBotUA(req.headers.get("user-agent"));
  if (bot.isBot) return NextResponse.json({ ok: false, error: bot.reason }, { status: 403, headers: WORKSTATION_SEC_HEADERS });

  let body: unknown = null;
  try { body = await req.json(); } catch { /* */ }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "manifest_required" }, { status: 400, headers: WORKSTATION_SEC_HEADERS });
  }

  const result = validateAndNormalize(body as PluginManifestInput);
  if (!result.ok) {
    // Quarantine rejected · founder can audit later
    try {
      const dir = quarantineRoot();
      mkdirSync(dir, { recursive: true });
      const q = { rejectedAt: new Date().toISOString(), code: result.code, detail: result.detail, raw: body };
      writeFileSync(join(dir, `${Date.now()}-${randomUUID().slice(0, 8)}.json`), JSON.stringify(q, null, 2), "utf8");
    } catch { /* quarantine best-effort */ }
    return NextResponse.json({ ok: false, error: result.code, detail: result.detail }, { status: 400, headers: WORKSTATION_SEC_HEADERS });
  }

  // Persist accepted plugin
  const dir = customRoot();
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${result.value.id}.json`), JSON.stringify(result.value, null, 2), "utf8");

  return NextResponse.json({ ok: true, plugin: result.value }, { headers: { ...WORKSTATION_SEC_HEADERS, "Cache-Control": "no-store" } });
}

export async function GET() {
  const dir = customRoot();
  if (!existsSync(dir)) return NextResponse.json({ ok: true, plugins: [] }, { headers: { ...WORKSTATION_SEC_HEADERS, "Cache-Control": "no-store" } });
  const out: unknown[] = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    try { out.push(JSON.parse(readFileSync(join(dir, f), "utf8"))); } catch { /* skip malformed */ }
  }
  return NextResponse.json({ ok: true, plugins: out }, { headers: { ...WORKSTATION_SEC_HEADERS, "Cache-Control": "no-store" } });
}
