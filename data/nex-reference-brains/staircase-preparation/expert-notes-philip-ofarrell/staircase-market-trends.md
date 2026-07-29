---
author: Philip O'Farrell
role: Founder · staircase manufacturer · named expert for the Staircase Reference Brain
captured_at: 2026-07-28
type: expert_note
status: layer_1_evidence
intended_module: staircase_market_trends (feeds Buying Intelligence · Specification Intelligence · Design Configurator · Estimation)
rule_b_compliance: authored by named expert · not AI-authored
rule_c_compliance: single named expert · every claim traceable · competitor names captured as market observation, not endorsement
---

# Staircase Market Trends & Segments

*Expert market observation by Philip O'Farrell · captured 2026-07-28 · Layer 1 evidence. Where the UK staircase market is going, which segments are growing, and how NEX should reason about market position when advising a workshop or a customer.*

The market is not shrinking — it is **shifting from selling functional access between floors to selling a design feature of the home**. The biggest growth is not in the number of staircases built; it's in the value and complexity of the staircases being chosen.

**Application note:** every principle here is subject to Product Constitution Principle 0003 — never used as a rigid rule. Market observations inform composition, not verdicts.

---

## Market segment structure

Four segments with distinct dynamics:

| Segment | Demand direction | Strength | Pressure |
|---|---|---|---|
| **Traditional** | Stable | Craftsmanship · heritage · fits period homes | Basic builder-grade variants under pressure from online |
| **Modern** | Growing | Open space · contemporary interiors · glass and metal combinations | High customisation expectations |
| **Luxury bespoke** | Growing | Unique architectural features · statement staircases · sweeping curves | Long lead times · deposit + design cycles |
| **Basic standard** | High price pressure | Cost efficiency | Online suppliers · imported components · standardisation |

Structured for the eventual Brain module:

```json
{
  "staircase_market_trends": {
    "traditional": {
      "demand": "stable",
      "strength": "craftsmanship and heritage"
    },
    "modern": {
      "demand": "growing",
      "strength": "open space and contemporary interiors"
    },
    "luxury_bespoke": {
      "demand": "growing",
      "strength": "unique architectural features"
    },
    "basic_standard": {
      "pressure": "high",
      "reason": "price competition from online / imported"
    }
  }
}
```

## Where growth is strongest

**Premium renovation market.** Older homes being upgraded · customers want to replace old stairs, improve hallway appearance, and increase home value.

**Luxury residential.** Sweeping stairs · curved handrails · premium hardwoods · architectural features.

**Personalisation.** Customers increasingly want *"make my staircase different"* rather than *"give me the cheapest staircase."*

## Where pressure is strongest

Very basic builder-grade painted softwood staircases with no design differentiation. Online suppliers · standardised designs · imported components compete on price alone — a traditional workshop cannot win by matching that price, only by offering what they can't (design + fit + finish + local service).

## Steel + timber + glass · the emerging default for modern high-end

The single most-observed combination in current modern high-end work:

- Steel structure (hidden or exposed spine)
- Oak (or walnut) treads
- Glass balustrades
- LED tread or handrail lighting

Delivers metal strength + timber warmth + open-plan compatibility. Discussed in more detail alongside metal-vs-timber comparison in `wood-intelligence-principles.md` Principle 2 (application-specific quality).

## Metal vs timber · the deeper truth

Metal and timber are not competing materials — they are engineered for different purposes. NEX must not present them as a hierarchy:

- **Well-made timber staircase** — 100+ years lifespan · warm to touch every day · can be repaired and refinished · suits home environment · appreciates in character over time
- **Well-made steel staircase** — 50-100+ years lifespan · long spans · low movement · corrosion risk if protection fails · fire behaviour requires specification · can transmit sound and vibration
- **Poorly-made either** — fails much sooner than the good version of the other material

Quality comes from design, material grade, manufacturing, installation, and environment — never from the material label alone. See `wood-intelligence-principles.md` Principle 2 for the underlying trade rule.

## Competitor observation (Philip's field awareness · not endorsement)

Philip flagged the following UK staircase companies as worth studying for different reasons. These are captured as **market observations**, not endorsements or recommendations.

### Traditional + premium timber

- **Stairplan** — larger timber manufacturer · oak / walnut / hardwood options · trade + public supply · useful example of scalable staircase manufacturing
- **DAB Stairs** — family-run workshop model · made-to-measure · traditional joinery + CNC · craftsmanship positioning
- **StairBox** — online staircase design + factory production · standardisation with custom options · digital tools for pre-manufacture selling

### Luxury bespoke / architectural

- **Meer End Bespoke Joinery** — bespoke interiors · premium joinery · design-led · high-value projects
- **M-Tech Engineering** — timber + steel + glass · contemporary engineering · floating stairs · helical stairs

### Modern metal + glass specialists

- **South Coast Steel** — steel spine stairs · floating stairs · glass · architectural metalwork

### What Philip's future winner probably looks like

Combining the strengths across these categories:

```
Traditional workshop knowledge      (DAB Stairs · Stairplan)
              +
Digital ordering + configuration    (StairBox)
              +
Luxury design thinking              (Meer End)
              +
Engineering innovation              (M-Tech / steel specialists)
              +
NEX intelligence layer              (this platform)
```

Customer uploads photos + measurements → NEX creates 3D staircase options → customer chooses timber / balusters / handrail / panels / storage → workshop receives manufacturing-ready information → CNC + craftsmen build → installer completes.

Many staircase companies are excellent at making stairs but fewer are excellent at explaining timber choices · visualising the final result · comparing suppliers · managing stock · predicting costs · educating customers. That's where the digital layer creates the advantage.

## Governance note

Same lifecycle as sibling files. Competitor names captured as verified expert observation, not opinions or endorsements. Rule A/B/C compliant.

## Related documents

- `wood-intelligence-principles.md` — Principle 2 (application-specific quality) underlies the metal-vs-timber discussion
- `staircase-category-taxonomy.md` — the five-level complexity classification maps directly to which market segment a design belongs to
- `docs/product-constitution/roadmap/nex-buying-intelligence.md` — market trend awareness composes with buying intelligence
- `docs/product-constitution/roadmap/nex-specification-intelligence.md` — helps traditional workshops explain their price vs online basic-grade suppliers
- `docs/product-constitution/roadmap/nex-staircase-design-configurator.md` — the customer-visualisation feature that captures this market opportunity
