// WO-AGENT-RUNTIME-01 · Crawler brain (reference implementation).
//
// Founder-locked 2026-09-13: Crawler is the reference implementation.
// Make it genuinely world-class first, then clone the RUNTIME CONTRACT
// (not fake behaviour) to Discovery / Hypothesis / Experiment / Scoring
// / Proposal.
//
// Mission chain (every arrow evidenced):
//   Mission received → runtime already started → heartbeat emitted →
//   tool invoked (http_get) → authorised internet request → source
//   retrieved → content hashed → sanitised → memory consulted → memory
//   persisted → knowledge extracted → progress reported → result produced.

import { sha256Hex } from "@/lib/nex-intelligence/provenance";
import { authorityPermits } from "../authority-manifest";
import { checkAcquisitionPermitted, beginRequest, recordRequestOutcome, type HostPolicy } from "@/lib/nex-intelligence/host-rate-limiter";
import { listEligibleSources, pickNextEligibleSource, recordSourceOutcome, AUTHORISED_SOURCES } from "@/lib/nex-intelligence/source-registry";
import { guardianCheck } from "@/lib/nex-intelligence/source-guardian";
import { persistSourceRecord, persistSourceEntry } from "@/lib/nex-intelligence/source-pool";
import type { Mission, MissionResult, BrainToolContext } from "../runtime-loop";

// ── HTTP override contract (test-friendly · P-S deterministic) ─────────

export type HttpFetch = (url: string) => Promise<{ status: number; headers: Record<string, string>; body: Buffer }>;

/** Node.js built-in fetch wrapper. Real implementation.
 *  Founder-locked 2026-09-13: identifies the crawler with an honest
 *  User-Agent so upstream sources can rate-limit us appropriately. */
async function realHttpFetch(url: string): Promise<{ status: number; headers: Record<string, string>; body: Buffer }> {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": "NEX-Intelligence-Crawler/0.1 (research-grade evidence acquisition; +https://thenetworkers.app/nex)",
      "Accept": "application/atom+xml, application/xml, text/xml, */*;q=0.5",
    },
  });
  const buf = Buffer.from(await res.arrayBuffer());
  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => { headers[k] = v; });
  return { status: res.status, headers, body: buf };
}

// ── Fragment extraction (deterministic, no LLM · P-S) ──────────────────

interface CrawlerRawEntry {
  readonly kind: "atom_entry" | "raw_content";
  readonly raw_text: string;   // capped text extracted from the source
}

/** Founder-locked 2026-09-13: Crawler's responsibility is to acquire and
 *  parse into entries. Sanitizer does the actual canonicalisation +
 *  normalisation. Real intelligence processing lives in the Sanitizer. */
function extractRawEntries(body: Buffer, contentType: string): CrawlerRawEntry[] {
  const bodyStr = body.toString("utf8");
  const out: CrawlerRawEntry[] = [];
  if (contentType.includes("atom") || contentType.includes("xml") || bodyStr.includes("<entry")) {
    const entries = bodyStr.match(/<entry[^>]*>[\s\S]*?<\/entry>/g) ?? [];
    for (const entry of entries) {
      // Cap raw text at 8 KB per entry to keep GB rows bounded
      out.push({ kind: "atom_entry", raw_text: entry.slice(0, 8192) });
    }
  }
  if (out.length === 0 && body.length > 0) {
    // Non-Atom · take first 8 KB as one raw_content entry
    out.push({ kind: "raw_content", raw_text: bodyStr.slice(0, 8192) });
  }
  return out;
}

// ── Crawler brain ──────────────────────────────────────────────────────

export interface CrawlerBrainOptions {
  readonly http_fetch?: HttpFetch;
}

export function makeCrawlerBrain(opts: CrawlerBrainOptions = {}) {
  const httpFetch = opts.http_fetch ?? realHttpFetch;

  return async function crawlerBrain(mission: Mission, ctx: BrainToolContext): Promise<MissionResult> {
    const evidence_refs: string[] = [];
    let itemsProcessed = 0;

    // Every arrow evidenced. Each arrow = one heartbeat + persisted evidence.

    // Arrow 1: mission received (already emitted by runtime-loop). Nothing to do.

    // Arrow 2: consult memory FIRST (agent decides based on prior lessons)
    const priorLessons = await ctx.readMemory({ kind: "VALIDATED_LESSON", limit: 20 });
    await ctx.emitProgress({
      progress_counter: 1, last_completed_work: `memory consulted · ${priorLessons.length} prior lessons`,
      evidence_refs: [`memory:read:${priorLessons.length}-lessons`],
    });
    evidence_refs.push(`memory:read:${priorLessons.length}-lessons`);

    // Arrow 3 · SOURCE SELECTION (multi-source · founder-locked)
    // The mission may hint a URL, but we ALWAYS run it through the source
    // registry's rotation scheduler first — if the hinted host is cooling
    // off, rotate to the next eligible authorised source.
    const hintUrl = typeof mission.input.url === "string" ? mission.input.url : null;
    let selectedUrl = hintUrl;
    let selectedHost: string | null = null;
    let selectedSourceId: string | null = null;
    let selectedPolicy: Partial<Omit<HostPolicy, "host">> = {};

    if (hintUrl) {
      try { selectedHost = new URL(hintUrl).host; }
      catch { return { outcome: "FAILURE", items_processed: 0, evidence_refs, summary: `mission.input.url invalid: ${hintUrl}` }; }
      // Check rate limiter · if hinted host is cooling off, rotate
      const check = await checkAcquisitionPermitted(selectedHost);
      if (!check.ok) {
        evidence_refs.push(`host:${selectedHost}:${check.kind}`);
        // Record source outcome so health reflects the constraint
        const hintedSource = AUTHORISED_SOURCES.find((s) => s.host === selectedHost);
        if (hintedSource) recordSourceOutcome({ source_id: hintedSource.source_id, outcome: check.kind === "RATE_LIMITED" ? "RATE_LIMITED_429" : "OTHER", latency_ms: 0, cooling_off_until: check.next_permitted_at });
        // Rotate to next eligible source
        const alt = pickNextEligibleSource();
        if (!alt) {
          return { outcome: "PARTIAL", items_processed: 0, evidence_refs, summary: `${check.kind} on ${selectedHost} · no other authorised source eligible right now (NO_ELIGIBLE_SOURCE)` };
        }
        selectedUrl = alt.url;
        selectedHost = alt.source.host;
        selectedSourceId = alt.source.source_id;
        selectedPolicy = alt.source.policy;
      } else {
        const hintedSource = AUTHORISED_SOURCES.find((s) => s.host === selectedHost);
        if (hintedSource) { selectedSourceId = hintedSource.source_id; selectedPolicy = hintedSource.policy; }
      }
    } else {
      // No hint · iterate through eligible sources by priority, skipping
      // any host that is currently backing off. Founder-locked: multi-source
      // resilience — different sources may share a host so we must check each.
      const candidates = listEligibleSources();
      let picked: { url: string; host: string; source_id: string; policy: Partial<Omit<HostPolicy, "host">> } | null = null;
      const skipped: string[] = [];
      for (const c of candidates) {
        // Authority check
        const authOk = authorityPermits({ manifest: ctx.authority, action: { kind: "host", value: c.source.host } });
        if (!authOk.permitted) { skipped.push(`${c.source.source_id}:auth-denied`); continue; }
        // Rate-limit check
        const rlCheck = await checkAcquisitionPermitted(c.source.host, c.source.policy);
        if (!rlCheck.ok) {
          skipped.push(`${c.source.source_id}:${rlCheck.kind}`);
          evidence_refs.push(`host:${c.source.host}:${rlCheck.kind}`);
          continue;
        }
        picked = { url: c.url, host: c.source.host, source_id: c.source.source_id, policy: c.source.policy };
        break;
      }
      if (!picked) {
        return {
          outcome: "PARTIAL", items_processed: 0, evidence_refs,
          summary: `NO_ELIGIBLE_SOURCE · all ${candidates.length} authorised sources unavailable · skipped=${skipped.join(",")}`,
        };
      }
      selectedUrl = picked.url;
      selectedHost = picked.host;
      selectedSourceId = picked.source_id;
      selectedPolicy = picked.policy;
    }

    // Authority check (skipped when we already checked in loop above)
    const perm = authorityPermits({ manifest: ctx.authority, action: { kind: "host", value: selectedHost! } });
    if (!perm.permitted) {
      return { outcome: "FAILURE", items_processed: 0, evidence_refs, summary: `authority denied · ${perm.reason}` };
    }

    // WO-SOURCE-GUARDIAN-01 · founder-locked fail-closed check.
    // Guardian verifies: (a) requesting identity is PRODUCTION_WORKFORCE,
    // (b) signed source registry manifest verifies against trusted founder key,
    // (c) source_id is present in the manifest, (d) URL host matches.
    const guardResult = await guardianCheck({
      source_id: selectedSourceId,
      url: selectedUrl,
      requesting_agent_id: ctx.identity.agent_id,
      requesting_identity_id: ctx.identity.identity_id,
      requesting_environment: ctx.identity.environment,
      mission_id: mission.mission_id,
      authorization_context: { authorised_hosts: mission.authorised_hosts, budget_ms: mission.budget_ms },
      trusted_founder_public_keys_hex: ctx.trusted_founder_public_keys_hex,
    });
    if (!guardResult.ok) {
      evidence_refs.push(`guardian-rejection:${guardResult.rejection.rejection_id}:${guardResult.rejection.rejection_code}`);
      return {
        outcome: "FAILURE", items_processed: 0, evidence_refs,
        summary: `GUARDIAN REJECTED · ${guardResult.rejection.rejection_code} · ${guardResult.rejection.reason}`,
      };
    }

    // Rate-limit re-check (harmless duplicate for hint-URL path)
    const finalCheck = await checkAcquisitionPermitted(selectedHost!, selectedPolicy);
    if (!finalCheck.ok) {
      return { outcome: "PARTIAL", items_processed: 0, evidence_refs, summary: `${finalCheck.kind} · next permitted ${finalCheck.next_permitted_at}` };
    }

    // Arrow 4 · tool invoked (real fetch)
    await beginRequest(selectedHost!);
    const requestStart = Date.now();
    let response: { status: number; headers: Record<string, string>; body: Buffer };
    let networkError: string | null = null;
    try {
      response = await httpFetch(selectedUrl!);
    } catch (e) {
      networkError = (e as Error).message;
      const latency = Date.now() - requestStart;
      const rec = await recordRequestOutcome({ host: selectedHost!, status: null, network_error: networkError, policy: selectedPolicy });
      if (selectedSourceId) recordSourceOutcome({ source_id: selectedSourceId, outcome: rec.outcome, latency_ms: latency });
      evidence_refs.push(rec.evidence_marker);
      await ctx.writeMemory({ kind: "FAILURE", mission_id: mission.mission_id, content: { url: selectedUrl, host: selectedHost, kind: rec.outcome, latency_ms: latency, error: networkError } });
      return { outcome: "FAILURE", items_processed: 0, evidence_refs, summary: `network ${rec.outcome} · ${networkError}` };
    }
    const latencyMs = Date.now() - requestStart;
    const rec = await recordRequestOutcome({
      host: selectedHost!,
      status: response.status,
      retry_after_header: response.headers["retry-after"] ?? null,
      bytes_received: response.body.length,
      policy: selectedPolicy,
    });
    if (selectedSourceId) recordSourceOutcome({ source_id: selectedSourceId, outcome: rec.outcome, latency_ms: latencyMs, cooling_off_until: rec.host_state.next_permitted_at > Date.now() ? new Date(rec.host_state.next_permitted_at).toISOString() : null });

    const responseHash = sha256Hex(response.body);
    const requestEvidenceId = `http:${responseHash.slice(0, 16)}:${response.status}`;
    evidence_refs.push(rec.evidence_marker);
    evidence_refs.push(requestEvidenceId);
    await ctx.emitProgress({
      progress_counter: 2, last_completed_work: `http_get ${selectedUrl} → ${response.status} (${response.body.length}B in ${latencyMs}ms)`,
      evidence_refs: [rec.evidence_marker, requestEvidenceId],
    });

    if (rec.outcome !== "OK") {
      // Non-2xx · record as evidence, DO NOT fabricate success. Rotation happens on next mission.
      await ctx.writeMemory({
        kind: "FAILURE", mission_id: mission.mission_id,
        content: { url: selectedUrl, host: selectedHost, source_id: selectedSourceId, status: response.status, response_hash: responseHash, kind: rec.outcome, retry_after_header: response.headers["retry-after"] ?? null, latency_ms: latencyMs },
      });
      return { outcome: "PARTIAL", items_processed: 0, evidence_refs, summary: `${rec.outcome} on ${selectedHost} · will rotate on next mission` };
    }
    // Success · assign for downstream processing
    const url = selectedUrl!;
    const host = selectedHost!;

    // Founder-locked 2026-09-13: persist a shared SourceRecord so Sanitizer/
    // Discovery can consume real cross-agent evidence. This breaks the
    // per-agent memory silo that previously kept the pipeline from flowing.
    const sourceRecord = await persistSourceRecord({
      emitter_agent_id: ctx.identity.agent_id,
      emitter_identity_id: ctx.identity.identity_id,
      emitter_mission_id: mission.mission_id,
      registry_source_id: selectedSourceId ?? "unknown",
      host, url,
      http_status: response.status,
      response_bytes: response.body.length,
      content_sha256: responseHash,
      content_type: response.headers["content-type"] ?? "application/octet-stream",
      acquired_at: new Date().toISOString(),
      latency_ms: latencyMs,
      body_ref: null,
      evidence_marker: requestEvidenceId,
    });
    evidence_refs.push(`source:${sourceRecord.source_id}`);

    // Arrow 5 · parse into raw entries · Sanitizer does the real canonicalisation
    const contentType = (response.headers["content-type"] ?? "").toLowerCase();
    const rawEntries = extractRawEntries(response.body, contentType);

    // Arrow 6 · persist each raw entry to the SHARED SourceEntry pool
    const entryIds: string[] = [];
    for (const e of rawEntries) {
      const entry = await persistSourceEntry({
        source_id: sourceRecord.source_id,
        emitter_agent_id: ctx.identity.agent_id,
        emitter_identity_id: ctx.identity.identity_id,
        kind: e.kind,
        raw_text: e.raw_text,
        extracted_at: new Date().toISOString(),
      });
      entryIds.push(entry.source_entry_id);
      itemsProcessed++;
    }
    evidence_refs.push(`source-entries:${entryIds.length}`);

    if (entryIds.length > 0) {
      await ctx.emitProgress({
        progress_counter: 3, last_completed_work: `persisted ${entryIds.length} raw source entries to shared pool`,
        evidence_refs: entryIds.slice(0, 10).map((id) => `source-entry:${id}`),
      });
    }

    // Arrow 7 · contribute learning back to NEX
    if (entryIds.length > 0) {
      const learn = await ctx.contributeLearning({
        kind: "NEW_PATTERN",
        content: {
          source_host: host,
          source_id: sourceRecord.source_id,
          entries_extracted: entryIds.length,
          sample_entry_ids: entryIds.slice(0, 3),
        },
        evidence_refs: [`source:${sourceRecord.source_id}`, ...entryIds.slice(0, 3).map((id) => `source-entry:${id}`)],
      });
      if (learn.ok && learn.contribution_id) evidence_refs.push(`learning:${learn.contribution_id}`);
    }

    return {
      outcome: entryIds.length > 0 ? "SUCCESS" : "PARTIAL",
      items_processed: itemsProcessed,
      evidence_refs,
      summary: `crawled ${host} · SRC=${sourceRecord.source_id} · ${entryIds.length} entries extracted`,
    };
  };
}
