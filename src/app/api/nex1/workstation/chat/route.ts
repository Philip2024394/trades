// POST /api/nex1/workstation/chat
//
// NEX1 · Workstation-scoped chat responder · 2026-09-17.
// Founder-authorised (troubleshoot: chat not producing reply on workstation).
//
// PURPOSE
//   The workstation page needs to answer WORKSTATION-CONTEXT questions
//   without going through the code-goal classifier at /api/nex1/chat/turn.
//   Session-3 root cause: the code-goal classifier refuses any message that
//   lacks a coding verb ("build/fix/refactor/change"). Workstation navigation
//   questions like "can I see preview" / "show me the file tree" have no
//   coding verb by design.
//
//   General fix (per Continuous Learning Program · no test-fitting): route
//   workstation-context messages through a small deterministic intent
//   responder that answers navigation questions natively, and DELEGATE to
//   /api/nex1/chat/turn ONLY when the message is genuinely a coding task.
//
//   Intents (deterministic pattern matching · zero LLM):
//     · PREVIEW · "see", "preview", "show", "open", "view", "display"
//                 · often paired with a file/repo/image reference
//     · LIST    · "list", "what files", "what's in", "tree", "files"
//     · SIZE    · "how big", "size", "how many files"
//     · FRAMEWORK · "framework", "built with", "what is it", "stack"
//     · SUGGESTIONS · "why", "restructure", "suggestion", "improve", "issues"
//     · SCAN    · "scan", "error", "warning", "malware", "safe"
//     · REPOS   · "which repos", "what repos", "available"
//     · GREET   · "hi", "hello", "hey"
//     · CODE_GOAL · build/fix/refactor/add/remove/rename/replace/change …
//                 → forward to /api/nex1/chat/turn
//     · UNKNOWN · returns an ACTIONABLE clarification (not "refused"),
//                 listing the actual workstation actions available now.
//
// CONTRACT
//   Request  · { conversation_id, message, repo_id?, context? }
//   Response · { ok, source: "NEX1_NATIVE", zero_llm: true,
//                intent, state, text, actions?, forwarded_to? }
//
// STATE VOCABULARY (workstation-scoped · distinct from code-goal chat)
//   · answered · direct native answer
//   · clarification_offered · user's question was ambiguous
//   · forwarded · delegated to /api/nex1/chat/turn for coding
//   · needs_repo · no repo selected · asks user to pick one
//
// Zero LLM · deterministic · pattern-based.

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface WorkstationContext {
  repo_id?: string | null;
  file_count?: number;
  total_bytes?: number;
  frameworks?: string[];
  restructure_suggestions_count?: number;
  scan_errors_count?: number;
  ready_for_prompt?: boolean;
  selected_file_path?: string | null;
}

interface Body {
  conversation_id?: string;
  message?: string;
  repo_id?: string;
  context?: WorkstationContext;
}

type Intent =
  | "PREVIEW" | "LIST" | "SIZE" | "FRAMEWORK" | "SUGGESTIONS"
  | "SCAN" | "REPOS" | "GREET" | "CODE_GOAL" | "UNKNOWN";

// Coding verbs (kept in sync semantically with the code-goal classifier).
// A message containing any of these — even in a wider sentence — is treated
// as a coding goal and delegated.
const CODING_VERBS = [
  "build", "make", "create", "add", "remove", "delete",
  "fix", "repair", "correct", "resolve",
  "refactor", "restructure", "rewrite", "rename",
  "change", "modify", "update", "edit", "replace",
  "improve", "optimise", "optimize", "clean up", "cleanup",
  "extract", "inline", "split", "merge",
  "implement", "wire", "connect", "hook up",
  "test", "verify",
];

const RE_WORD_BOUNDARY = (w: string) => new RegExp(`(^|\\W)${w.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}(\\W|$)`, "i");

function hasCodingVerb(msg: string): boolean {
  for (const v of CODING_VERBS) {
    if (RE_WORD_BOUNDARY(v).test(msg)) return true;
  }
  return false;
}

// Question-form detector. A message is treated as a QUESTION (navigation intent
// candidate) when it either ends in `?` or begins with an interrogative token.
// General rule: questions are ASKS, not COMMANDS — even when they mention a
// coding verb ("why is restructure suggested?" · "what does refactor mean?").
// This prevents accidental delegation of navigation questions to the code-goal
// classifier just because the question mentions a coding word.
const INTERROGATIVES = /^\s*(why|what|how|where|when|which|who|can|could|would|should|do|does|did|is|are|will|may|might)\b/i;
function isQuestionForm(msg: string): boolean {
  if (/\?\s*$/.test(msg)) return true;
  return INTERROGATIVES.test(msg);
}

function classifyIntent(msg: string): Intent {
  const m = msg.trim().toLowerCase();
  if (!m) return "UNKNOWN";

  // Greeting first · short-circuit.
  if (/^(hi|hello|hey|yo|hola|gm)\b/.test(m)) return "GREET";

  // Question form: run navigation intents BEFORE coding-verb detection so a
  // question that mentions "restructure/refactor/change" as a NOUN or as the
  // SUBJECT being asked about is not accidentally treated as a command.
  const question = isQuestionForm(msg);

  const navPattern = (): Intent | null => {
    if (/\b(scan|scanned|malware|virus|safe|threat|dangerous)\b/.test(m)) return "SCAN";
    if (/\b(suggestion|suggestions|improvement|improvements|advice|issues?|problems?|restructure|refactor idea)\b/.test(m)) return "SUGGESTIONS";
    if (/\b(framework|built with|stack|what is it|tech|technology|library|libraries)\b/.test(m)) return "FRAMEWORK";
    if (/\b(size|how big|total|file count|how many files|bytes|kb|mb)\b/.test(m)) return "SIZE";
    if (/\b(list|tree|what files|files here|whats here|what's here|files in|contents|show tree|browse)\b/.test(m)) return "LIST";
    if (/\b(which repos?|what repos?|available repos?|repos? available|repos? here)\b/.test(m)) return "REPOS";
    if (/\b(see|show|preview|open|view|display|render|look at|check out|reveal)\b/.test(m)) return "PREVIEW";
    return null;
  };

  if (question) {
    const nav = navPattern();
    if (nav) return nav;
    // Question-form but no navigation match · still MAY be a coding request
    // ("can you refactor …") · fall through to coding-verb check.
  }

  // Command-form: coding-verb wins over navigation intents when both present.
  if (hasCodingVerb(m)) return "CODE_GOAL";

  // Command-form navigation intents (no question).
  const nav = navPattern();
  if (nav) return nav;
  return "UNKNOWN";
}

function bytesHuman(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

interface Reply {
  intent: Intent;
  state: "answered" | "clarification_offered" | "forwarded" | "needs_repo";
  text: string;
  actions?: Array<{ kind: string; label: string; hint?: string }>;
  forwarded_to?: string;
}

function respond(msg: string, repo_id: string | null, ctx: WorkstationContext): Reply {
  const intent = classifyIntent(msg);
  const repo = repo_id ?? ctx.repo_id ?? null;

  if (intent === "CODE_GOAL") {
    return {
      intent,
      state: "forwarded",
      text: "That reads like a coding task — forwarding to the NEX1 code-goal channel.",
      forwarded_to: "/api/nex1/chat/turn",
    };
  }

  if (intent === "GREET") {
    return {
      intent,
      state: "answered",
      text: repo
        ? `Hi. You're on the workstation with ${repo}. Ask me to show a file, list the tree, or explain a suggestion — or state a coding goal to hand off to NEX1.`
        : "Hi. Pick a repo from the LEFT panel to begin onboarding.",
    };
  }

  if (!repo) {
    return {
      intent,
      state: "needs_repo",
      text: "No repo is selected yet. Click one of the repo buttons in the LEFT panel to onboard it first.",
    };
  }

  switch (intent) {
    case "PREVIEW":
      return {
        intent,
        state: "answered",
        text:
          `To preview a file · click any file in the LEFT file tree.\n` +
          `· HTML pages render in a sandboxed iframe (scripts disabled).\n` +
          `· Images / GIFs / SVG / icons render inline via <img>.\n` +
          `· Videos and audio render with a controls bar.\n` +
          `· PDFs render in an embedded viewer.\n` +
          `· Code files render in a syntax-hinted read-only panel.\n` +
          (ctx.selected_file_path ? `Currently selected: ${ctx.selected_file_path}.` : `No file is selected yet.`),
        actions: [
          { kind: "focus_tree", label: "Focus the file tree", hint: "top of LEFT panel" },
        ],
      };
    case "LIST":
      return {
        intent,
        state: "answered",
        text:
          `The file tree lives in the LEFT panel. Click any 📁 to expand a directory, ` +
          `and 📄 to preview a file. The tree honours the sandbox — you cannot navigate ` +
          `outside data/nex-training-corpus/${repo}.`,
      };
    case "SIZE":
      return {
        intent,
        state: "answered",
        text:
          `${repo} · ${ctx.file_count ?? "unknown"} files · ` +
          `${bytesHuman(ctx.total_bytes ?? 0)} on disk.`,
      };
    case "FRAMEWORK":
      return {
        intent,
        state: "answered",
        text:
          Array.isArray(ctx.frameworks) && ctx.frameworks.length > 0
            ? `${repo} was built with: ${ctx.frameworks.join(" + ")}.`
            : `Framework detection for ${repo} reported no known top-level framework · check package_details for raw signals.`,
      };
    case "SUGGESTIONS":
      return {
        intent,
        state: "answered",
        text:
          typeof ctx.restructure_suggestions_count === "number"
            ? `NEX1 flagged ${ctx.restructure_suggestions_count} restructure suggestion(s) for ${repo}. ` +
              `Each item is code-level (not UI) and appears in the RIGHT feed as a restructure_suggestion event with severity + rationale.`
            : `Restructure suggestion count is not available in the current context.`,
      };
    case "SCAN":
      return {
        intent,
        state: "answered",
        text:
          typeof ctx.scan_errors_count === "number"
            ? ctx.scan_errors_count === 0
              ? `${repo} passed the safety scan · no errors flagged during upload.`
              : `${repo} had ${ctx.scan_errors_count} scan finding(s) during upload · see the scan_error events in the RIGHT feed for detail.`
            : `Scan status is not available in the current context.`,
      };
    case "REPOS":
      return {
        intent,
        state: "answered",
        text: `The available repos are listed as buttons at the top of the LEFT panel. Click one to onboard it.`,
      };
    case "UNKNOWN":
    default:
      return {
        intent: "UNKNOWN",
        state: "clarification_offered",
        text:
          `I couldn't match that to a workstation intent. Try one of:\n` +
          `· "show me the file tree"\n` +
          `· "how big is this repo"\n` +
          `· "what framework is it"\n` +
          `· "why the restructure suggestion"\n` +
          `· "any scan errors"\n` +
          `Or state a coding goal (build/fix/refactor/change/…) to hand off to NEX1.`,
        actions: [
          { kind: "example", label: "show me the file tree" },
          { kind: "example", label: "how big is this repo" },
          { kind: "example", label: "what framework is it" },
        ],
      };
  }
}

async function forwardToCodeGoal(req: Request, body: Body): Promise<Response> {
  const url = new URL("/api/nex1/chat/turn", req.url);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      conversation_id: body.conversation_id,
      message: body.message,
    }),
  });
  const text = await res.text();
  let parsed: unknown = null;
  try { parsed = JSON.parse(text); } catch { /* upstream returned non-json */ }
  return NextResponse.json({
    ok: true,
    source: "NEX1_NATIVE",
    zero_llm: true,
    intent: "CODE_GOAL",
    state: "forwarded",
    forwarded_to: "/api/nex1/chat/turn",
    upstream_status: res.status,
    upstream: parsed ?? text,
  });
}

export async function POST(req: Request) {
  let body: Body = {};
  try { body = await req.json(); } catch { /* body optional */ }
  const message = (body.message ?? "").toString();
  if (!message.trim()) {
    return NextResponse.json({
      ok: false,
      error: "message_required",
      source: "NEX1_NATIVE",
      zero_llm: true,
    }, { status: 400 });
  }
  const ctx: WorkstationContext = body.context ?? {};
  const reply = respond(message, body.repo_id ?? ctx.repo_id ?? null, ctx);

  if (reply.state === "forwarded") {
    return forwardToCodeGoal(req, body);
  }

  return NextResponse.json({
    ok: true,
    source: "NEX1_NATIVE",
    zero_llm: true,
    intent: reply.intent,
    state: reply.state,
    text: reply.text,
    actions: reply.actions ?? [],
  });
}
