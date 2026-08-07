// Deterministic Q&A parser · zero LLM · zero cost per import.
//
// Author pastes structured Q&A written in ChatGPT (or by hand).
// Parser splits on Q: / A: markers and produces one craft.fact
// candidate per pair. Author already structured it, so the
// candidate lands with a payload that requires no LLM interpretation.
//
// Supported formats (case-insensitive on Q:/A:):
//   Q: <question>
//   A: <answer paragraph, may span multiple lines>
//
//   Q: <next question>
//   A: <next answer>
//
// Blank lines between pairs optional. Everything before the first
// "Q:" is ignored (intro text). Everything after the last "A:" is
// consumed as part of that answer until the next Q: or end of input.

export type QAPair = {
  index:    number;
  question: string;
  answer:   string;
};

export type ParseResult = {
  pairs:   QAPair[];
  skipped: string[];      // reasons for any pairs we couldn't parse cleanly
};

// Character class order intentional: Tailwind JIT scans .ts files and
// mistakes bracket-colon-value patterns for arbitrary utility classes,
// which pollutes globals.css. Placing the hyphen at the end (literal)
// avoids the false match.
const Q_MARK = /^\s*Q\s*[.:\-]\s*(.+)$/i;
const A_MARK = /^\s*A\s*[.:\-]\s*(.+)$/i;

export function parseQA(raw: string): ParseResult {
  const lines = raw.split(/\r?\n/);
  const pairs: QAPair[] = [];
  const skipped: string[] = [];

  let i = 0;
  let pairIndex = 0;

  while (i < lines.length) {
    // Skip lines until we find a Q: marker.
    while (i < lines.length && !Q_MARK.test(lines[i])) i++;
    if (i >= lines.length) break;

    const qMatch = lines[i].match(Q_MARK);
    if (!qMatch) { i++; continue; }
    const question = qMatch[1].trim();
    i++;

    // Collect subsequent lines until an A: marker.
    const questionExtra: string[] = [];
    while (i < lines.length && !A_MARK.test(lines[i]) && !Q_MARK.test(lines[i])) {
      if (lines[i].trim() !== "") questionExtra.push(lines[i].trim());
      i++;
    }
    if (i >= lines.length || !A_MARK.test(lines[i])) {
      skipped.push(`Q at line ${pairIndex + 1} had no matching A: · dropped`);
      continue;
    }

    const aMatch = lines[i].match(A_MARK);
    if (!aMatch) { i++; continue; }
    const answerFirst = aMatch[1].trim();
    i++;

    // Collect subsequent lines until the next Q: or end.
    const answerRest: string[] = [];
    while (i < lines.length && !Q_MARK.test(lines[i])) {
      answerRest.push(lines[i]);
      i++;
    }

    const fullQuestion = [question, ...questionExtra].join(" ").trim();
    const fullAnswer   = [answerFirst, ...answerRest.map((l) => l.trimEnd())]
                          .join("\n")
                          .replace(/\n{3,}/g, "\n\n")
                          .trim();

    if (fullAnswer === "") {
      skipped.push(`Q at pair ${pairIndex + 1} had empty answer · dropped`);
      continue;
    }

    pairs.push({ index: pairIndex, question: fullQuestion, answer: fullAnswer });
    pairIndex++;
  }

  return { pairs, skipped };
}
