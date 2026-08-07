// GET /api/nex/email/audit — aggregate + recent email events
//
// Reads nex.events via the storage layer, filtered to the email.* family.
// Powers the Communications Centre Mission Control panel:
//   · today's send / block / failure counts
//   · success rate
//   · last send + last failure (with recency)
//   · top blocked reasons (compliance breakdown)
//   · top failure reasons (provider breakdown)
//   · recent audit rows (default 50) for the timeline view
//
// Query params:
//   limit    · default 50  · max 500      · recent rows returned
//   since    · ISO         · optional     · only rows at/after this timestamp
//   kind     · marketing|transactional    · optional filter
//   caller   · string prefix              · optional filter
//   event    · email.sent|email.blocked|email.failed · optional filter

import { NextResponse } from "next/server";
import { getStorage } from "@/lib/nex/storage/registry";
import { COLLECTIONS } from "@/lib/nex/storage/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EmailEvent = {
  event_id?: string;
  event_type?: string;
  timestamp?: string;
  outcome?: string;
  related_contact?: string | null;
  payload?: {
    to_email?: string;
    kind?: "marketing" | "transactional";
    campaign_id?: string | null;
    caller?: string;
    provider?: string;
    provider_message_id?: string;
    latency_ms?: number;
    reason?: string;
    detail?: string;
    retryable?: boolean;
  };
};

function startOfTodayIso(): string {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
}

function topN(counter: Record<string, number>, n: number): Array<{ key: string; count: number }> {
  return Object.entries(counter)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Math.min(Math.max(1, Number(url.searchParams.get("limit") ?? 50)), 500);
  const since = url.searchParams.get("since") ?? undefined;
  const kindFilter = url.searchParams.get("kind");
  const callerFilter = url.searchParams.get("caller");
  const eventFilter = url.searchParams.get("event");

  const store = getStorage();

  // Pull a wide window of recent events, then filter in-process to the email family.
  // Storage layer doesn't yet expose LIKE / prefix filters, so we oversample and post-filter.
  const rawRows = await store.query<EmailEvent>(COLLECTIONS.events, {
    limit: 5000,
    order_dir: "desc",
    ...(since ? { since } : {}),
  });

  const emailRows = rawRows.filter((r) =>
    typeof r.event_type === "string" && r.event_type.startsWith("email.")
    && (!kindFilter || r.payload?.kind === kindFilter)
    && (!callerFilter || (r.payload?.caller ?? "").startsWith(callerFilter))
    && (!eventFilter || r.event_type === eventFilter),
  );

  // Aggregates
  const todayStart = startOfTodayIso();
  let todaySent = 0, todayBlocked = 0, todayFailed = 0;
  let totalSent = 0, totalBlocked = 0, totalFailed = 0;
  const blockedReasons: Record<string, number> = {};
  const failedReasons: Record<string, number> = {};
  const callers: Record<string, number> = {};
  const providers: Record<string, number> = {};
  const kinds: Record<string, number> = { marketing: 0, transactional: 0 };
  let lastSent: EmailEvent | null = null;
  let lastFailure: EmailEvent | null = null;
  let latencySum = 0, latencyCount = 0;

  for (const r of emailRows) {
    const isToday = typeof r.timestamp === "string" && r.timestamp >= todayStart;
    if (r.event_type === "email.sent") {
      totalSent += 1;
      if (isToday) todaySent += 1;
      if (!lastSent || (r.timestamp ?? "") > (lastSent.timestamp ?? "")) lastSent = r;
      if (typeof r.payload?.latency_ms === "number") {
        latencySum += r.payload.latency_ms;
        latencyCount += 1;
      }
    } else if (r.event_type === "email.blocked") {
      totalBlocked += 1;
      if (isToday) todayBlocked += 1;
      const reason = r.payload?.reason ?? "unknown";
      blockedReasons[reason] = (blockedReasons[reason] ?? 0) + 1;
    } else if (r.event_type === "email.failed") {
      totalFailed += 1;
      if (isToday) todayFailed += 1;
      if (!lastFailure || (r.timestamp ?? "") > (lastFailure.timestamp ?? "")) lastFailure = r;
      const reason = r.payload?.reason ?? "unknown";
      failedReasons[reason] = (failedReasons[reason] ?? 0) + 1;
    }
    const caller = r.payload?.caller;
    if (caller) callers[caller] = (callers[caller] ?? 0) + 1;
    const provider = r.payload?.provider;
    if (provider) providers[provider] = (providers[provider] ?? 0) + 1;
    const kind = r.payload?.kind;
    if (kind && kind in kinds) kinds[kind] += 1;
  }

  const attempts = totalSent + totalFailed;
  const successRate = attempts > 0 ? Math.round((totalSent / attempts) * 10000) / 100 : null;
  const avgLatencyMs = latencyCount > 0 ? Math.round(latencySum / latencyCount) : null;

  return NextResponse.json({
    ok: true,
    window: {
      total_rows: emailRows.length,
      oversample_scanned: rawRows.length,
      since: since ?? null,
    },
    today: {
      sent: todaySent,
      blocked: todayBlocked,
      failed: todayFailed,
    },
    totals: {
      sent: totalSent,
      blocked: totalBlocked,
      failed: totalFailed,
    },
    success_rate_pct: successRate,          // null when no attempts yet
    avg_latency_ms: avgLatencyMs,           // null when no sends yet
    kinds,                                   // { marketing, transactional }
    top_blocked_reasons: topN(blockedReasons, 6),
    top_failure_reasons: topN(failedReasons, 6),
    top_callers: topN(callers, 8),
    top_providers: topN(providers, 4),
    last_sent: lastSent,
    last_failure: lastFailure,
    recent: emailRows.slice(0, limit),
    generated_at: new Date().toISOString(),
  });
}
