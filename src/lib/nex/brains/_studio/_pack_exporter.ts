// Author Studio pack exporter — turns approved draft modules into a
// BrainPack (the shape the substrate loader accepts) and, in dev,
// writes JSON files under `src/lib/nex/brains/<slug>/`.
//
// The exporter is validation-first: every module is re-validated
// against its Zod schema before it's added to the pack. Refuses to
// export a partial V1 pack (all 6 required modules must exist per
// ADR-0017 §2 boot audit).

import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  BrainManifestSchema,
  MODULE_SCHEMAS,
  V1_MODULE_NAMES,
  type V1ModuleName
} from "@/lib/nex/brains/_schema";
import { loadBrain } from "@/lib/nex/brains/_loader";
import type { BrainPack, LoadedBrain } from "@/lib/nex/brains/_types";
import { listDraftsForBrain, readDraft } from "./_draft_store";
import { listRuns } from "./_extraction/_queue";
import type { ExtractionCandidate } from "./_extraction/types";

export type ExportMode = "draft" | "published";

export type ExportResult =
  | { ok: true; pack: BrainPack; loaded: LoadedBrain; mode: ExportMode; admin_gate_pending?: PendingCandidateSummary[] }
  | { ok: false; reason: "missing_manifest" | "missing_module" | "invalid_module" | "invalid_manifest" | "load_failed" | "admin_gate_blocked"; detail: string; missing?: V1ModuleName[]; pending?: PendingCandidateSummary[] };

export type PendingCandidateSummary = {
  candidate_id: string;
  run_id:       string;
  kind:         string;
  admin_status: string;
  author_status: string;
};

/** Build a BrainPack from the drafts for a given brain_slug.
 *
 *  `mode: "draft"` (default) returns everything the Author has accepted
 *  — visible to the Author in the Studio preview.
 *
 *  `mode: "published"` runs the Admin publish gate first: if any
 *  Author-Accepted candidate is not yet Admin-Approved (i.e. it's
 *  unreviewed, sent_back, or changes_requested), the export is
 *  refused with `admin_gate_blocked`. Only when every candidate has
 *  a terminal Admin decision (approved / rejected / merged) does the
 *  published pack build.
 *
 *  This is the enforcement of the user's rule: "Author approval alone
 *  is not enough. Administrator approval is mandatory." */
export async function exportPackFromDrafts(brain_slug: string, mode: ExportMode = "draft"): Promise<ExportResult> {
  // Publish gate — refuses if any Author-accepted candidate lacks a
  // terminal Admin decision. Runs BEFORE we spend time validating
  // module drafts so callers get the actionable error fast.
  if (mode === "published") {
    const pending = await pendingAdminDecisions(brain_slug);
    if (pending.length > 0) {
      return {
        ok: false,
        reason: "admin_gate_blocked",
        detail: `${pending.length} Author-accepted candidate(s) still awaiting Admin decision. Every candidate must be Admin-approved, rejected, or merged before published pack export.`,
        pending
      };
    }
  }

  const drafts = await listDraftsForBrain(brain_slug);

  const manifestDraft = drafts.find((d) => d.module === "manifest");
  if (!manifestDraft) return { ok: false, reason: "missing_manifest", detail: `No manifest draft for '${brain_slug}'` };

  const manifestParse = BrainManifestSchema.safeParse(manifestDraft.payload);
  if (!manifestParse.success) {
    return { ok: false, reason: "invalid_manifest", detail: manifestParse.error.message };
  }

  const modules: Partial<Record<V1ModuleName, unknown>> = {};
  const missing: V1ModuleName[] = [];

  for (const name of V1_MODULE_NAMES) {
    const draft = drafts.find((d) => d.module === name);
    if (!draft) { missing.push(name); continue; }
    const parsed = MODULE_SCHEMAS[name].safeParse(draft.payload);
    if (!parsed.success) {
      return { ok: false, reason: "invalid_module", detail: `${name}: ${parsed.error.message}` };
    }
    modules[name] = parsed.data;
  }

  if (missing.length > 0) {
    return { ok: false, reason: "missing_module", detail: `Missing V1 modules: ${missing.join(", ")}`, missing };
  }

  const pack: BrainPack = { manifest: manifestParse.data, modules };

  try {
    const loaded = loadBrain(pack);
    // If the caller asked for a draft pack, also surface how many
    // candidates are pending Admin review so the Author sees the gate.
    const admin_gate_pending = mode === "draft" ? await pendingAdminDecisions(brain_slug) : undefined;
    return { ok: true, pack, loaded, mode, admin_gate_pending };
  } catch (err) {
    return { ok: false, reason: "load_failed", detail: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Publish gate helper ────────────────────────────────────────

async function pendingAdminDecisions(brain_slug: string): Promise<PendingCandidateSummary[]> {
  const runs = await listRuns(brain_slug);
  const pending: PendingCandidateSummary[] = [];
  for (const run of runs) {
    for (const c of run.candidates) {
      if (isPendingAdmin(c)) {
        pending.push({
          candidate_id:  c.id,
          run_id:        run.run_id,
          kind:          c.kind,
          admin_status:  c.admin_status ?? "unreviewed",
          author_status: c.status
        });
      }
    }
  }
  return pending;
}

function isPendingAdmin(c: ExtractionCandidate): boolean {
  // Author must have accepted or edited-then-accepted this candidate.
  if (c.status !== "accepted" && c.status !== "edited") return false;
  const admin = c.admin_status ?? "unreviewed";
  // Terminal Admin decisions (never pending):
  //   approved · rejected · merged
  // Non-terminal (Admin action still needed):
  //   unreviewed · sent_back · changes_requested
  return admin === "unreviewed" || admin === "sent_back" || admin === "changes_requested";
}

/** Write the pack to `src/lib/nex/brains/<slug>/` as JSON files.
 *  Prefixed with `_studio_` in dev to avoid clashing with any hand-
 *  authored packs already there. Skips filesystem writes in production
 *  environments (production packs land via git PR, not runtime write). */
export async function writePackToDisk(brain_slug: string, pack: BrainPack): Promise<{ written: string[] }> {
  if (process.env.NODE_ENV === "production") return { written: [] };

  const dir = path.join(process.cwd(), "src", "lib", "nex", "brains", brain_slug, "_studio_exports");
  await fs.mkdir(dir, { recursive: true });

  const written: string[] = [];

  const manifestPath = path.join(dir, "manifest.json");
  await fs.writeFile(manifestPath, JSON.stringify(pack.manifest, null, 2), "utf8");
  written.push(manifestPath);

  for (const [name, payload] of Object.entries(pack.modules)) {
    const p = path.join(dir, `${name}.json`);
    await fs.writeFile(p, JSON.stringify(payload, null, 2), "utf8");
    written.push(p);
  }

  return { written };
}
