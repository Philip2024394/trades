// Signal runner. For one user, invokes every relevant detector and
// upserts the results. Also clears out stale signals for kinds that
// stopped firing so the widget doesn't show dead nudges.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { detectorsForSurface } from "./registry";
import type { MateSignal } from "./types";

export type RunOutcome = {
  userKey:     string;
  detectors:   number;
  fired:       number;
  cleared:     number;
  errors:      number;
};

export async function runSignalsForUser(surface: "merchant" | "homeowner", userKey: string): Promise<RunOutcome> {
  const dets = detectorsForSurface(surface);
  let fired = 0, errors = 0;
  const firedKinds = new Set<string>();

  for (const d of dets) {
    try {
      const sig = await d.detect({ surface, userKey });
      if (sig) {
        await upsertSignal(surface, userKey, sig);
        fired++;
        firedKinds.add(sig.kind);
      }
    } catch (e) {
      errors++;
      console.error(`[mate/signals] detector ${d.kind} threw for ${userKey}:`, e);
    }
  }

  // Clear signals from detectors that used to fire for this user but
  // didn't this round. Only touches 'new' status — a signal the user
  // has already read/actioned stays as-is.
  const stale = await supabaseAdmin
    .from("hammerex_mate_signals")
    .select("id, kind")
    .eq("surface", surface)
    .eq("user_key", userKey)
    .eq("status", "new");

  let cleared = 0;
  for (const row of stale.data ?? []) {
    if (!firedKinds.has(row.kind)) {
      await supabaseAdmin
        .from("hammerex_mate_signals")
        .update({ status: "dismissed" })
        .eq("id", row.id);
      cleared++;
    }
  }

  return { userKey, detectors: dets.length, fired, cleared, errors };
}

async function upsertSignal(surface: "merchant" | "homeowner", userKey: string, sig: MateSignal): Promise<void> {
  // If a NEW signal of this kind already exists, refresh its content
  // in place (keeps the same id + generated_at ordering). If it was
  // read/actioned, re-fire it as new so the badge lights up again.
  const existing = await supabaseAdmin
    .from("hammerex_mate_signals")
    .select("id, status")
    .eq("surface", surface)
    .eq("user_key", userKey)
    .eq("kind", sig.kind)
    .maybeSingle();

  if (existing.data) {
    const wasClosed = existing.data.status === "read" || existing.data.status === "actioned" || existing.data.status === "dismissed";
    await supabaseAdmin
      .from("hammerex_mate_signals")
      .update({
        priority:     sig.priority,
        title:        sig.title,
        body:         sig.body,
        action_url:   sig.action_url  ?? null,
        action_label: sig.action_label ?? null,
        metadata:     sig.metadata ?? {},
        status:       wasClosed ? "new" : existing.data.status,
        generated_at: new Date().toISOString(),
        read_at:      wasClosed ? null : undefined,
        actioned_at:  wasClosed ? null : undefined
      })
      .eq("id", existing.data.id);
    return;
  }

  await supabaseAdmin
    .from("hammerex_mate_signals")
    .insert({
      surface,
      user_key:     userKey,
      kind:         sig.kind,
      priority:     sig.priority,
      title:        sig.title,
      body:         sig.body,
      action_url:   sig.action_url  ?? null,
      action_label: sig.action_label ?? null,
      metadata:     sig.metadata ?? {}
    });
}
