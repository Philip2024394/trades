# NEX Staircase Knowledge Architecture

**Source:** Philip's Batch 27 (2026-07-27)
**Purpose:** Principles for how NEX should reason about staircase knowledge — not more staircase facts, but the shape of the knowledge system itself.

> The strongest AI is not the one with the most information. It is the one that knows *which* information matters, *when* it matters, and *why*.

---

## 1. The goal

Not the biggest staircase database. **The most useful staircase expert.**

The staircase brain (1,928 FAQ entries as of Batch 24) is *source material*. The next generation of NEX capabilities — diagnosis engine, design recommendation engine, country packs, marketplace intelligence, photo analysis — is the *reasoning layer* that sits on top of it.

Adding more random facts without building the reasoning layer produces a bigger database, not a better expert.

---

## 2. Knowledge node design

Every NEX staircase entry should carry these dimensions:

```
Question
  → Expert answer
  → Related topics
  → Trade category (installation / structural / finishing / hardware / timber / regs / business)
  → Country relevance (UK · USA · Australia · universal)
  → Customer explanation (layered by audience level)
```

Single-fact entries ("Oak is strong") are weak. Composite entries ("Oak master node → styles / pricing / finishes / maintenance / alternatives") are strong because they link.

---

## 3. Audience hierarchy

NEX must answer the same underlying question differently depending on who is asking:

| Level | Audience | Tone |
|---|---|---|
| 1 | Homeowner | Plain language, feelings, safety-first |
| 2 | DIY user | Practical repair steps, tools, when to stop |
| 3 | Trade professional | Technical detail, dimensions, tolerances |
| 4 | Manufacturer | Production, machining, batch economics |

Every FAQ entry has an `audience_level` field. Diagnosis and design engines should respect it — a homeowner does not want to hear about kerf allowances.

---

## 4. Knowledge layers

```
Layer 1  Customer questions       ← what people ask
Layer 2  Trade knowledge          ← how the work is actually done
Layer 3  Manufacturing knowledge  ← how it is made in a workshop
Layer 4  Business intelligence    ← how the industry works
Layer 5  Industry strategy        ← where the industry is going
```

A customer asks a Layer 1 question. NEX often needs a Layer 2 or Layer 3 answer to respond well — but must translate down to Layer 1 language.

---

## 5. Avoid duplicate material knowledge

Weak pattern: "Oak for treads" + "Oak for luxury homes" + "Oak for modern homes" + "Oak for farmhouse".

Strong pattern: **Oak master node** with links to styles / pricing / finishes / maintenance / alternatives.

Deduplication saves storage and — more importantly — prevents drift. Four "oak" entries updated on different dates go out of sync. One master node stays canonical.

---

## 6. Component database

NEX should understand every staircase component as a first-class entity:

`string · tread · riser · newel · handrail · spindle · glass panel · fixings · skirting · balustrade · landing · nosing · baserail`

Each component carries:
- Common materials
- Standard sizes
- Fixing methods
- Common problems
- Typical suppliers
- Country variations in terminology

Questions about "screws" or "gaps" or "movement" resolve against the component database, not against a fuzzy match on the wider brain.

---

## 7. Problem diagnosis rule

**Cause before solution.** When a user reports a symptom, NEX must not immediately give a repair. First find the cause.

`Symptom → possible causes → diagnostic questions → confirmed cause → repair options.`

Skipping to a repair without confirming cause is how you tell a customer to add a screw to something that needs the whole newel re-bedded.

---

## 8. Separate installation from workshop intelligence

Installation and workshop are different disciplines. Same craft, different problems.

**Installation topics:** measuring · access · levelling · fixing · packing · finishing · snagging.

**Workshop topics:** timber preparation · CNC · cutting · assembly · sanding · finishing.

Combining them into one bucket loses the ability to route questions to the right expertise. A homeowner asks installation questions; a workshop apprentice asks workshop questions.

---

## 9. Design intelligence

NEX should understand *why* a style is a style, not just the label.

**Modern:** clean lines, minimal detail, glass, metal.
**Traditional:** turned components, decorative detail, timber warmth.
**Farmhouse:** honest materials, painted string + timber tread, chunky proportions.
**Luxury contemporary:** walnut or smoked oak, glass, integrated lighting, shadow gaps.

A customer says "modern" and NEX must translate to material and detail choices, not to a stock photo.

---

## 10. Customer emotion translation

Customers describe feelings; NEX must translate to specification.

| Customer says | NEX translates to |
|---|---|
| "I want it to look expensive" | Premium timber · clean details · integrated lighting · quality finishes |
| "I want it to feel warm" | Oak or walnut · matt finish · warm 2700-3000K lighting |
| "I want it to feel modern" | White oak · glass · square handrail · shadow gap detail |
| "I want it to look grand" | Curved geometry · full-height newels · statement balustrade |

Without this translation layer, NEX either quotes technical spec at customers who cannot decode it, or gives vague style advice that does not commit to product choices.

---

## 11. Budget intelligence — do not judge

Every price tier is a valid answer. NEX offers three tiers by default:

```
Budget option    →   Better option    →   Dream option
```

Never say "you should spend more". Show three routes and let the customer pick.

For customers who cannot afford their first choice: offer alternatives (oak stain instead of walnut · veneer details · feature handrail on painted stair).

---

## 12. Country intelligence

A staircase answer changes by country. UK regs, US IRC codes, Australian NCC. UK "spindle" = US "baluster" = both = same object.

**Country switching rule:** if a user asks about "American staircase" or specifies a US zip code, do not answer with UK-only assumptions. The country pack becomes the primary reference for regs, terminology and supplier landscape.

---

## 13. Supplier + marketplace intelligence

Separate databases:
- **Timber suppliers** — species, grades, delivery reach, price bands
- **Glass suppliers** — sizes, edge finishes, safety certifications
- **Hardware suppliers** — brackets, fixings, connectors, stair-spec kits
- **Machinery suppliers** — CNC, planers, spray booths (for the workshop-facing audience)

Marketplace intelligence connects customers → designers → manufacturers → installers → suppliers. Not a single product marketplace — a network of specialised marketplaces resolved by role.

---

## 14. Quote intelligence

NEX must understand what drives price:

`Size · Material · Complexity · Labour · Location · Access · Finishing scope`

And why two companies quote different prices:
- Different materials (specified oak vs unspecified "hardwood")
- Different finish (spray-lacquered vs on-site oiled)
- Different service level (stair-only vs full installation + decoration)

Never present a price comparison without normalising for scope.

---

## 15. Image intelligence

Future NEX should analyse photos. From a single photo it should identify:
- Stair type (open · closed · floating · spiral · winder)
- Materials (species, string material, balustrade type)
- Visible problems (loose newel, gap at string, worn nosing)
- Possible upgrades (oak caps · glass panels · lighting)

Photo → structured findings → recommended next step. See `photo-analysis-rules.md` (future doc) for the ruleset.

---

## 16. Design generator intelligence

Customer says "farmhouse style" — NEX generates concrete choices:
- Material suggestions
- Balustrade options
- Colour combinations
- Under-stair use recommendations

**Manufacturing realism rule:** never suggest a design that cannot be built. Every generated design passes structural, material and installation feasibility checks before it reaches the customer.

---

## 17. Expert validation and personality

Information should come from stair makers, joiners, installers and engineers — not from internet averages. Generic content is dangerous because it is confidently wrong.

NEX should sound like a mix of:
- Experienced staircase designer
- Experienced installer
- Helpful teacher (never patronising)

If NEX genuinely does not know, say so. Never invent to fill the silence.

---

## 18. Continuous learning loop

```
Question   →   Answer   →   Review   →   Improve   →   Add expert connection
```

When a new question type appears that NEX cannot answer well, that is a knowledge gap to fill — not a failure to hide. Every gap logged is next month's brain improvement.

**Deduplication process:**
1. Find similar entries
2. Merge into strongest answer
3. Add cross-links
4. Delete the weaker versions

Growth without dedup produces a bigger database that gets worse over time.

---

## 19. Knowledge quality score

Each entry carries a quality score across four dimensions:

- **Accuracy** — is it correct?
- **Depth** — does it explain the why, not just the what?
- **Practical value** — does it help someone do or decide something?
- **Country relevance** — is it clear which country / regs frame it assumes?

Low-scoring entries are candidates for rewrite or merge, not preservation.

---

## 20. The final architecture rule

A human remembers facts. **An expert understands connections.**

NEX needs connections — component to material, material to finish, finish to maintenance, maintenance to customer expectation, expectation to sales conversation. A single fact is useless in isolation; a fact linked into a reasoning graph is expert knowledge.

---

## 21. The pivot

The staircase brain has 1,928 FAQ entries. Adding another 1,000 is diminishing returns. The next phase moves from **brain** to **intelligence engine**:

1. **Diagnosis engine** — 100 common problems structured as decision trees (in progress)
2. **Design recommendation engine** — style + budget + house → concrete design
3. **Country packs** — UK / USA / Australia terminology + regs
4. **Marketplace intelligence** — network of connected specialised marketplaces
5. **Photo analysis rules** — structured rules for image identification

Each of these consumes the brain as source material and adds a reasoning layer on top.

---

## 22. The final rule

Every knowledge entry must help answer a real customer or trade problem. If it does not, it should not be in the brain. If it does, it should be linked to the reasoning layer that will actually use it.

Storage is cheap. Attention is not.
