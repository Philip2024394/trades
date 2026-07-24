// Overnight prep — the "what happened while you slept" run.
//
// Builds the approval queue + surfaces top highlights + text-formats
// a briefing. Nothing sends. Everything remains awaiting_approval.

import { buildApprovalQueue } from "./queue";
import type { OvernightRun, PreparedAction, PreparedActionCategory } from "./types";

export type BuildOvernightInput = {
  merchantSlug: string;
  now?:         Date;
};

export async function buildOvernightRun(input: BuildOvernightInput): Promise<OvernightRun> {
  const now = input.now ?? new Date();
  const queue = await buildApprovalQueue({ merchantSlug: input.merchantSlug, now });

  const highlights = queue.actions.slice(0, 5).map((a) => ({
    headline: a.headline,
    category: a.category as PreparedActionCategory
  }));

  return {
    merchant_slug:  input.merchantSlug,
    ran_at:         now.toISOString(),
    prepared_count: queue.actions.length,
    auto_approved:  queue.auto_approvable.length,
    highlights,
    queue,
    errors:         queue.errors.map((e) => `${e.module}: ${e.error}`)
  };
}

/** Text renderer — one plain-English block Nex can speak / show in a
 *  morning email. */
export function overnightRunToText(run: OvernightRun): string {
  const lines: string[] = [];
  lines.push(`Overnight run — ${run.ran_at.slice(0, 10)}`);
  lines.push("");
  lines.push(`Prepared: ${run.prepared_count} action${run.prepared_count === 1 ? "" : "s"} awaiting your approval.`);
  if (run.auto_approved > 0) lines.push(`Auto-approved (per your policy): ${run.auto_approved}.`);
  else                       lines.push("Auto-approved: 0 (mode is Manual — everything waits for you).");
  if (run.highlights.length > 0) {
    lines.push("");
    lines.push("Top items:");
    for (const h of run.highlights) lines.push(`- ${h.headline}`);
  }
  if (run.errors.length > 0) {
    lines.push("");
    lines.push("Modules that hit an error:");
    for (const e of run.errors) lines.push(`- ${e}`);
  }
  return lines.join("\n");
}

/** Text renderer for a full approval queue. */
export function approvalQueueToText(actions: PreparedAction[]): string {
  if (actions.length === 0) return "Nothing awaits your approval right now.";
  const lines: string[] = [`${actions.length} action${actions.length === 1 ? "" : "s"} awaiting your approval:`];
  for (const a of actions) {
    lines.push("");
    lines.push(`- [${a.severity}] ${a.headline}`);
    lines.push(`  Reason: ${a.reason}`);
    lines.push(`  If approved: ${a.preview_of_effect}`);
    if (a.action_url) lines.push(`  Open: ${a.action_url}`);
  }
  return lines.join("\n");
}
