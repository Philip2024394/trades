// NEX Coding Chat · shared types
// Fluent bidirectional conversation between User and NEX1 / NEX-Twin about code.
// Every message is durable on disk (per-session JSON + transit inbox/outbox)
// so external engines (Python watchdog, Node fs.watch, NEX1 runtime) can plug in
// without an HTTP dependency.

export type ChatRole = "user" | "nex" | "system";

export interface ChatMessage {
  readonly id: string; // stable per message
  readonly session_id: string;
  readonly role: ChatRole;
  readonly content: string; // markdown-ish text; UI escapes HTML
  readonly ts: string; // ISO 8601 UTC
  readonly context?: ChatContextSnapshot; // set on user messages · captures what NEX saw
  readonly status: "sent" | "queued" | "processing" | "answered" | "failed" | "timeout";
  readonly error?: string;
}

export interface ChatSession {
  readonly session_id: string;
  readonly created_at: string;
  readonly last_ts: string;
  readonly title: string; // derived from first user message
  readonly messages: readonly ChatMessage[];
}

/** Everything NEX sees alongside a user query. Auto-assembled by context-provider. */
export interface ChatContextSnapshot {
  readonly project_map: ProjectMap;
  readonly code_standards: CodeStandards;
  readonly mentioned_files: readonly { path: string; sha256: string; excerpt: string }[];
  readonly active_runs: readonly { run_id: string; status: string; current_stage: string | null }[];
  readonly rolling_memory: readonly { role: ChatRole; content: string }[]; // last N turns
  readonly repo_head_sha: string | null;
}

export interface ProjectMap {
  readonly project_root: string;
  readonly key_paths: Readonly<Record<string, string>>; // path → one-line description
  readonly agent_definitions_dir: string;
  readonly runtime_dir: string;
}

export interface CodeStandards {
  readonly primary_language: string;
  readonly module_style: string;
  readonly error_handling: string;
  readonly type_safety: string;
  readonly test_framework: string;
  readonly commit_style: string;
  readonly protected_files: readonly string[];
  readonly anti_bullshit: readonly string[];
}

/** Payload written to `transit/inbox/<message_id>.json` for external engines. */
export interface InboxPayload {
  readonly protocol_version: 1;
  readonly message_id: string;
  readonly session_id: string;
  readonly ts: string;
  readonly user_query: string;
  readonly command: ParsedCommand | null;
  readonly context: ChatContextSnapshot;
}

/** Payload written back by the engine to `transit/outbox/<message_id>.json`. */
export interface OutboxPayload {
  readonly protocol_version: 1;
  readonly message_id: string;
  readonly session_id: string;
  readonly ts: string;
  readonly reply: string;
  readonly executor: string; // "MAI" | "NEX1" | "NEX-TWIN" | "STUB" | ...
  readonly evidence?: readonly string[]; // file:LINE references NEX cites
  readonly proposed_actions?: readonly ProposedAction[];
  readonly error?: string;
}

/** Structured suggestion NEX can offer (dispatch a coding-team run, open a file, etc.). */
export interface ProposedAction {
  readonly kind: "dispatch_coding_team" | "open_file" | "run_test" | "cite_evidence" | "clarify";
  readonly label: string;
  readonly detail: string;
  readonly deep_link?: string; // e.g. `/nex1/workstation-live?prefill=...`
}

/** Slash-command surface. Chat interprets these locally before hitting the engine. */
export type SlashCommand =
  | "help"
  | "clear"
  | "history"
  | "files"
  | "status"
  | "dispatch"
  | "standards"
  | "map";

export interface ParsedCommand {
  readonly command: SlashCommand;
  readonly args: string; // free-form arg tail
}
