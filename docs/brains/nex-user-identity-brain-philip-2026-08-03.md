---
authored_by: Philip O'Farrell (10-register model) · Master AI Engineer (classifier design)
authored_role: Founder doctrine + Master AI Engineer runtime design
captured_at: 2026-08-03
governance:
  rule_a_anti_fabrication: pass
  rule_c_attributable_origin: named_expert = Philip O'Farrell 2026-08-03
architecture_layer: L2 · Phase C · sits between User → Goal Layer
document_version: 1.0
composes_with:
  - Foundation Brain 13 (Match User Knowledge) — Identity classification FEEDS Brain 13
  - Foundation Brain 10 (Memory) — Identity persists across sessions in Workspace
  - Foundation Brain 3 (Customer Service) — Identity determines register
---

# NEX User Identity Brain

## The Doctrine

Philip 2026-08-03: *"Every new user gets classified. Then the AI adapts automatically."*

Identity is the first classification Nex makes about a new user. It sits ABOVE the Goal Layer and Router because who-someone-is determines how every downstream layer speaks + what defaults to load.

## The 10 Registers

| Register | Signals |
|---|---|
| **Homeowner (novice)** | Non-trade vocabulary · conceptual questions · consumer language |
| **Homeowner (informed)** | Some trade terms · has researched · Pinterest/Instagram references |
| **Builder** | Site-orientated · install sequence questions · material/tolerance mentions |
| **Joiner / Carpenter** | Manufacturing vocabulary · joinery terms fluently · workshop references |
| **Architect** | Design + regs + spec · plan-view thinking · CAD/BIM mentions |
| **Interior Designer** | Aesthetic + finishes + style compatibility · mood-board thinking |
| **Developer / Housebuilder** | Programme-first · volume · cost-per-unit · trade coordination |
| **Manufacturer** | Production + CNC + nesting + tolerance · commercial scale |
| **Student** | Learning-orientated · foundational "why" questions |
| **DIY Enthusiast** | Practical · tools · techniques · YouTube-style questions |
| **Business Owner (non-trade)** | Cake shop · hair salon · restaurant · service business |

## Signals

Nex reads these signals in decreasing weight:

1. **Explicit self-identification** — *"I'm the builder"* → highest weight (100%)
2. **Workspace declaration** — pre-existing Workspace profile → high (90%)
3. **Vocabulary in current message** — trade-specific terms → medium (70%)
4. **Question style** — conceptual vs technical vs procedural → medium (60%)
5. **Prior conversation register** (Foundation Brain 10) — established carries forward
6. **Goal Layer selection** — which of the 7 goal cards they picked → medium (50%)

## The Classification Algorithm

Token-weighted match against a signal vocabulary per register + score aggregation. Below 0.7 confidence → route via Goal Layer question instead of guessing (Brain 14 · Never-Guess).

## Persistence

Once classified with ≥0.85 confidence, register is written to the Workspace `user_profile.identity_register` field. Every subsequent conversation loads that register. If new evidence contradicts the stored register (customer's language shifts markedly), Nex re-classifies and updates the Workspace.

## Downstream Effects

Register drives:

- **Brain 13 (Match User Knowledge)** — tone, jargon depth, explanation style.
- **Brain 5 (Explaining Technical)** — translation on/off, and depth.
- **Brain 6 (Recommendations)** — technical vs conceptual reasoning.
- **Brain 12 (Show-Don't-Tell)** — homeowners get more images; joiners get technical drawings.
- **Goal Layer defaults** — Homeowners default to Home & Property · Business Owners default to Business Growth · etc.
- **Knowledge Layer filtering** — `audience_level` filter (1=novice/homeowner · 2=informed · 3=expert/trade).

## Never-Guess Rule

If Identity classification confidence <0.7 and no Workspace record exists, Nex asks ONE friendly question via the Goal Layer instead of assuming:

> *"Welcome to Nex. Are you looking to work on your home, grow a business, or something else?"*

The answer classifies both Identity AND Goal in a single question.

## Success Criteria

- 90% of returning users have their register instantly recognised from Workspace.
- 80% of first-time users have their register inferred correctly on the first message.
- Remaining 20% trigger the Goal Layer question, which classifies with 100% accuracy on the second message.
- No user is spoken to in a register that doesn't match them.

## Composition

- **Foundation Brain 13** — Identity feeds the tone.
- **Foundation Brain 10** — Identity persists via Workspace.
- **Foundation Brain 14** — Identity ambiguity triggers a clarifying question, not a guess.
- **Goal Layer (Phase C UI)** — surfaces the 7 goal cards that classify both Identity + Goal simultaneously.
