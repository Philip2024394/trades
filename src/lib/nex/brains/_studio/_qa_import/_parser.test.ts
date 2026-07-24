import { describe, expect, it } from "vitest";
import { parseQA } from "./_parser";

describe("parseQA", () => {
  it("parses a single Q&A pair", () => {
    const { pairs } = parseQA("Q: What is a stringer?\nA: A stringer is the side member of a staircase.");
    expect(pairs).toHaveLength(1);
    expect(pairs[0].question).toBe("What is a stringer?");
    expect(pairs[0].answer).toBe("A stringer is the side member of a staircase.");
  });

  it("parses multiple pairs with blank lines between", () => {
    const { pairs } = parseQA(`
Q: First?
A: First answer.

Q: Second?
A: Second answer.

Q: Third?
A: Third answer.
`);
    expect(pairs).toHaveLength(3);
    expect(pairs.map((p) => p.question)).toEqual(["First?", "Second?", "Third?"]);
  });

  it("captures multi-line answers", () => {
    const { pairs } = parseQA(`Q: Complex question?
A: First line.
Second line.
Third line.`);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].answer).toContain("First line.");
    expect(pairs[0].answer).toContain("Second line.");
    expect(pairs[0].answer).toContain("Third line.");
  });

  it("is case-insensitive on markers", () => {
    const { pairs } = parseQA("q: lower?\na: lower answer.");
    expect(pairs).toHaveLength(1);
    expect(pairs[0].question).toBe("lower?");
  });

  it("ignores intro text before first Q:", () => {
    const { pairs } = parseQA(`This is some intro text.
It should be ignored.

Q: Real question?
A: Real answer.`);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].question).toBe("Real question?");
  });

  it("skips a Q with no matching A", () => {
    const { pairs, skipped } = parseQA(`Q: Orphan question?
Q: Real question?
A: Real answer.`);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].question).toBe("Real question?");
    expect(skipped.length).toBeGreaterThan(0);
  });

  it("skips pairs with empty answer", () => {
    const { pairs, skipped } = parseQA(`Q: Question?
A:

Q: Real?
A: Answer.`);
    expect(pairs).toHaveLength(1);
    expect(skipped.length).toBeGreaterThan(0);
  });

  it("returns empty result on empty input", () => {
    const { pairs } = parseQA("");
    expect(pairs).toHaveLength(0);
  });

  it("handles paragraphs inside answer", () => {
    const { pairs } = parseQA(`Q: Big question?
A: Paragraph one starts here and continues for a while.

Paragraph two is separate.

Paragraph three concludes.

Q: Next question?
A: Short answer.`);
    expect(pairs).toHaveLength(2);
    expect(pairs[0].answer.split("\n\n")).toHaveLength(3);
  });
});
