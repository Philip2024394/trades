# Complete Staircase Order Process + Factory Operations + Manufacturing Methods · Philip 2026-08-02

Raw index of Philip's follow-up dump covering:
- Complete 20-stage order process (enquiry → handover)
- Factory operations (Stages 21-38 — job pack, material inspection, roles)
- Factory roles + culture (Stages 39-55)
- Installation day best practices (Stages 56-70)
- Production scheduling + lead times (Stages 71-84)
- Company quality principles (Stages 85-95)
- Manufacturing methods "no single correct way" (Components 901-908)
- Two future proposals: **Component Relationships** + **Construction Sequence Brain**

## Destinations

| Domain | File |
|---|---|
| Complete order process · factory operations · roles · scheduling · timelines · site challenges | `data/nex-component-qa/installation.json` (extend) |
| CNC vs hand vs hybrid manufacturing methods | `data/nex-universal-qa.json` + memory rule |
| Component Relationships proposal | Memory (documented for future build, NOT built this cycle per validate-first rule) |
| Construction Sequence Brain proposal | Memory (documented for future build) |

## Philip's future proposals (VERBATIM · NOT BUILT THIS CYCLE)

### Component Relationships

> *"As the Component Brain continues to expand, consider introducing Component Relationships. Instead of every component existing independently, define explicit relationships."*

Example graph structures:
```
Stringer → supports → Tread → supports → User
Newel → anchors → Handrail → supports → Balustrade → protects → Landing
```

Would allow Nex to answer:
- What does this connect to?
- If this fails, what else is affected?
- Can this component be removed?
- What components rely on this one?

Without duplicating knowledge across files.

### Construction Sequence Brain

> *"Rather than asking 'What is a tread?', Nex could answer 'What happens before the tread is installed?'"*

Every component would understand:
- what comes before it
- what comes after it
- who installs it
- what must already be complete
- what depends on it

Sequence: Survey → Technical Drawings → Manufacturing → Factory QC → Dry Fit → Packaging → Delivery → Installation → Protection → Final Inspection → Handover

### Philip's assessment of current architecture

> *"The architecture is moving beyond a traditional FAQ system into a layered knowledge model where:*
> *- Universal Brain explains general principles.*
> *- Family Brain explains staircase layouts.*
> *- Materials Brain explains construction materials.*
> *- Component Brain explains individual parts and their engineering.*
> *- Image Brain explains what is visible in a specific design.*
> *- Workflow logic determines when knowledge should be used versus when the conversation should continue gathering customer information."*

## Verbatim principles preserved

- *"A premium staircase is built long before timber enters the factory. Most of the work happens in planning, surveying, engineering and quality control. Manufacturing is only one stage of the process."*
- *"Lead time is not the same as manufacturing time."*
- *"A staircase spends more time moving through planning, scheduling and finishing than it does on the CNC machine."*
- *"You cannot machine accuracy into poor measurements."*
- *"You cannot varnish over poor joinery."*
- *"The best installers are given the least remedial work because the factory has already solved the manufacturing challenges."*
- *"A staircase spends far more time being planned and manufactured than it does being installed."*
- *"Installation is the final quality check—not the place to redesign the staircase."*
- *"Quality is built in, not inspected in."*
- *"Every department depends on the accuracy of the department before it."*
- *"The most successful staircase installations are usually those where the customer notices nothing except the beauty of the finished staircase."*
- *"There is no single correct manufacturing process that every staircase company follows."*
- *"CNC does not automatically produce a premium staircase."*
- *"Poor drawings programmed into a CNC machine will produce poor components very accurately."*
- *"Experience cannot be automated."*
- *"Technology supports craftsmanship — it does not replace it."*

## Typical Lead Times (Philip verbatim)

| Staircase Type | Typical Overall Lead Time |
|---|---|
| Standard straight staircase | 4–6 weeks |
| Quarter-turn staircase | 5–7 weeks |
| Open-riser staircase | 5–8 weeks |
| Glass balustrade staircase | 6–8 weeks |
| Curved or helical staircase | 8–16+ weeks |
| Concrete staircase with timber overlay | 4–8 weeks after the concrete shell is complete and surveyed |

## 20-Stage Order Process (verbatim)

Initial Enquiry (1-3d) → Design Consultation (2-7d) → Preliminary Quotation (1-5d) → Order Confirmation (1-7d) → Site Survey (0.5-1d) → Technical Drawings (2-7d) → Material Ordering → Timber Acclimatisation → Machining (2-7d) → Dry Fitting (1-3d) → Disassembly → Sanding → Staining (optional) → Varnishing/Finishing → Quality Control → Packaging → Delivery → Installation → Final Inspection → Handover
