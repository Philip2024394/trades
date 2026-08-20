// P3 · Phase 1 · Language detection.
//
// Doctrine (Philip 2026-08-20): re-detect language every turn. Customer
// can switch English ↔ Indonesian mid-conversation and NEX follows.
// Default 'en' when signal is weak — protects the English regression gate.

import { detectLanguage } from "./lib/language.mjs";

const CASES = [
  // Positive · Indonesian
  { text: "Halo",                                          expect: "id" },
  { text: "Saya ingin tangga oak",                          expect: "id" },
  { text: "Saya mau tangga kayu jati",                      expect: "id" },
  { text: "Sebenarnya, ganti ke walnut",                    expect: "id" },
  { text: "Berapa harganya?",                               expect: "id" },
  { text: "Apa saja pilihan untuk railing?",                expect: "id" },
  { text: "Bagaimana dengan balustrade kaca?",              expect: "id" },
  { text: "Rekomendasi apa untuk hallway kecil?",           expect: "id" },
  { text: "Terima kasih",                                   expect: "id" },
  { text: "Iya, saya suka itu",                             expect: "id" },
  { text: "Tidak, saya belum yakin",                        expect: "id" },

  // Negative · English (existing regression gate)
  { text: "hi",                                             expect: "en" },
  { text: "I want an oak staircase",                        expect: "en" },
  { text: "how much would that cost roughly?",              expect: "en" },
  { text: "what about glass balustrades",                   expect: "en" },
  { text: "actually, change the oak to walnut",             expect: "en" },
  { text: "thanks",                                         expect: "en" },
  { text: "yes",                                            expect: "en" },
  { text: "no",                                             expect: "en" },
  { text: "What is a newel?",                               expect: "en" },
  { text: "It's a small Victorian hallway",                 expect: "en" },
  { text: "make the handrail walnut too",                   expect: "en" },
];

function main() {
  console.log("════════════════════════════════════════════════════════");
  console.log("P3-1 · Language detection (id vs en)");
  console.log("════════════════════════════════════════════════════════");
  let p = 0, f = 0;
  for (const c of CASES) {
    const actual = detectLanguage(c.text);
    const ok = actual === c.expect;
    console.log(`  ${ok ? "✓" : "✗"} "${c.text}" → ${actual} (expected ${c.expect})`);
    ok ? p++ : f++;
  }
  console.log(`\nSUMMARY · passed: ${p} · failed: ${f}`);
  process.exit(f === 0 ? 0 : 2);
}

main();
