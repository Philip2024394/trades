// Industry Brain — answer endpoint.
//
//   POST /api/studio/industry-brain/answer
//     Body: { question: string }
//     → { ok, answer, citations, confidence, escalate, nodesUsed }
//
// Wires the Knowledge Graph retriever to the Anthropic gateway. Loads
// the merchant's context server-side, retrieves cited nodes, formats
// them for the prompt, calls the LLM, and STRICTLY VALIDATES that
// every citation the LLM returned matches a node we actually sent it.
// Hallucinated node ids are dropped silently.

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { aiGateway } from "@/lib/studio/aiGateway";
import "@/lib/studio/aiProviders"; // register anthropic provider
import "@/lib/studio/blueprints"; // populate blueprint registry
import {
  formatRetrievalForPrompt,
  retrieveKnowledge
} from "@/lib/knowledge";
import type { MerchantContext } from "@/lib/knowledge";

export const runtime = "nodejs";

type PostBody = { question?: string };

type LlmResult = {
  answer?: string;
  citations?: string[];
  confidence?: number;
  escalate?: boolean;
};

export async function POST(req: Request) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }
  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid-json" },
      { status: 400 }
    );
  }
  const question = (body.question ?? "").trim();
  if (question.length < 4) {
    return NextResponse.json(
      { ok: false, error: "question-too-short" },
      { status: 400 }
    );
  }

  // ─── 1. Load merchant context ─────────────────────────
  const [outcomesRes, credsRes, layoutRes] = await Promise.all([
    supabaseAdmin
      .from("studio_brand_outcomes")
      .select("coverage_postcode, coverage_radius_mi")
      .eq("brand_id", session.brand.id)
      .maybeSingle(),
    supabaseAdmin
      .from("studio_brand_credentials")
      .select("scheme, status, number, display_label")
      .eq("brand_id", session.brand.id)
      .in("status", ["verified", "self-declared"]),
    supabaseAdmin
      .from("studio_layouts")
      .select("blueprint_id")
      .eq("brand_id", session.brand.id)
      .eq("page_id", "home")
      .eq("status", "published")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  const outcomes = outcomesRes.data as {
    coverage_postcode: string | null;
    coverage_radius_mi: number | null;
  } | null;
  const layout = layoutRes.data as { blueprint_id: string | null } | null;

  const merchantContext: MerchantContext = {
    tradeSlug: session.merchant.primary_trade,
    brandName: session.merchant.display_name,
    city: session.merchant.city,
    coveragePostcode: outcomes?.coverage_postcode ?? null,
    coverageRadiusMi: outcomes?.coverage_radius_mi ?? null,
    heldCredentials: (credsRes.data ?? []).map(
      (c: {
        scheme: string;
        status: string;
        number: string;
        display_label: string | null;
      }) => ({
        scheme: c.scheme,
        status: c.status,
        number: c.number,
        displayLabel: c.display_label
      })
    ),
    publishedBlueprintSlug: layout?.blueprint_id ?? null
  };

  // ─── 2. Retrieve ─────────────────────────────────────
  const retrieval = retrieveKnowledge(
    { intent: question, maxResults: 10 },
    merchantContext
  );

  // If nothing matched, return an honest empty answer without calling
  // the LLM — cheap + trustworthy.
  if (retrieval.nodes.length === 0) {
    return NextResponse.json({
      ok: true,
      answer:
        "The Knowledge Graph doesn't have a strong match for your question yet. Best next step: contact a qualified trade professional for a definitive answer.",
      citations: [],
      confidence: 0,
      escalate: true,
      nodesUsed: [],
      layersUsed: retrieval.meta.layersUsed
    });
  }

  const contextBlock = formatRetrievalForPrompt(retrieval);
  const validNodeIds = retrieval.nodes.map((n) => n.id);

  // ─── 3. Call the gateway ─────────────────────────────
  const gatewayRes = await aiGateway.complete({
    task: "industry.answer",
    context: {
      payload: {
        question,
        contextBlock,
        validNodeIds
      }
    }
  });

  if (!gatewayRes.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: gatewayRes.error.code,
        detail: gatewayRes.error.message
      },
      { status: 502 }
    );
  }

  const raw = gatewayRes.result as LlmResult;

  // ─── 4. STRICT validation — drop hallucinations ──────
  const validSet = new Set(validNodeIds);
  const cleanCitations = (raw.citations ?? [])
    .filter((c): c is string => typeof c === "string")
    .filter((c) => validSet.has(c));

  // Also strip any [<hallucinated-id>] tokens from the answer text
  let cleanAnswer = typeof raw.answer === "string" ? raw.answer : "";
  cleanAnswer = cleanAnswer.replace(/\[([^\]]+)\]/g, (match, id) =>
    validSet.has(id) ? match : ""
  );

  // If the model claimed high confidence but ended up citing nothing
  // (because everything was hallucinated), rewrite as escalate.
  const finalConfidence =
    typeof raw.confidence === "number"
      ? Math.max(0, Math.min(1, raw.confidence))
      : 0;
  const finalEscalate =
    typeof raw.escalate === "boolean" ? raw.escalate : false;

  if (cleanCitations.length === 0 && finalConfidence >= 0.6) {
    // Model was confident but couldn't cite anything real
    return NextResponse.json({
      ok: true,
      answer:
        "The Knowledge Graph didn't cover this specifically. Best next step: contact a qualified trade professional for a definitive answer.",
      citations: [],
      confidence: 0,
      escalate: true,
      nodesUsed: retrieval.nodes.map((n) => ({
        id: n.id,
        title: n.title,
        citation: n.citation,
        layer: n.layer
      })),
      layersUsed: retrieval.meta.layersUsed
    });
  }

  return NextResponse.json({
    ok: true,
    answer: cleanAnswer.trim(),
    citations: cleanCitations,
    confidence: finalConfidence,
    escalate: finalEscalate,
    nodesUsed: retrieval.nodes
      .filter((n) => cleanCitations.includes(n.id))
      .map((n) => ({
        id: n.id,
        title: n.title,
        citation: n.citation,
        layer: n.layer
      })),
    layersUsed: retrieval.meta.layersUsed
  });
}
