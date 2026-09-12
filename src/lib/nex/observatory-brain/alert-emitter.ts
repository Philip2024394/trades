// src/lib/nex/observatory-brain/alert-emitter.ts
//
// Founder ALERT-1 · Observatory push-alert channel.
//
// When a snapshot fires critical alerts, emit them to a JSONL sink at
// data/alerts/alerts_YYYY-MM-DD.jsonl AND (if configured) POST to
// NEX_ALERT_WEBHOOK_URL. Best-effort · never crashes the snapshot call.
//
// Deduplication: same (category, message) pair fires at most once per
// dedup window (default 300s) so the sink doesn't fill with duplicate
// rows from repeated snapshot reads.

import { promises as fs } from "node:fs";
import path from "node:path";

export interface AlertRow {
  severity: "info" | "warning" | "critical";
  category: string;
  message: string;
}

const _emittedAt = new Map<string, number>();
const _DEDUP_WINDOW_MS = Number(process.env.NEX_ALERT_DEDUP_MS ?? 300_000);
const _ALERTS_DIR = path.join(process.cwd(), "data", "alerts");

function shouldEmit(key: string): boolean {
  const now = Date.now();
  const last = _emittedAt.get(key);
  if (last && now - last < _DEDUP_WINDOW_MS) return false;
  _emittedAt.set(key, now);
  // Cheap eviction: keep the map bounded.
  if (_emittedAt.size > 1_000) {
    const cutoff = now - _DEDUP_WINDOW_MS * 4;
    for (const [k, t] of _emittedAt) if (t < cutoff) _emittedAt.delete(k);
  }
  return true;
}

function todayFilename(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `alerts_${y}-${m}-${day}.jsonl`;
}

export function emitAlerts(alerts: readonly AlertRow[]): void {
  const enabled = process.env.NEX_ALERT_EMISSION;
  if (enabled === "off" || enabled === "0" || enabled === "false") return;
  const fresh: AlertRow[] = [];
  for (const a of alerts) {
    const key = `${a.severity}::${a.category}::${a.message}`;
    if (shouldEmit(key)) fresh.push(a);
  }
  if (fresh.length === 0) return;

  const emittedAt = new Date().toISOString();
  const rows = fresh.map((a) => JSON.stringify({ emitted_at: emittedAt, ...a })).join("\n") + "\n";

  // Fire-and-forget file write.
  void (async () => {
    try {
      await fs.mkdir(_ALERTS_DIR, { recursive: true });
      await fs.appendFile(path.join(_ALERTS_DIR, todayFilename()), rows, "utf8");
    } catch { /* observability must not crash the snapshot */ }
  })();

  // Fire-and-forget webhook POST when configured.
  const webhook = process.env.NEX_ALERT_WEBHOOK_URL;
  if (webhook && /^https?:\/\//.test(webhook)) {
    void (async () => {
      try {
        await fetch(webhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: "nex-observatory", emitted_at: emittedAt, alerts: fresh }),
        });
      } catch { /* swallow */ }
    })();
  }
}
