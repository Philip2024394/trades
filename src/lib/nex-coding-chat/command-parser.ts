// NEX Coding Chat · Slash-command parser + local-handler dispatcher
// Some user inputs never need to touch NEX1 · they're metadata commands
// against the chat itself. Parse them, execute locally, return the reply.

import type { ChatMessage, ParsedCommand, SlashCommand } from "./types";
import { listSessions, loadSession } from "./memory";
import { loadCodeStandards, loadProjectMap, listActiveRuns } from "./context-provider";

const KNOWN: readonly SlashCommand[] = [
  "help",
  "clear",
  "history",
  "files",
  "status",
  "dispatch",
  "standards",
  "map",
];

export function parseCommand(input: string): ParsedCommand | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) return null;
  const first_space = trimmed.indexOf(" ");
  const raw_cmd = (first_space === -1 ? trimmed : trimmed.slice(0, first_space)).slice(1).toLowerCase();
  const args = first_space === -1 ? "" : trimmed.slice(first_space + 1).trim();
  if (!KNOWN.includes(raw_cmd as SlashCommand)) return null;
  return { command: raw_cmd as SlashCommand, args };
}

/**
 * Handle commands that CAN be answered without touching NEX1/NEX-Twin.
 * Returns the reply string, or `null` if the command should still be routed to the engine
 * (e.g. `/dispatch` builds a payload that the engine consumes).
 */
export function handleLocalCommand(cmd: ParsedCommand, session_id: string): string | null {
  switch (cmd.command) {
    case "help":
      return HELP_TEXT;
    case "clear":
      // Actual clearing is done by the API route (it can wipe the session on disk).
      return "🧹 Clearing session memory · new session will be created on next message.";
    case "history": {
      const sessions = listSessions(20);
      if (sessions.length === 0) return "No chat sessions on disk yet.";
      const lines = sessions.map(
        (s, i) => `${i + 1}. \`${s.session_id}\` · ${s.title} · last: ${s.last_ts}`,
      );
      return `**Sessions on disk (${sessions.length}):**\n\n${lines.join("\n")}`;
    }
    case "files": {
      const map = loadProjectMap();
      const rows = Object.entries(map.key_paths)
        .map(([p, desc]) => `- \`${p}\` — ${desc}`)
        .join("\n");
      return `**Project map (${Object.keys(map.key_paths).length} key paths):**\n\n${rows}`;
    }
    case "standards": {
      const std = loadCodeStandards();
      return [
        "**Code standards in force:**",
        `- Language: \`${std.primary_language}\``,
        `- Modules: \`${std.module_style}\``,
        `- Errors: ${std.error_handling}`,
        `- Type safety: ${std.type_safety}`,
        `- Tests: ${std.test_framework}`,
        `- Commits: ${std.commit_style}`,
        `- Protected files (${std.protected_files.length}): ${std.protected_files.map((s) => `\`${s}\``).join(" · ")}`,
        `- Anti-bullshit: ${std.anti_bullshit.map((s) => `\`${s}\``).join(" · ")}`,
      ].join("\n");
    }
    case "map": {
      const s = loadSession(session_id);
      const map = loadProjectMap();
      const runs = listActiveRuns();
      return [
        `**Repo:** \`${map.project_root}\``,
        `**Session:** \`${session_id}\` · ${s?.messages.length ?? 0} messages`,
        `**Active coding-team runs:** ${runs.length}`,
        ...runs.map((r) => `  - \`${r.run_id}\` · ${r.status} · stage=${r.current_stage ?? "—"}`),
      ].join("\n");
    }
    case "status": {
      const runs = listActiveRuns();
      const s = loadSession(session_id);
      if (runs.length === 0) return `Session \`${session_id}\` · ${s?.messages.length ?? 0} messages · no active coding-team runs.`;
      return [
        `Session \`${session_id}\` · ${s?.messages.length ?? 0} messages.`,
        `**Active runs:**`,
        ...runs.map((r) => `- \`${r.run_id}\` · ${r.status} · stage=${r.current_stage ?? "—"}`),
      ].join("\n");
    }
    case "dispatch":
      // `/dispatch <prompt>` is routed to the engine — the engine (MAI or NEX1) creates
      // an actual coding-team run and returns the run_id. Local handler returns null so
      // the caller enqueues the message to the engine transit.
      if (cmd.args.length === 0) {
        return "Usage: `/dispatch <what you want built>` — routes to the 15-agent coding team.";
      }
      return null; // fall through to engine
    default:
      return null;
  }
}

const HELP_TEXT = `**NEX Coding Chat · commands**

- \`/help\` — this message
- \`/clear\` — start a fresh session (previous history stays on disk)
- \`/history\` — list past sessions
- \`/files\` — show the project map (key repo paths)
- \`/standards\` — show code standards in force
- \`/map\` — show current session + active coding-team runs
- \`/status\` — summary of active runs
- \`/dispatch <prompt>\` — hand the prompt to the 15-agent coding team

**Mention a file with \`@path/to/file.ts\`** and NEX auto-includes an excerpt in context.

Everything you type is routed to NEX1 / NEX-Twin (or the current supervising executor)
with full repo context. No LLM tokens leave your machine when local engines are in use.`;
