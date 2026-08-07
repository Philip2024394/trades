// NEX Journey Engine · definition parser
//
// Takes a raw JSONB definition (as stored / sent by the UI) and
// normalises it into a typed JourneyDefinition. Rejects malformed
// input BEFORE the validator sees it so downstream code can trust
// the shape.

import type { JourneyDefinition, Node, NodeType } from "../types";

const NODE_TYPES: Set<NodeType> = new Set(["start", "wait", "send_campaign", "branch", "goal", "stop", "send_campaign_and_wait", "experiment"]);

export type ParseResult = { ok: true; definition: JourneyDefinition } | { ok: false; errors: string[] };

export function parseDefinition(raw: unknown): ParseResult {
  const errors: string[] = [];
  const obj = raw as Record<string, unknown> | null;
  if (!obj || typeof obj !== "object") return { ok: false, errors: ["definition must be an object"] };

  const nodesRaw = obj.nodes;
  if (!Array.isArray(nodesRaw)) return { ok: false, errors: ["definition.nodes must be an array"] };

  const nodes: Node[] = [];
  const seenIds = new Set<string>();
  for (let i = 0; i < nodesRaw.length; i++) {
    const n = nodesRaw[i] as Record<string, unknown>;
    if (!n || typeof n !== "object") { errors.push(`node[${i}] not an object`); continue; }

    const id = String(n.id ?? "").trim();
    if (!id) { errors.push(`node[${i}] missing id`); continue; }
    if (seenIds.has(id)) { errors.push(`node[${i}] duplicate id ${id}`); continue; }
    seenIds.add(id);

    const type = String(n.type ?? "") as NodeType;
    if (!NODE_TYPES.has(type)) { errors.push(`node ${id} unknown type ${n.type}`); continue; }

    const label = n.label ? String(n.label) : undefined;
    // Preserve editor position (additive · optional · runtime ignores this)
    const pos = n.position as { x?: number; y?: number } | undefined;
    const position = pos && typeof pos.x === "number" && typeof pos.y === "number" ? { x: pos.x, y: pos.y } : undefined;
    const base = { id, label, ...(position ? { position } : {}) } as { id: string; label?: string; position?: { x: number; y: number } };

    switch (type) {
      case "start": {
        const next = String(n.next ?? "");
        if (!next) { errors.push(`node ${id} (start) missing next`); continue; }
        nodes.push({ ...base, type, next });
        break;
      }
      case "wait": {
        const next = String(n.next ?? "");
        const wait_seconds = Number(n.wait_seconds ?? 0);
        if (!next) { errors.push(`node ${id} (wait) missing next`); continue; }
        if (!Number.isFinite(wait_seconds) || wait_seconds < 0) { errors.push(`node ${id} (wait) wait_seconds must be >= 0`); continue; }
        nodes.push({ ...base, type, next, wait_seconds });
        break;
      }
      case "send_campaign": {
        const next = String(n.next ?? "");
        const campaign_id = String(n.campaign_id ?? "");
        if (!next) { errors.push(`node ${id} (send_campaign) missing next`); continue; }
        if (!campaign_id) { errors.push(`node ${id} (send_campaign) missing campaign_id`); continue; }
        nodes.push({ ...base, type, next, campaign_id });
        break;
      }
      case "branch": {
        const cond = String(n.condition ?? "") as "opened" | "clicked" | "delivered" | "not_opened" | "not_clicked";
        const within_seconds = Number(n.within_seconds ?? 0);
        const branches = (n.branches as { yes?: string; no?: string } | undefined) ?? {};
        const yes = String(branches.yes ?? "");
        const no  = String(branches.no  ?? "");
        const observe = n.observe_campaign_id ? String(n.observe_campaign_id) : undefined;
        if (!["opened","clicked","delivered","not_opened","not_clicked"].includes(cond)) { errors.push(`node ${id} (branch) invalid condition ${n.condition}`); continue; }
        if (!Number.isFinite(within_seconds) || within_seconds < 0) { errors.push(`node ${id} (branch) within_seconds must be >= 0`); continue; }
        if (!yes || !no) { errors.push(`node ${id} (branch) missing branches.yes or branches.no`); continue; }
        nodes.push({ ...base, type, condition: cond, within_seconds, branches: { yes, no }, observe_campaign_id: observe });
        break;
      }
      case "goal": {
        const goal_key = String(n.goal_key ?? "").trim();
        const next = n.next ? String(n.next) : undefined;
        if (!goal_key) { errors.push(`node ${id} (goal) missing goal_key`); continue; }
        nodes.push({ ...base, type, goal_key, next });
        break;
      }
      case "send_campaign_and_wait": {
        const campaign_id = String(n.campaign_id ?? "");
        const next_on_completion = String(n.next_on_completion ?? "");
        const next_on_failure = n.next_on_failure ? String(n.next_on_failure) : undefined;
        const poll_interval_seconds = n.poll_interval_seconds !== undefined ? Number(n.poll_interval_seconds) : undefined;
        const timeout_seconds = n.timeout_seconds !== undefined ? Number(n.timeout_seconds) : undefined;
        if (!campaign_id) { errors.push(`node ${id} (send_campaign_and_wait) missing campaign_id`); continue; }
        if (!next_on_completion) { errors.push(`node ${id} (send_campaign_and_wait) missing next_on_completion`); continue; }
        if (poll_interval_seconds !== undefined && (!Number.isFinite(poll_interval_seconds) || poll_interval_seconds < 5 || poll_interval_seconds > 3600)) {
          errors.push(`node ${id} (send_campaign_and_wait) poll_interval_seconds must be between 5 and 3600`); continue;
        }
        if (timeout_seconds !== undefined && (!Number.isFinite(timeout_seconds) || timeout_seconds < 60)) {
          errors.push(`node ${id} (send_campaign_and_wait) timeout_seconds must be >= 60`); continue;
        }
        nodes.push({ ...base, type, campaign_id, next_on_completion, next_on_failure, poll_interval_seconds, timeout_seconds });
        break;
      }
      case "stop": {
        const reason = n.reason ? String(n.reason) : undefined;
        nodes.push({ ...base, type, reason });
        break;
      }
      case "experiment": {
        const experiment_id = String(n.experiment_id ?? "");
        const fallback_node_id = n.fallback_node_id ? String(n.fallback_node_id) : undefined;
        const variant_target_node_ids = Array.isArray(n.variant_target_node_ids)
          ? (n.variant_target_node_ids as unknown[]).map((x) => String(x)).filter((s) => s.length > 0)
          : undefined;
        if (!experiment_id) { errors.push(`node ${id} (experiment) missing experiment_id`); continue; }
        nodes.push({ ...base, type, experiment_id, fallback_node_id, variant_target_node_ids });
        break;
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  const start_node_id = String(obj.start_node_id ?? nodes.find((n) => n.type === "start")?.id ?? "");
  if (!start_node_id) return { ok: false, errors: ["definition.start_node_id missing"] };

  return { ok: true, definition: { nodes, start_node_id } };
}
