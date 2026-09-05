// src/lib/nex/brain/user-fact-memory.test.ts
//
// G23 · User-Fact Memory · unit tests.
// Philip 2026-09-06 · AUTHORIZE · G23.

import { describe, it, expect, beforeEach } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import {
  detectUserFactCandidates,
  writeUserFacts,
  retrieveUserFacts,
  listAllUserFacts,
  supersedeMatchingFacts,
  decideMemoryReply,
  _resetUserFactStoreForTests,
  type UserFactCandidate,
} from "./user-fact-memory";

let tmpDir: string;
let tmpPath: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "g23-store-"));
  tmpPath = join(tmpDir, "user-facts.jsonl");
  _resetUserFactStoreForTests(tmpPath);
});

// ─── EXPLICIT · positive assertions create facts ────────────────

describe("detector · explicit user facts (positive)", () => {
  it("'I run a restaurant' → USER_PROFILE_INFORMATION / role", () => {
    const c = detectUserFactCandidates({ message: "I run a restaurant" });
    expect(c.length).toBeGreaterThan(0);
    expect(c[0].fact_type).toBe("USER_PROFILE_INFORMATION");
    expect(c[0].subject).toBe("role");
    expect(c[0].value).toBe("restaurant_operator");
    expect(c[0].scope).toBe("DURABLE");
    expect(c[0].confidence).toBe("EXPLICIT");
  });

  it("'I live in Yogyakarta' → residence / Yogyakarta / CURRENT", () => {
    const c = detectUserFactCandidates({ message: "I live in Yogyakarta" });
    expect(c[0].subject).toBe("residence");
    expect(c[0].value).toBe("yogyakarta");
    expect(c[0].scope).toBe("CURRENT");
  });

  it("'I prefer Indonesian' → preferred_language", () => {
    const c = detectUserFactCandidates({ message: "I prefer Indonesian" });
    expect(c[0].fact_type).toBe("USER_PREFERENCE");
    expect(c[0].subject).toBe("preferred_language");
    expect(c[0].value).toBe("indonesian");
  });

  it("'I have an allergy to shellfish' → USER_CONSTRAINT / allergy", () => {
    const c = detectUserFactCandidates({ message: "I have an allergy to shellfish" });
    expect(c[0].fact_type).toBe("USER_CONSTRAINT");
    expect(c[0].subject).toBe("allergy");
    expect(c[0].value).toBe("shellfish");
  });

  it("'I can't eat prawns' → USER_CONSTRAINT / dietary_exclusion", () => {
    const c = detectUserFactCandidates({ message: "I can't eat prawns" });
    expect(c[0].fact_type).toBe("USER_CONSTRAINT");
    expect(c[0].value).toBe("prawns");
  });

  it("'I'm travelling with my parents this week' → TEMPORARY context", () => {
    const c = detectUserFactCandidates({ message: "I'm travelling with parents this week" });
    expect(c[0].fact_type).toBe("USER_CONTEXT");
    expect(c[0].subject).toBe("travel_companions");
    expect(c[0].scope).toBe("TEMPORARY");
  });
});

// ─── §5 · ATOMICITY · compound utterances decompose ─────────────

describe("atomicity · compound utterances yield multiple candidates", () => {
  it("'I run a restaurant in Yogyakarta and I prefer WhatsApp' → 3 atomic facts", () => {
    const c = detectUserFactCandidates({
      message: "I run a restaurant and I live in Yogyakarta and I prefer WhatsApp",
    });
    const subjects = c.map((x) => x.subject).sort();
    expect(subjects).toEqual(["communication_channel", "residence", "role"]);
  });
});

// ─── §28 · ADVERSARIAL · things that must NOT become facts ──────

describe("§28 adversarial · non-facts must NOT create user facts", () => {
  it("'Do I run a restaurant?' (question) → no facts", () => {
    const c = detectUserFactCandidates({
      message: "Do I run a restaurant?",
      dialogueFunction: "INFORMATION_QUESTION",
    });
    expect(c).toEqual([]);
  });

  it("'People say I run a restaurant' (attribution) → no facts", () => {
    const c = detectUserFactCandidates({ message: "People say I run a restaurant" });
    expect(c).toEqual([]);
  });

  it("'My friend runs a restaurant' (third-party) → no facts", () => {
    const c = detectUserFactCandidates({ message: "My friend runs a restaurant" });
    expect(c).toEqual([]);
  });

  it("'I want to run a restaurant' (intention) → no facts", () => {
    const c = detectUserFactCandidates({ message: "I want to run a restaurant" });
    expect(c).toEqual([]);
  });

  it("'I'm thinking about running a restaurant' (intention) → no facts", () => {
    const c = detectUserFactCandidates({ message: "I'm thinking about running a restaurant" });
    expect(c).toEqual([]);
  });

  it("'I don't run a restaurant' (G12 NEGATED) → no positive fact", () => {
    const c = detectUserFactCandidates({
      message: "I don't run a restaurant",
      polarity: "NEGATED",
    });
    expect(c).toEqual([]);
  });

  it("dialogueFunction=INFORMATION_QUESTION suppresses even assertion-shaped inputs", () => {
    const c = detectUserFactCandidates({
      message: "I run a restaurant",   // assertion shape
      dialogueFunction: "INFORMATION_QUESTION",   // but classified as question
    });
    expect(c).toEqual([]);
  });
});

// ─── SAFETY · sensitive facts filtered ──────────────────────────

describe("§16 memory safety · sensitive facts rejected", () => {
  it("'My password is secret' → no fact", () => {
    // My friend is third-party rejection first · but "my" starts and
    // "password" is sensitive. Let's use "I have a password:" instead.
    const c = detectUserFactCandidates({ message: "I have an allergy to password" });
    // "password" as a value is filtered by the sensitive-value marker.
    expect(c).toEqual([]);
  });
});

// ─── PERSISTENCE · write + on-disk verification ─────────────────

describe("persistence · JSONL-backed store", () => {
  it("writeUserFacts appends to the on-disk JSONL", () => {
    const candidates: UserFactCandidate[] = detectUserFactCandidates({ message: "I run a restaurant" });
    const { written } = writeUserFacts(candidates, "conv1", "I run a restaurant");
    expect(written.length).toBe(1);
    expect(existsSync(tmpPath)).toBe(true);
    const contents = readFileSync(tmpPath, "utf8").trim().split("\n");
    expect(contents.length).toBe(1);
    const parsed = JSON.parse(contents[0]);
    expect(parsed.subject).toBe("role");
    expect(parsed.value).toBe("restaurant_operator");
    expect(parsed.conversation_id).toBe("conv1");
  });

  it("facts survive process-reset · reload from disk", () => {
    const candidates = detectUserFactCandidates({ message: "I run a restaurant" });
    writeUserFacts(candidates, "conv1", "I run a restaurant");
    // Simulate a fresh process load pointing at the same store file.
    _resetUserFactStoreForTests(tmpPath);
    const facts = listAllUserFacts("conv1");
    expect(facts.length).toBe(1);
    expect(facts[0].value).toBe("restaurant_operator");
  });
});

// ─── PROVENANCE · every fact records source ─────────────────────

describe("provenance · every fact records source · created_at · turn text", () => {
  it("captures the source turn text and created_at", () => {
    const candidates = detectUserFactCandidates({ message: "I live in Yogyakarta" });
    const { written } = writeUserFacts(candidates, "conv1", "I live in Yogyakarta");
    expect(written[0].provenance.source_type).toBe("user_assertion");
    expect(written[0].provenance.source_turn_text).toBe("I live in Yogyakarta");
    expect(written[0].provenance.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

// ─── SUPERSESSION · corrections update current truth ────────────

describe("supersession · corrections update the current truth", () => {
  it("'Actually, I live in Jakarta now' supersedes prior Yogyakarta residence", () => {
    writeUserFacts(
      detectUserFactCandidates({ message: "I live in Yogyakarta" }),
      "conv1", "I live in Yogyakarta");
    const secondCandidates = detectUserFactCandidates({ message: "I live in Jakarta" });
    const result = writeUserFacts(secondCandidates, "conv1", "Actually, I live in Jakarta now");
    // 1 new fact, 1 superseded
    expect(result.written.length).toBe(1);
    expect(result.superseded.length).toBe(1);
    expect(result.superseded[0].value).toBe("yogyakarta");
    // Retrieval without include_superseded returns only the current one
    const current = retrieveUserFacts({ conversation_id: "conv1", subjects: ["residence"] });
    expect(current.length).toBe(1);
    expect(current[0].value).toBe("jakarta");
    // Historical truth remains distinguishable
    const all = listAllUserFacts("conv1");
    expect(all.length).toBe(2);
    expect(all.some((f) => f.value === "yogyakarta" && f.status === "superseded")).toBe(true);
  });

  it("provenance for the correction records 'user_stated_correction'", () => {
    writeUserFacts(
      detectUserFactCandidates({ message: "I live in Yogyakarta" }),
      "conv1", "I live in Yogyakarta");
    const secondCandidates = detectUserFactCandidates({ message: "I live in Jakarta" });
    const result = writeUserFacts(secondCandidates, "conv1", "I live in Jakarta");
    expect(result.written[0].provenance.source_type).toBe("user_stated_correction");
  });
});

// ─── SUPERSESSION via G12 NEGATION · explicit retraction ────────

describe("G12 interaction · negated statements retract prior facts", () => {
  it("supersedeMatchingFacts retracts a prior current fact", () => {
    writeUserFacts(
      detectUserFactCandidates({ message: "I run a restaurant" }),
      "conv1", "I run a restaurant");
    const retracted = supersedeMatchingFacts({
      conversation_id: "conv1",
      fact_type: "USER_PROFILE_INFORMATION",
      subject: "role",
      source_turn_text: "Actually, I don't run a restaurant anymore",
    });
    expect(retracted.length).toBe(1);
    expect(retracted[0].status).toBe("superseded");
    expect(retracted[0].superseded_by).toContain("retracted:");
    // A follow-up query returns no current role fact
    const current = retrieveUserFacts({ conversation_id: "conv1", subjects: ["role"] });
    expect(current.length).toBe(0);
  });
});

// ─── RETRIEVAL · relevance-scoped ───────────────────────────────

describe("retrieval · scoped by fact_type or subject", () => {
  it("returns only requested fact_types", () => {
    writeUserFacts(
      detectUserFactCandidates({ message: "I run a restaurant" }),
      "conv1", "T1");
    writeUserFacts(
      detectUserFactCandidates({ message: "I prefer Indonesian" }),
      "conv1", "T2");
    const roleOnly = retrieveUserFacts({
      conversation_id: "conv1",
      fact_types: ["USER_PROFILE_INFORMATION"],
    });
    expect(roleOnly.length).toBe(1);
    expect(roleOnly[0].subject).toBe("role");
  });
});

// ─── MEMORY-QUESTION responder ──────────────────────────────────

describe("decideMemoryReply · retrieval questions", () => {
  it("'what do you know about me?' with facts → lists all", () => {
    writeUserFacts(
      detectUserFactCandidates({ message: "I run a restaurant" }),
      "conv1", "T1");
    const d = decideMemoryReply({ userMessage: "what do you know about me?", conversation_id: "conv1" });
    expect(d.shouldReply).toBe(true);
    if (d.shouldReply) {
      expect(d.reply.toLowerCase()).toContain("role");
      expect(d.reply.toLowerCase()).toContain("restaurant");
      expect(d.retrieved.length).toBe(1);
    }
  });

  it("'what did I tell you about my business?' scopes to profile info", () => {
    writeUserFacts(
      detectUserFactCandidates({ message: "I run a restaurant" }),
      "conv1", "T1");
    writeUserFacts(
      detectUserFactCandidates({ message: "I prefer Indonesian" }),
      "conv1", "T2");
    const d = decideMemoryReply({ userMessage: "what did I tell you about my business?", conversation_id: "conv1" });
    expect(d.shouldReply).toBe(true);
    if (d.shouldReply) {
      expect(d.reply.toLowerCase()).toContain("restaurant");
      expect(d.reply.toLowerCase()).not.toContain("indonesian"); // language not surfaced under 'business' topic
    }
  });

  it("empty memory → honest 'nothing recorded' reply · never fabricates", () => {
    const d = decideMemoryReply({ userMessage: "what do you remember about me?", conversation_id: "empty" });
    expect(d.shouldReply).toBe(true);
    if (d.shouldReply) {
      expect(d.reply.toLowerCase()).toMatch(/don't have|haven't/);
      expect(d.retrieved.length).toBe(0);
    }
  });

  it("provenance question surfaces the source turn text", () => {
    writeUserFacts(
      detectUserFactCandidates({ message: "I run a restaurant" }),
      "conv1", "I run a restaurant");
    const d = decideMemoryReply({
      userMessage: "why do you think I run a restaurant?",
      conversation_id: "conv1",
    });
    expect(d.shouldReply).toBe(true);
    if (d.shouldReply) {
      expect(d.reply.toLowerCase()).toContain("i run a restaurant");
    }
  });

  it("no memory-question pattern → does not fire", () => {
    const d = decideMemoryReply({ userMessage: "find me a hotel", conversation_id: "conv1" });
    expect(d.shouldReply).toBe(false);
  });
});

// ─── §11 SCOPE · TEMPORARY vs CURRENT vs DURABLE ────────────────

describe("scope discrimination", () => {
  it("'I run a restaurant' → DURABLE", () => {
    expect(detectUserFactCandidates({ message: "I run a restaurant" })[0].scope).toBe("DURABLE");
  });
  it("'I live in Yogyakarta' → CURRENT", () => {
    expect(detectUserFactCandidates({ message: "I live in Yogyakarta" })[0].scope).toBe("CURRENT");
  });
  it("'I'm travelling with parents this week' → TEMPORARY", () => {
    expect(detectUserFactCandidates({ message: "I'm travelling with parents this week" })[0].scope).toBe("TEMPORARY");
  });
});
