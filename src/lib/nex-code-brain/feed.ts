// NEX Code Brain · Per-lane feed lines
// Deterministic queue per registered lane. The feed for lane X contains only
// tasks whose paths ALL route to lane X. This is the primitive that makes
// "NEX1 and NEX-Twin never see the same task" true by construction.
//
// A feed item stays "queued" until a lease is acquired for it. Once the
// leaseholder releases (or lease expires), the item can be re-queued.

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import * as path from "node:path";
import type { FeedItem } from "./types";
import { getBrainDir, findLane } from "./lane-registry";
import { routePaths } from "./path-router";

function getFeedDir(): string {
  return path.join(getBrainDir(), "feed");
}

function ensureFeedDir(): void {
  if (!existsSync(getFeedDir())) mkdirSync(getFeedDir(), { recursive: true });
}

function feedPathFor(lane: string): string {
  return path.join(getFeedDir(), `${lane}.jsonl`);
}

export function newFeedItemId(): string {
  return `feed-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomBytes(3).toString("hex")}`;
}

export interface EnqueueInput {
  readonly lane: string; // must be the SINGLE lane all paths route to
  readonly task_id: string;
  readonly title: string;
  readonly paths: readonly string[];
  readonly priority?: number;
  readonly requested_by: string;
  readonly hint: string;
}

export interface EnqueueResult {
  readonly ok: boolean;
  readonly item?: FeedItem;
  readonly reason?: string;
}

/**
 * Enqueue a task on a lane's feed · rejects if any path in the task routes
 * to a different lane, so a cross-lane task cannot land here silently.
 */
export function enqueueOnLane(input: EnqueueInput): EnqueueResult {
  const lane = findLane(input.lane);
  if (!lane) return { ok: false, reason: `unknown lane: ${input.lane}` };
  if (lane.status !== "active") return { ok: false, reason: `lane inactive: ${input.lane}` };
  if (input.paths.length === 0) return { ok: false, reason: "task has no paths" };

  const routed = routePaths(input.paths);
  const mismatched = Object.entries(routed.per_path).filter(([, l]) => l !== input.lane);
  if (mismatched.length > 0) {
    return {
      ok: false,
      reason: `paths do not all route to lane "${input.lane}": ${mismatched.map(([p, l]) => `${p}→${l ?? "(unrouted)"}`).join(", ")}`,
    };
  }

  const item: FeedItem = {
    item_id: newFeedItemId(),
    lane: input.lane,
    task_id: input.task_id,
    title: input.title,
    priority: input.priority ?? 5,
    paths: Array.from(input.paths).map((p) => p.replace(/\\/g, "/")),
    status: "queued",
    requested_at: new Date().toISOString(),
    requested_by: input.requested_by,
    hint: input.hint,
  };
  ensureFeedDir();
  appendFileSync(feedPathFor(input.lane), JSON.stringify(item) + "\n", "utf8");
  return { ok: true, item };
}

/** Read the current feed for a lane · latest per item_id folded from the append-only log. */
export function readFeed(lane: string): readonly FeedItem[] {
  const p = feedPathFor(lane);
  if (!existsSync(p)) return [];
  const lines = readFileSync(p, "utf8").split("\n").filter((l) => l.trim().length > 0);
  const latest = new Map<string, FeedItem>();
  for (const line of lines) {
    try {
      const item = JSON.parse(line) as FeedItem;
      latest.set(item.item_id, item);
    } catch {
      /* skip */
    }
  }
  return Array.from(latest.values()).sort((a, b) => a.priority - b.priority || a.requested_at.localeCompare(b.requested_at));
}

/** Update the status of a feed item (append the new record; append-only). */
export function updateFeedItemStatus(lane: string, item_id: string, status: FeedItem["status"]): { ok: boolean; reason?: string } {
  const feed = readFeed(lane);
  const item = feed.find((i) => i.item_id === item_id);
  if (!item) return { ok: false, reason: `no feed item ${item_id} on lane ${lane}` };
  const next: FeedItem = { ...item, status };
  ensureFeedDir();
  appendFileSync(feedPathFor(lane), JSON.stringify(next) + "\n", "utf8");
  return { ok: true };
}

// Test-only reset · clears every lane feed.
export function __resetAllFeedsForTest(): void {
  if (!existsSync(getFeedDir())) return;
  const { readdirSync, unlinkSync } = require("node:fs") as typeof import("node:fs");
  for (const f of readdirSync(getFeedDir())) {
    try {
      unlinkSync(path.join(getFeedDir(), f));
    } catch {
      /* nothing */
    }
  }
}

export { getFeedDir };
