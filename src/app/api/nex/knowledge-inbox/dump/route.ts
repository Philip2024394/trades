// POST /api/nex/knowledge-inbox/dump
//
// Persists one text dump (Quick Dump textarea, note, or any typed
// content) to disk. Body:
//   { source: KnowledgeSource, title?: string, content: string }
//
// Returns the created item, or the existing duplicate if the sha256
// hash matches something already in the inbox. Duplicate detection
// is per the Knowledge Source doctrine: NEX never stores the same
// content twice.
//
// EVENT EMISSION (Phase 8 · 2026-08-07):
// On successful dump, emit a `knowledge_dumped` intelligence event so
// the Living Timeline, Operations History, and future Brain Router
// can observe every dump as a first-class event · not just a filesystem
// side effect. Fire-and-forget · never blocks the dump response.
// Doctrine: feedback_nex_knowledge_ingestion_event_and_truth_surface.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { coerceSource, saveTextItem } from "@/lib/nex/knowledge-inbox/storage";
import { emitAuditEvent } from "@/lib/nex/brain/audit-log";
import { emitEventSafe } from "@/lib/nex/events/fs-store";
import { createJobSafe } from "@/lib/nex/jobs/fs-store";
// W-OBS-1 Path A Layer 1 · ALS scope for HTTP → inbox → worker CID chain.
import { runFromRequest } from "@/lib/nex/observability/correlation";

// Parse the classification tag prepended by the Knowledge Dumping form.
// Form emits titles like: "[🏢 HQ · Marketing Knowledge · L2] Q3 plan"
// or                       "[🌍 Platform · Staircases · L1] Floating Guide"
// or                       "[🔬 Research · Competitor Analysis · L1] Rival X"
// If no tag present · returns nulls.
function parseClassificationTag(rawTitle: string | undefined): {
  destination: "hq" | "platform" | "research" | null;
  category_label: string | null;
  level: 1 | 2 | 3 | null;
  clean_title: string;
} {
  if (!rawTitle) return { destination: null, category_label: null, level: null, clean_title: "" };
  const m = rawTitle.match(/^\[([^\]]+)\]\s*(.*)$/);
  if (!m) return { destination: null, category_label: null, level: null, clean_title: rawTitle };
  const tag = m[1];
  const rest = m[2] ?? "";
  const parts = tag.split("·").map((s) => s.trim());
  const destPart = parts[0] ?? "";
  // Match emoji OR plain-text destination markers · defensive against
  // any transport that strips emoji (curl · terminals · older clients).
  const destLower = destPart.toLowerCase();
  const destination =
    destPart.includes("🏢") || destLower.includes("hq") || destLower.includes("headquarters") ? "hq"       :
    destPart.includes("🌍") || destLower.includes("platform")                                   ? "platform" :
    destPart.includes("🔬") || destLower.includes("research")                                   ? "research" :
                                                                                                   null;
  const category_label = parts[1] ?? null;
  const levelPart = parts[2] ?? "";
  const level =
    levelPart === "L1" ? 1 :
    levelPart === "L2" ? 2 :
    levelPart === "L3" ? 3 :
                         null;
  return { destination, category_label, level, clean_title: rest };
}

// Map a classified dump onto its target HQ Brains per doctrine.
// Keep in sync with HQ_CATEGORIES / PLATFORM_CATEGORIES / RESEARCH_CATEGORIES
// in operations-centre/page.tsx.
function brainsForClassification(destination: string | null, category_label: string | null): string[] {
  if (!destination) return [];
  if (destination === "hq") {
    if (category_label?.includes("Boss")) return ["All HQ Brains (Founder Decision Model)"];
    if (category_label?.includes("Legal")) return ["Legal Brain"];
    if (category_label?.includes("Privacy")) return ["Legal Brain", "Audience Intelligence Brain"];
    if (category_label?.includes("Marketing")) return ["Marketing Brain", "Brand Brain"];
    if (category_label?.includes("Sales")) return ["Sales Brain"];
    if (category_label?.includes("Customer Service")) return ["Customer Service Brain"];
    if (category_label?.includes("Finance")) return ["Finance Brain"];
    if (category_label?.includes("Operations")) return ["Operations Brain", "Executive Brain", "Internal Audit"];
    if (category_label?.includes("Security")) return ["Security Brain"];
    if (category_label?.includes("Strategy")) return ["Strategy Room", "Executive Brain"];
    return ["Executive Brain"];
  }
  if (destination === "platform") {
    if (category_label?.includes("Staircases"))    return ["Staircase Brain"];
    if (category_label?.includes("Kitchens"))      return ["Kitchen Brain"];
    if (category_label?.includes("Doors"))         return ["Door Brain"];
    if (category_label?.includes("Windows"))       return ["Window Brain"];
    if (category_label?.includes("Flooring"))      return ["Flooring Brain"];
    if (category_label?.includes("Joinery"))       return ["Joinery Brain"];
    if (category_label?.includes("Construction"))  return ["Construction Brain"];
    return ["Content Brain"];
  }
  if (destination === "research") {
    return ["Research & Innovation Lab (review)"];
  }
  return [];
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return runFromRequest(req, () => dumpHandler(req));
}

async function dumpHandler(req: NextRequest) {
  let body: { source?: unknown; title?: unknown; content?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) {
    return NextResponse.json({ ok: false, error: "empty_content" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title : undefined;
  const source = coerceSource(body.source);

  try {
    const { item, deduplicated } = await saveTextItem({ source, title, content });

    // TWO event emissions · both fire-and-forget · both survive the other failing.
    // (1) Supabase audit table — will populate once migration 004 is applied.
    // (2) Filesystem event bus — works TODAY · powers Living Timeline immediately.
    emitAuditEvent({
      worker_type: "system",
      event_type: "job_started",          // dump = first "job" in the pipeline
      actor: "user",
      job_id: item?.id ?? null,
      input_ref: title ?? null,
      details: {
        kind: "knowledge_dumped",
        source,
        title: title ?? null,
        content_length: content.length,
        deduplicated: Boolean(deduplicated),
      },
    });

    emitEventSafe({
      event_type: "knowledge_dumped",
      source: "human",
      actor_id: "admin",
      related_job: item?.id ?? null,
      related_department: "inbox",
      outcome: deduplicated ? "informational" : "success",
      payload: {
        source_kind: source,
        title: title ?? null,
        content_length: content.length,
        deduplicated: Boolean(deduplicated),
        item_id: item?.id ?? null,
      },
    });

    // Create a real Knowledge Job (only for genuinely new content · never
    // for duplicates that already have an in-flight or completed job).
    let job = null;
    if (!deduplicated) {
      const cls = parseClassificationTag(title);
      const target_brains = brainsForClassification(cls.destination, cls.category_label);
      const knowledge_type = cls.destination && cls.category_label
        ? `${cls.destination}:${cls.category_label}`
        : null;
      job = await createJobSafe({
        source: "Knowledge Dump",
        owner: "admin",
        knowledge_type,
        target_brains,
        inbox_item_id: item?.id ?? null,
        title: cls.clean_title || title || null,
        content_length: content.length,
      });
    }

    return NextResponse.json({ ok: true, item, deduplicated, job });
  } catch (err) {
    console.error("[knowledge-inbox.dump] save failed:", err);
    return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });
  }
}
