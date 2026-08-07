// NEX Journey Engine · pre-activation validator
//
// Eight checks (Philip 2026-08-08 · locked before implementation):
//   1. Exactly one Start node
//   2. Every node reachable from Start
//   3. No orphan nodes
//   4. Every path ends with Goal or Stop
//   5. Wait duration ≥ 0
//   6. Branches have valid targets
//   7. SendCampaign references an existing campaign
//   8. No infinite loops (unless an explicit Loop node in a future version)
//
// Only validated journeys can transition draft → active.

import { withClient } from "@/lib/nex/delivery/db";
import type { JourneyDefinition, Node } from "../types";

export type ValidationResult = { ok: true } | { ok: false; errors: string[] };

export async function validateForActivation(def: JourneyDefinition): Promise<ValidationResult> {
  const errors: string[] = [];
  const byId = new Map(def.nodes.map((n) => [n.id, n] as const));

  // 1 · exactly one Start
  const starts = def.nodes.filter((n) => n.type === "start");
  if (starts.length === 0) errors.push("no Start node");
  if (starts.length > 1)  errors.push(`multiple Start nodes (${starts.length}) · exactly one required`);
  if (starts.length === 1 && starts[0].id !== def.start_node_id) errors.push("start_node_id does not match the Start node's id");

  // 2 · reachability from Start · 3 · no orphans
  const reachable = new Set<string>();
  const visit = (id: string) => {
    if (reachable.has(id)) return;
    const n = byId.get(id);
    if (!n) return;
    reachable.add(id);
    for (const t of outgoing(n)) visit(t);
  };
  if (starts.length === 1) visit(starts[0].id);
  for (const n of def.nodes) if (!reachable.has(n.id)) errors.push(`node ${n.id} (${n.type}) is unreachable from Start`);

  // 6 · branches have valid targets · 5 · wait_seconds ≥ 0 (checked in parser too but enforced here)
  for (const n of def.nodes) {
    for (const target of outgoing(n)) {
      if (!byId.has(target)) errors.push(`node ${n.id} (${n.type}) points to non-existent node ${target}`);
    }
    if (n.type === "wait" && n.wait_seconds < 0) errors.push(`node ${n.id} (wait) wait_seconds < 0`);
  }

  // 4 · every path ends with Goal or Stop · detected by walking from each node and confirming
  //     that every reachable path terminates at a Goal/Stop OR hits a cycle we detect in step 8
  //     For MVP we accept: (a) presence of at least one Stop or Goal · (b) no wait/branch/send_campaign
  //     with a next-chain that never terminates
  const terminals = def.nodes.filter((n) => n.type === "stop" || (n.type === "goal" && !n.next)).map((n) => n.id);
  if (terminals.length === 0) errors.push("no terminal node (Goal without next OR Stop)");

  // 8 · infinite loop detection (MVP: any cycle in the reachable graph rejects · a future Loop node
  //     would set an "allow_cycle" flag on the edges it participates in)
  const cycle = findCycle(def);
  if (cycle) errors.push(`cycle detected: ${cycle.join(" → ")} · introduce a Loop node in a future version if intentional`);

  // 7 · SendCampaign references an existing campaign (DB read · async)
  const sendNodes = def.nodes.filter((n): n is Extract<Node, { type: "send_campaign" }> => n.type === "send_campaign");
  if (sendNodes.length > 0) {
    const ids = Array.from(new Set(sendNodes.map((n) => n.campaign_id)));
    const missing = await withClient(async (c) => {
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(",");
      const res = await c.query(`SELECT campaign_id FROM nex.campaigns WHERE campaign_id = ANY(ARRAY[${placeholders}]::uuid[])`, ids);
      const found = new Set(res.rows.map((r) => String(r.campaign_id)));
      return ids.filter((id) => !found.has(id));
    });
    if (missing && missing.length > 0) {
      for (const id of missing) errors.push(`SendCampaign references non-existent campaign ${id}`);
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

function outgoing(n: Node): string[] {
  switch (n.type) {
    case "start":         return [n.next];
    case "wait":          return [n.next];
    case "send_campaign": return [n.next];
    case "branch":        return [n.branches.yes, n.branches.no];
    case "goal":          return n.next ? [n.next] : [];
    case "stop":          return [];
  }
}

function findCycle(def: JourneyDefinition): string[] | null {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const colour = new Map<string, number>();
  const byId = new Map(def.nodes.map((n) => [n.id, n] as const));
  for (const n of def.nodes) colour.set(n.id, WHITE);

  const path: string[] = [];
  function dfs(id: string): string[] | null {
    const c = colour.get(id);
    if (c === GRAY)  return [...path, id];                             // back-edge · cycle
    if (c === BLACK) return null;
    const node = byId.get(id);
    if (!node) return null;
    colour.set(id, GRAY);
    path.push(id);
    for (const t of outgoing(node)) {
      const r = dfs(t);
      if (r) return r;
    }
    path.pop();
    colour.set(id, BLACK);
    return null;
  }
  for (const n of def.nodes) {
    const r = dfs(n.id);
    if (r) {
      // Trim to just the cycle portion
      const first = r.indexOf(r[r.length - 1]);
      return r.slice(first);
    }
  }
  return null;
}
