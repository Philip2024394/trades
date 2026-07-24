// Brain Growth stats aggregator — computes a Brain's growth signal
// from real substrate state (drafts + extraction runs + admin queue).
//
// Numbers start at zero. They grow as the Author uses Teach Nex and
// as the Admin approves candidates. Every metric is grounded in real
// signal — placeholders (FAQs, Knowledge Graph Links) are surfaced
// as `null` rather than fabricated.

import "server-only";
import { listDraftsForBrain } from "./_draft_store";
import { listRuns } from "./_extraction/_queue";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const CONFIDENCE_SCORE: Record<string, number> = { low: 0.5, medium: 0.7, high: 0.9 };

export type BrainStats = {
  brain_slug:              string;
  computed_at:             string;

  // Real signal — grounded in draft / candidate state:
  questions_learned:       number;            // extraction runs count
  knowledge_nodes:         number;            // author-accepted or edited candidates
  expert_observations:     number;            // craft.fact accepted
  vision_rules:            number;            // defects with vision_hints
  estimation_rules:        number;            // pricing_model rules in draft
  regulations_captured:    number;            // regulations entries in draft
  materials_captured:      number;            // materials entries in draft
  workflow_playbooks:      number;            // workflow playbooks in draft
  defects_captured:        number;            // defects entries in draft
  craft_facts_in_draft:    number;            // total craft.facts in draft (author + admin approved)

  // Governance signal:
  author_approved_total:   number;            // author status=accepted+edited across all runs
  admin_approved_total:    number;            // admin_status=approved
  admin_pending_review:    number;            // admin_status=unreviewed (admin queue length)
  admin_rejected_total:    number;
  admin_sent_back_total:   number;
  admin_changes_requested: number;
  admin_merged_total:      number;

  // Aggregate quality signal:
  confidence_pct:          number | null;     // weighted avg across draft items (0-100)
  brain_coverage_pct:      number;            // v1_modules_present count / 6 * 100

  // Placeholders — no real signal yet, surfaced honestly:
  faqs:                    number | null;     // FAQ concept not yet a first-class schema type
  knowledge_graph_links:   number | null;     // Per-node graph edges not yet tracked
};

export async function computeBrainStats(brain_slug: string): Promise<BrainStats> {
  const drafts = await listDraftsForBrain(brain_slug);
  const runs   = await listRuns(brain_slug);

  // Extraction-driven metrics.
  let questions_learned  = runs.length;
  let knowledge_nodes    = 0;
  let expert_observations = 0;
  let author_approved_total   = 0;
  let admin_approved_total    = 0;
  let admin_pending_review    = 0;
  let admin_rejected_total    = 0;
  let admin_sent_back_total   = 0;
  let admin_changes_requested = 0;
  let admin_merged_total      = 0;

  for (const run of runs) {
    for (const c of run.candidates) {
      const authorAccepted = c.status === "accepted" || c.status === "edited";
      if (authorAccepted) {
        author_approved_total++;
        knowledge_nodes++;
        if (c.kind === "craft.fact") expert_observations++;
      }
      const admin = c.admin_status ?? "unreviewed";
      if (authorAccepted) {
        if (admin === "approved")            admin_approved_total++;
        else if (admin === "rejected")       admin_rejected_total++;
        else if (admin === "sent_back")      admin_sent_back_total++;
        else if (admin === "changes_requested") admin_changes_requested++;
        else if (admin === "merged")         admin_merged_total++;
        else if (admin === "unreviewed")     admin_pending_review++;
      }
    }
  }

  // Draft-module content metrics.
  let vision_rules          = 0;
  let estimation_rules      = 0;
  let regulations_captured  = 0;
  let materials_captured    = 0;
  let workflow_playbooks    = 0;
  let defects_captured      = 0;
  let craft_facts_in_draft  = 0;
  let brain_coverage_pct    = 0;

  // Confidence aggregation across all draft items.
  const confidenceValues: number[] = [];

  for (const d of drafts) {
    const payload = d.payload as Record<string, unknown>;
    switch (d.module) {
      case "craft": {
        const facts = (payload.facts as Array<{ confidence?: string }>) ?? [];
        craft_facts_in_draft += facts.length;
        for (const f of facts) if (f.confidence && CONFIDENCE_SCORE[f.confidence] != null) confidenceValues.push(CONFIDENCE_SCORE[f.confidence]);
        break;
      }
      case "regulations": {
        const regs = (payload.regulations as Array<{ confidence?: string }>) ?? [];
        regulations_captured = regs.length;
        for (const r of regs) if (r.confidence && CONFIDENCE_SCORE[r.confidence] != null) confidenceValues.push(CONFIDENCE_SCORE[r.confidence]);
        break;
      }
      case "materials": {
        const mats = (payload.materials as Array<{ confidence?: string }>) ?? [];
        materials_captured = mats.length;
        for (const m of mats) if (m.confidence && CONFIDENCE_SCORE[m.confidence] != null) confidenceValues.push(CONFIDENCE_SCORE[m.confidence]);
        break;
      }
      case "workflow": {
        const pbs = (payload.playbooks as Array<{ confidence?: string }>) ?? [];
        workflow_playbooks = pbs.length;
        for (const p of pbs) if (p.confidence && CONFIDENCE_SCORE[p.confidence] != null) confidenceValues.push(CONFIDENCE_SCORE[p.confidence]);
        break;
      }
      case "defects": {
        const defs = (payload.defects as Array<{ confidence?: string; vision_hints?: string[] }>) ?? [];
        defects_captured = defs.length;
        for (const d0 of defs) {
          if (d0.confidence && CONFIDENCE_SCORE[d0.confidence] != null) confidenceValues.push(CONFIDENCE_SCORE[d0.confidence]);
          if (Array.isArray(d0.vision_hints) && d0.vision_hints.length > 0) vision_rules++;
        }
        break;
      }
      case "pricing_model": {
        const rules = (payload.rules as Array<{ confidence?: string }>) ?? [];
        estimation_rules = rules.length;
        for (const r of rules) if (r.confidence && CONFIDENCE_SCORE[r.confidence] != null) confidenceValues.push(CONFIDENCE_SCORE[r.confidence]);
        break;
      }
      case "manifest": {
        const m = payload as { v1_modules_present?: string[] };
        const present = Array.isArray(m.v1_modules_present) ? m.v1_modules_present.length : 0;
        brain_coverage_pct = Math.round((present / 6) * 100);
        break;
      }
    }
  }

  const confidence_pct = confidenceValues.length === 0
    ? null
    : Math.round((confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length) * 100);

  return {
    brain_slug,
    computed_at:             new Date().toISOString(),
    questions_learned,
    knowledge_nodes,
    expert_observations,
    vision_rules,
    estimation_rules,
    regulations_captured,
    materials_captured,
    workflow_playbooks,
    defects_captured,
    craft_facts_in_draft,
    author_approved_total,
    admin_approved_total,
    admin_pending_review,
    admin_rejected_total,
    admin_sent_back_total,
    admin_changes_requested,
    admin_merged_total,
    confidence_pct,
    brain_coverage_pct,
    faqs:                  null,
    knowledge_graph_links: null
  };
}
