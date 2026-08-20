// P3 · Phase 2 · Indonesian intent classification.
//
// Doctrine (Philip 2026-08-20): "Indonesian and English are two
// linguistic inputs into the same canonical NEX reasoning system."
// Same intent slug regardless of language. Critical for
// pricing-doctrine safety — ask_price MUST fire on Indonesian input.
//
// Asserts: each Indonesian utterance classifies to the same canonical
// intent slug as its English equivalent.

import { createStore } from "./lib/store-factory.mjs";
import { STAIRCASE_ENTITIES, STAIRCASE_INTENTS } from "./lib/entities.mjs";
import { extractIntent } from "./lib/extract.mjs";

async function boot() {
  const store = await createStore({ backend: "jsonl" });
  for (const i of STAIRCASE_INTENTS) await store.upsertIntent(i);
  for (const e of STAIRCASE_ENTITIES) await store.upsertEntity({ ...e, brain: "staircase_brain" });
  return store;
}

const CASES = [
  // meta_greeting
  { text: "Halo",                                          expect: "meta_greeting" },
  { text: "Hai",                                           expect: "meta_greeting" },
  { text: "Selamat pagi",                                  expect: "meta_greeting" },
  // ask_price · DOCTRINE-CRITICAL
  { text: "Berapa harganya?",                              expect: "ask_price" },
  { text: "Berapa biaya untuk tangga oak?",                expect: "ask_price" },
  { text: "Harganya berapa?",                              expect: "ask_price" },
  { text: "Perkiraan biaya berapa?",                       expect: "ask_price" },
  { text: "Kira-kira berapa?",                             expect: "ask_price" },
  // ask_options
  { text: "Apa saja pilihan untuk balustrade?",            expect: "ask_options" },
  { text: "Pilihan apa saja yang ada?",                    expect: "ask_options" },
  { text: "Opsi apa yang tersedia?",                       expect: "ask_options" },
  // ask_definition
  { text: "Apa itu newel?",                                expect: "ask_definition" },
  { text: "Apa arti closed string?",                       expect: "ask_definition" },
  { text: "Jelaskan tentang cut string",                   expect: "ask_definition" },
  // ask_what_about
  { text: "Bagaimana dengan balustrade kaca?",             expect: "ask_what_about" },
  { text: "Kalau untuk hallway kecil?",                    expect: "ask_what_about" },
  { text: "Dan kalau memakai walnut?",                     expect: "ask_what_about" },
  // ask_recommendation
  { text: "Apa yang Anda rekomendasikan?",                 expect: "ask_recommendation" },
  { text: "Rekomendasi apa untuk hallway kecil?",          expect: "ask_recommendation" },
  { text: "Mana yang lebih baik?",                         expect: "ask_recommendation" },
  // correct
  { text: "Sebenarnya, ganti ke walnut",                   expect: "correct" },
  { text: "Sebetulnya walnut saja",                        expect: "correct" },
  { text: "Tunggu, kembali ke oak",                        expect: "correct" },
  { text: "Ganti ke walnut ya",                            expect: "correct" },
  { text: "Ubah ke oak",                                   expect: "correct" },
  // deny_attribution
  { text: "Saya tidak bilang balustrade kaca",             expect: "deny_attribution" },
  { text: "Bukan itu maksud saya",                         expect: "deny_attribution" },
  // confirm
  { text: "Ya",                                            expect: "confirm" },
  { text: "Iya",                                           expect: "confirm" },
  { text: "Oke",                                           expect: "confirm" },
  { text: "Baik, setuju",                                  expect: "confirm" },
  // close
  { text: "Terima kasih",                                  expect: "close" },
  { text: "Makasih",                                       expect: "close" },
  { text: "Sudah cukup, terima kasih",                     expect: "close" },
  { text: "Sampai jumpa",                                  expect: "close" },
  // compare
  { text: "Apa bedanya closed string dan cut string?",     expect: "compare" },
  { text: "Perbandingan oak vs walnut?",                   expect: "compare" },
  // ask_installation
  { text: "Bagaimana instalasinya?",                        expect: "ask_installation" },
  { text: "Apakah termasuk pemasangan?",                    expect: "ask_installation" },
];

async function main() {
  const store = await boot();
  console.log("════════════════════════════════════════════════════════");
  console.log("P3-Phase-2 · Indonesian intent classification");
  console.log("════════════════════════════════════════════════════════");
  let p = 0, f = 0;
  for (const c of CASES) {
    const intent = extractIntent(c.text, store);
    const ok = intent.slug === c.expect;
    console.log(`  ${ok ? "✓" : "✗"} "${c.text}" → ${intent.slug} (expected ${c.expect})`);
    if (!ok) console.log(`      reason: ${intent.reason}`);
    ok ? p++ : f++;
  }
  console.log(`\nSUMMARY · passed: ${p} · failed: ${f}`);
  process.exit(f === 0 ? 0 : 2);
}

main().catch(e => { console.error(e); process.exit(1); });
