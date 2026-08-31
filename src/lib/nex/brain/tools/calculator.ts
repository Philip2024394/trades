// src/lib/nex/brain/tools/calculator.ts
//
// Stage 3.35 · Phase E · Deterministic calculator tool (Philip 2026-08-31).
//
// Doctrine (Phase E constitutional):
//   · Never uses an LLM to hallucinate arithmetic
//   · Only handles patterns whose intent is unambiguous
//   · Returns BLOCKED with reason when numeric args can't be extracted
//   · Every result carries the operation + operands so Reflection can
//     re-verify

export type CalculatorOp =
  | { kind: "percentage_of"; percent: number; of: number; result: number }
  | { kind: "addition";      operands: readonly number[]; result: number }
  | { kind: "subtraction";   left: number; right: number; result: number }
  | { kind: "multiplication"; operands: readonly number[]; result: number }
  | { kind: "division";      left: number; right: number; result: number };

export type CalculatorResult =
  | {
      computed: true;
      op: CalculatorOp;
      displayResult: string;   // "Rp 600.000" · "600,000" · "50" depending on hint
      replyText: { en: string; id: string };
    }
  | {
      computed: false;
      reason: "no_numeric_arguments" | "division_by_zero" | "no_operation_pattern";
      message: { en: string; id: string };
    };

// Parse a number that may carry Indonesian/English separator styles +
// unit shorthand ("3 million" · "3 juta" · "2.5m" · "500k").
export function parseHumanNumber(raw: string): number | undefined {
  const m = raw.trim().match(/^([\d.,]+)\s*(million|mil|m|juta|jt|k|ribu|rb|thousand)?$/i);
  if (!m) return undefined;
  const nRaw = m[1].replace(/,/g, "");           // commas are thousands separators
  const n = parseFloat(nRaw);
  if (!Number.isFinite(n)) return undefined;
  const unit = (m[2] ?? "").toLowerCase();
  const mult =
    unit === "million" || unit === "mil" || unit === "m" || unit === "juta" || unit === "jt" ? 1_000_000 :
    unit === "k" || unit === "ribu" || unit === "rb" || unit === "thousand" ? 1_000 :
    1;
  return n * mult;
}

function formatIdr(n: number): string {
  return `Rp ${n.toLocaleString("id-ID")}`;
}

/**
 * Deterministic calculator router · matches the message against a
 * bounded set of arithmetic patterns and executes the operation with
 * real numbers only. Never guesses.
 */
export function runCalculator(message: string): CalculatorResult {
  const m = message.trim();

  // 1. Percentage: "20% of 3 million" · "20 percent of 3 juta" · "hitung 20% dari 3 juta"
  {
    const rx = /(\d+(?:[.,]\d+)?)\s*(?:%|percent|persen)\s*(?:of|dari)\s*([\d.,]+\s*(?:million|mil|m|juta|jt|k|ribu|rb|thousand)?)/i;
    const r = m.match(rx);
    if (r) {
      const percent = parseFloat(r[1].replace(/,/g, ""));
      const of = parseHumanNumber(r[2]);
      if (of == null || !Number.isFinite(percent)) {
        return {
          computed: false,
          reason: "no_numeric_arguments",
          message: {
            en: "I recognised a percentage query but couldn't extract clean numeric arguments.",
            id: "Saya kenali pertanyaan persentase tapi tidak bisa mengekstrak angka yang jelas.",
          },
        };
      }
      const result = (percent / 100) * of;
      // Format as IDR when the "of" argument looked currency-shaped
      // (had a million/juta unit or looked like a big rupiah number).
      const displayResult = of >= 100_000 ? formatIdr(Math.round(result)) : String(result);
      return {
        computed: true,
        op: { kind: "percentage_of", percent, of, result },
        displayResult,
        replyText: {
          en: `${percent}% of ${of >= 100_000 ? formatIdr(of) : of} is ${displayResult}.`,
          id: `${percent}% dari ${of >= 100_000 ? formatIdr(of) : of} adalah ${displayResult}.`,
        },
      };
    }
  }

  // 2. Simple binary operation: "3 + 5" · "3+5" · "3 * 5" · "10 - 3" · "10 / 2"
  {
    const rx = /(\d+(?:[.,]\d+)?)\s*([+\-*/x×÷])\s*(\d+(?:[.,]\d+)?)/;
    const r = m.match(rx);
    if (r) {
      const left = parseFloat(r[1].replace(/,/g, ""));
      const right = parseFloat(r[3].replace(/,/g, ""));
      const opChar = r[2];
      if (!Number.isFinite(left) || !Number.isFinite(right)) {
        return {
          computed: false, reason: "no_numeric_arguments",
          message: { en: "Couldn't extract numeric arguments.", id: "Tidak bisa mengekstrak angka." },
        };
      }
      let result: number;
      let opName: CalculatorOp["kind"];
      switch (opChar) {
        case "+":
          result = left + right; opName = "addition"; break;
        case "-":
          result = left - right; opName = "subtraction"; break;
        case "*": case "x": case "×":
          result = left * right; opName = "multiplication"; break;
        case "/": case "÷":
          if (right === 0) {
            return {
              computed: false, reason: "division_by_zero",
              message: { en: "Division by zero is undefined.", id: "Pembagian dengan nol tidak terdefinisi." },
            };
          }
          result = left / right; opName = "division"; break;
        default:
          return { computed: false, reason: "no_operation_pattern", message: { en: "Unknown operator.", id: "Operator tidak dikenal." } };
      }
      const op: CalculatorOp =
        opName === "addition"       ? { kind: "addition", operands: [left, right], result } :
        opName === "subtraction"    ? { kind: "subtraction", left, right, result } :
        opName === "multiplication" ? { kind: "multiplication", operands: [left, right], result } :
                                      { kind: "division", left, right, result };
      const display = String(result);
      return {
        computed: true, op, displayResult: display,
        replyText: {
          en: `${left} ${opChar} ${right} = ${display}.`,
          id: `${left} ${opChar} ${right} = ${display}.`,
        },
      };
    }
  }

  // 3. No pattern matched · honest signal · never guesses.
  return {
    computed: false,
    reason: "no_operation_pattern",
    message: {
      en: "I couldn't identify a specific arithmetic operation in your message. Try phrasing like '20% of 3 million' or '150 + 200'.",
      id: "Saya tidak bisa mengidentifikasi operasi aritmatika. Coba format seperti '20% dari 3 juta' atau '150 + 200'.",
    },
  };
}
