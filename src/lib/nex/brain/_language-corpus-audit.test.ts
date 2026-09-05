// src/lib/nex/brain/_language-corpus-audit.test.ts
//
// STAGE 3.41.k · LANGUAGE CORPUS AUDIT · Phase 1 · observation only.
// Zero code changes to production files. Delete after review.
//
// Drives 400 realistic EN/ID/code-switch sentences through the existing
// deterministic detectors:
//   · classifyConversationIntent
//   · extractEntities (ordinals · pronouns · areas · quantities · etc.)
//   · detectEntityFollowup
//   · parseConfirmation
//
// Reports per-family coverage · gaps · reusable pattern families ·
// implementation order. Does NOT modify any regex.

import { describe, it } from "vitest";
import { classifyConversationIntent } from "../conversation-intent";
import { extractEntities } from "./entities";
import { detectEntityFollowup } from "./entity-followup-detector";
import { parseConfirmation } from "./confirmation-parser";
import { detectAbandonment } from "./abandonment-detector";
import { detectRefinement } from "./refinement-detector";

// ─── The corpus · 400 sentences · organized by family A-L ───────

type Sentence = { text: string; language: "en" | "id" | "mix"; family: string; expectedIntent: string; expectedHandled?: boolean };

const CORPUS: Sentence[] = [
  // ─── A · INDONESIAN REFERENCES · 25 sentences ────────────────
  { text: "yang pertama",             language: "id",  family: "A",  expectedIntent: "reference" },
  { text: "yang kedua",               language: "id",  family: "A",  expectedIntent: "reference" },
  { text: "yang ketiga",              language: "id",  family: "A",  expectedIntent: "reference" },
  { text: "yang keempat",             language: "id",  family: "A",  expectedIntent: "reference" },
  { text: "yang kelima",              language: "id",  family: "A",  expectedIntent: "reference" },
  { text: "nomor satu",               language: "id",  family: "A",  expectedIntent: "reference" },
  { text: "nomor dua",                language: "id",  family: "A",  expectedIntent: "reference" },
  { text: "nomor tiga",               language: "id",  family: "A",  expectedIntent: "reference" },
  { text: "yang nomor satu",          language: "id",  family: "A",  expectedIntent: "reference" },
  { text: "yang nomor dua",           language: "id",  family: "A",  expectedIntent: "reference" },
  { text: "yang nomor tiga",          language: "id",  family: "A",  expectedIntent: "reference" },
  { text: "yang nomor dua bagus",     language: "id",  family: "A",  expectedIntent: "reference" },
  { text: "pertama",                  language: "id",  family: "A",  expectedIntent: "reference" },
  { text: "kedua",                    language: "id",  family: "A",  expectedIntent: "reference" },
  { text: "ketiga",                   language: "id",  family: "A",  expectedIntent: "reference" },
  { text: "yang ini",                 language: "id",  family: "A",  expectedIntent: "reference" },
  { text: "yang itu",                 language: "id",  family: "A",  expectedIntent: "reference" },
  { text: "yang tadi",                language: "id",  family: "A",  expectedIntent: "reference" },
  { text: "yang terakhir",            language: "id",  family: "A",  expectedIntent: "reference" },
  { text: "yang next",                language: "mix", family: "A",  expectedIntent: "reference" },
  { text: "yang option B",            language: "mix", family: "A",  expectedIntent: "reference" },
  { text: "yang paling murah",        language: "id",  family: "A",  expectedIntent: "refinement" },
  { text: "yang recommended",         language: "mix", family: "A",  expectedIntent: "reference" },
  { text: "yang ini aja",             language: "id",  family: "A",  expectedIntent: "reference" },
  { text: "yang itu aja",             language: "id",  family: "A",  expectedIntent: "reference" },

  // ─── B · CODE-SWITCH REFERENCES · 25 sentences ──────────────
  { text: "I'll take yang ini",             language: "mix", family: "B", expectedIntent: "reference" },
  { text: "what about yang black one",      language: "mix", family: "B", expectedIntent: "alternative" },
  { text: "let's pick yang ini",            language: "mix", family: "B", expectedIntent: "reference" },
  { text: "I love yang warna biru",         language: "mix", family: "B", expectedIntent: "preference" },
  { text: "the third one bagus",            language: "mix", family: "B", expectedIntent: "reference" },
  { text: "yang first one aja",             language: "mix", family: "B", expectedIntent: "reference" },
  { text: "yang last one",                  language: "mix", family: "B", expectedIntent: "reference" },
  { text: "that one yang tadi",             language: "mix", family: "B", expectedIntent: "reference" },
  { text: "the second one aja",             language: "mix", family: "B", expectedIntent: "reference" },
  { text: "pick yang cheapest",             language: "mix", family: "B", expectedIntent: "refinement" },
  { text: "the yang nomor dua",             language: "mix", family: "B", expectedIntent: "reference" },
  { text: "yang paling recommended",        language: "mix", family: "B", expectedIntent: "reference" },
  { text: "give me yang first",             language: "mix", family: "B", expectedIntent: "reference" },
  { text: "yang top rated",                 language: "mix", family: "B", expectedIntent: "refinement" },
  { text: "show me yang other options",     language: "mix", family: "B", expectedIntent: "alternative" },
  { text: "yang best deal",                 language: "mix", family: "B", expectedIntent: "refinement" },
  { text: "pick number two aja",            language: "mix", family: "B", expectedIntent: "reference" },
  { text: "gue mau the second one",         language: "mix", family: "B", expectedIntent: "reference" },
  { text: "yang ada di atas",               language: "id",  family: "B", expectedIntent: "reference" },
  { text: "yang di bawah",                  language: "id",  family: "B", expectedIntent: "reference" },
  { text: "yang di tengah",                 language: "id",  family: "B", expectedIntent: "reference" },
  { text: "the last yang muncul",           language: "mix", family: "B", expectedIntent: "reference" },
  { text: "kedua aja",                      language: "id",  family: "B", expectedIntent: "reference" },
  { text: "yang number 2",                  language: "mix", family: "B", expectedIntent: "reference" },
  { text: "yang no 3",                      language: "mix", family: "B", expectedIntent: "reference" },

  // ─── C · ABANDONMENT / CHANGE OF MIND · 30 sentences ────────
  { text: "forget that",                    language: "en",  family: "C", expectedIntent: "abandonment" },
  { text: "forget dinner",                  language: "en",  family: "C", expectedIntent: "abandonment" },
  { text: "forget food",                    language: "en",  family: "C", expectedIntent: "abandonment" },
  { text: "actually forget that",           language: "en",  family: "C", expectedIntent: "abandonment" },
  { text: "actually forget dinner",         language: "en",  family: "C", expectedIntent: "abandonment" },
  { text: "never mind",                     language: "en",  family: "C", expectedIntent: "abandonment" },
  { text: "nevermind",                      language: "en",  family: "C", expectedIntent: "abandonment" },
  { text: "scratch that",                   language: "en",  family: "C", expectedIntent: "abandonment" },
  { text: "cancel that",                    language: "en",  family: "C", expectedIntent: "abandonment" },
  { text: "skip that",                      language: "en",  family: "C", expectedIntent: "abandonment" },
  { text: "change my mind",                 language: "en",  family: "C", expectedIntent: "abandonment" },
  { text: "I changed my mind",              language: "en",  family: "C", expectedIntent: "abandonment" },
  { text: "actually no",                    language: "en",  family: "C", expectedIntent: "abandonment" },
  { text: "no wait",                        language: "en",  family: "C", expectedIntent: "abandonment" },
  { text: "hold on forget that",            language: "en",  family: "C", expectedIntent: "abandonment" },
  { text: "let's move on",                  language: "en",  family: "C", expectedIntent: "abandonment" },
  { text: "let's skip this",                language: "en",  family: "C", expectedIntent: "abandonment" },
  { text: "lupain aja",                     language: "id",  family: "C", expectedIntent: "abandonment" },
  { text: "gajadi",                         language: "id",  family: "C", expectedIntent: "abandonment" },
  { text: "gak jadi",                       language: "id",  family: "C", expectedIntent: "abandonment" },
  { text: "batal deh",                      language: "id",  family: "C", expectedIntent: "abandonment" },
  { text: "batal aja",                      language: "id",  family: "C", expectedIntent: "abandonment" },
  { text: "batalkan",                       language: "id",  family: "C", expectedIntent: "abandonment" },
  { text: "skip dulu",                      language: "id",  family: "C", expectedIntent: "abandonment" },
  { text: "tunda dulu",                     language: "id",  family: "C", expectedIntent: "abandonment" },
  { text: "gak usah dulu",                  language: "id",  family: "C", expectedIntent: "abandonment" },
  { text: "yang tadi aja",                  language: "id",  family: "C", expectedIntent: "reference" },
  { text: "actually lupain aja",            language: "mix", family: "C", expectedIntent: "abandonment" },
  { text: "gak jadi dinner deh",            language: "mix", family: "C", expectedIntent: "abandonment" },
  { text: "forget this whole thing",        language: "en",  family: "C", expectedIntent: "abandonment" },

  // ─── D · REFINEMENT / PREFERENCE · 40 sentences ─────────────
  { text: "yang lebih murah",               language: "id",  family: "D", expectedIntent: "refinement" },
  { text: "yang lebih mahal",               language: "id",  family: "D", expectedIntent: "refinement" },
  { text: "yang lebih besar",               language: "id",  family: "D", expectedIntent: "refinement" },
  { text: "yang lebih kecil",               language: "id",  family: "D", expectedIntent: "refinement" },
  { text: "yang lebih dekat",               language: "id",  family: "D", expectedIntent: "refinement" },
  { text: "yang lebih jauh",                language: "id",  family: "D", expectedIntent: "refinement" },
  { text: "yang premium",                   language: "id",  family: "D", expectedIntent: "refinement" },
  { text: "yang local",                     language: "mix", family: "D", expectedIntent: "refinement" },
  { text: "yang ready",                     language: "mix", family: "D", expectedIntent: "refinement" },
  { text: "yang more colorful",             language: "mix", family: "D", expectedIntent: "refinement" },
  { text: "yang paling safe",               language: "mix", family: "D", expectedIntent: "refinement" },
  { text: "yang recommended",               language: "mix", family: "D", expectedIntent: "refinement" },
  { text: "yang halal",                     language: "id",  family: "D", expectedIntent: "refinement" },
  { text: "yang buka 24 jam",               language: "id",  family: "D", expectedIntent: "refinement" },
  { text: "yang deket sini",                language: "id",  family: "D", expectedIntent: "refinement" },
  { text: "yang deket malioboro",           language: "id",  family: "D", expectedIntent: "refinement" },
  { text: "yang deket kampus",              language: "id",  family: "D", expectedIntent: "refinement" },
  { text: "yang enak",                      language: "id",  family: "D", expectedIntent: "refinement" },
  { text: "yang murah aja",                 language: "id",  family: "D", expectedIntent: "refinement" },
  { text: "similar kayak gini",             language: "mix", family: "D", expectedIntent: "refinement" },
  { text: "around here aja",                language: "mix", family: "D", expectedIntent: "refinement" },
  { text: "jangan terlalu jauh",            language: "id",  family: "D", expectedIntent: "refinement" },
  { text: "jangan yang mahal",              language: "id",  family: "D", expectedIntent: "refinement" },
  { text: "jangan yang mahal banget",       language: "id",  family: "D", expectedIntent: "refinement" },
  { text: "cheaper",                        language: "en",  family: "D", expectedIntent: "refinement" },
  { text: "something cheaper",              language: "en",  family: "D", expectedIntent: "refinement" },
  { text: "something closer",               language: "en",  family: "D", expectedIntent: "refinement" },
  { text: "something bigger",               language: "en",  family: "D", expectedIntent: "refinement" },
  { text: "something better",               language: "en",  family: "D", expectedIntent: "refinement" },
  { text: "something more upscale",         language: "en",  family: "D", expectedIntent: "refinement" },
  { text: "something less touristy",        language: "en",  family: "D", expectedIntent: "refinement" },
  { text: "under 500k",                     language: "en",  family: "D", expectedIntent: "price" },
  { text: "di bawah 500 ribu",              language: "id",  family: "D", expectedIntent: "price" },
  { text: "budget under 300k",              language: "en",  family: "D", expectedIntent: "price" },
  { text: "murah aja",                      language: "id",  family: "D", expectedIntent: "refinement" },
  { text: "affordable please",              language: "en",  family: "D", expectedIntent: "refinement" },
  { text: "nothing too expensive",          language: "en",  family: "D", expectedIntent: "refinement" },
  { text: "not too pricey",                 language: "en",  family: "D", expectedIntent: "refinement" },
  { text: "yang tanggal malam ini bisa",    language: "id",  family: "D", expectedIntent: "time" },
  { text: "book for tonight",               language: "en",  family: "D", expectedIntent: "time" },

  // ─── E · ENTITY REFERENCE · 30 sentences ────────────────────
  { text: "the shop",                       language: "en",  family: "E", expectedIntent: "reference" },
  { text: "the store",                      language: "en",  family: "E", expectedIntent: "reference" },
  { text: "the restaurant",                 language: "en",  family: "E", expectedIntent: "reference" },
  { text: "the place",                      language: "en",  family: "E", expectedIntent: "reference" },
  { text: "the hotel",                      language: "en",  family: "E", expectedIntent: "reference" },
  { text: "the seller",                     language: "en",  family: "E", expectedIntent: "reference" },
  { text: "the owner",                      language: "en",  family: "E", expectedIntent: "reference" },
  { text: "the venue",                      language: "en",  family: "E", expectedIntent: "reference" },
  { text: "tokonya",                        language: "id",  family: "E", expectedIntent: "reference" },
  { text: "restorannya",                    language: "id",  family: "E", expectedIntent: "reference" },
  { text: "tempatnya",                      language: "id",  family: "E", expectedIntent: "reference" },
  { text: "hotelnya",                       language: "id",  family: "E", expectedIntent: "reference" },
  { text: "penjualnya",                     language: "id",  family: "E", expectedIntent: "reference" },
  { text: "pemiliknya",                     language: "id",  family: "E", expectedIntent: "reference" },
  { text: "warungnya",                      language: "id",  family: "E", expectedIntent: "reference" },
  { text: "yang tadi",                      language: "id",  family: "E", expectedIntent: "reference" },
  { text: "yang ini",                       language: "id",  family: "E", expectedIntent: "reference" },
  { text: "yang itu",                       language: "id",  family: "E", expectedIntent: "reference" },
  { text: "that one",                       language: "en",  family: "E", expectedIntent: "reference" },
  { text: "this one",                       language: "en",  family: "E", expectedIntent: "reference" },
  { text: "them",                           language: "en",  family: "E", expectedIntent: "reference" },
  { text: "him",                            language: "en",  family: "E", expectedIntent: "reference" },
  { text: "her",                            language: "en",  family: "E", expectedIntent: "reference" },
  { text: "mereka",                         language: "id",  family: "E", expectedIntent: "reference" },
  { text: "dia",                            language: "id",  family: "E", expectedIntent: "reference" },
  { text: "that one looks good",            language: "en",  family: "E", expectedIntent: "reference" },
  { text: "this one looks nice",            language: "en",  family: "E", expectedIntent: "reference" },
  { text: "yang itu bagus",                 language: "id",  family: "E", expectedIntent: "reference" },
  { text: "yang ini bagus",                 language: "id",  family: "E", expectedIntent: "reference" },
  { text: "the one with the pool",          language: "en",  family: "E", expectedIntent: "reference" },

  // ─── F · ACTION LANGUAGE · 30 sentences ─────────────────────
  { text: "message them",                   language: "en",  family: "F", expectedIntent: "action" },
  { text: "message the shop",               language: "en",  family: "F", expectedIntent: "action" },
  { text: "contact the seller",             language: "en",  family: "F", expectedIntent: "action" },
  { text: "call the restaurant",            language: "en",  family: "F", expectedIntent: "action" },
  { text: "book it",                        language: "en",  family: "F", expectedIntent: "action" },
  { text: "book that one",                  language: "en",  family: "F", expectedIntent: "action" },
  { text: "reserve that one",               language: "en",  family: "F", expectedIntent: "action" },
  { text: "order this one",                 language: "en",  family: "F", expectedIntent: "action" },
  { text: "buy this one",                   language: "en",  family: "F", expectedIntent: "action" },
  { text: "text them",                      language: "en",  family: "F", expectedIntent: "action" },
  { text: "whatsapp them",                  language: "en",  family: "F", expectedIntent: "action" },
  { text: "email the owner",                language: "en",  family: "F", expectedIntent: "action" },
  { text: "reach out to them",              language: "en",  family: "F", expectedIntent: "action" },
  { text: "ping the shop",                  language: "en",  family: "F", expectedIntent: "action" },
  { text: "dm the seller",                  language: "en",  family: "F", expectedIntent: "action" },
  { text: "hubungi tokonya",                language: "id",  family: "F", expectedIntent: "action" },
  { text: "kontak penjualnya",              language: "id",  family: "F", expectedIntent: "action" },
  { text: "pesen yang ini",                 language: "id",  family: "F", expectedIntent: "action" },
  { text: "booking yang itu",               language: "id",  family: "F", expectedIntent: "action" },
  { text: "telepon restorannya",            language: "id",  family: "F", expectedIntent: "action" },
  { text: "kirim pesan ke tokonya",         language: "id",  family: "F", expectedIntent: "action" },
  { text: "wa tokonya",                     language: "id",  family: "F", expectedIntent: "action" },
  { text: "chat tokonya",                   language: "mix", family: "F", expectedIntent: "action" },
  { text: "message tokonya",                language: "mix", family: "F", expectedIntent: "action" },
  { text: "can you message them",           language: "en",  family: "F", expectedIntent: "action" },
  { text: "can you message the shop",       language: "en",  family: "F", expectedIntent: "action" },
  { text: "bisa hubungi tokonya",           language: "id",  family: "F", expectedIntent: "action" },
  { text: "tolong chat tokonya",            language: "mix", family: "F", expectedIntent: "action" },
  { text: "please contact the seller",      language: "en",  family: "F", expectedIntent: "action" },
  { text: "just book it",                   language: "en",  family: "F", expectedIntent: "action" },

  // ─── G · ALTERNATIVE REQUESTS · 25 sentences ────────────────
  { text: "what else",                      language: "en",  family: "G", expectedIntent: "alternative" },
  { text: "what else do they have",         language: "en",  family: "G", expectedIntent: "alternative" },
  { text: "anything else",                  language: "en",  family: "G", expectedIntent: "alternative" },
  { text: "anything more",                  language: "en",  family: "G", expectedIntent: "alternative" },
  { text: "any other suggestions",          language: "en",  family: "G", expectedIntent: "alternative" },
  { text: "other options",                  language: "en",  family: "G", expectedIntent: "alternative" },
  { text: "any other options",              language: "en",  family: "G", expectedIntent: "alternative" },
  { text: "got any more",                   language: "en",  family: "G", expectedIntent: "alternative" },
  { text: "show me more",                   language: "en",  family: "G", expectedIntent: "alternative" },
  { text: "give me more options",           language: "en",  family: "G", expectedIntent: "alternative" },
  { text: "similar",                        language: "en",  family: "G", expectedIntent: "alternative" },
  { text: "similar ones",                   language: "en",  family: "G", expectedIntent: "alternative" },
  { text: "backup alternative",             language: "en",  family: "G", expectedIntent: "alternative" },
  { text: "ada yang lain",                  language: "id",  family: "G", expectedIntent: "alternative" },
  { text: "ada yang lainnya",               language: "id",  family: "G", expectedIntent: "alternative" },
  { text: "ada lagi",                       language: "id",  family: "G", expectedIntent: "alternative" },
  { text: "ada lagi nggak",                 language: "id",  family: "G", expectedIntent: "alternative" },
  { text: "apa lagi",                       language: "id",  family: "G", expectedIntent: "alternative" },
  { text: "apa lagi ya",                    language: "id",  family: "G", expectedIntent: "alternative" },
  { text: "pilihan lain",                   language: "id",  family: "G", expectedIntent: "alternative" },
  { text: "pilihan lainnya",                language: "id",  family: "G", expectedIntent: "alternative" },
  { text: "yang sejenis",                   language: "id",  family: "G", expectedIntent: "alternative" },
  { text: "ada apa lagi di sana",           language: "id",  family: "G", expectedIntent: "alternative" },
  { text: "ada apa lagi",                   language: "id",  family: "G", expectedIntent: "alternative" },
  { text: "yang mirip",                     language: "id",  family: "G", expectedIntent: "alternative" },

  // ─── H · ACKNOWLEDGEMENT / CONTINUATION · 35 sentences ──────
  { text: "okay",                           language: "en",  family: "H", expectedIntent: "acknowledgement" },
  { text: "ok",                             language: "en",  family: "H", expectedIntent: "acknowledgement" },
  { text: "alright",                        language: "en",  family: "H", expectedIntent: "acknowledgement" },
  { text: "sounds good",                    language: "en",  family: "H", expectedIntent: "acknowledgement" },
  { text: "makes sense",                    language: "en",  family: "H", expectedIntent: "acknowledgement" },
  { text: "cool",                           language: "en",  family: "H", expectedIntent: "acknowledgement" },
  { text: "got it",                         language: "en",  family: "H", expectedIntent: "acknowledgement" },
  { text: "gotcha",                         language: "en",  family: "H", expectedIntent: "acknowledgement" },
  { text: "exactly",                        language: "en",  family: "H", expectedIntent: "acknowledgement" },
  { text: "true",                           language: "en",  family: "H", expectedIntent: "acknowledgement" },
  { text: "right",                          language: "en",  family: "H", expectedIntent: "acknowledgement" },
  { text: "sure",                           language: "en",  family: "H", expectedIntent: "acknowledgement" },
  { text: "fine",                           language: "en",  family: "H", expectedIntent: "acknowledgement" },
  { text: "boleh",                          language: "id",  family: "H", expectedIntent: "acknowledgement" },
  { text: "boleh boleh",                    language: "id",  family: "H", expectedIntent: "acknowledgement" },
  { text: "sip",                            language: "id",  family: "H", expectedIntent: "acknowledgement" },
  { text: "sipp",                           language: "id",  family: "H", expectedIntent: "acknowledgement" },
  { text: "oke",                            language: "id",  family: "H", expectedIntent: "acknowledgement" },
  { text: "oke deh",                        language: "id",  family: "H", expectedIntent: "acknowledgement" },
  { text: "ya",                             language: "id",  family: "H", expectedIntent: "acknowledgement" },
  { text: "iya",                            language: "id",  family: "H", expectedIntent: "confirm" },
  { text: "iya deh",                        language: "id",  family: "H", expectedIntent: "confirm" },
  { text: "iyalah",                         language: "id",  family: "H", expectedIntent: "acknowledgement" },
  { text: "bener",                          language: "id",  family: "H", expectedIntent: "acknowledgement" },
  { text: "betul",                          language: "id",  family: "H", expectedIntent: "acknowledgement" },
  { text: "gitu ya",                        language: "id",  family: "H", expectedIntent: "acknowledgement" },
  { text: "lanjut",                         language: "id",  family: "H", expectedIntent: "acknowledgement" },
  { text: "lanjut aja",                     language: "id",  family: "H", expectedIntent: "acknowledgement" },
  { text: "anyway lanjut",                  language: "mix", family: "H", expectedIntent: "acknowledgement" },
  { text: "mantap",                         language: "id",  family: "H", expectedIntent: "acknowledgement" },
  { text: "keren",                          language: "id",  family: "H", expectedIntent: "acknowledgement" },
  { text: "makasih",                        language: "id",  family: "H", expectedIntent: "acknowledgement" },
  { text: "thanks",                         language: "en",  family: "H", expectedIntent: "acknowledgement" },
  { text: "thank you",                      language: "en",  family: "H", expectedIntent: "acknowledgement" },
  { text: "cheers",                         language: "en",  family: "H", expectedIntent: "acknowledgement" },

  // ─── I · NATURAL INDONESIAN / CODE-SWITCHING · 40 sentences ──
  { text: "Agak pricey gak sih",            language: "mix", family: "I", expectedIntent: "opinion" },
  { text: "Ini perfect banget",             language: "mix", family: "I", expectedIntent: "opinion" },
  { text: "Kurang cocok ah",                language: "id",  family: "I", expectedIntent: "opinion" },
  { text: "Nyari yang similar kayak gini",  language: "mix", family: "I", expectedIntent: "alternative" },
  { text: "Ada option lain",                language: "mix", family: "I", expectedIntent: "alternative" },
  { text: "Search yang deket MRT",          language: "mix", family: "I", expectedIntent: "refinement" },
  { text: "Can you message tokonya",        language: "mix", family: "I", expectedIntent: "action" },
  { text: "Yang third one bagus",           language: "mix", family: "I", expectedIntent: "reference" },
  { text: "I'll take yang ini",             language: "mix", family: "I", expectedIntent: "reference" },
  { text: "Yang last one aja",              language: "mix", family: "I", expectedIntent: "reference" },
  { text: "Yang recommended aja",           language: "mix", family: "I", expectedIntent: "reference" },
  { text: "OK lah",                         language: "mix", family: "I", expectedIntent: "acknowledgement" },
  { text: "gak lah",                        language: "id",  family: "I", expectedIntent: "decline" },
  { text: "gapapa deh",                     language: "id",  family: "I", expectedIntent: "acknowledgement" },
  { text: "yaudah",                         language: "id",  family: "I", expectedIntent: "acknowledgement" },
  { text: "gimana ya",                      language: "id",  family: "I", expectedIntent: "clarify" },
  { text: "gitu",                           language: "id",  family: "I", expectedIntent: "acknowledgement" },
  { text: "mendingan yang mana",            language: "id",  family: "I", expectedIntent: "clarify" },
  { text: "enakan yang mana",               language: "id",  family: "I", expectedIntent: "clarify" },
  { text: "recommended-nya apa",            language: "mix", family: "I", expectedIntent: "clarify" },
  { text: "cariin yang bagus dong",         language: "id",  family: "I", expectedIntent: "discovery" },
  { text: "eh apa ada yang deket",          language: "id",  family: "I", expectedIntent: "refinement" },
  { text: "bagus sih tapi mahal",           language: "id",  family: "I", expectedIntent: "opinion" },
  { text: "ah too expensive",               language: "mix", family: "I", expectedIntent: "opinion" },
  { text: "murah tapi kayaknya jelek",      language: "id",  family: "I", expectedIntent: "opinion" },
  { text: "kayaknya bagus deh",             language: "id",  family: "I", expectedIntent: "opinion" },
  { text: "gaskeun",                        language: "id",  family: "I", expectedIntent: "confirm" },
  { text: "gas aja",                        language: "id",  family: "I", expectedIntent: "confirm" },
  { text: "ayo",                            language: "id",  family: "I", expectedIntent: "confirm" },
  { text: "yuk",                            language: "id",  family: "I", expectedIntent: "confirm" },
  { text: "kayaknya sih bagus",             language: "id",  family: "I", expectedIntent: "opinion" },
  { text: "let me think",                   language: "en",  family: "I", expectedIntent: "acknowledgement" },
  { text: "hmm let me think",               language: "en",  family: "I", expectedIntent: "acknowledgement" },
  { text: "hmm tunggu",                     language: "id",  family: "I", expectedIntent: "acknowledgement" },
  { text: "bentar",                         language: "id",  family: "I", expectedIntent: "acknowledgement" },
  { text: "sebentar",                       language: "id",  family: "I", expectedIntent: "acknowledgement" },
  { text: "tunggu dulu",                    language: "id",  family: "I", expectedIntent: "acknowledgement" },
  { text: "wait a sec",                     language: "en",  family: "I", expectedIntent: "acknowledgement" },
  { text: "hold on",                        language: "en",  family: "I", expectedIntent: "acknowledgement" },
  { text: "kasih tau dong",                 language: "id",  family: "I", expectedIntent: "followup" },

  // ─── J · GIFT / PERSON-BASED INTENT · 25 sentences ──────────
  { text: "I want to get her something",           language: "en", family: "J", expectedIntent: "gift" },
  { text: "I want to buy her something",           language: "en", family: "J", expectedIntent: "gift" },
  { text: "I want to get him something",           language: "en", family: "J", expectedIntent: "gift" },
  { text: "I need a gift",                         language: "en", family: "J", expectedIntent: "gift" },
  { text: "looking for a gift",                    language: "en", family: "J", expectedIntent: "gift" },
  { text: "something for my girlfriend",           language: "en", family: "J", expectedIntent: "gift" },
  { text: "something for my boyfriend",            language: "en", family: "J", expectedIntent: "gift" },
  { text: "something for her birthday",            language: "en", family: "J", expectedIntent: "gift" },
  { text: "something for our anniversary",         language: "en", family: "J", expectedIntent: "gift" },
  { text: "gift for my mom",                       language: "en", family: "J", expectedIntent: "gift" },
  { text: "birthday present idea",                 language: "en", family: "J", expectedIntent: "gift" },
  { text: "sebenernya aku mau beliin dia sesuatu", language: "id", family: "J", expectedIntent: "gift" },
  { text: "mau beliin dia sesuatu",                language: "id", family: "J", expectedIntent: "gift" },
  { text: "mau cari sesuatu buat dia",             language: "id", family: "J", expectedIntent: "gift" },
  { text: "buat hadiah",                           language: "id", family: "J", expectedIntent: "gift" },
  { text: "cari kado",                             language: "id", family: "J", expectedIntent: "gift" },
  { text: "cari kado buat pacar",                  language: "id", family: "J", expectedIntent: "gift" },
  { text: "cari kado ulang tahun",                 language: "id", family: "J", expectedIntent: "gift" },
  { text: "something buat dia",                    language: "mix",family: "J", expectedIntent: "gift" },
  { text: "buat gift",                             language: "mix",family: "J", expectedIntent: "gift" },
  { text: "kado buat mama",                        language: "id", family: "J", expectedIntent: "gift" },
  { text: "surprise buat pacar",                   language: "id", family: "J", expectedIntent: "gift" },
  { text: "want to surprise her",                  language: "en", family: "J", expectedIntent: "gift" },
  { text: "sesuatu yang special buat dia",         language: "mix",family: "J", expectedIntent: "gift" },
  { text: "cariin oleh-oleh",                      language: "id", family: "J", expectedIntent: "gift" },

  // ─── K · SOFT EMOTIONAL ACKNOWLEDGEMENT · 25 sentences ────
  { text: "NEX I'm annoyed with my girlfriend",    language: "en", family: "K", expectedIntent: "emotional" },
  { text: "I'm bored tonight",                     language: "en", family: "K", expectedIntent: "emotional" },
  { text: "I'm bored",                             language: "en", family: "K", expectedIntent: "emotional" },
  { text: "I'm tired",                             language: "en", family: "K", expectedIntent: "emotional" },
  { text: "I'm exhausted",                         language: "en", family: "K", expectedIntent: "emotional" },
  { text: "I'm stressed",                          language: "en", family: "K", expectedIntent: "emotional" },
  { text: "I'm overwhelmed",                       language: "en", family: "K", expectedIntent: "emotional" },
  { text: "I'm lonely",                            language: "en", family: "K", expectedIntent: "emotional" },
  { text: "had a rough day",                       language: "en", family: "K", expectedIntent: "emotional" },
  { text: "need to unwind",                        language: "en", family: "K", expectedIntent: "emotional" },
  { text: "lagi bad mood",                         language: "id", family: "K", expectedIntent: "emotional" },
  { text: "lagi galau",                            language: "id", family: "K", expectedIntent: "emotional" },
  { text: "mager",                                 language: "id", family: "K", expectedIntent: "emotional" },
  { text: "mager banget",                          language: "id", family: "K", expectedIntent: "emotional" },
  { text: "capek banget",                          language: "id", family: "K", expectedIntent: "emotional" },
  { text: "cape",                                  language: "id", family: "K", expectedIntent: "emotional" },
  { text: "lagi stres",                            language: "id", family: "K", expectedIntent: "emotional" },
  { text: "lagi kesel",                            language: "id", family: "K", expectedIntent: "emotional" },
  { text: "bete banget hari ini",                  language: "id", family: "K", expectedIntent: "emotional" },
  { text: "hari ini gak enak",                     language: "id", family: "K", expectedIntent: "emotional" },
  { text: "aku bosen malam ini",                   language: "id", family: "K", expectedIntent: "emotional" },
  { text: "butuh refreshing",                      language: "id", family: "K", expectedIntent: "emotional" },
  { text: "pengen healing",                        language: "id", family: "K", expectedIntent: "emotional" },
  { text: "butuh me time",                         language: "mix",family: "K", expectedIntent: "emotional" },
  { text: "kangen pacar",                          language: "id", family: "K", expectedIntent: "emotional" },

  // ─── L · CASUAL MORPHOLOGY (particles + slang) · 30 ────────
  { text: "cariin dong",                    language: "id", family: "L", expectedIntent: "discovery" },
  { text: "kasih tau dong",                 language: "id", family: "L", expectedIntent: "clarify" },
  { text: "coba deh",                       language: "id", family: "L", expectedIntent: "acknowledgement" },
  { text: "eh gimana sih",                  language: "id", family: "L", expectedIntent: "clarify" },
  { text: "kok gitu",                       language: "id", family: "L", expectedIntent: "clarify" },
  { text: "yaudahlah",                      language: "id", family: "L", expectedIntent: "acknowledgement" },
  { text: "boleh nih",                      language: "id", family: "L", expectedIntent: "acknowledgement" },
  { text: "yuk gas",                        language: "id", family: "L", expectedIntent: "confirm" },
  { text: "gw mau yang ini",                language: "id", family: "L", expectedIntent: "reference" },
  { text: "lu mau yang mana",               language: "id", family: "L", expectedIntent: "clarify" },
  { text: "gak deh",                        language: "id", family: "L", expectedIntent: "decline" },
  { text: "nggak jadi",                     language: "id", family: "L", expectedIntent: "abandonment" },
  { text: "ama yang ini aja",               language: "id", family: "L", expectedIntent: "reference" },
  { text: "pake yang murah",                language: "id", family: "L", expectedIntent: "refinement" },
  { text: "dapet diskon gak",               language: "id", family: "L", expectedIntent: "clarify" },
  { text: "nyari hotel",                    language: "id", family: "L", expectedIntent: "discovery" },
  { text: "nyari makan",                    language: "id", family: "L", expectedIntent: "discovery" },
  { text: "beliin sepatu",                  language: "id", family: "L", expectedIntent: "gift" },
  { text: "pesenin makanan",                language: "id", family: "L", expectedIntent: "action" },
  { text: "tanyain jam bukanya",            language: "id", family: "L", expectedIntent: "clarify" },
  { text: "urusin sendiri deh",             language: "id", family: "L", expectedIntent: "abandonment" },
  { text: "gaskeun bro",                    language: "id", family: "L", expectedIntent: "confirm" },
  { text: "mantap jiwa",                    language: "id", family: "L", expectedIntent: "acknowledgement" },
  { text: "wih keren",                      language: "id", family: "L", expectedIntent: "acknowledgement" },
  { text: "asik",                           language: "id", family: "L", expectedIntent: "acknowledgement" },
  { text: "asik nih",                       language: "id", family: "L", expectedIntent: "acknowledgement" },
  { text: "kece",                           language: "id", family: "L", expectedIntent: "acknowledgement" },
  { text: "santai aja",                     language: "id", family: "L", expectedIntent: "acknowledgement" },
  { text: "ampe kapan sih",                 language: "id", family: "L", expectedIntent: "clarify" },
  { text: "kayaknya sih",                   language: "id", family: "L", expectedIntent: "opinion" },

  // ─── EXTRA · DISCOVERY openers · 40 sentences (baseline for coverage) ──
  { text: "find me a hotel near malioboro", language: "en", family: "X-discovery", expectedIntent: "discovery" },
  { text: "cariin hotel dekat malioboro",   language: "id", family: "X-discovery", expectedIntent: "discovery" },
  { text: "find me somewhere nice to stay", language: "en", family: "X-discovery", expectedIntent: "discovery" },
  { text: "somewhere to eat",               language: "en", family: "X-discovery", expectedIntent: "discovery" },
  { text: "somewhere nice to eat",          language: "en", family: "X-discovery", expectedIntent: "discovery" },
  { text: "a place to eat",                 language: "en", family: "X-discovery", expectedIntent: "discovery" },
  { text: "maybe dinner",                   language: "en", family: "X-discovery", expectedIntent: "discovery" },
  { text: "mungkin makan malam",            language: "id", family: "X-discovery", expectedIntent: "discovery" },
  { text: "let's grab lunch",               language: "en", family: "X-discovery", expectedIntent: "discovery" },
  { text: "I'm hungry",                     language: "en", family: "X-discovery", expectedIntent: "discovery" },
  { text: "lapar",                          language: "id", family: "X-discovery", expectedIntent: "discovery" },
  { text: "laper",                          language: "id", family: "X-discovery", expectedIntent: "discovery" },
  { text: "buy me headphones",              language: "en", family: "X-discovery", expectedIntent: "discovery" },
  { text: "jewellery",                      language: "en", family: "X-discovery", expectedIntent: "discovery" },
  { text: "find me some jewellery",         language: "en", family: "X-discovery", expectedIntent: "discovery" },
  { text: "cariin perhiasan",               language: "id", family: "X-discovery", expectedIntent: "discovery" },
  { text: "cari perhiasan",                 language: "id", family: "X-discovery", expectedIntent: "discovery" },
  { text: "beli kalung",                    language: "id", family: "X-discovery", expectedIntent: "discovery" },
  { text: "new shoes",                      language: "en", family: "X-discovery", expectedIntent: "discovery" },
  { text: "a new phone",                    language: "en", family: "X-discovery", expectedIntent: "discovery" },
  { text: "book a table for two",           language: "en", family: "X-discovery", expectedIntent: "discovery" },
  { text: "book me a driver",               language: "en", family: "X-discovery", expectedIntent: "discovery" },
  { text: "find me a driver",               language: "en", family: "X-discovery", expectedIntent: "discovery" },
  { text: "need a plumber",                 language: "en", family: "X-discovery", expectedIntent: "discovery" },
  { text: "find me a dentist",              language: "en", family: "X-discovery", expectedIntent: "discovery" },
  { text: "cariin dokter",                  language: "id", family: "X-discovery", expectedIntent: "discovery" },
  { text: "cari klinik",                    language: "id", family: "X-discovery", expectedIntent: "discovery" },
  { text: "hey nex",                        language: "en", family: "X-discovery", expectedIntent: "greeting" },
  { text: "halo nex",                       language: "id", family: "X-discovery", expectedIntent: "greeting" },
  { text: "hi",                             language: "en", family: "X-discovery", expectedIntent: "greeting" },
  { text: "hello",                          language: "en", family: "X-discovery", expectedIntent: "greeting" },
  { text: "hai",                            language: "id", family: "X-discovery", expectedIntent: "greeting" },
  { text: "halo",                           language: "id", family: "X-discovery", expectedIntent: "greeting" },
  { text: "what's the weather",             language: "en", family: "X-discovery", expectedIntent: "weather" },
  { text: "cuaca hari ini",                 language: "id", family: "X-discovery", expectedIntent: "weather" },
  { text: "what is kos-kosan",              language: "en", family: "X-discovery", expectedIntent: "knowledge" },
  { text: "apa itu gudeg",                  language: "id", family: "X-discovery", expectedIntent: "knowledge" },
  { text: "calculate 20% of 3 million",     language: "en", family: "X-discovery", expectedIntent: "calculator" },
  { text: "hitung 20% dari 3 juta",         language: "id", family: "X-discovery", expectedIntent: "calculator" },
  { text: "what should I do tonight",       language: "en", family: "X-discovery", expectedIntent: "vague" },
];

// ─── Audit runner ───────────────────────────────────────────

type AuditRow = {
  sentence:       string;
  language:       string;
  family:         string;
  expectedIntent: string;
  classifiedAs:   string;
  classifyReason: string;
  ordinal:        string | null;
  pronoun:        string | null;
  isFollowup:     boolean;
  confirmation:   string;
  handled:        boolean;
  missingCapability: string;
};

function classifyRow(s: Sentence): AuditRow {
  const r = classifyConversationIntent(s.text, { userMarket: "ID" });
  const ents = extractEntities(s.text, "2026-08-31T00:00:00Z");
  const ordinal = ents.find(e => e.kind === "ordinal")?.canonical ?? null;
  const pronoun = ents.find(e => e.kind === "pronoun")?.canonical ?? null;
  const followup = detectEntityFollowup(s.text);
  const confirmation = parseConfirmation(s.text);

  // "handled" = the sentence would trigger the RIGHT deterministic
  // response given the user's expectedIntent.
  let handled = false;
  let missingCapability = "";
  switch (s.expectedIntent) {
    case "discovery":
      handled = ["accommodation","food","commerce","business","tourism","places","marketplace","transport"].includes(r.intent);
      if (!handled) missingCapability = "no vertical routing for this phrasing";
      break;
    case "greeting":
      handled = r.intent === "greeting" || /^\s*(hi|hello|hey|halo|hai|yo)\b/i.test(s.text);
      if (!handled) missingCapability = "greeting fallback";
      break;
    case "weather":
      handled = r.intent === "weather" || r.intent === "conversation";
      if (!handled) missingCapability = "weather intent";
      break;
    case "knowledge":
      handled = r.intent === "knowledge" || r.intent === "indonesia";
      if (!handled) missingCapability = "knowledge intent";
      break;
    case "calculator":
      handled = r.intent === "calculator" || /\d/.test(s.text);
      if (!handled) missingCapability = "calculator intent";
      break;
    case "vague":
      handled = r.intent === "conversation"; // vague SHOULD stay vague
      if (!handled) missingCapability = "should stay conversation/clarify";
      break;
    case "reference":
      handled = ordinal !== null || pronoun !== null;
      if (!handled) missingCapability = "reference not extracted";
      break;
    case "alternative":
      handled = followup.matched;
      if (!handled) missingCapability = "entity_followup pattern for 'what else' family";
      break;
    case "followup":
      handled = followup.matched;
      if (!handled) missingCapability = "entity_followup pattern";
      break;
    case "abandonment":
      handled = detectAbandonment(s.text).matched || confirmation.kind === "DECLINE";
      if (!handled) missingCapability = "abandonment/decline pattern not matched";
      break;
    case "acknowledgement":
      // Ambiguous · currently either DECLINE (no · never mind) OR
      // AMBIGUOUS (okay · sure). No dedicated ACKNOWLEDGEMENT class.
      handled = confirmation.kind === "AMBIGUOUS" || confirmation.kind === "CONFIRM";
      if (!handled) missingCapability = "no dedicated acknowledgement intent · falls to DECLINE or unclassified";
      break;
    case "confirm":
      handled = confirmation.kind === "CONFIRM";
      if (!handled) missingCapability = "confirm pattern";
      break;
    case "decline":
      handled = confirmation.kind === "DECLINE";
      if (!handled) missingCapability = "decline pattern";
      break;
    case "action":
      // Action verbs (message/call/whatsapp/hubungi/pesen) — tool-router
      // uses ACTION_MARKERS but that requires a resolved reference too.
      // Here we just check whether the phrase would enter the action gate.
      handled = /\b(message|contact|whatsapp|call|phone|reach out|hubungi|kontak|telepon|kirim|pesen|pesan|booking|order|buy this|book it|reserve)\b/i.test(s.text);
      if (!handled) missingCapability = "action verb not matched in tool-router markers";
      break;
    case "refinement":
      handled = detectRefinement(s.text).matched;
      if (!handled) missingCapability = "refinement pattern not matched";
      break;
    case "price":
      handled = /\b(under|below|di bawah|less than|max|maximum|budget|murah|mahal|cheap|expensive)\b/i.test(s.text);
      if (!handled) missingCapability = "price/budget signal not extracted";
      break;
    case "time":
      handled = /\b(tonight|tomorrow|weekend|malam ini|besok|akhir pekan)\b/i.test(s.text);
      if (!handled) missingCapability = "time signal not extracted";
      break;
    case "gift":
      // Gift = commerce intent + person-based framing. Currently only
      // fires if a product noun is present.
      handled = r.intent === "commerce";
      if (!handled) missingCapability = "gift intent without product noun · no commerce routing";
      break;
    case "emotional":
      // Should acknowledge before continuing. Currently falls to clarify.
      handled = false;
      missingCapability = "no soft emotional acknowledgement intent · needs doctrine decision";
      break;
    case "opinion":
      // Opinion turns ('ini perfect banget' / 'kurang cocok') · currently
      // fall to conversation (clarify) or ignored. No dedicated intent.
      handled = false;
      missingCapability = "no opinion/sentiment intent";
      break;
    case "clarify":
      handled = r.intent === "conversation";
      if (!handled) missingCapability = "clarify handling";
      break;
    default:
      missingCapability = "unknown expected intent";
  }
  return {
    sentence:       s.text,
    language:       s.language,
    family:         s.family,
    expectedIntent: s.expectedIntent,
    classifiedAs:   r.intent,
    classifyReason: r.reason,
    ordinal,
    pronoun,
    isFollowup:     followup.matched,
    confirmation:   confirmation.kind,
    handled,
    missingCapability,
  };
}

// ─── Report generator ───────────────────────────────────────

function summarise(rows: AuditRow[]): void {
  const total = rows.length;
  const handled = rows.filter(r => r.handled).length;
  const broken = total - handled;

  // Per-family
  const families = Array.from(new Set(rows.map(r => r.family))).sort();
  const perFamily = families.map(fam => {
    const inFam = rows.filter(r => r.family === fam);
    const h = inFam.filter(r => r.handled).length;
    const b = inFam.length - h;
    return { family: fam, total: inFam.length, handled: h, broken: b, pct: Math.round((h/inFam.length)*100) };
  });

  // Missing capability aggregate
  const gapCounts = new Map<string, number>();
  for (const r of rows) {
    if (!r.handled && r.missingCapability) {
      gapCounts.set(r.missingCapability, (gapCounts.get(r.missingCapability) ?? 0) + 1);
    }
  }
  const topGaps = Array.from(gapCounts.entries()).sort((a,b) => b[1]-a[1]).slice(0, 15);

  // Print
  const lines: string[] = [];
  lines.push("");
  lines.push("═════════════════════════════════════════════════════════════════════");
  lines.push("  3.41.k LANGUAGE CORPUS AUDIT · Phase 1 · Observation Only");
  lines.push("═════════════════════════════════════════════════════════════════════");
  lines.push("");
  lines.push(`TOTAL SENTENCES AUDITED  : ${total}`);
  lines.push(`HANDLED (deterministic)  : ${handled}  (${Math.round((handled/total)*100)}%)`);
  lines.push(`BROKEN / GAP             : ${broken}   (${Math.round((broken/total)*100)}%)`);
  lines.push("");
  lines.push("── PER-FAMILY COVERAGE ─────────────────────────────────────────────");
  for (const p of perFamily) {
    const bar = "█".repeat(Math.round(p.pct/5)).padEnd(20, " ");
    lines.push(`  ${p.family.padEnd(14)} ${bar} ${p.pct.toString().padStart(3)}%   handled=${p.handled.toString().padStart(3)} broken=${p.broken.toString().padStart(3)}`);
  }
  lines.push("");
  lines.push("── TOP 15 MISSING CAPABILITIES (by count) ──────────────────────────");
  for (const [gap, count] of topGaps) {
    lines.push(`  ${count.toString().padStart(3)}× ${gap}`);
  }
  lines.push("");
  lines.push("── SAMPLE BROKEN ROWS PER FAMILY ───────────────────────────────────");
  for (const fam of families) {
    const brokenRows = rows.filter(r => r.family === fam && !r.handled).slice(0, 4);
    if (brokenRows.length === 0) continue;
    lines.push(`  · ${fam}:`);
    for (const r of brokenRows) {
      lines.push(`      "${r.sentence}" (${r.language}) → expected=${r.expectedIntent} · classified=${r.classifiedAs} · gap=${r.missingCapability}`);
    }
  }
  lines.push("");
  lines.push("═════════════════════════════════════════════════════════════════════");
  // eslint-disable-next-line no-console
  console.log(lines.join("\n"));
}

describe("3.41.k · Language corpus audit · Phase 1 · observation only", () => {
  it(`audits ${CORPUS.length} sentences and prints the summary`, () => {
    const rows = CORPUS.map(classifyRow);
    summarise(rows);
  });
});
