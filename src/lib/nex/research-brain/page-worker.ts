// src/lib/nex/research-brain/page-worker.ts
//
// Founder Path A · Phase A2 + RB-2 · Page + Evidence Worker.
//
// Turns SearchHits into ParsedPages and then into EvidenceSpans that
// carry stable ref_ids (research:<plan_id>:<step>:<idx>) and enough
// text to be validated by Fabrication Gate v2 alignment scoring.
//
// RB-2 upgrade: hits with a URL are FETCHED (bounded budget) and the
// full page text is chunked into multiple EvidenceSpans. Snippet-only
// fallback preserved when fetch fails, is disabled, or the hit is a
// local KF row (no URL).
//
// Doctrine #3 extension: fetched evidence remains capped at
// evidence_provisional in reportToEvidenceItems (never elevated).

import type { EvidenceSpan, ParsedPage, SearchHit } from "./contract";
import { makeSpanRefId } from "./contract";
import { fetchPage } from "./page-fetcher";

const MAX_SPAN_TEXT_CHARS = 800;

const _fetchEnabled = (() => {
  const v = process.env.NEX_RESEARCH_FETCH;
  return v !== "off" && v !== "0" && v !== "false";
})();
const _perUrlBudgetMs = (() => {
  const n = Number(process.env.NEX_RESEARCH_FETCH_BUDGET_MS ?? 5_000);
  return Number.isFinite(n) && n >= 500 && n <= 30_000 ? Math.floor(n) : 5_000;
})();

export interface PageWorkerInput {
  plan_id: string;
  step_id: string;
  hits: readonly SearchHit[];
  /** Max spans to emit per step (after all pages fetched). */
  limit?: number;
  signal?: AbortSignal;
}

export interface PageWorkerOutput {
  spans: EvidenceSpan[];
  pages: ParsedPage[];
  stage_ms: number;
  fetch_meta: {
    attempted: number;
    ok: number;
    failed: number;
    total_bytes: number;
    total_fetch_ms: number;
  };
}

export async function extractSpans(input: PageWorkerInput): Promise<PageWorkerOutput> {
  const t0 = performance.now();
  const spans: EvidenceSpan[] = [];
  const pages: ParsedPage[] = [];
  const limit = Math.min(input.limit ?? 8, 24);
  const now = new Date().toISOString();

  let attempted = 0, ok = 0, failed = 0, totalBytes = 0, totalFetchMs = 0;

  for (const hit of input.hits) {
    if (spans.length >= limit) break;

    // Case 1: no URL (e.g. local KF hit) OR fetch disabled → snippet-only.
    if (!hit.url || !_fetchEnabled) {
      const text = normaliseSpanText(hit.snippet);
      if (!text || text.length < 8) continue;
      pages.push({
        hit_id: hit.hit_id,
        mime_type: hit.source_kind === "local_kf" ? "text/plain" : "text/html",
        text,
        extracted_at: now,
      });
      spans.push(makeSpan(input, hit, text, spans.length, now));
      continue;
    }

    // Case 2: URL present · fetch full page.
    attempted += 1;
    const fetched = await fetchPage({ url: hit.url, budget_ms: _perUrlBudgetMs, signal: input.signal });
    totalFetchMs += fetched.request_ms;
    if (!fetched.ok) {
      failed += 1;
      // Fall back to snippet so the hit is not silently dropped.
      const text = normaliseSpanText(hit.snippet);
      if (text && text.length >= 8) {
        pages.push({ hit_id: hit.hit_id, mime_type: hit.source_kind === "local_kf" ? "text/plain" : "text/html", text, extracted_at: now });
        spans.push(makeSpan(input, hit, text, spans.length, now));
      }
      continue;
    }

    ok += 1;
    totalBytes += fetched.fetched_bytes;
    if (fetched.chunks.length === 0) {
      // No usable text; fall back to snippet.
      const text = normaliseSpanText(hit.snippet);
      if (text && text.length >= 8) {
        pages.push({ hit_id: hit.hit_id, mime_type: fetched.mime_type ?? "text/html", text, extracted_at: now });
        spans.push(makeSpan(input, hit, text, spans.length, now));
      }
      continue;
    }
    // Emit ONE ParsedPage per URL (concatenated preview) + multiple spans.
    const preview = fetched.chunks.slice(0, 3).join(" · ").slice(0, MAX_SPAN_TEXT_CHARS);
    pages.push({
      hit_id: hit.hit_id,
      mime_type: fetched.mime_type ?? "text/html",
      text: preview,
      extracted_at: now,
    });
    for (const chunk of fetched.chunks) {
      if (spans.length >= limit) break;
      const text = normaliseSpanText(chunk);
      if (!text || text.length < 8) continue;
      spans.push(makeSpan(input, hit, text, spans.length, now));
    }
  }

  return {
    spans,
    pages,
    stage_ms: Math.round(performance.now() - t0),
    fetch_meta: { attempted, ok, failed, total_bytes: totalBytes, total_fetch_ms: totalFetchMs },
  };
}

function makeSpan(
  input: PageWorkerInput,
  hit: SearchHit,
  text: string,
  idx: number,
  now: string,
): EvidenceSpan {
  return {
    ref_id: makeSpanRefId(input.plan_id, hit.step_id, idx),
    hit_id: hit.hit_id,
    source_url: hit.url,
    text,
    span_offset: { start: 0, end: text.length },
    authority: hit.authority,
    freshness_days: hit.freshness_days,
    extracted_at: now,
  };
}

function normaliseSpanText(raw: string): string {
  return String(raw ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SPAN_TEXT_CHARS);
}
