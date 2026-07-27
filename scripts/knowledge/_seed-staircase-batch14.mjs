#!/usr/bin/env node
// Batch 14 staircase seed — three focused gap-fills from Philip's
// 143-Q paste (Q121-Q263):
//   A. Glass TYPES & COLOURS (11) — clear, low-iron, smoked, tinted,
//      frosted, patterned, logo-laminated, panels vs spindles,
//      channel systems, spigots
//   B. Judging maker SKILL (3) — price vs skill, how to assess
//      quality, big-company vs small-maker trade-off
//   C. Misc new angles (7) — glass in small hallways, biggest glass
//      mistakes, when to order glass vs staircase, why some regret
//      glass, is glass always most luxurious, oak+glass, black+glass
//
// Skips ~120 Qs from the paste that duplicate Batches 1-13.

import fs from "node:fs";
import path from "node:path";

const FILE = path.resolve("knowledge/staircase.json");
const raw = fs.readFileSync(FILE, "utf8");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
fs.writeFileSync(`${FILE}.bak.${stamp}`, raw, "utf8");

const doc = JSON.parse(raw);

const NEW = [
  // ─── A. Glass types & colours (11) ────────────────────────
  { q: "What different types of glass are available for a staircase balustrade beyond plain clear glass?",
    a: "Quite a range — the visual options include clear glass (the default), low-iron ultra-clear glass (removes the green tinge of thicker standard glass), smoked or tinted glass (grey, bronze, black tones), frosted glass (for privacy or a softer look), patterned or printed glass (etched lines, textures, digital prints), and decorative laminated glass (bespoke artwork or logos sealed between two safety layers). All the same underlying safety-glass spec applies — you're only changing the appearance, not the structural performance.",
    audience: 2, classification: "expert_observation" },

  { q: "What is clear glass on a staircase balustrade — is it just standard window glass?",
    a: "It's the safety-glass version of clear glass (toughened, laminated, or toughened-laminated depending on spec) — never ordinary window glass. Clear glass is the most popular staircase choice because it maximises light through the flight, keeps sightlines open, and does the least visual work in a busy hallway. It works especially well in smaller homes where a solid balustrade would visually close the space in.",
    audience: 2, classification: "expert_observation" },

  { q: "What is low-iron glass and when is it worth specifying on a staircase?",
    a: "Low-iron (sometimes called 'ultra-clear' or 'optiwhite') is glass manufactured with the iron content reduced during production. Standard glass has a subtle green tinge — you barely notice it on a thin window pane, but on a 12 mm staircase balustrade panel viewed edge-on, the green is very obvious. Low-iron gives a crystal-clear appearance and shows the timber, wall colour and lighting behind it accurately. Worth specifying on any premium staircase where the glass thickness would make standard glass look tinted.",
    audience: 3, classification: "professional_recommendation" },

  { q: "What is smoked or tinted staircase glass?",
    a: "Safety glass manufactured with a colour tint through the whole panel — grey, bronze, black or occasionally green. It creates privacy without going fully opaque like frosted, adds a strong design statement, and pairs beautifully with black metal newels or dark interiors. Common uses: half-height smoked-glass panels below a timber handrail, or a full smoked-glass balustrade against a light wall for maximum contrast. Popular in modern industrial and luxury schemes.",
    audience: 2, classification: "expert_observation" },

  { q: "Is tinted or smoked staircase glass harder to keep looking clean than clear glass?",
    a: "About the same to clean, but marks show differently. Dark tinted glass reveals dust and cleaning streaks more visibly under sidelight than clear glass does; clear glass shows fingerprints more prominently. Cleaning method matters either way — proper glass cleaner and a clean microfibre cloth handles both. If your household would be bothered by visible cleaning streaks on a black panel, clear or low-iron might be the easier choice.",
    audience: 2, classification: "expert_observation" },

  { q: "What is frosted glass on a staircase?",
    a: "Safety glass with one face treated (sandblasted or acid-etched) so it's translucent — light passes through but you can't see clearly through it. Uses on a staircase: adds privacy where the flight is beside a bedroom or bathroom, softens the design vs the hard edge of clear glass, works as a subtle backdrop for LED lighting so the whole panel glows. Choose the etching direction with care — frosted-on-the-inside vs frosted-on-the-outside matters for cleaning (frosted surfaces are harder to keep smear-free).",
    audience: 3, classification: "professional_recommendation" },

  { q: "Can I have patterns, textures or prints inside staircase glass?",
    a: "Yes — decorative laminated glass lets you seal almost any design safely between two toughened layers. Options include etched line patterns, digital prints (photographs, gradients, colours), applied films, coloured interlayers, or textured surface finishes. All keep the underlying safety-glass structure intact. Specialist glass suppliers offer these as bespoke orders — expect longer lead times and higher cost than plain glass, but the design freedom is significant.",
    audience: 3, classification: "expert_observation" },

  { q: "Can I have my company logo or custom artwork laminated into a staircase glass panel?",
    a: "Yes — decorative laminated glass can carry almost any two-dimensional design: company logos, abstract art, photographs, family crests, gradients. The design is printed onto one of the layers or captured in an interlayer film, then sealed between two toughened glass sheets. Popular for commercial staircases, hotel entrances, and home cinema-room balustrades. As always with safety glass, everything has to be finalised before toughening — a change after the fact is a full remake.",
    audience: 3, classification: "expert_observation" },

  { q: "Should I choose full glass panels or slim glass-effect spindles for the balustrade?",
    a: "Different looks entirely. FULL GLASS PANELS give the cleanest modern appearance — uninterrupted sightlines, maximum light, the strongest design statement. GLASS SPINDLES (individual vertical glass rods spaced like traditional balusters) fit the same envelope as timber spindles and read as a subtle modern touch on an otherwise traditional balustrade — good for period homes updating carefully. Panels are more of a commitment; spindles are more of a blend. Depends how far into 'modern' you want to go.",
    audience: 3, classification: "expert_observation" },

  { q: "What is a glass channel fixing system on a staircase?",
    a: "A continuous metal (usually aluminium or stainless steel) channel bonded or bolted along the top edge of the string or landing edge — the glass panel drops vertically into the channel and is secured with resin or wedge-blocks. Advantage: no visible fixings through the glass (no point-fixing discs, no spider clamps), just a slim base rail. It's the cleanest, most minimal look for a modern glass balustrade. Downside: less forgiving to install and the channel needs to be perfectly straight or the glass sits skewed.",
    audience: 3, classification: "expert_observation" },

  { q: "What are glass spigots on a staircase balustrade?",
    a: "Individual stud-style fixings — small cylindrical stainless-steel supports that bolt down through the landing edge or string top, with the glass panel clamped between two of them at each corner. Sit between full channel systems (invisible but expensive) and point fixings (visible discs on the glass face). Spigots leave the top edge of the glass exposed cleanly and are usually the most cost-effective way to fit a frameless glass balustrade. Common on modern staircases and landings.",
    audience: 3, classification: "expert_observation" },

  // ─── B. Judging maker skill (3) — NEW territory ──────────
  { q: "Does a lower-priced staircase quote automatically mean the maker has less skill?",
    a: "Not automatically — a lower price can come from a simpler design, standard-size components, less expensive timber, lower workshop overheads, local supply chains, or included install being excluded. All legitimate. But an unusually low quote CAN indicate less-experienced labour, lower-grade materials, thinner finishes, or non-existent aftercare. The right question isn't 'is this the cheapest?' — it's 'what am I actually getting for this price?' Ask for a specific line-by-line breakdown: timber species and grade, finish product, balustrade type, install scope, warranty. Three lower quotes that itemise honestly can be safer than one higher quote that doesn't.",
    audience: 2, classification: "professional_recommendation" },

  { q: "How do I actually judge whether a staircase maker is skilled?",
    a: "Three areas worth pressing on. FIRST: their PORTFOLIO — ask for photos of at least three completed staircases similar to yours, ideally including close-ups of joints, cover slips, handrail-to-newel transitions and finish quality. Vague 'we've done lots' with no photos is a warning sign. SECOND: their COMMUNICATION — a skilled maker asks careful questions about your site, floors, walls, floor finishes and access before quoting; someone who quotes off a rough sketch without questions probably won't spot the site-specific issues either. THIRD: they talk about the DETAILS an amateur skips — timber movement, wall tolerances, handrail comfort, balustrade alignment, future refinishing. Depth of knowledge in the conversation predicts quality of the build.",
    audience: 2, classification: "professional_recommendation" },

  { q: "Should I choose a large staircase company or a small bespoke maker?",
    a: "Both can be excellent — depends on the project. LARGER companies give you production consistency, structured processes, wider resources for repeat-work or complex builds, and (usually) faster lead times. SMALLER bespoke makers give you personal attention from the actual person building your staircase, more design flexibility, traditional craftsmanship on unusual details, and often better after-sales relationships years later. For a straightforward new-build staircase, either works. For a genuinely bespoke design in a period home, a small experienced maker often wins. For a large or complex multi-flight project on a tight timeline, a larger company's process is a genuine advantage.",
    audience: 2, classification: "professional_recommendation" },

  // ─── C. Misc new angles (7) ──────────────────────────────
  { q: "Is a glass balustrade a good choice for a small or narrow hallway?",
    a: "Often the best choice — glass genuinely helps a small hallway feel less enclosed. A solid painted timber balustrade with turned spindles blocks the sightline and swallows the light; a clear or low-iron glass panel keeps everything visually open. Combined with under-tread LED and a light-coloured wall, a compact staircase can feel meaningfully larger than its footprint suggests. Downside is the cleaning frequency and the higher cost per metre than turned spindles — but the visual gain is real.",
    audience: 2, classification: "professional_recommendation" },

  { q: "What's the single biggest mistake homeowners make with a glass staircase?",
    a: "Treating the glass as a final decorative touch rather than a structural safety element planned from the start. The glass spec, thickness, fixing system, panel dimensions, hole positions, handrail arrangement and Building Control compliance all need designing IN — not bolted on at the end. Late glass decisions lead to remakes, wrong fixings, awkward last-minute handrails, and sometimes non-compliance. Design the glass at the same stage as the staircase drawing, not afterwards.",
    audience: 3, classification: "professional_recommendation" },

  { q: "Should I order the glass panels BEFORE or AFTER the staircase is installed?",
    a: "Almost always AFTER. The staircase goes in first; the installer levels it, adjusts to the actual floor and wall conditions, and confirms the final geometry. Then the glass supplier takes proper site measurements from the fitted staircase, manufactures the panels to those exact dimensions (including drilled holes for any point fixings), toughens them, and fits them. Ordering glass from drawings before the staircase's actually installed almost always produces panels that need remaking — because real-world install almost always shifts by small amounts from the drawing.",
    audience: 3, classification: "manufacturer_guidance" },

  { q: "Why do some homeowners end up regretting choosing glass balustrading?",
    a: "Almost always because they underestimated the cleaning frequency. Glass shows every fingerprint, every splash from a passing plant-water can, every mark from a child leaning against it, every dust settlement in a busy house. If nobody in the household is going to enjoy wiping the panels weekly, glass gets frustrating fast. Second regret is choosing very dark tinted glass and then discovering it shows cleaning streaks worse than clear does. Neither problem is glass's fault — it's a mismatch between what the design promised and what daily life actually delivers.",
    audience: 2, classification: "expert_observation" },

  { q: "Is a glass staircase always more luxurious than a timber one?",
    a: "No — a beautifully-made hardwood staircase can read as more luxurious than a mediocre glass one. Luxury on a staircase comes from craftsmanship, proportion, quality materials and thoughtful design details — not from a specific material choice. Turned oak spindles in a Georgian townhouse feel entirely right and premium; frameless glass in the same house feels like a design mistake. Match the material to the house before you match it to a trend.",
    audience: 2, classification: "expert_observation" },

  { q: "Why is the oak-and-glass staircase combination so popular in modern UK homes?",
    a: "Because it balances two contradictory things that homeowners want at once. Oak brings warmth, natural character, and the traditional 'proper staircase' feel; glass brings light, openness, and modern minimal styling. Neither alone quite hits the sweet spot most modern British homes want — glass alone can feel cold, oak alone can feel dark against modern open-plan interiors. Together they read as 'contemporary but not clinical', which is the register most new-builds and renovations aim for.",
    audience: 2, classification: "expert_observation" },

  { q: "Why does the black-metal-with-glass staircase combination work so well?",
    a: "Because the two materials do different jobs cleanly. Black powder-coated steel gives you crisp architectural line-work — stringers, newels, handrails all reading as strong geometric strokes against a light interior. Frameless glass fills the balustrade gaps without adding any visual competition to those lines. Result: the eye reads the staircase as an architectural composition rather than as a lot of decorative pieces. Pairs particularly well with black-framed windows and doors for design-language consistency across the whole space.",
    audience: 2, classification: "expert_observation" }
];

// Add new entries
const nextN = doc.entries.reduce((a, e) => {
  const m = String(e.id ?? "").match(/-(\d+)$/);
  return m ? Math.max(a, parseInt(m[1], 10)) : a;
}, 0) + 1;

const norm = (q) => String(q ?? "").toLowerCase().replace(/[?.!,;:'"]/g, "").replace(/\s+/g, " ").trim();
const existing = new Set(doc.entries.map((e) => norm(e.question)));

let added = 0, skipped = 0;
for (const item of NEW) {
  if (existing.has(norm(item.q))) { skipped += 1; continue; }
  const id = `staircase-faq-${String(nextN + added).padStart(3, "0")}`;
  doc.entries.push({
    id, kind: "faq",
    question: item.q,
    answer: item.a,
    category_tag: "staircase",
    audience_level: item.audience ?? null,
    classification: item.classification ?? "industry_good_practice",
    safety_note: item.safety ?? null,
    source_verified_at: null,
    fact_check_flag: null
  });
  existing.add(norm(item.q));
  added += 1;
}

doc.count = doc.entries.length;
doc.generated_at = new Date().toISOString();
fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + "\n", "utf8");

console.log(`✅ Batch 14 (glass types + maker skill + misc gaps): Added ${added} new entries (${skipped} skipped). Total: ${doc.entries.length}`);
console.log(`   backup: knowledge/staircase.json.bak.${stamp}`);
