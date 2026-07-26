# Staircase Country Packs — Specification

**Data files:** `data/staircase-country-packs/{country_code}.json`
**Countries in V1:** GB (uk.json), US (usa.json), AU (australia.json)

## Purpose

The same staircase question changes by country. A UK homeowner and a Texas homeowner asking "what size should my stairs be?" need different answers — different terminology, different regulations, different supplier landscapes, different cultural preferences.

Country packs enforce the **country switching rule** from the knowledge architecture doc: *if a user asks about "American staircase" or specifies a US zip code, do not answer with UK-only assumptions.*

---

## Schema (common across countries)

```
country_code                ISO 3166-1 alpha-2
country_name
version
generated

terminology                 Local names for each staircase component
terminology_map_uk_to_us    Cross-reference for translation queries (US pack)
terminology_notes           Regional usage quirks (AU pack — sits between UK/US)

regional_style_preferences  Style biases by region within the country

regulations
  primary_reference         Doc name + section
  residential               Dimensions, handrail rules, sphere-gap rule
  commercial                Different envelope for public buildings
  glass_balustrade          Safety glass spec
  referenced_standards      Cross-referenced standards (BS / AS / ASTM etc.)

regional_regulations_variance   For federations (UK devolved nations, US states, AU states)

supplier_categories         Which types of suppliers cover which categories
                            Cross-reference to merchant directory where available

typical_property_types      Regional housing stock with typical dimensions
cultural_preferences        What locals actually favour vs what is technically possible
common_customer_journey     How the sales process typically flows

regulatory_warnings         Non-obvious gotchas
not_in_v1                   Deferred content
```

---

## Key country differences to remember

### Terminology

| UK | US | AU |
|---|---|---|
| String | Stringer | Stringer or String |
| Spindle | Baluster | Baluster |
| Newel | Newel post | Newel post |
| Going | Run | Going |
| Baserail | Shoe rail | Bottom rail |
| Balustrade | Railing system | Balustrade |

### Regulatory frameworks

- **UK** — Approved Document K (England + Wales), Building Standards (Scotland), Building Regulations NI. Different values across the four nations.
- **US** — IRC (residential), IBC (commercial). Adopted state-by-state with amendments. California, NYC, Massachusetts, Florida have extensive local variations.
- **AU** — National Construction Code (NCC) Volumes 1 and 2. Referenced AS 1657, AS 1288, etc. State amendments apply.

### Sphere / gap rules

- **UK** — 100mm sphere
- **US** — 4-inch (~100mm) sphere
- **AU** — 125mm sphere (more relaxed — but customer expectation and child safety still favour tighter spacing)

### Dominant styles

- **UK** — oak default, renovation preferred over replacement, painted string + oak tread classic
- **US** — grand entrance foyer, curved feature stairs, wrought iron balusters common, carpet runners in traditional
- **AU** — Australian hardwoods (Spotted Gum, Blackbutt, Tasmanian Oak) preferred over imports, external staircases much more common (Queenslander), glass balustrade dominant on coastal builds

### Cultural signals to notice

- **UK** customer typically asks "can we renovate?" first
- **US** customer typically asks "can we create a feature staircase?" first
- **AU** customer often thinks about external durability and bushfire rating alongside interior aesthetic

---

## How NEX uses country packs

### Country detection
User input signals → detected country:
- Postcode format (UK postcodes vs US ZIP vs AU postcodes)
- Terminology (baluster → US or AU; spindle → UK; stringer with "run" → US)
- Explicit statement ("I'm in Sydney")
- Currency mention (£ / $ / AUD)

If detection fails, NEX asks — never guess when a wrong guess sends the user to the wrong regs.

### Language translation
User query in one terminology → answered in the same terminology.
- "How wide should my baluster gap be?" (US/AU term) → answered using local sphere rule
- "How wide should my spindle gap be?" (UK term) → answered using UK 100mm rule

### Regulation gating
Every technical dimension answer is filtered through the country pack's regulations block. NEX **never quotes UK Doc K numbers to a US user** and vice versa.

### Supplier routing
When the user is ready to source materials, NEX filters the merchant directory to the user's country. UK merchant directory is fully built (88 records); US and AU supplier directories are V1 references, full data deferred to V2.

### Style + property-type matching
Regional style preferences bias the design recommendation engine's suggestions. A Victorian terrace query and a Queensland coastal query start from different style shortlists.

---

## Extension rules

- New country pack goes in `data/staircase-country-packs/{country_code}.json` (ISO 3166-1 alpha-2).
- Every pack must include: terminology, regulations, cultural_preferences at minimum.
- Regional variation within a country goes into `regional_style_preferences` and `regional_regulations_variance`.
- Cross-reference merchant directory whenever suppliers exist in it for that country.
- Regulatory content should cite the primary reference document by name — never make up numbers.

---

## Not in V1

- Full state-by-state code amendment libraries (US)
- Full US and AU supplier directories in merchant-directory format
- Devolved-nation regulation variance for UK (currently sits in `regional_regulations_variance` but only high level)
- New Zealand, Ireland, Canada, EU country packs
- Currency conversion / regional pricing
- Language localisation beyond English
