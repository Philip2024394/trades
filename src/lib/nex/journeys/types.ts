// NEX Journey Engine · shared types
//
// Doctrine: docs/JOURNEY_ENGINE_CHARTER.md
//
// The runtime is a compiler:
//   Input:  (Journey, JourneyState, currentTime)
//   Output: (nextState, commands[], events[])

// ── Node model · locked MVP six ──────────────────────────────────
export type NodeType = "start" | "wait" | "send_campaign" | "branch" | "goal" | "stop";

export type NodeBase = { id: string; type: NodeType; label?: string };

export type StartNode        = NodeBase & { type: "start";         next: string };
export type WaitNode         = NodeBase & { type: "wait";          next: string; wait_seconds: number };
export type SendCampaignNode = NodeBase & { type: "send_campaign"; next: string; campaign_id: string };
export type BranchNode       = NodeBase & {
  type: "branch";
  condition: "opened" | "clicked" | "delivered" | "not_opened" | "not_clicked";
  within_seconds: number;                                              // window during which to check the event
  branches: { yes: string; no: string };
  observe_campaign_id?: string;                                        // which campaign's events to inspect · defaults to last sent
};
export type GoalNode         = NodeBase & { type: "goal";          next?: string; goal_key: string };
export type StopNode         = NodeBase & { type: "stop";          reason?: string };

export type Node = StartNode | WaitNode | SendCampaignNode | BranchNode | GoalNode | StopNode;

export type JourneyDefinition = {
  nodes: Node[];
  start_node_id: string;                                                // convenience · must equal the id of the (single) Start node
};

// ── Persistence shapes ───────────────────────────────────────────
export type JourneyStatus = "draft" | "active" | "paused" | "archived";
export type TriggerType   = "segment_join" | "manual";

export type Journey = {
  journey_id: string;
  slug: string;
  name: string;
  description: string | null;
  version: number;
  status: JourneyStatus;
  trigger_type: TriggerType;
  trigger_config: Record<string, unknown>;
  definition: JourneyDefinition;
  validation_errors: string[] | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  activated_at: string | null;
  paused_at: string | null;
  archived_at: string | null;
};

export type JourneyStateStatus = "active" | "waiting" | "completed" | "stopped" | "failed";

export type JourneyState = {
  state_id: string;
  journey_id: string;
  journey_slug: string;
  journey_version: number;
  contact_id: string;
  current_node_id: string;
  status: JourneyStateStatus;
  entered_at: string;
  last_transition_at: string;
  wait_until: string | null;
  random_seed: number;
  snapshot: Record<string, unknown>;
  completed_at: string | null;
  stopped_reason: string | null;
  last_command: JourneyCommand | null;
};

// ── Event model · locked audit vocabulary ────────────────────────
export type JourneyEventType =
  | "JourneyStarted" | "WaitEntered" | "WaitExpired" | "BranchTaken"
  | "CampaignCommandEmitted" | "CampaignCompleted" | "GoalReached"
  | "JourneyCompleted" | "JourneyStopped" | "JourneyFailed";

export type JourneyEvent = {
  event_id: string;
  journey_id: string;
  journey_slug: string;
  journey_version: number;
  state_id: string | null;
  contact_id: string | null;
  event_type: JourneyEventType;
  from_node_id: string | null;
  to_node_id: string | null;
  emitted_command: JourneyCommand | null;
  metadata: Record<string, unknown>;
  occurred_at: string;
};

// ── Commands · the ONLY output the runtime is allowed to produce ──
export type JourneyCommand =
  | { kind: "enqueue_send_batch"; campaign_id: string; contact_id: string; payload: Record<string, unknown> }
  | { kind: "complete"; state_id: string; goal_key?: string }
  | { kind: "stop"; state_id: string; reason: string };

// ── State-machine tick I/O ───────────────────────────────────────
export type TickInput = {
  journey: Journey;
  state: JourneyState;
  now: Date;                        // injected · never Date.now() inside the runtime · doctrine §6
};

export type TickOutput = {
  next_state: Partial<JourneyState> & { current_node_id: string; status: JourneyStateStatus };
  events: Array<Omit<JourneyEvent, "event_id" | "journey_id" | "journey_slug" | "journey_version" | "state_id" | "contact_id" | "occurred_at">>;
  commands: JourneyCommand[];
};

// ── Pending contact / entry ──────────────────────────────────────
export type PendingContact = {
  contact_id: string;
  email: string | null;
  country: string | null;
  name: string | null;
  company: string | null;
  trade_categories: string[] | null;
};
