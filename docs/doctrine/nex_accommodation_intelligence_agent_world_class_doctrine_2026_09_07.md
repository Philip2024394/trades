# NEX Accommodation Intelligence Agent · World-Class Doctrine
**Established**: 2026-09-07 · **Author**: Philip
**Status**: DURABLE SPEC · NOT a build authorization
**Governs**: A3 · A4 · A5 · A6 · A7 · A8 · A9 · every future accommodation slice

---

## 0 · Governing principle

**Build the accommodation intelligence system, not just the accommodation
crawler.**

The Accommodation Agent has ONE job: to build, understand, verify, maintain
and continuously improve the world's best accommodation intelligence dataset
for NEX.

- This is NOT a generic crawler.
- This is NOT a generic workforce.
- This agent is **dedicated to accommodation intelligence**.
- Indonesia-first. Must eventually operate internationally without destroying
  the Indonesia-specific knowledge model.

**Mission covers**: hotels · guesthouses · hostels · villas · apartments ·
houses · kos / kos-kosan · co-living · serviced apartments · resorts · motels ·
chalets · and other legitimate accommodation types as the taxonomy evolves.

---

## The realistic target · "world-class", not "100%"

No accommodation intelligence system can honestly guarantee 100% completeness
or permanent accuracy because properties open, close, change prices, change
ownership, disappear from sources, and sources themselves can be wrong.

But **100% commitment to the architecture and truth discipline** is absolutely
the target.

The biggest conceptual upgrade: **the agent doesn't finish when it finds
accommodation. It becomes responsible for maintaining knowledge about that
accommodation.** That is what turns it from a crawler into an Accommodation
Intelligence Agent.

---

## The complete architecture

```
                    ACCOMMODATION AGENT
                           │
             ┌─────────────┴─────────────┐
             │                           │
       DISCOVERY                    MONITORING
             │                           │
     Find new properties        Re-check known properties
             │                           │
             └─────────────┬─────────────┘
                           ↓
                    RAW OBSERVATIONS
                           ↓
                     NORMALIZATION
                           ↓
                 ENTITY RESOLUTION
                           ↓
                      DEDUPLICATION
                           ↓
                  SOURCE RECONCILIATION
                           ↓
                     EVIDENCE ENGINE
                           ↓
                 VERIFICATION / CONFIDENCE
                           ↓
                  CANONICAL DATA MODEL
                           ↓
                  CHANGE DETECTION
                           ↓
                     FRESHNESS ENGINE
                           ↓
                  QUALITY / TRUST SCORE
                           ↓
                 ACCOMMODATION DATABASE
                           ↓
                       NEX BRAIN
                           ↓
                 NEX CHAT / DISCOVERY
                           ↓
                ACCURATE ACCOMMODATION CARD
```

---

## §1 · Core principle · discovery + maintenance

Two distinct jobs, both continuous:

**A · DISCOVERY** — find accommodation NEX does not know about.

**B · MAINTENANCE** — continuously revisit accommodation NEX already knows about
and determine whether anything has changed.

A property is not "done" when first discovered. Every canonical accommodation
entity has a lifecycle:

```
DISCOVERED → NORMALIZED → RESOLVED → VERIFIED → MONITORED
          → RECHECKED → UPDATED / CONFIRMED → RECHECKED AGAIN
```

The monitoring loop is a **first-class capability**.

---

## §2 · Absolute scope

Accommodation ONLY. This workforce must never become a restaurant,
programmer, social, general-purpose discovery, or generic web agent.

- Do not modify Programmer.
- Do not modify unrelated workforce categories.
- Do not allow accommodation logic to silently change food, trades,
  transport, social, or other domains.
- Shared infrastructure may be reused where already designed for this
  purpose, but accommodation-specific logic must remain clearly isolated.

---

## §3 · Continuous 24/7 mission

Final production architecture must support continuous operation. Separate
queues/concepts for:

- NEW_DISCOVERY
- RECHECK_DUE
- CHANGE_DETECTED
- STALE_RECORD
- FAILED_SOURCE_RETRY
- LOW_CONFIDENCE_REVIEW
- CONFLICT_REVIEW
- IMAGE_REVIEW
- LOCATION_REVIEW
- ENTITY_RESOLUTION_REVIEW

**Bounded, observable work** — never uncontrolled infinite crawling. Every
work item must have: identity · city · country · category · source · priority ·
generation · lease · attempt count · next_due_at · last_success_at ·
last_failure_at · reason.

---

## §4 · Discovery

Discover: new properties · newly opened · renamed · category-changing ·
moving/rebranding · previously missed · returning after stale periods.

**Current source**: OSM / Overpass.

**Future source adapters may include**: official accommodation websites ·
permitted public sources · licensed APIs · licensed feeds · channel-manager
integrations where authorized · owner/business submissions · NEX business
claims · other legally permitted structured sources.

**NEVER implement**: CAPTCHA bypass · anti-bot evasion · residential proxy
evasion · authentication bypass · rate-limit circumvention · scraping against
access restrictions. Respect source terms and rate policies.

---

## §5 · Monitoring is as important as discovery

Every canonical accommodation must have a monitoring schedule. The system
must determine when each field should be checked again.

Example conceptual TTL policy (must be **explicit and configurable**, not
hard-coded blindly):

| Field | TTL |
|---|---|
| identity | long |
| address | long |
| phone | medium |
| website | medium |
| amenities | medium |
| room count | medium |
| pricing | short |
| availability | very short (only when a legitimate live source exists) |
| owner-verified information | different trust/freshness policy |

---

## §6 · Change detection

Proper accommodation change-event system. For every meaningful change preserve:

- property_id
- field_name
- old_value
- new_value
- source
- source_reference
- detected_at
- evidence_id
- confidence
- verification_state

Examples: price Rp 350,000 → Rp 425,000 · amenity Wi-Fi removed · category
guesthouse → hotel · name ABC Guest House → ABC Residence · phone changed ·
website changed · location changed / conflict · status active → uncertain / stale.

**Never simply overwrite valuable information and lose the historical truth.**

---

## §7 · Conflict management

If sources disagree: **DO NOT silently choose one**. Store: SOURCE A says X ·
SOURCE B says Y. Then evaluate: source authority · recency · verification
state · owner verification · administrative verification · confidence ·
consistency · historical reliability. Produce: canonical value AND preserved
conflicting evidence. **The database must be able to explain WHY the canonical
value was selected.**

---

## §8 · Field-level truth model

Implement the missing field-level verification system. Required states:

`DISCOVERED · NORMALIZED · SUPPORTED · VERIFIED · CONFLICTED · STALE · REJECTED`

These are NOT the same as `claim_status` / `owner_status`. Do not reuse
business-outreach lifecycle fields for factual verification.

Every important canonical field must be capable of having: value · source ·
evidence · confidence · verification state · last verified · last changed ·
freshness status.

---

## §9 · Confidence engine

**Field-level** confidence, not just property-level. Example:
name / address / category / phone / website / amenities / location / price /
room-count / image confidences.

**Confidence must be explainable.** NEX should be able to answer: "Why does
NEX believe this?" with the underlying evidence chain.

---

## §10 · Canonical accommodation model

Do not force every accommodation type into hotel-shaped data. Create:

**COMMON ACCOMMODATION CORE** + **TYPE-SPECIFIC ATTRIBUTE OVERLAYS.**

| Type | Type-specific attributes |
|---|---|
| **Hotel** | star rating · room count · hotel services · front desk · check-in policy |
| **Villa** | bedrooms · beds · capacity · private pool · bathrooms · whole-property status |
| **Apartment** | unit count · furnished state · bedrooms · bathrooms · monthly rental · building info |
| **Kos** | monthly price · deposit · gender restrictions · room size · private/shared bathroom · electricity · Wi-Fi · furnished/unfurnished · curfew · shared facilities · co-living characteristics |
| **House** | bedrooms · bathrooms · capacity · whole-property rental · monthly/daily · furnished state |
| **Co-living** | private room · shared room · shared facilities · community facilities · minimum stay |

Do NOT hide the complete semantic model inside uncontrolled JSONB. Use
validated structured fields where the data model becomes stable.

---

## §11 · Room / Unit model

Implement accommodation sub-entities. Architect for at minimum:
`accommodation_property` → `accommodation_unit`.

- Hotel: property → room types → individual/unit availability where legally + technically possible
- Villa: property → bedrooms / capacity attributes
- Apartment building: property → units

Do not prematurely create millions of unnecessary rows. Design the
relationship correctly first.

---

## §12 · Language intelligence

Preserve original language. Do NOT destroy source text by translating into
one canonical string.

Architecture: `original_text` · `detected_language` · `normalized_value` ·
translations where needed.

Indonesia-first terminology must remain meaningful: kos · kos-kosan ·
boarding house · guest house · penginapan · homestay · kontrakan · co-living.

**Do not collapse culturally different accommodation types merely because
English terminology looks similar.**

---

## §13 · Entity resolution

Multi-level:

- LEVEL 0: exact source identity
- LEVEL 1: strong deterministic identity
- LEVEL 2: candidate similarity
- LEVEL 3: geospatial similarity
- LEVEL 4: name/address/phone/website similarity
- LEVEL 5: cross-source entity resolution

Produce: HIGH / MEDIUM / LOW confidence duplicate bands. **Never
automatically merge ambiguous entities.** Every merge must preserve evidence
and create an audit record.

---

## §14 · Location intelligence

Preserve: latitude · longitude · country · province · city · district ·
neighbourhood · street · target zone · landmarks · location confidence ·
location evidence · location source.

**City authority MUST come from the NEX city catalogue/work item**, not
blindly from source addr:city. Never allow a malformed source address to
silently move a property into another city.

---

## §15 · Image intelligence (baseline)

Images are evidence, not truth. Build toward: image ↔ accommodation matching ·
perceptual duplicate detection · image freshness · image source provenance ·
image moderation · amenity extraction · property-type hints · room-type hints.

**Never claim an amenity exists solely because an image classifier guessed it.**
Image-derived information requires appropriate confidence/evidence handling.

**Full first-class image intelligence spec — see Addendum below.**

---

## §16 · Document / OCR intelligence

Where legitimate documents or owner-provided material exist, support: OCR ·
structured extraction · document provenance · document timestamps ·
field-level evidence. Do not store unnecessary personal information. Do not
turn identity documents or sensitive personal material into general
accommodation data.

---

## §17 · Pricing intelligence

Structured pricing. Not one generic "price". Support: night · month · person ·
room · unit · whole property · minimum stay · maximum occupancy · currency ·
tax inclusion · service fee · deposit · price period · effective_from ·
effective_to · source · confidence.

**Price must always have context. Never display a price without knowing what
the price represents.**

---

## §18 · Availability intelligence

Availability is **separate** from property existence. States: `AVAILABLE ·
UNAVAILABLE · UNKNOWN · STALE`. Only claim real-time availability where a
legitimate source actually provides it. Never infer availability merely
because the property exists.

---

## §19 · Freshness engine

Implement: field TTL policy · `next_check_at` · `last_checked_at` ·
`last_changed_at` · `freshness_state ∈ {FRESH, AGING, STALE, UNKNOWN}`.

**Freshness must be field-specific.** A property's name can remain fresh for
months while its price may become stale within hours.

---

## §20 · Quality engine

Explainable accommodation quality metrics. Potential dimensions: identity
quality · location · contact · category · amenity · pricing · availability ·
image · source diversity · verification strength · freshness · conflict level.

**Do not create a meaningless black-box score. NEX must be able to explain
the score.**

---

## §21 · Source diversity

Do not allow the accommodation universe to depend permanently on one source.
OSM is an important discovery layer. It is not the entire truth. The
architecture must support additional legitimate source adapters without
rewriting the canonical system.

Track source coverage per property.

---

## §22 · Real persistence (locked in Slice A2)

`nex_workforce.persist_to_accommodation_business()` +
`nex_workforce_persister_accommodation_business` role. Requirements: NOLOGIN
· NOBYPASSRLS · least privilege · SECURITY DEFINER · safe search_path ·
four-field work fence · authoritative city · identity ambiguity protection ·
monotonic update · evidence linkage · provenance linkage · transaction safety
· idempotency.

**The accommodation production path MUST NEVER silently fall through to
`mock_persist_target`.** Production startup must eventually fail closed if
the accommodation persister is not explicitly configured.

**Status**: A2 shipped 2026-09-07 · 38/38 contract tests GREEN · three-layer
fail-closed defense.

---

## §23 · Data authority (locked in ADR-0119)

Accommodation Intelligence remains on **local PostgreSQL `:5433` · `nex_dev`**
during this workforce build. **Supabase Project B remains the NEX application
authority.**

Do NOT migrate accommodation to Project B in this slice. Do NOT create
accommodation tables in Project B. A future migration requires a separately
authorized migration project.

---

## §24 · NEX Brain contract

The accommodation agent does not merely store rows. Its output must be
understandable by NEX. NEX Brain should eventually be able to reason over:

- What accommodation is this?
- Where is it?
- What type?
- Who is it suitable for?
- What does it cost?
- When was the price checked?
- What amenities are actually supported?
- How confident are we?
- What changed?
- When was it last checked?
- Which sources support this?
- Are sources conflicting?
- Is it currently available?
- What nearby landmarks matter?
- How far is it from the user's requested place?

**NEX must never invent a field that the accommodation database does not
support.**

---

## §25 · NEX Chat card contract

NEX Chat accommodation cards must **consume canonical stored data**. The
Chat UI must NOT become a second accommodation database.

```
ACCOMMODATION AGENT
    → canonical database
    → NEX accommodation query/matching layer
    → NEX Brain
    → Chat result/card
```

Cards must show only supported fields. Every important dynamic claim should
have a freshness/provenance basis:

- "Rp X per night" must know the currency, unit and source context.
- "Wi-Fi" must have evidence.
- "0.8 km from Malioboro" must be computed from coordinates, not guessed.
- "Updated 2 days ago" must derive from actual freshness metadata.

---

## §26 · Search / matching readiness

The canonical model must support NEX queries such as:

- "hotel near Malioboro"
- "cheap kos near UGM"
- "villa for 8 people"
- "apartment for monthly rental"
- "quiet guesthouse near the airport"
- "hotel with pool"
- "female-only kos"
- "pet-friendly accommodation"

The agent stores facts. NEX Brain interprets the user's intent. **Do not
embed conversational reasoning into the acquisition worker.**

---

## §27 · 518-city scale

The existing 518-city catalogue is authoritative. Do not immediately launch
all 518 cities. First prove:

**ONE CITY → discovery → persistence → verification → monitoring → change
detection → NEX query → Chat card**

Then: 3 cities → 10 → controlled regional expansion → 518.

**Never scale because the crawler technically works. Scale only after truth
and monitoring metrics are GREEN.**

---

## §28 · 24/7 health / observability

The accommodation agent must expose: heartbeat · queue depth · discovery
rate · recheck rate · change rate · verification rate · duplicate rate ·
conflict rate · stale rate · failure rate · source health · city coverage ·
records processed · records changed · records rejected · records requiring
review.

**Must distinguish `NO WORK` from `WORKER BROKEN`.** Do not report "healthy"
merely because the process is alive.

---

## §29 · Failure recovery

Every worker must recover safely from: network failure · source timeout ·
rate limiting · malformed source data · database failure · process crash ·
lease expiry · partial batch failure · duplicate work · stale work.

**Never lose evidence because a worker crashed. Use idempotent processing.**

---

## §30 · Security / truth

No fabricated: accommodation · price · availability · amenity · image
provenance · verification. No silent source conflicts. No silent overwrites
of meaningful historical facts. No credential harvesting. No unauthorized
access. No anti-bot bypass. No hidden data collection outside the
accommodation mission.

---

## §31 · Testing

Every layer requires tests. Minimum: persister contract · normalization ·
category · entity-resolution · dedup · conflict · freshness · change-event ·
verification · confidence · city-authority · source · image evidence ·
pricing · availability · NEX query contract · Chat-card data contract ·
failure/retry · idempotency · security.

**Real PostgreSQL proof is required for database behavior.** Do not
substitute mocks for database guarantees where database behavior is the
thing being proven.

---

## §32 · Real-world proof

Before production activation prove **ONE CITY** end-to-end (20 steps):

1. work item created
2. legitimate source queried
3. raw evidence captured
4. candidate staged
5. evidence ledger written
6. real accommodation persister invoked
7. canonical row created
8. provenance created
9. confidence calculated
10. entity identity established
11. monitoring schedule created
12. property rechecked
13. unchanged property remains unchanged
14. changed field creates change event
15. canonical value updates correctly
16. old value remains auditable
17. NEX query retrieves property
18. NEX Brain receives structured facts
19. Chat card renders stored facts
20. displayed freshness is truthful

Then prove a second city. Only then consider controlled expansion.

---

## §33 · Architectural roadmap

| Slice | Description | Status |
|---|---|---|
| A0 | Workforce registry / test isolation | ✅ GREEN |
| A1 | Accommodation capability | ✅ GREEN |
| A2 | Real accommodation persister | ✅ GREEN (2026-09-07) |
| A3 | Canonical model completeness (type-specific overlays, room/unit model, language intelligence) | pending authorization |
| A4 | Entity resolution / dedup (multi-level scoring, evidence-preserving merge) | pending authorization |
| A5 | Evidence / verification / confidence (field-level truth model, conflict store, explainable confidence) | pending authorization |
| A6 | Freshness / change detection (per-field TTL policy, change_event table) | pending authorization |
| A7 | Image / document intelligence (see full addendum below) | pending authorization |
| A8 | Controlled real acquisition (one city, real Overpass, real persister) | pending authorization |
| A9 | Controlled 518-city rotation | pending authorization |

**Do not skip architectural dependencies.** Each slice requires its own
explicit authorization.

---

## §34 · Final governing principle

The Accommodation Agent is not successful because it collects many records.
It is successful when **NEX can TRUST the accommodation knowledge**.

The goal is:

> COMPLETE + ACCURATE + VERIFIED + PROVENANCED + DEDUPLICATED + FRESH +
> CHANGE-AWARE + TYPE-AWARE + LOCATION-AWARE + PRICE-AWARE +
> AVAILABILITY-AWARE + IMAGE-AWARE + MULTILINGUAL + EXPLAINABLE +
> CONTINUOUSLY MAINTAINED

**BUILD THE ACCOMMODATION INTELLIGENCE SYSTEM, NOT JUST THE CRAWLER.**

---

# ADDENDUM · IMAGE INTELLIGENCE (FIRST-CLASS ACCOMMODATION DATA)

Images are a **first-class** accommodation data source. Not decoration.
Not optional. Part of the accommodation knowledge graph.

```
Property → Room Type → Images → Facilities → Evidence → Source → Freshness → Confidence
```

The Accommodation Agent must build an **image inventory** for each
accommodation, not just collect a single "hotel image".

## Example image inventory

```
HOTEL: Grand Example Hotel
│
├── PROPERTY IMAGES
│   ├── exterior
│   ├── entrance
│   ├── lobby
│   ├── reception
│   ├── restaurant
│   ├── garden
│   └── surroundings
│
├── ROOM TYPES
│   ├── Standard Room
│   │   ├── bedroom
│   │   ├── bathroom
│   │   ├── view
│   │   └── amenities
│   ├── Deluxe Room
│   │   ├── bedroom
│   │   ├── bathroom
│   │   └── balcony
│   └── Family Room
│       ├── bedroom
│       ├── beds
│       └── bathroom
│
├── FACILITIES
│   ├── swimming pool
│   ├── gym
│   ├── spa
│   ├── restaurant
│   ├── parking
│   └── kids area
│
└── LOCATION
    ├── street/exterior
    ├── nearby landmark
    └── surrounding area
```

## Image roles (accommodation-specific)

`EXTERIOR · LOBBY · RECEPTION · ROOM · BATHROOM · POOL · GYM · SPA ·
RESTAURANT · KITCHEN · BALCONY · VIEW · GARDEN · PARKING · FACILITY · OTHER`

## Required image metadata

- image_id
- property_id
- unit_type_id / room_type_id
- image_role
- source
- source_reference
- source_url
- captured_at
- discovered_at
- last_checked_at
- content_hash
- perceptual_hash
- dimensions
- mime_type
- provenance
- confidence
- verification_state

## Image → property matching

**Never assume an image belongs to a property merely because a source page
contains the image.** Establish association through source context · page
identity · structured metadata · URL context · matching signals. **Ambiguous
associations must remain ambiguous.** Do not silently attach an image to the
wrong accommodation.

## Image classification

Classify into accommodation-specific roles as listed above. Where room-type
information is available, associate the image with the specific room/unit
type. **Do not infer a room type solely from visual appearance when source
evidence does not support it.**

## Image deduplication

Both **exact** duplicate detection AND **perceptual** duplicate detection.
The same image may appear at multiple URLs · resized · recompressed ·
cropped · with different filenames. Do not store unnecessary duplicate
copies. Preserve all relevant source provenance even when the underlying
visual asset is deduplicated.

## Image freshness

Track: `first_seen · last_seen · last_checked · source_changed · image_changed
· removed_from_source`. If an image disappears from its authoritative source,
do not immediately delete the historical evidence. Mark its source status
appropriately.

## Image evidence (not truth)

Image-derived observations are **evidence, not automatically verified facts**.

Example:
- observation: possible_pool
- source: image
- confidence: X
- verification_state: SUPPORTED / UNVERIFIED

**Do NOT automatically convert this into `pool = true` unless the
verification policy permits it.**

## Amenity image intelligence

System may detect visual indicators of: pool · gym · spa · parking ·
restaurant · balcony · air conditioning · bathroom · kitchen · bed
configuration · workspace · garden · etc.

**IMAGE CLASSIFICATION ≠ FACTUAL VERIFICATION.** The canonical accommodation
record must preserve the distinction.

## Room / unit image intelligence

Where source information identifies room types, maintain the relationship:

```
ACCOMMODATION → ROOM TYPE / UNIT → IMAGES
```

Examples:
- Hotel → Deluxe King Room → 4 images
- Hotel → Family Room → 6 images
- Villa → Master Bedroom → 3 images
- Apartment → Studio Unit → 5 images

**Do not merge images from different room types.**

## Image quality

Track quality signals: resolution · aspect ratio · blur · duplicate
probability · visual relevance · source reliability · recency. Prefer useful
representative images for NEX Chat cards. Do not select images purely
because they are the largest.

## Image selection for NEX

Ranked image set per property: `hero · exterior · room · bathroom · pool ·
facility · location`. Ranking must be **explainable** and based on relevance
· quality · freshness · verification · source reliability · duplicate status.

## NEX Chat image contract

NEX Chat must consume image associations from the canonical accommodation
system. **The Chat layer must NOT independently scrape accommodation images.**

- When NEX displays "Pool", the associated pool image must belong to the
  same accommodation entity and have appropriate evidence.
- When NEX displays "Deluxe Room", the associated room images must belong
  to that room type/unit where the source supports that relationship.

## Image rights / source discipline

Only collect and display images through **legitimate permitted sources** and
according to applicable source/license/usage restrictions. Store provenance.
Do not bypass access controls. Do not bypass anti-bot protections. Do not
copy protected/private material merely because it is technically accessible.
Where licensing requires a reference rather than local storage, retain the
appropriate source reference instead.

## Image failure modes

The system must handle without corrupting the canonical accommodation
record: broken image · removed image · duplicate image · wrong-property
image · wrong-room image · low-quality image · stale image · conflicting
image · ambiguous image · source restriction.

## World-class image objective

**The goal is not: "collect hotel photos."**

**The goal is:**

> UNDERSTAND WHICH IMAGE BELONGS TO WHICH PROPERTY, WHICH ROOM/FACILITY IT
> REPRESENTS, WHERE IT CAME FROM, HOW TRUSTWORTHY THE ASSOCIATION IS, HOW
> CURRENT IT IS, WHETHER IT IS A DUPLICATE, AND WHETHER NEX IS ALLOWED TO
> USE IT.

**Images become structured accommodation intelligence.**

---

## Slice-by-slice binding to this doctrine

- **A3** (canonical model completeness) will implement §10 · §11 · §12
- **A4** (entity resolution / dedup) will implement §13
- **A5** (evidence / verification / confidence) will implement §7 · §8 · §9
- **A6** (freshness / change detection) will implement §5 · §6 · §19
- **A7** (image / document intelligence) will implement §15 · §16 + full addendum
- **A8** (controlled real acquisition) will implement §32 (20-step end-to-end proof for ONE CITY)
- **A9** (controlled 518-city rotation) will implement §27 progressive scaling

Every slice from A3 onward must:
1. Cite this doctrine in its authorization prompt
2. Pass its slice-specific tests (§31)
3. Not break the A0/A1/A2 baseline
4. Not implicitly enable acquisition (§27)
5. Add its own contract tests before implementation

## Related documents

- **ADR-0119** · Accommodation Intelligence Database Authority (local PG :5433)
- **`scripts/nex-workforce-v2/PERSISTER-INTEGRITY.md`** · A2 fail-closed contract
- **`supabase/migrations/_slice_a2_accommodation_business_persister.sql`** · A2 real persister
- **`scripts/nex-workforce-v2/tests/accommodation_persister_contract.test.mjs`** · A2 38/38 GREEN
- **doctrine_nex_authority_y_p2_foundation_2026_09_07** · Supabase Project B authority
