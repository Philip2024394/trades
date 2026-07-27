// POST /api/admin/image-tagger/save
//
// Receives the tagger's payload (URL → manifest row) and merges it
// into data/nex-image-manifest.json. Existing rows for URLs not in
// the payload are preserved. Adds / updates rows for URLs in the
// payload.
//
// Per ADR-0024: the manifest is git-versioned and this endpoint is
// the single write path from the retroactive tagger. Direct edits
// to the JSON file are also fine.

import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { parseWithInheritance } from "@/lib/nex/images/knowledgeParser";
import {
  validateImageKnowledge,
  type ValidationFlag,
} from "@/lib/nex/images/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ManifestRow = {
  source?: string;
  original_prompt?: string | null;
  description?: string;
  master_ai_prompt?: string;
  tags?: string[];
  a_plus?: boolean;
  subject_domain?: string;
  created_at?: string;
  created_by?: string;
  notes?: string;
  // ADR-0026 knowledge fields written by the parser
  image_dna?: unknown;
  ai_intent?: unknown;
  locked_attributes?: unknown;
  material_journey?: unknown;
  objects?: unknown;
  // ADR-0027 Rule #11 fields
  image_type?: string;
  image_purpose?: unknown;
  can_become?: string[];
  collection_id?: string;
  // ADR-0027 v1.2 (Rules #12/13/14 + ADR-0028)
  family_tree?: unknown;
  geometry_preservation?: unknown;
  learning_signals?: unknown[];
  // ADR-0032 MASTER IMAGE SCORE + ADR-0035 knowledge band
  master_image_score?: {
    image_intelligence: number;
    collection_intelligence: number;
    relationship_intelligence: number;
    future_intelligence: number;
    creative_intelligence: number;
    master_score: number;
  };
  primary_brain?: string | null;
  collection_memberships?: string[];
  knowledge_band?: string;
  knowledge_band_label?: string;
  // Validation output — set by this endpoint, not client
  validation_flags?: ValidationFlag[];
  validation_flags_at?: string;
};

type ManifestFile = {
  version: number;
  generated_at?: string;
  description?: string;
  images: Record<string, ManifestRow>;
};

const MANIFEST_PATH = path.join(
  process.cwd(),
  "data",
  "nex-image-manifest.json"
);
const BACKUP_DIR = path.join(process.cwd(), "data", ".manifest-backups");
const BACKUP_KEEP = 50;

// ─── Concurrency + durability (added 2026-07-27 after 909-row corruption) ───
//
// Node's fs.writeFile is NOT atomic across concurrent callers. Six parallel
// POSTs each did: read manifest → modify → write. Last write won; 1010 rows
// collapsed to 1. Two guards prevent recurrence:
//   1. Module-level Promise chain (writeQueue) serialises every writer in
//      this process — the next request waits for the previous one to finish
//      its full read-modify-write cycle.
//   2. Every write goes to a .tmp file first, then fs.rename() atomically
//      swaps it in — an interrupted write can never leave the manifest
//      half-parseable.
// Plus: before each successful rename, the current manifest is copied to
// data/.manifest-backups/manifest-YYYYMMDD-HHMMSS-mmm.json. Last 50 are kept.

let writeQueue: Promise<unknown> = Promise.resolve();

function runSerialized<T>(fn: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(fn, fn);
  writeQueue = next.catch(() => undefined);
  return next;
}

async function backupManifest(): Promise<string | null> {
  try {
    const raw = await fs.readFile(MANIFEST_PATH, "utf8");
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    const ts = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .replace("T", "-")
      .slice(0, 23);
    const backupPath = path.join(BACKUP_DIR, `manifest-${ts}.json`);
    await fs.writeFile(backupPath, raw, "utf8");
    // Prune to last BACKUP_KEEP files
    const entries = await fs.readdir(BACKUP_DIR);
    const backups = entries
      .filter((n) => n.startsWith("manifest-") && n.endsWith(".json"))
      .sort();
    if (backups.length > BACKUP_KEEP) {
      const toDelete = backups.slice(0, backups.length - BACKUP_KEEP);
      await Promise.all(
        toDelete.map((n) =>
          fs.unlink(path.join(BACKUP_DIR, n)).catch(() => undefined)
        )
      );
    }
    return backupPath;
  } catch {
    // If backup fails (e.g., manifest doesn't exist yet), continue — do
    // not block the write path.
    return null;
  }
}

async function atomicWriteManifest(manifest: ManifestFile): Promise<void> {
  const tmpPath = MANIFEST_PATH + ".tmp." + process.pid + "." + Date.now();
  await fs.writeFile(tmpPath, JSON.stringify(manifest, null, 2), "utf8");
  await fs.rename(tmpPath, MANIFEST_PATH);
}

export async function POST(req: NextRequest) {
  let payload: { images?: Record<string, ManifestRow> };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 }
    );
  }
  const incoming = payload?.images ?? {};
  if (typeof incoming !== "object") {
    return NextResponse.json(
      { ok: false, error: "images_must_be_object" },
      { status: 400 }
    );
  }

  // Serialise the entire read-modify-write cycle. Concurrent POSTs from a
  // batch script would otherwise race on the shared file. Backup + atomic
  // rename inside the same critical section.
  return runSerialized(() => processWrite(incoming));
}

async function processWrite(incoming: Record<string, ManifestRow>) {
  // Auto-backup BEFORE modifying — recovery snapshot of the last-known-good state
  const backupPath = await backupManifest();

  // Read current manifest (create if missing)
  let manifest: ManifestFile;
  try {
    const raw = await fs.readFile(MANIFEST_PATH, "utf8");
    manifest = JSON.parse(raw) as ManifestFile;
  } catch {
    manifest = {
      version: 1,
      generated_at: new Date().toISOString(),
      description:
        "NEX image manifest — canonical index of every image asset in the app with subject metadata, generation prompt (if AI), and tags. Per ADR-0024.",
      images: {},
    };
  }
  if (!manifest.images) manifest.images = {};

  // Merge incoming rows (URL-keyed; preserves untouched rows).
  // Per ADR-0026 + ADR-0027 v1.1 every save runs the parser to derive
  // structured knowledge (image_dna, ai_intent, locked_attributes,
  // material_journey, objects, image_type, image_purpose, can_become)
  // + runs the validation gate to attach validation_flags.
  let added = 0;
  let updated = 0;
  const perRowFlags: Record<string, ValidationFlag[]> = {};
  for (const [url, row] of Object.entries(incoming)) {
    if (typeof url !== "string" || !url.startsWith("http")) continue;

    // Parser: derive all structured knowledge from the authored inputs.
    // ADR-0030: parseWithInheritance runs the 6-level intelligence
    // stack — collection intelligence, base parser, auto-generated
    // MASTER AI PROMPT — before returning. Validator receives the
    // overall_confidence so it doesn't flag rows that inheritance
    // already resolved above the 85% floor.
    const description = row.description ?? "";
    const { knowledge, inheritance } = await parseWithInheritance({
      master_description: description,
      master_ai_prompt: row.master_ai_prompt ?? row.original_prompt ?? null,
    });

    // Validation gate — attach Rule #4/6/10/11 flags, aware of inheritance
    const flags = await validateImageKnowledge(knowledge, {
      overall_confidence: inheritance.overall_confidence,
      master_ai_prompt_auto_generated: inheritance.master_ai_prompt_auto_generated,
      fields_inherited: inheritance.fields_inherited,
    });
    perRowFlags[url] = flags;

    // ADR-0033 Rule #7 — HARD QUALITY GATE. Uses the SAME scoring
    // formula as the Global Intelligence Pipeline (ADR-0032 MASTER
    // IMAGE SCORE) so save + pipeline agree on the same image.
    // Previously this was a coarser 6-field variant which meant a row
    // could pass the pipeline (score 76) but fail the save (score 62).
    const dnaScalarFields = [
      knowledge.image_dna.STYLE.primary,
      knowledge.image_dna.STYLE.secondary,
      knowledge.image_dna.STYLE.photographic,
      knowledge.image_dna.CAMERA.view,
      knowledge.image_dna.CAMERA.orientation,
      knowledge.image_dna.CAMERA.height,
      knowledge.image_dna.MATERIALS.primary,
      knowledge.image_dna.MATERIALS.secondary,
      knowledge.image_dna.LIGHTING.primary,
      knowledge.image_dna.QUALITY.realism,
      knowledge.image_dna.QUALITY.rendering,
      knowledge.image_dna.SETTING.primary,
    ];
    const dnaFilled = dnaScalarFields.filter(Boolean).length;
    const image_intelligence = Math.round((dnaFilled / 12) * 20);

    // Collection Intelligence — same as pipeline: 3 pts per collection + 5 base.
    // Uses the multi-collection knowledge (ADR-0032 Knowledge Master) so a
    // rich description that touches 5 collections scores 20/20, matching
    // what the Global Intelligence Pipeline computes for the same row.
    const collectionMemberships = knowledge.collection_memberships ?? [];
    const collection_intelligence = Math.min(
      20,
      collectionMemberships.length * 3 + (collectionMemberships.length > 0 ? 5 : 0)
    );

    // Relationship Intelligence — parent + siblings
    const relationship_intelligence = Math.min(
      20,
      (knowledge.family_tree?.children?.length ?? 0) * 4 +
        (knowledge.family_tree?.parent_url ? 4 : 0) +
        (knowledge.material_journey ? 4 : 0)
    );

    // Future Intelligence — recreation readiness
    const promptOK = knowledge.master_ai_prompt && knowledge.master_ai_prompt.length > 80 ? 8 : 0;
    const lockedOK = (knowledge.locked_attributes?.must_keep?.length ?? 0) > 0 ? 4 : 0;
    const canBecomeOK = Math.min(6, knowledge.can_become?.length ?? 0);
    const journeyOK = knowledge.material_journey ? 2 : 0;
    const future_intelligence = promptOK + lockedOK + canBecomeOK + journeyOK;

    // Creative Intelligence — derivative-type richness
    const creative_intelligence = Math.min(20, (knowledge.can_become?.length ?? 0) * 3);

    const master_score =
      image_intelligence +
      collection_intelligence +
      relationship_intelligence +
      future_intelligence +
      creative_intelligence;

    // ADR-0035 · SECOND LAW — knowledge is never rejected, only classified.
    // Every save succeeds. Row is classified into one of 7 bands
    // (Master · Excellent · Good · Specialist · Reference · Limited · Visual).
    // `primary_brain: null` no longer refused — the row saves classified,
    // and the classifier can be re-run later when more collection
    // intelligence exists. `draft_only` REMOVED per ADR-0035.
    const { knowledgeBandFromScore, knowledgeBandLabel } = await import(
      "@/lib/nex/images/knowledgeParser"
    );
    const knowledge_band = knowledgeBandFromScore(master_score);
    const knowledge_band_label = knowledgeBandLabel(knowledge_band);
    row.a_plus = row.a_plus ?? (master_score >= 85);
    (row as { master_image_score?: unknown }).master_image_score = {
      image_intelligence,
      collection_intelligence,
      relationship_intelligence,
      future_intelligence,
      creative_intelligence,
      master_score,
    };
    (row as { primary_brain?: string | null }).primary_brain = knowledge.primary_brain;
    (row as { knowledge_band?: string }).knowledge_band = knowledge_band;
    (row as { knowledge_band_label?: string }).knowledge_band_label = knowledge_band_label;

    // Preserve family_tree.children[] and learning_signals[] across
    // saves — Rule #14/#12. Parser returns empty defaults; anything
    // already accumulated on the existing row survives.
    const existing = manifest.images[url];
    const preservedFamilyTree = existing?.family_tree
      ? existing.family_tree
      : knowledge.family_tree;
    const preservedLearningSignals =
      Array.isArray(existing?.learning_signals) && existing!.learning_signals!.length > 0
        ? existing!.learning_signals
        : knowledge.learning_signals;

    // Build the merged manifest row: user-authored fields + parser-derived
    // knowledge + validation flags. User values take precedence for the
    // few fields both provide (a_plus, tags — user may override).
    const merged: ManifestRow = {
      // authored / preserved
      source: row.source ?? "ai_generated",
      original_prompt: knowledge.master_ai_prompt || row.original_prompt || null,
      description: knowledge.master_description,
      master_ai_prompt: knowledge.master_ai_prompt,
      created_at: row.created_at ?? new Date().toISOString(),
      created_by: row.created_by ?? "philip",
      notes: row.notes ?? "",
      // user-editable structured (allow client overrides)
      tags: row.tags && row.tags.length > 0 ? row.tags : knowledge.tags,
      a_plus: row.a_plus ?? knowledge.a_plus,
      subject_domain: row.subject_domain ?? knowledge.subject_domain,
      // parser-derived knowledge (never overridden by client)
      image_dna: knowledge.image_dna,
      ai_intent: knowledge.ai_intent,
      locked_attributes: knowledge.locked_attributes,
      material_journey: knowledge.material_journey,
      objects: knowledge.objects,
      // Rule #11 fields
      image_type: knowledge.image_type,
      image_purpose: knowledge.image_purpose,
      can_become: knowledge.can_become,
      collection_id: knowledge.collection_id,
      // Rules #12/13/14 fields — family_tree children and
      // learning_signals accumulate across saves (never reset).
      family_tree: preservedFamilyTree,
      geometry_preservation: knowledge.geometry_preservation,
      learning_signals: preservedLearningSignals,
      // ADR-0032 · MASTER IMAGE SCORE (5-axis) + ADR-0035 · knowledge band
      master_image_score: {
        image_intelligence,
        collection_intelligence,
        relationship_intelligence,
        future_intelligence,
        creative_intelligence,
        master_score,
      },
      primary_brain: knowledge.primary_brain,
      collection_memberships: knowledge.collection_memberships,
      knowledge_band,
      knowledge_band_label,
      // Validation output
      validation_flags: flags,
      validation_flags_at: new Date().toISOString(),
    };

    if (manifest.images[url]) updated++;
    else added++;
    manifest.images[url] = merged;
  }

  manifest.generated_at = new Date().toISOString();

  await atomicWriteManifest(manifest);

  return NextResponse.json({
    ok: true,
    added,
    updated,
    total_rows: Object.keys(manifest.images).length,
    manifest_path: "data/nex-image-manifest.json",
    backup_path: backupPath
      ? path.relative(process.cwd(), backupPath).replace(/\\/g, "/")
      : null,
    validation_flags: perRowFlags,
  });
}
