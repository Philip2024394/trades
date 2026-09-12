// src/lib/nex-agent/language/code-intent-registry.ts
//
// Founder BEGIN 2026-09-10 · code-domain intents for the founder ↔ nex1
// conversation. Same 9 intent kinds nex1's classifyPrompt() knows · re-expressed
// as trigger tokens + phrases the deterministic language engine can score.
//
// Every intent carries: what triggers it · what nex1 asks back when unsure ·
// and a natural-English reply template used when composing back to the founder.

import type { DomainIntent } from "@/lib/nex/language/types";

export const CODE_INTENT_REGISTRY: readonly DomainIntent[] = Object.freeze([
  {
    slug: "add_feature",
    display: "Add a new feature",
    domain: "code",
    trigger_tokens: ["add", "build", "create", "new", "feature", "module"],
    trigger_phrases: ["chuck in", "bung in", "knock up", "put together", "spin up"],
    clarify_questions: [
      "Roughly where in the app does it live · a page · an API route · a background worker · or a library the others reuse?",
      "Anything already in the codebase this should mirror so it feels at home?",
      "What's the smallest working version you'd be happy shipping first?",
    ],
    reply_template: "Right — I've picked this up as a new feature build. {summary}. Founder still merges the branch.",
    confidence_base: 0.6,
  },
  {
    slug: "fix_bug",
    display: "Fix a bug",
    domain: "code",
    trigger_tokens: ["fix", "bug", "broken", "error", "crash", "issue", "problem"],
    trigger_phrases: ["sort out", "patch up", "not working", "gone wrong", "throwing an error"],
    clarify_questions: [
      "What's the shortest repro you can give me · one URL · one command · one click?",
      "What did you expect to see · and what did you actually see?",
      "Any error text · red banner · console message worth sharing?",
    ],
    reply_template: "Got it — a fix. {summary}. I'll produce the diff, verify it passes touched-files typecheck, and hand you a branch.",
    confidence_base: 0.72,
  },
  {
    slug: "explain",
    display: "Explain some code or concept",
    domain: "code",
    // Strong triggers for definition questions ("what is X" / "what does X mean" /
    // "define X") · these must beat operational intents like add_migration when
    // the founder is asking ABOUT a concept, not asking to DO something.
    trigger_tokens: ["explain", "how", "why", "walk", "understand", "does", "work", "mean", "meaning", "definition", "define", "definitions", "what"],
    trigger_phrases: [
      "walk me through", "talk me through", "run me through", "break it down",
      "what is", "what does", "what are", "what mean", "what means", "what does mean",
      "define", "meaning of", "definition of", "explain what",
    ],
    clarify_questions: [
      "Should I read the code as-is or trace what actually happens when someone hits it?",
      "Which file · route · or feature is the entry point · I'll follow the thread from there.",
    ],
    reply_template: "OK — explanation mode. {summary}. No files will be written.",
    confidence_base: 0.85,
  },
  {
    slug: "refactor",
    display: "Refactor existing code",
    domain: "code",
    trigger_tokens: ["refactor", "clean", "rename", "restructure", "reorganise", "tidy"],
    trigger_phrases: ["clean up", "tidy up", "pull apart"],
    clarify_questions: [
      "Are we shrinking the code · renaming something · or pulling logic into a shared library?",
      "How wide should the change land · one file · one folder · everywhere it appears?",
    ],
    reply_template: "OK — refactor. {summary}. No behaviour change intended · tests must still pass.",
    confidence_base: 0.65,
  },
  {
    slug: "add_migration",
    display: "Add a database migration",
    domain: "code",
    trigger_tokens: ["migration", "database", "postgres", "supabase", "schema", "table", "column"],
    trigger_phrases: ["new migration", "alter table", "add column", "drop column"],
    clarify_questions: [
      "Postgres side (nex_dev · db/migrations/) or Supabase side (supabase/migrations/)?",
      "Which schema and table? Existing table or brand new?",
      "How would we roll this back if it went wrong?",
    ],
    reply_template: "Right — a schema migration. {summary}. Founder types the confirmation phrase before it hits Postgres · that's unchanged.",
    confidence_base: 0.75,
  },
  {
    slug: "add_api_route",
    display: "Add a new API route",
    domain: "code",
    trigger_tokens: ["route", "api", "endpoint", "url"],
    trigger_phrases: ["new route", "new endpoint", "api route"],
    clarify_questions: [
      "What's the URL path?",
      "GET, POST, PUT, DELETE · or more than one?",
      "Rough shape of the response payload?",
    ],
    reply_template: "OK — new API route. {summary}. Will land as `src/app/api/…/route.ts`.",
    confidence_base: 0.75,
  },
  {
    slug: "explain_error",
    display: "Explain an error message",
    domain: "code",
    trigger_tokens: ["what", "mean", "error", "stack", "trace"],
    trigger_phrases: ["what does this mean", "what's this error"],
    clarify_questions: [
      "Paste the full error text if you can · line numbers help.",
      "Anything you did just before it appeared?",
    ],
    reply_template: "OK — diagnosing an error. {summary}. Purely reading · no writes.",
    confidence_base: 0.6,
  },
  {
    slug: "add_test",
    display: "Add tests",
    domain: "code",
    trigger_tokens: ["test", "tests", "vitest", "spec"],
    trigger_phrases: ["add tests", "write tests", "cover with tests"],
    clarify_questions: [
      "Unit-level (Vitest, single module) or end-to-end?",
      "What behaviour matters most to lock in?",
    ],
    reply_template: "OK — adding tests. {summary}. Will run vitest before commit.",
    confidence_base: 0.7,
  },
  {
    slug: "small_talk",
    display: "Small talk / greeting",
    domain: "code",
    trigger_tokens: ["hi", "hey", "hello", "morning", "afternoon", "evening", "cheers", "yo", "alright"],
    clarify_questions: [
      "What's on your mind · a bug · a build · a chat?",
    ],
    reply_template: "Hi. What are we tackling?",
    confidence_base: 0.9,
  },
  {
    slug: "capabilities",
    display: "What can you do",
    domain: "code",
    // Founder BEGIN 2026-09-10 · Phase 3 · meta questions about what NEX1 can do.
    // Note "programe" (common misspelling) + "program" · handled explicitly here
    // rather than in the slang list because it changes intent, not just wording.
    trigger_tokens: ["can", "capabilities", "abilities", "help", "code", "programe", "program", "programming", "do"],
    trigger_phrases: [
      "what can you do", "what can you code", "what can you programe", "what can you program",
      "what do you do", "what are you capable of",
      "how can you help", "how do you help",
      "list your capabilities", "list what you can do",
    ],
    clarify_questions: [
      "Do you want a full list of everything I can help with · or a summary of what I'm best at?",
    ],
    reply_template: "I'm NEX in software-engineering mode. I can help with adding features · fixing bugs · explaining code · refactoring · database migrations · API routes · and tests. Type your request in your own English and I'll classify, plan, and hand you a branch.",
    confidence_base: 0.85,
  },
]);
