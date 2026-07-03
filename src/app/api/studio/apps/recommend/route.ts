// POST /api/studio/apps/recommend
//   Body: { description: string }
//
// Retrieval-first App recommender for the Studio home "Describe your
// app" flow. Loads every registered App manifest, hands the corpus +
// merchant description to the AI gateway with task "app.recommend",
// then filters the AI's response so ONLY slugs that actually exist in
// the registry come back. The AI cannot invent Apps.
//
// Also attaches install state so the modal can render "Install" or
// "Manage" per match without a second round-trip.
//
// Zero side effects — this is a read-only compose. The merchant still
// clicks Install from the modal, which routes through the standard
// /api/platform/apps/install path.

import { NextResponse } from "next/server";
import { appRegistry } from "@/platform/registry";
import { runtime as platformRuntime } from "@/platform/runtime";
import { loadStudioSession } from "@/lib/studio/session";
import { aiGateway } from "@/lib/studio/aiGateway";
// Populate providers + Apps at import time so the gateway + registry
// are hot the first time this route fires.
import "@/lib/studio/aiProviders";
import "@/platform/apps";

export const runtime = "nodejs";
export const revalidate = 0;

type RecommendBody = { description?: string };

type AiMatchesShape = {
  matches?: {
    slug?: string;
    confidence?: number;
    reasoning?: string;
  }[];
};

type MatchOut = {
  slug: string;
  name: string;
  tagline: string;
  category: string;
  confidence: number;
  reasoning: string;
  installed: boolean;
};

export async function POST(req: Request) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }

  let body: RecommendBody = {};
  try {
    body = (await req.json()) as RecommendBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid-json" },
      { status: 400 }
    );
  }

  const description = (body.description ?? "").trim();
  if (description.length < 4) {
    return NextResponse.json(
      { ok: false, error: "description-too-short" },
      { status: 400 }
    );
  }

  const manifests = appRegistry.list();
  if (manifests.length === 0) {
    // Retrieval corpus is empty — surface honestly so the modal can
    // route the merchant to the standard App Store instead of showing
    // a fake "no matches" state.
    return NextResponse.json({
      ok: true,
      matches: [],
      corpusSize: 0
    });
  }

  // Compact corpus — only fields the recommender needs. Keeps prompt
  // tokens down and hides internals (permissions, hooks, storage).
  const corpus = manifests.map((m) => ({
    slug: m.slug,
    name: m.name,
    tagline: m.tagline,
    category: m.category,
    tags: [...(m.tags ?? [])],
    description: (m.description ?? "").slice(0, 400)
  }));

  const gatewayRes = await aiGateway.complete({
    task: "app.recommend",
    context: {
      merchantId: session.merchant.id,
      brandId: session.brand.id,
      payload: {
        description,
        corpus
      }
    },
    budget: { maxOutputTokens: 800, maxLatencyMs: 15_000 }
  });

  if (!gatewayRes.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: gatewayRes.error.code,
        detail: gatewayRes.error.message
      },
      { status: 503 }
    );
  }

  const raw = gatewayRes.result as AiMatchesShape;
  const rawMatches = Array.isArray(raw?.matches) ? raw.matches : [];

  // Retrieval firewall: drop any slug the AI returned that isn't in
  // the registry. This is the hallucination guard.
  const validManifests = new Map(manifests.map((m) => [m.slug, m]));
  const installs = await platformRuntime
    .listActiveInstalls(session.merchant.id)
    .catch(() => []);
  const installedSlugs = new Set(
    installs.filter((i) => !i.uninstalled_at).map((i) => i.app_slug)
  );

  const matches: MatchOut[] = [];
  const seen = new Set<string>();
  for (const m of rawMatches) {
    const slug = typeof m?.slug === "string" ? m.slug : "";
    if (!slug || seen.has(slug)) continue;
    const manifest = validManifests.get(slug);
    if (!manifest) continue;
    seen.add(slug);
    matches.push({
      slug,
      name: manifest.name,
      tagline: manifest.tagline,
      category: manifest.category,
      confidence: clampConfidence(m.confidence),
      reasoning: (m.reasoning ?? "").slice(0, 240),
      installed: installedSlugs.has(slug)
    });
    if (matches.length >= 3) break;
  }

  return NextResponse.json({
    ok: true,
    matches,
    corpusSize: corpus.length,
    provider: gatewayRes.meta.provider,
    latencyMs: gatewayRes.meta.latencyMs
  });
}

function clampConfidence(n: unknown): number {
  const num = typeof n === "number" ? n : 0;
  if (!Number.isFinite(num)) return 0;
  if (num < 0) return 0;
  if (num > 1) return 1;
  return num;
}
