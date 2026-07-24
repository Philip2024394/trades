import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Anthropic mock — controlled per test via mockCompleteReturn.
let mockCompleteReturn: unknown = null;
vi.mock("@/lib/llm/anthropic", () => ({
  completeWithUsage: vi.fn(async () => mockCompleteReturn)
}));

beforeEach(() => { mockCompleteReturn = null; });
afterEach(() => { mockCompleteReturn = null; });

describe("structureAuthorKnowledge", () => {
  it("returns no_llm_key when LLM returns null", async () => {
    mockCompleteReturn = null;
    const { structureAuthorKnowledge } = await import("./_llm_structure");
    const result = await structureAuthorKnowledge({
      brain_slug: "staircase",
      brain_name: "Staircase Brain",
      author_id: "author-1",
      author_name: "T",
      raw_input: "some notes"
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("no_llm_key");
  });

  it("rejects empty input", async () => {
    const { structureAuthorKnowledge } = await import("./_llm_structure");
    const result = await structureAuthorKnowledge({
      brain_slug: "staircase",
      brain_name: "Staircase Brain",
      author_id: "author-1",
      author_name: "T",
      raw_input: "   "
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("empty_input");
  });

  it("returns parse_error on malformed LLM JSON", async () => {
    mockCompleteReturn = { text: "not json", usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheCreationTokens: 0 } };
    const { structureAuthorKnowledge } = await import("./_llm_structure");
    const result = await structureAuthorKnowledge({
      brain_slug: "staircase", brain_name: "Staircase", author_id: "a", author_name: "T",
      raw_input: "input text"
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("parse_error");
  });

  it("returns candidates as pending with provenance filled", async () => {
    mockCompleteReturn = {
      text: JSON.stringify({
        candidates: [
          {
            kind: "craft.fact",
            payload: { id: "f1", statement: "test1 statement", evidence: [{ source: "src1" }], confidence: "medium" },
            source_span: "input mentions test1 clearly",
            needs_author_source: false,
            reason: "Author mentioned test1 in input"
          }
        ]
      }),
      usage: { inputTokens: 10, outputTokens: 10, cacheReadTokens: 0, cacheCreationTokens: 0 }
    };
    const { structureAuthorKnowledge } = await import("./_llm_structure");
    const result = await structureAuthorKnowledge({
      brain_slug: "staircase", brain_name: "Staircase", author_id: "author-1", author_name: "T",
      raw_input: "input mentions test1 clearly and provides evidence."
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.run.candidates.length).toBe(1);
    expect(result.run.candidates[0].status).toBe("pending");
    expect(result.run.candidates[0].provenance.llm_model).toBe("claude-opus-4-7");
    expect(result.run.candidates[0].provenance.input_hash).toHaveLength(16);
  });

  it("overrides needs_author_source to true when LLM returned null span but false flag", async () => {
    mockCompleteReturn = {
      text: JSON.stringify({
        candidates: [
          {
            kind: "craft.fact",
            payload: { id: "f1", statement: "s", evidence: [{ source: "" }], confidence: "low" },
            source_span: null,
            needs_author_source: false,   // <— LLM tried to say "no source needed"
            reason: "trust me"
          }
        ]
      }),
      usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheCreationTokens: 0 }
    };
    const { structureAuthorKnowledge } = await import("./_llm_structure");
    const result = await structureAuthorKnowledge({
      brain_slug: "staircase", brain_name: "Staircase", author_id: "author-1", author_name: "T",
      raw_input: "arbitrary input"
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Post-processing enforces needs_author_source when source_span is null.
    expect(result.run.candidates[0].needs_author_source).toBe(true);
  });

  it("strips ```json code fences from LLM output before parsing", async () => {
    mockCompleteReturn = {
      text: "```json\n" + JSON.stringify({
        candidates: [{ kind: "craft.fact", payload: { id: "f1", statement: "s", evidence: [{ source: "src" }], confidence: "medium" }, source_span: "s", needs_author_source: false }]
      }) + "\n```",
      usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheCreationTokens: 0 }
    };
    const { structureAuthorKnowledge } = await import("./_llm_structure");
    const result = await structureAuthorKnowledge({
      brain_slug: "staircase", brain_name: "Staircase", author_id: "author-1", author_name: "T",
      raw_input: "input"
    });
    expect(result.ok).toBe(true);
  });
});
