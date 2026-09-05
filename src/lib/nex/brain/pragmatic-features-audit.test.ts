// src/lib/nex/brain/pragmatic-features-audit.test.ts
//
// Indonesian Pragmatic Layer · adversarial audit corpus + constitutional
// negative boundary (Philip 2026-09-01).
//
// Contract exercised here:
//
//   POSITIVE: For canonical pragmatic constructions, extractPragmaticFeatures
//   correctly identifies role / address / particles / register / codeswitching.
//
//   CONSTITUTIONAL NEGATIVE: Extracting pragmatic features MUST NOT change
//   any existing detector's output. The pragmatic layer is read-only
//   observation · existing detectors (abandonment / refinement /
//   entity-followup / reference) remain the constitutional wall.
//
//   NO PATTERN-LIST BLOAT. If a test needs a huge vocabulary to pass,
//   the test itself was wrong · not the layer.

import { describe, expect, it } from "vitest";
import { extractPragmaticFeatures, type PragmaticParticle } from "./pragmatic-features";
import { detectAbandonment } from "./abandonment-detector";
import { detectRefinement } from "./refinement-detector";
import { detectEntityFollowup } from "./entity-followup-detector";

// ═══════════════════════════════════════════════════════════════════
// PART 1 · ROLE detection · question / statement / command / etc.
// ═══════════════════════════════════════════════════════════════════

describe("Pragmatic · ROLE · question detection (ID + EN)", () => {
  it.each([
    // Indonesian wh-questions
    "Apa yang paling murah?",
    "Kapan Maghrib?",
    "Dimana lokasinya?",
    "Kenapa mahal banget?",
    "Bagaimana cara pesan?",
    "Gimana ya?",
    "Siapa nama driver?",
    "Berapa harganya?",
    // Indonesian yes/no questions
    "Bisa tolong bantu?",
    "Boleh yang ini aja?",
    "Udah sampai belum?",
    "Sudah dibayar?",
    "Masih ada slot?",
    "Ada yang recommended?",
    // English questions
    "What is this?",
    "When is Maghrib?",
    "Can you help me?",
    "Do you have any recommendations?",
    // Trailing question mark alone makes it a question
    "Ini mahal?",
    "Bener nih?",
  ])("'%s' role=question", (msg) => {
    expect(extractPragmaticFeatures(msg).role).toBe("question");
  });
});

describe("Pragmatic · ROLE · command detection", () => {
  it.each([
    "Coba yang lain",
    "Tolong kasih tau",
    "Kasih rekomendasi dong",
    "Bikin reservasi buat besok",
    "Cariin hotel deket sini",
    "Show me the cheapest",
    "Give me options",
    "Book that one",
    "Come check the map",
  ])("'%s' role=command", (msg) => {
    expect(extractPragmaticFeatures(msg).role).toBe("command");
  });
});

describe("Pragmatic · ROLE · clarification detection (bare Apa?)", () => {
  it.each([
    "Apa?",
    "Apa",
    "Apaan?",
    "Sorry?",
    "Huh?",
    "Hah?",
    "Maaf?",
  ])("'%s' role=clarification", (msg) => {
    expect(extractPragmaticFeatures(msg).role).toBe("clarification");
  });
});

describe("Pragmatic · ROLE · acknowledgement detection", () => {
  it.each([
    "Oke",
    "OK",
    "Sip",
    "Siap",
    "Siap!",
    "Iya",
    "Iyalah",
    "Iya deh",
    "Betul",
    "Bener",
    "Mantap",
    "Noted",
    "Got it",
    "Paham",
    "Ngerti",
    "Makasih",
    "Thanks",
  ])("'%s' role=acknowledgement", (msg) => {
    expect(extractPragmaticFeatures(msg).role).toBe("acknowledgement");
  });
});

describe("Pragmatic · ROLE · statement default", () => {
  it.each([
    "Yang lebih murah",
    "Jangan yang boutique",
    "Aku suka yang ini",
    "The nearest one",
    "Gak jadi beli",
  ])("'%s' role=statement", (msg) => {
    expect(extractPragmaticFeatures(msg).role).toBe("statement");
  });
});

// ═══════════════════════════════════════════════════════════════════
// PART 2 · ADDRESS extraction
// ═══════════════════════════════════════════════════════════════════

describe("Pragmatic · ADDRESS · bare + named forms", () => {
  it("'Pak, tolong bantu' → address=pak", () => {
    const f = extractPragmaticFeatures("Pak, tolong bantu");
    expect(f.address?.term).toBe("pak");
    expect(f.address?.name).toBeUndefined();
  });
  it("'Mas Budi, yang lebih murah' → address=mas Budi", () => {
    const f = extractPragmaticFeatures("Mas Budi, yang lebih murah");
    expect(f.address?.term).toBe("mas");
    expect(f.address?.name).toBe("Budi");
  });
  it("'Bu Rina, jangan yang mahal' → address=bu Rina", () => {
    const f = extractPragmaticFeatures("Bu Rina, jangan yang mahal");
    expect(f.address?.term).toBe("bu");
    expect(f.address?.name).toBe("Rina");
  });
  it("'Kak Ahmad Rizky, apa lagi?' → address=kak Ahmad Rizky", () => {
    const f = extractPragmaticFeatures("Kak Ahmad Rizky, apa lagi?");
    expect(f.address?.term).toBe("kak");
    expect(f.address?.name).toBe("Ahmad Rizky");
  });
});

describe("Pragmatic · ADDRESS · guards · non-address prefixes MUST NOT extract", () => {
  it.each([
    "Yang lebih murah",              // starts with Yang, not address
    "Aku mau ini",                   // pronoun, not address
    "Selamat pagi",                  // greeting, not address
    "Bagus banget",                  // adjective + intensifier
    "Cari hotel",                    // verb-first
  ])("'%s' has no address", (msg) => {
    expect(extractPragmaticFeatures(msg).address).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════
// PART 3 · PARTICLES
// ═══════════════════════════════════════════════════════════════════

describe("Pragmatic · PARTICLES · sih/dong/deh/kok/nih/tuh/aja/ya", () => {
  it.each<[string, PragmaticParticle[]]>([
    ["Apa sih?",                      ["sih"]],
    ["Kasih tau dong",                ["dong"]],
    ["Yang ini aja deh",              ["aja", "deh"]],
    ["Kok mahal banget?",             ["kok"]],
    ["Ini nih yang aku cari",         ["nih"]],
    ["Yang tuh aja",                  ["aja", "tuh"]],
    ["Cari yang murah aja",           ["aja"]],
    ["Ini bagus ya?",                 ["ya"]],
    ["Yang paling murah dong ya?",    ["dong", "ya"]],
  ])("'%s' particles=%j", (msg, expected) => {
    const found = extractPragmaticFeatures(msg).particles.sort();
    expect(found).toEqual(expected.sort());
  });
});

describe("Pragmatic · PARTICLES · guards · particle-like tokens mid-word MUST NOT match", () => {
  it("'sihir' (magic · contains 'sih') does not extract sih", () => {
    expect(extractPragmaticFeatures("Aku mau belajar sihir").particles).toEqual([]);
  });
  it("'kokoh' (sturdy · contains 'kok') does not extract kok", () => {
    expect(extractPragmaticFeatures("Bangunan yang kokoh").particles).toEqual([]);
  });
  it("'nihilis' (nihilist · contains 'nih') does not extract nih", () => {
    expect(extractPragmaticFeatures("Filsafat nihilis susah dipahami").particles).toEqual([]);
  });
  it("bare 'ya' at sentence start (as greeting) does not extract ya-particle", () => {
    // Our pattern requires content-then-ya-at-end · "ya" alone at start doesn't match
    expect(extractPragmaticFeatures("ya").particles).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════
// PART 4 · REGISTER heuristic
// ═══════════════════════════════════════════════════════════════════

describe("Pragmatic · REGISTER · classifies formal / polite / neutral / casual", () => {
  it("'Selamat pagi, Bapak Ahmad' → formal", () => {
    expect(extractPragmaticFeatures("Selamat pagi, Bapak Ahmad").register).toBe("formal");
  });
  it("'Apakah Anda punya rekomendasi?' → formal", () => {
    expect(extractPragmaticFeatures("Apakah Anda punya rekomendasi?").register).toBe("formal");
  });
  it("'Pak, tolong kasih rekomendasi dong' → polite (address + particle)", () => {
    expect(extractPragmaticFeatures("Pak, tolong kasih rekomendasi dong").register).toBe("polite");
  });
  it("'Gw mau yang murah banget aja' → casual (casual pronoun + intensifier)", () => {
    expect(extractPragmaticFeatures("Gw mau yang murah banget aja").register).toBe("casual");
  });
  it("'Lu udah check yang ini?' → casual (casual pronoun)", () => {
    expect(extractPragmaticFeatures("Lu udah check yang ini?").register).toBe("casual");
  });
  it("'Yang lebih murah' → neutral (declarative, no markers)", () => {
    expect(extractPragmaticFeatures("Yang lebih murah").register).toBe("neutral");
  });
});

// ═══════════════════════════════════════════════════════════════════
// PART 5 · CODE-SWITCHING detection
// ═══════════════════════════════════════════════════════════════════

describe("Pragmatic · CODE-SWITCHING · structural function-word mix (deliberately narrow)", () => {
  // Per Philip's "no large pattern lists" constraint · this detector
  // catches STRUCTURAL codeswitching (function words from both languages)
  // NOT content-word codeswitching (yang direct flight · yang recommended).
  // Content-word detection would require a huge vocabulary · deferred.
  it.each([
    "Show me yang paling murah",          // show + me (EN structural) + yang + paling (ID)
    "Bisa tolong help me?",                // bisa + tolong (ID) + help + me (EN)
    "Order yang ini aja",                  // order (EN structural) + yang + ini + aja (ID)
    "Give me yang direct flight",          // give + me (EN) + yang (ID)
    "Can you cariin yang murah?",          // can + you (EN) + yang (ID)
  ])("'%s' → codeswitching=true (structural function-word mix)", (msg) => {
    expect(extractPragmaticFeatures(msg).codeswitching).toBe(true);
  });

  it.each([
    "Yang lebih murah",                    // pure ID
    "Jangan yang boutique",                // "boutique" is content · not EN function word
    "Apa kabar?",                          // pure ID
    "Aku mau ini",                         // pure ID
    "Cari yang direct flight aja",         // "direct/flight" content words · not detected without vocab bloat
    "Yang recommended aja dong",           // "recommended" content · not detected
  ])("'%s' → codeswitching=false (pure ID OR content-word-only mix · known limitation)", (msg) => {
    expect(extractPragmaticFeatures(msg).codeswitching).toBe(false);
  });

  it.each([
    "Give me the cheapest",
    "What is this?",
    "Show me options",
  ])("'%s' → codeswitching=false (pure EN)", (msg) => {
    expect(extractPragmaticFeatures(msg).codeswitching).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// PART 6 · CONSTITUTIONAL NEGATIVE · pragmatic layer must NOT change
//          existing detectors' output on ANY sample
// ═══════════════════════════════════════════════════════════════════
//
// This is the load-bearing constitutional guarantee. For every sample
// in the corpus, we run detectPragmaticFeatures() AND the existing
// detectors, then re-run the existing detectors and prove they output
// the SAME result. Pragmatic layer is read-only observation.

const ALL_CORPUS_SAMPLES = [
  // Sample sentences from other corpora (H · C · R · H2 · T · Q · APA · ADDRESS · PRAYER)
  "Yang lebih murah",
  "Jangan yang third-party seller, official brand aja",
  "Gak jadi beli",
  "Lupakan",
  "Cancel that",
  "Yang first one",
  "yang tadi",
  "apa lagi?",
  "Ini apa?",
  "Apa kabar?",
  "Mas, yang lebih murah?",
  "Bu Rina, jangan kasih reminder lagi",
  "Pak, jam Maghrib berapa?",
  "Jangan yang unverified driver account, cancel aja",
  "What menu option yang paling recommended di sini?",
  "Yang rating-nya below 4.5 skip",
  "Gak usah pake paylater, cash aja",
  "yang direct flight aja",
  "the nearest one",
  "yang termurah",
  "yang next ride",
  "hey", "halo", "yes", "iya", "no", "jangan",
];

describe("Pragmatic · CONSTITUTIONAL NEGATIVE · extracting features MUST NOT change detector output", () => {
  it.each(ALL_CORPUS_SAMPLES)("'%s' — abandonment output unchanged before/after pragmatic extraction", (msg) => {
    const before = detectAbandonment(msg).matched;
    extractPragmaticFeatures(msg); // observe · discard
    const after  = detectAbandonment(msg).matched;
    expect(after).toBe(before);
  });

  it.each(ALL_CORPUS_SAMPLES)("'%s' — refinement output unchanged before/after pragmatic extraction", (msg) => {
    const before = detectRefinement(msg).matched;
    extractPragmaticFeatures(msg);
    const after  = detectRefinement(msg).matched;
    expect(after).toBe(before);
  });

  it.each(ALL_CORPUS_SAMPLES)("'%s' — entity-followup output unchanged before/after pragmatic extraction", (msg) => {
    const before = detectEntityFollowup(msg).matched;
    extractPragmaticFeatures(msg);
    const after  = detectEntityFollowup(msg).matched;
    expect(after).toBe(before);
  });
});

// ═══════════════════════════════════════════════════════════════════
// PART 7 · FALSE-POSITIVE TRAPS · pragmatic features on adversarial input
// ═══════════════════════════════════════════════════════════════════
//
// Sentences deliberately constructed to trip the pragmatic layer.
// The layer must produce reasonable features · no crashes · no
// impossible combinations.

describe("Pragmatic · FALSE-POSITIVE TRAPS · adversarial input handled cleanly", () => {
  it("empty string produces safe features", () => {
    const f = extractPragmaticFeatures("");
    expect(f.role).toBe("unknown");
    expect(f.address).toBeUndefined();
    expect(f.particles).toEqual([]);
    expect(f.register).toBe("unknown");
    expect(f.codeswitching).toBe(false);
  });
  it("whitespace-only string safe", () => {
    const f = extractPragmaticFeatures("   \n\t   ");
    expect(f.role).toBe("unknown");
  });
  it("very long stream doesn't crash", () => {
    const long = "yang ".repeat(500) + "murah";
    expect(() => extractPragmaticFeatures(long)).not.toThrow();
  });
  it("name-that-contains-address-word does not misclassify (e.g. 'Pakistani')", () => {
    // "Pakistani" starts with "pak" but is not an address term
    const f = extractPragmaticFeatures("Aku dari Pakistani area");
    expect(f.address).toBeUndefined();  // requires trailing ,:!?. after address
  });
  it("address without trailing punctuation does not extract (fail-closed)", () => {
    // "Mas Budi mau kemana?" — no comma after Budi · we require punctuation
    const f = extractPragmaticFeatures("Mas Budi mau kemana");
    expect(f.address).toBeUndefined();
  });
  it("particle-heavy but no address defaults to polite/casual not formal", () => {
    const f = extractPragmaticFeatures("Kasih dong nih deh");
    expect(f.register).not.toBe("formal");
  });
});

// ═══════════════════════════════════════════════════════════════════
// PART 8 · Aggregate observability report
// ═══════════════════════════════════════════════════════════════════

describe("Pragmatic · aggregate observability", () => {
  it("prints summary + confirms constitutional invariant across all samples", () => {
    const lines: string[] = [];
    lines.push("");
    lines.push("═════════════════════════════════════════════════════════════════════");
    lines.push("  Indonesian Pragmatic Layer · Adversarial Audit Summary");
    lines.push("═════════════════════════════════════════════════════════════════════");
    lines.push("");

    const roleCount   = new Map<string, number>();
    const partCount   = new Map<PragmaticParticle, number>();
    const regCount    = new Map<string, number>();
    let addressCount  = 0;
    let codeswitchCt  = 0;

    for (const msg of ALL_CORPUS_SAMPLES) {
      const f = extractPragmaticFeatures(msg);
      roleCount.set(f.role, (roleCount.get(f.role) ?? 0) + 1);
      regCount.set(f.register, (regCount.get(f.register) ?? 0) + 1);
      if (f.address) addressCount++;
      if (f.codeswitching) codeswitchCt++;
      for (const p of f.particles) partCount.set(p, (partCount.get(p) ?? 0) + 1);
    }

    lines.push(`Samples analysed: ${ALL_CORPUS_SAMPLES.length}`);
    lines.push(`Roles           : ${Array.from(roleCount.entries()).map(([k,v]) => `${k}=${v}`).join(" · ")}`);
    lines.push(`Registers       : ${Array.from(regCount.entries()).map(([k,v]) => `${k}=${v}`).join(" · ")}`);
    lines.push(`Particles       : ${Array.from(partCount.entries()).map(([k,v]) => `${k}=${v}`).join(" · ")}`);
    lines.push(`Address extracts: ${addressCount}`);
    lines.push(`Code-switching  : ${codeswitchCt}`);
    lines.push("");
    lines.push("Constitutional invariant: features are read-only observation.");
    lines.push("Existing detectors' output unchanged by pragmatic extraction.");
    lines.push("═════════════════════════════════════════════════════════════════════");
    // eslint-disable-next-line no-console
    console.log(lines.join("\n"));
    // The invariant is enforced by the individual per-sample tests in Part 6.
    // This aggregate is observability only · always passes.
    expect(true).toBe(true);
  });
});
