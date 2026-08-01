# Kitchen Brain · Scaffold-Only

**Status:** Scaffold only. **No routing · no retrieval · no chat endpoint · no AI behaviour.**

Purpose (Philip 2026-08-01): give Philip somewhere to organise and confirm kitchen images while the Staircase Brain is still being built. When the Kitchen Centre launches in the future, the data will already be organised and ready to connect.

---

## ADR-0033 Brain Isolation

The Kitchen Brain is **completely separate** from the Staircase Brain:

- Kitchen data lives here · Staircase data lives at `data/nex-confirmed-images.json` and `data/nex-staircase-*`
- Zero cross-brain retrieval
- Zero shared code paths (except the one legacy `kitchen_redirect` handler in the Staircase Advisor which reads exactly one reference image · see below)
- Staircase queries never touch this folder
- Kitchen images never enter the Staircase Visual Brain

---

## Folder structure

```
data/nex-kitchen-brain/
├── README.md               ← this file
├── confirmed/              ← Philip-confirmed kitchen designs (customer-visible when Kitchen Centre launches)
│   └── README.md           ← currently points to legacy top-level file
├── working/                ← raw kitchen images not yet analysed
│   └── working-images.json
├── pending-review/         ← AI-extracted metadata awaiting Philip's approval
│   └── pending-review.json
├── vision-scans/           ← raw vision-analysis text · awaiting extraction into pending-review
│   └── vision-scans.json
├── knowledge/              ← authored knowledge chunks (definitions · guidance · FAQ)
├── components/             ← kitchen components reference (hinges · handles · drawer runners · appliances · connectors)
│   └── components.json
└── articles/               ← long-form authored articles about kitchen topics
```

---

## Canonical Confirmed Library location

**Current canonical location:** `data/nex-kitchen-confirmed-images.json` (top-level, at the project root of `data/`).

Reason: this file was created before the brain-folder scaffold existed, and is currently read by the `kitchen_redirect` handler in the Staircase Advisor (`src/lib/nex/staircase-advisor/kitchen-redirect.ts`) to attach ONE reference image when a customer asks a kitchen question in the Staircase Centre. The redirect handler was authorised in an earlier cycle; per the scaffold-only directive it is **not** modified here.

**When the Kitchen Centre formally launches**, migrate the top-level file into `data/nex-kitchen-brain/confirmed/confirmed-images.json` and update the two path references (kitchen-redirect handler + any new Kitchen Advisor code).

---

## Buckets

| Bucket | File | Purpose |
|---|---|---|
| **Confirmed** | (see above) | Philip-confirmed designs · only these are customer-visible when Kitchen Centre launches |
| **Working** | `working/working-images.json` | Raw images not yet analysed · like uploaded staircase originals awaiting metadata |
| **Pending Review** | `pending-review/pending-review.json` | AI-extracted metadata drafted from vision scans · awaiting Philip approval |
| **Vision Scans** | `vision-scans/vision-scans.json` | Raw vision-analysis text · gets processed into Pending Review records |
| **Knowledge** | `knowledge/*.md` | Kitchen-specific knowledge articles (created individually as authored) |
| **Components** | `components/components.json` | Kitchen components reference (hinges · runners · drawer boxes · appliance connectors) |
| **Articles** | `articles/*.md` | Long-form kitchen articles (created individually as authored) |

---

## Schema

Kitchen metadata mirrors the Staircase Visual Brain shape (`design_id · title · design_family · view_types · additional_views`) but uses kitchen-specific domain fields.

See `src/lib/nex/kitchen-brain/schema.ts` for the TypeScript types.

Kitchen-specific fields:

- `kitchen_type` — island layout · galley · L-shape · U-shape · one-wall · peninsula
- `cabinet_style` — shaker · flat-front · handleless · in-frame · glazed
- `layout` — physical arrangement + zones (prep · cook · clean)
- `worktop` — quartz · granite · timber · laminate · stainless steel · marble
- `island` — details of the island if present
- `appliances` — integrated oven · induction hob · dishwasher · fridge · wine cooler · etc.
- `sink` — undermount · inset · Belfast/butler · double bowl · one-and-a-half
- `lighting` — pendant · under-cabinet · plinth · task · ambient
- `colour_scheme` — colour palette + finish tones
- `design_style` — modern · traditional · Shaker · contemporary · industrial · minimalist
- `materials` — timber · stone · metal · glass finishes
- `project_suitability` — new-build kitchen · renovation · extension · open-plan · self-build

Shared v2 fields (same as Staircase):

- `design_id` — stable `NEX-KITCHEN-000001` upward
- `title` — customer-friendly display name
- `design_family` — Modern · Traditional · Shaker · Contemporary · Industrial · Minimalist · Farmhouse · Coastal (kitchen-domain families · **separate list** from staircase families)
- `primary_brain` — always `"kitchen"` (ADR-0033 isolation flag)
- `url` — hero image URL
- `additional_views` — other angles of the SAME kitchen design
- `view_types` — parallel array: `hero` · `island-detail` · `cabinet-detail` · `worktop-detail` · `appliance-detail` · `lighting` · `open-view` · `close-view` · `plan-drawing` · `render`
- `view_labels` — optional human labels
- `related_articles` — Knowledge Brain article slugs
- `customer_description` — one-sentence customer-facing description
- `designer_notes` — internal notes · never shown to customer
- `confirmed_at` · `confirmed_by`
