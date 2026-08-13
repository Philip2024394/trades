// Voice Intelligence Platform · explain() MVP.
//
// Constitutional rule: Voice reads · never invents. If the required evidence
// isn't in the context · Voice REFUSES (returns `refused` field) rather than
// hallucinate an explanation.
//
// Doctrine: docs/brains/nex-phase-e3-e8-roadmap-and-design-history-philip-2026-08-04.md

import type { VoiceContext, VoiceExplanation, VoiceQuery, VoiceEvidence } from "./types";

const VOICE_VERSION = "e7_voice_mvp_1.0";

function refuse(reason: string): VoiceExplanation {
  return {
    answer: `I don't have enough recorded design evidence to answer that. ${reason}`,
    evidence: [],
    confidence: "low",
    refused: { reason },
    generated_at: new Date().toISOString(),
  };
}

function getAt(doc: unknown, path?: string): unknown {
  if (!path) return undefined;
  const segs = path.startsWith("/") ? path.slice(1).split("/") : path.split("/");
  let cur: unknown = doc;
  for (const s of segs) {
    if (cur == null) return undefined;
    const key = /^\d+$/.test(s) ? Number(s) : s;
    cur = (cur as Record<string | number, unknown>)[key as string];
  }
  return cur;
}

export function explain<Doc>(query: VoiceQuery, ctx: VoiceContext<Doc>): VoiceExplanation {
  const now = new Date().toISOString();
  const evidence: VoiceEvidence[] = [];

  switch (query.intent) {
    case "what_is": {
      const value = getAt(ctx.design_document, query.target_path);
      if (value === undefined) return refuse("The requested part of the design isn't in the current Design Document.");
      evidence.push({ source: "design_document", reference: query.target_path ?? "/", snippet: JSON.stringify(value) });
      return {
        answer: `At ${query.target_path}, the current design specifies: ${JSON.stringify(value)}.`,
        evidence, confidence: "high", generated_at: now,
      };
    }

    case "why_choice": {
      // Voice reads the render manifest's provenance chain if available.
      const provenance = (ctx.render_manifest as { provenance?: { reasoning_chain?: readonly string[]; knowledge_citations?: readonly string[]; campaign_engine?: string } } | undefined)?.provenance;
      if (!provenance || !provenance.reasoning_chain?.length) {
        return refuse("No reasoning chain was recorded in the render manifest for this decision.");
      }
      evidence.push({ source: "render_manifest", reference: "provenance.reasoning_chain", snippet: provenance.reasoning_chain.join(" · ") });
      for (const c of provenance.knowledge_citations ?? []) {
        evidence.push({ source: "design_document", reference: c });
      }
      return {
        answer: `That choice traces to: ${provenance.reasoning_chain.join(" · ")}${provenance.campaign_engine ? ` (campaign: ${provenance.campaign_engine})` : ""}.`,
        evidence, confidence: "high", generated_at: now,
      };
    }

    case "how_wide":
    case "cost_estimate":
    case "maintenance": {
      const path = query.target_path;
      const materialLookup = path && ctx.material_lookups ? ctx.material_lookups[path] : undefined;
      const spatial = path && ctx.spatial_measurements ? ctx.spatial_measurements[path] : undefined;
      if (query.intent === "how_wide" && spatial) {
        evidence.push({ source: "spatial_measurement", reference: path!, snippet: JSON.stringify(spatial) });
        return { answer: `Measured value at ${path}: ${JSON.stringify(spatial)}.`, evidence, confidence: "high", generated_at: now };
      }
      if ((query.intent === "cost_estimate" || query.intent === "maintenance") && materialLookup) {
        evidence.push({ source: "material_intelligence", reference: path!, snippet: JSON.stringify(materialLookup) });
        return { answer: `From the material record at ${path}: ${JSON.stringify(materialLookup)}.`, evidence, confidence: "high", generated_at: now };
      }
      return refuse(`No ${query.intent === "how_wide" ? "spatial measurement" : "material record"} recorded for ${path}.`);
    }

    case "can_be_built": {
      const report = ctx.reality_report as { classification?: string; scores?: { reality_score?: number }; concerns?: readonly { severity: string; message: string }[] } | undefined;
      if (!report) return refuse("No Reality Advisor report exists for the current design.");
      evidence.push({ source: "reality_report", reference: "classification", snippet: report.classification });
      const concernsList = (report.concerns ?? []).map((c) => `[${c.severity}] ${c.message}`).join(" · ");
      return {
        answer: `Reality classification: ${report.classification} (reality score ${report.scores?.reality_score ?? "?"}). ${concernsList || "No concerns recorded."}`,
        evidence, confidence: "high", generated_at: now,
      };
    }

    case "show_alternatives": {
      const alts = ctx.recommendations ?? [];
      if (alts.length === 0) return refuse("No stored alternative recommendations for this design.");
      evidence.push({ source: "recommendation", reference: "recommendations", snippet: `${alts.length} alternatives on file` });
      return { answer: `There are ${alts.length} recorded alternatives.`, evidence, confidence: "medium", generated_at: now };
    }

    case "explain_evolution": {
      const dh = ctx.design_history as { entries?: readonly { version: number; operation: { reason?: string; target_path: string; kind: string } }[] } | undefined;
      if (!dh?.entries || dh.entries.length === 0) return refuse("No design history recorded for this document.");
      const summary = dh.entries.map((e) => `v${e.version}: ${e.operation.kind}@${e.operation.target_path}${e.operation.reason ? ` — ${e.operation.reason}` : ""}`).join(" · ");
      evidence.push({ source: "design_history", reference: "entries", snippet: `${dh.entries.length} operations` });
      return { answer: `The design evolved through: ${summary}`, evidence, confidence: "high", generated_at: now };
    }

    case "custom":
    default:
      return refuse("Custom intent · Voice needs a specific evidence path to answer.");
  }
}

export const VOICE_INTELLIGENCE_VERSION = VOICE_VERSION;
