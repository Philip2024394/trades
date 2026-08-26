# NEX Transport Intelligence · Regulatory Source Map · Yogyakarta

**Status:** DRAFT · research phase · design-only per doctrine `project_nex_transport_intelligence_design_2026_08_23`
**Not yet:** schema · migration · calculation code · customer-facing UI · driver dispatch

**Purpose:** Establish an authoritative regulatory evidence base for transport pricing in Yogyakarta before any calculation logic or customer-facing answers are shipped. Every entry uses the SOURCE → CLAIM → INTERPRETATION → UNKNOWN discipline.

---

## 0 · The discipline (locked)

Every transport pricing statement NEX makes carries five parts:

- **Source:** which authoritative regulatory instrument (national ministry regulation · provincial governor decree · municipal decree)
- **Claim:** the exact tariff / boundary / rule cited
- **Interpretation:** what NEX may honestly use this evidence for
- **Unknown:** what NEX cannot conclude even with this evidence
- **Decision:** belongs to the traveller

Fill this shape for every row in the regulatory map below.

---

## 1 · What Philip has cited (2026-08-23 · VERIFIED baseline)

### 1a · National · Ministry of Transport · app-based motorcycle ride-hailing zones

- **Source:** Ministry of Transport (Kementerian Perhubungan) · framework for app-based motorcycle services (ojek online / ojol)
- **Claim:** zonal per-km tariff boundaries + minimum-fare ranges
- **Zonal per-km boundaries:**
  - **Zone I:** Rp 1,850 – Rp 2,300 / km
  - **Zone II:** Rp 2,600 – Rp 3,000 / km
  - **Zone III:** Rp 2,100 – Rp 2,600 / km
- **Interpretation:** These are the REGULATED lower–upper bounds within which app operators may set fares · NEX may cite this as the regulated reference for motorbike ride-hailing pricing calculations · NEX may NOT present a specific point in the range as the guaranteed live app price
- **Unknown:** which zone specifically applies to a given trip (needs zone mapping) · the actual live app price · promotions / surge / tolls · exact minimum-fare figures per zone (to be verified from source document)
- **Needs verification (research task):** the exact regulation number + effective date + zone-to-city mapping (which regencies/cities fall under Zone I/II/III) · the exact minimum-fare figures per zone

### 1b · Provincial · Yogyakarta · Governor Decree 41/2025

- **Source:** Yogyakarta provincial Dishub (Dinas Perhubungan Daerah Istimewa Yogyakarta)
- **Claim:** upper/lower tariff limits for intercity transport and taxis
- **Interpretation:** These set the regulated ceiling/floor for taxi and intercity transport fares within the Yogyakarta Special Region · NEX may use them as regulated reference for calculation
- **Unknown:** exact per-km + per-time components and any airport/terminal supplements · precise definitions of "intercity" · exact effective date + any subsequent amendments · exact figures (need to be fetched from the decree itself)
- **Needs verification (research task):** full decree text OR authoritative published summary from the Dishub · exact monetary values

### 1c · Provincial · Yogyakarta · Decree 419/2023

- **Source:** Yogyakarta provincial Dishub
- **Claim:** rules for Angkutan Sewa Khusus (ASK · special rental transport · typically covers app-based cars)
- **Interpretation:** governs the legal framework for app-based car ride-hailing operating within the province · may specify fare boundaries or operator obligations
- **Unknown:** whether it sets specific fare boundaries or only operational rules · exact provisions · any subsequent amendment or supersession
- **Needs verification (research task):** full decree text OR authoritative published summary

---

## 1d · Research findings 2026-08-23 (in-session evidence)

Filling in what I could verify against authoritative or authoritative-adjacent sources. Every finding uses SCIUD.

### Finding 1 · Motorcycle ride-hailing tariff · KP 348/2019 (VERIFIED)

- **Source:** Indonesian Ministry of Transportation official portal (portal.dephub.go.id) · announcement 1 May 2019
- **Claim:**
  - **Zone I** (Sumatra · Java-except-Jabodetabek · Bali · **including Yogyakarta**): floor **Rp 1,850/km** · ceiling **Rp 2,300/km** · minimum fare Rp 7,000–10,000
  - **Zone II** (Jabodetabek): floor **Rp 2,000/km** · ceiling **Rp 2,500/km** · minimum fare Rp 8,000–10,000
  - **Zone III** (Kalimantan · Sulawesi · NTT · Maluku · other): floor **Rp 2,100/km** · ceiling **Rp 2,600/km** · minimum fare Rp 7,000–10,000
- **Interpretation:** NEX may cite this as the regulated per-km tariff RANGE for ojek-online (motorbike ride-hail) in Yogyakarta · Zone I applies to Yogyakarta · these are NET figures (after operator's indirect fee deduction)
- **Unknown:** whether KP 348/2019 has been amended/superseded by a later Kemenhub instrument in 2020-2026 · actual live app quote (may differ within or outside the range due to promotions/surge/operator rules)
- **⚠️ Discrepancy flag with Philip's earlier citation:** Philip cited Zone II as Rp 2,600–3,000/km. The Kemenhub 2019 portal shows Zone II as Rp 2,000–2,500/km. Zone I and Zone III match Philip's citation exactly. **Possible explanations:** Philip's source may be quoting GROSS (including 20% operator fee) rather than net · OR there is a later tariff update I could not locate. Requires verification against current instrument.

### Finding 2 · Angkutan Sewa Khusus operator framework · PM 118/2018 (VERIFIED existence · details need fetch)

- **Source:** Permenhub PM 118 Tahun 2018 · listed on BPK JDIH · Kemenhub JDIH · paralegal.id · basishukum.com
- **Claim:** Establishes the national operator-licensing framework for Angkutan Sewa Khusus (special rental transport · covers app-based car ride-hailing)
- **Effective:** 18 December 2018
- **Interpretation:** Any operator running app-based car ride-hailing (including a future NEX Driver network) must operate under this framework OR its successor
- **Unknown:** exact requirements (STNK · KIR · vehicle age · driver documentation · insurance · fleet minimums · geographic operating zones · reporting obligations) · whether PM 118/2018 remains fully in force or has been amended
- **Next action:** fetch full text via BPK JDIH direct PDF · verify current-in-force status

### Finding 3 · Yogyakarta Angkutan Sewa Khusus tariff · Kepgub 419/KEP/2023 (VERIFIED existence · exact figures unresolved)

- **Source:** JDIH Pemda DIY (jdih.jogjaprov.go.id) · confirmed instrument exists
- **Claim:** Sets tariff for Angkutan Sewa Khusus operating in DIY
- **Interpretation:** NEX Transport Knowledge Object should treat this as the applicable provincial ASK tariff instrument for Yogyakarta
- **Unknown:** exact minimum fare · per-km lower and upper boundaries · airport supplement · waiting/time components · effective date (2023 dated · possibly under evaluation per Antara News 2025)
- **Next action:** fetch full text · JDIH page rendered empty via WebFetch (JavaScript-loaded content); direct PDF access or authoritative summary needed

### Finding 4 · Yogyakarta taxi + inter-city tariff · Kepgub 420/KEP/2023 (VERIFIED existence · exact figures unresolved)

- **Source:** JDIH Pemda DIY · confirmed instrument exists · title reads *"Tarif Angkutan Bus Perkotaan Trans Jogja · Tarif Batas Bawah Dan Batas Atas Angkutan Antar Kota Dalam Provinsi · Dan Angkutan Taksi"*
- **Claim:** Combined instrument setting Trans Jogja + inter-city intra-provincial + taxi tariff boundaries
- **Interpretation:** NEX Transport Knowledge Object should treat this as the applicable provincial taxi + inter-city tariff instrument for Yogyakarta
- **Unknown:** exact taxi minimum fare · per-km lower/upper boundaries · door opening fee · waiting charges · effective date · whether Trans Jogja portion has been superseded by Kepgub 40/2025
- **Next action:** same as Finding 3 · JDIH direct PDF or authoritative summary

### Finding 5 · Yogyakarta Trans Jogja urban bus tariff · Kepgub 40/2025 (VERIFIED existence · exact figures unresolved)

- **Source:** JDIH Pemda DIY · confirmed instrument exists (title *"Tarif Angkutan Perkotaan Trans Jogja"*)
- **Claim:** 2025 Trans Jogja tariff instrument · likely supersedes the Trans Jogja portion of Kepgub 420/KEP/2023
- **Unknown:** exact fare · effective date · categories (adult/student/tourist) · whether it affects the taxi + inter-city portions of Kepgub 420/KEP/2023
- **⚠️ Note:** Philip earlier cited "Governor Decree 41/2025" as the current taxi instrument. Search surfaced Decree **40**/2025 (Trans Jogja) but NOT 41/2025. Possibilities: typo/off-by-one · OR 41/2025 exists but isn't indexed by common search. Kepgub 420/KEP/2023 remains the confirmed taxi + inter-city instrument in JDIH pending a direct 41/2025 confirmation.

### Finding 6 · Prior Yogyakarta taxi tariff · Kepgub 96/KEP/2016 (OBSERVED · almost certainly superseded)

- **Source:** harga.web.id (secondary aggregator · cites the decree directly)
- **Claim:** Conventional taxi in Yogyakarta · per km **Rp 3,900** · door opening **Rp 6,500** · waiting **Rp 43,700/hour**
- **Interpretation:** Historical reference only · superseded by Kepgub 420/KEP/2023 which now governs
- **Unknown:** current per-km figure (which the 2023 decree specifies · unresolved above)

### Finding 7 · GrabCar Yogyakarta (September 2022) (OBSERVED · stale)

- **Source:** harga.web.id
- **Claim:** Base fare Rp 8,000–10,000 (first 4 km) · per km Rp 2,000–2,500
- **Interpretation:** 2022 operator claim · likely superseded by Kepgub 419/KEP/2023 · treat as historical only
- **Unknown:** current GrabCar tariff · which is regulated by 419/KEP/2023 but operator sets specific point within range

### Finding 8 · YIA Airport transfer flat rates (OBSERVED · operator claims)

- **Source:** multiple travel-blog aggregators (welcomepickups.com · javatourism.co.id · discoveryourindonesia.com)
- **Claim:** Airport → Malioboro flat rates:
  - Rajawali Taxi: ~**Rp 335,000**
  - JAS Taxi: ~**Rp 240,000**
  - Grab (approx): ~**Rp 250,000**
- **Interpretation:** OPERATOR flat rates for pre-booked airport transfer · NOT government-regulated per-km calculation
- **Unknown:** whether YIA has a regulated airport-transport supplement · whether these operator rates are currently accurate (blog data · varies) · exact toll pass-through

---

## 2 · Research to complete (before any calculation ships)

Each item below needs its own SOURCE → CLAIM → INTERPRETATION → UNKNOWN entry backed by an authoritative government source URL + accessed-date.

### 2a · National regulations

- [ ] Full ministry regulation number + effective date for the zonal ojol framework in § 1a
- [ ] Exact minimum-fare figures per zone (Zone I / II / III)
- [ ] Zone-to-city mapping (which regencies fall in which zone)
- [ ] National taxi tariff framework (if separate national regulation exists)
- [ ] National Angkutan Sewa Khusus (ASK) framework (Ministry of Transport Permenhub No. 118/2018 was historical · check current instrument)
- [ ] National airport-transport regulations (if separate)
- [ ] National toll pricing (via Badan Pengatur Jalan Tol · for road-toll components)

### 2b · Yogyakarta provincial regulations

- [ ] Full text / authoritative summary of Governor Decree 41/2025 with exact figures
- [ ] Full text / authoritative summary of Decree 419/2023 with exact provisions
- [ ] Any Yogyakarta city-level taxi decree (Kota Yogyakarta municipal instrument)
- [ ] Sleman / Bantul / Gunung Kidul / Kulon Progo regency-level transport instruments (for hotels outside DIY)
- [ ] Magelang regency transport rules (Borobudur corridor)

### 2c · Airport / terminal specifics

- [ ] YIA (Yogyakarta International Airport) authorised transport tariffs + supplements
- [ ] Adisutjipto (JOG) transport tariffs + supplements
- [ ] Tugu / Lempuyangan station taxi ranks (if regulated)
- [ ] Giwangan / Jombor bus terminal rules

### 2d · Time-of-day / surcharge components

- [ ] Whether Yogyakarta taxis have night surcharge (kenaikan tarif malam) · authoritative source
- [ ] Whether app-based ojol has time-of-day surcharge · authoritative source
- [ ] Waiting-time charges (per minute) · where applicable
- [ ] Toll pass-through pricing rules

### 2e · Free-market space (what is NOT regulated)

- [ ] Explicitly document which pricing components are LEFT to operator/app discretion (surge · dynamic pricing · promotions · loyalty · specific route optimisation)
- [ ] Document that NEX cannot honestly quote these · only the regulated boundary
- [ ] Document that NEX may present a "regulated reference" and label the free-market space as "live operator quote required"

---

## 3 · Proposed Transport Knowledge Object shape (design · not built)

Every filled entry above becomes one row (or more) in:

```
nex.transport_evidence
  evidence_id           uuid PK
  jurisdiction          text        national / DIY / Kota Yogyakarta / Sleman / etc.
  transport_category    text        taxi / car-rental / ask / motorbike-ride-hail / bus / rail / airport-transfer
  regulatory_instrument text        Ministry Regulation Permenhub N/YYYY / Governor Decree 41/2025 etc.
  effective_from        date
  effective_to          date NULL
  fare_component        text        minimum-fare / per-km-lower / per-km-upper / airport-supplement / toll / waiting / night-surcharge / parking
  value                 numeric NULL
  value_range           jsonb NULL  {min, max, currency: "IDR"}
  applicability         jsonb       geographic scope / vehicle type / time-of-day
  source_authority_tier text        VERIFIED / OBSERVED / OWNER-CLAIM / INFERRED / UNKNOWN
  source_url            text NULL
  raw_snippet           text NULL
  confidence            numeric
  captured_at           timestamptz
  provenance            jsonb
  interpretation_note   text        what NEX may honestly conclude
  unknown_note          text        what NEX may NOT conclude even with this evidence
```

Polymorphic across jurisdictions. Scales to any country/province by registering new rows · never per-country hardcoded formulas.

---

## 4 · First customer use case (interaction design)

Traveller: *"I'm staying at [hotel]. How much will it cost to get to Malioboro?"*

NEX composition sequence (design):

1. Read hotel coordinates + location_confidence (from Location Intelligence · Path C)
2. Read Malioboro landmark coordinates (from `nex.geo_landmark` · Path C)
3. If Distance Intelligence available (routed distance from OSRM/GraphHopper), compute routed distance · walking time · driving time · motorbike time
4. If Distance Intelligence NOT available (current state), state that clearly: *"NEX can measure straight-line distance but doesn't yet have routed travel-time data for this route"*
5. Query `nex.transport_evidence` for applicable regulatory rows (jurisdiction=DIY · transport_category IN (taxi · motorbike-ride-hail · car-rental))
6. Compute regulated reference range per transport category
7. Compose the honest answer with SCIUD discipline visible

Locked template:

> *"[Hotel] to Malioboro is approximately [X] km."*
>
> *"Based on the applicable tariff information (Governor Decree [N] and Ministry Zone-[N] motorbike framework), the regulated reference calculation suggests:"*
>
> - *"Motorbike ride-hailing: roughly Rp [Y]–Rp [Z] · zone-[N] per-km rate × distance"*
> - *"Taxi: roughly Rp [Y]–Rp [Z] · per Governor Decree upper/lower bounds"*
>
> *"These are regulated reference ranges. The actual live app quote may differ because the operator can apply its own current fare rules, promotions, tolls, waiting, or surge · NEX can't quote the live price directly."*
>
> *"If walking is an option, straight-line distance is about [N] m · I don't yet have a routed walking time for this specific route."*

Every one of those phrases has a defensible provenance chain.

---

## 5 · Comparison shape for the anchor question (*"don't depend on taxis"*)

For the anchor traveller question, transport intelligence enables comparison per candidate hotel:

| Option | Walk | Motorbike | Taxi | Car | Public transport |
|---|---|---|---|---|---|
| Hotel A → Prawirotaman food area | routed distance · straight-line for now · [walking-time-when-available] | Rp X–Y regulated zone-N | Rp Y–Z Decree 41/2025 | Rp Y–Z Decree 41/2025 | route + fare where evidence exists |
| Hotel A → Malioboro landmarks | same shape | same shape | same shape | same shape | same shape |
| Hotel A → daily food density (within 500 m) | count · not distance | n/a | n/a | n/a | n/a |
| Hotel B → same | same shape | same shape | same shape | same shape | same shape |

The customer sees whether Hotel A really means *"don't depend on taxis"* · Hotel B may need vehicles daily. Trade-off surfaced with actual numbers not gut feel.

---

## 6 · Prerequisites before ANY implementation

- [ ] Regulatory research (§ 2 above) completed with source URLs
- [ ] Transport Knowledge Object schema designed + reviewed
- [ ] Migration file drafted (not applied)
- [ ] Sample regulatory rows seeded (Yogyakarta only initially)
- [ ] Distance Intelligence decision (OSRM local · GraphHopper local · or hosted service) — this is C4 · currently future
- [ ] Traveller phrasing templates drafted with SCIUD discipline
- [ ] Design approved by Philip

Only after all six · then a persistence PR + calculation logic + limited answer surface behind a feature flag.

---

## 7 · Explicit non-goals for this phase

- ❌ No customer-facing transport UI
- ❌ No driver dispatch (that's `project_nex_driver_network_authorised_only_design_2026_08_23`)
- ❌ No integration with any third-party app APIs
- ❌ No scraping any operator's price
- ❌ No inference of driver location from any source
- ❌ No hard-coded national fare
- ❌ No Walker for transport pricing

---

## 8 · Companion memories

- Design doctrine: `project_nex_transport_intelligence_design_2026_08_23`
- Driver network (deferred): `project_nex_driver_network_authorised_only_design_2026_08_23`
- Distance Intelligence prerequisite: `project_nex_location_distance_intelligence_precision_matched_to_confidence_2026_08_23`
- Traveller Protection Principle (transport is one of the 15 categories): `project_nex_traveller_protection_principle_2026_08_23`
- Verified vs Anecdotal source rule (regulatory instruments are VERIFIED tier): `project_nex_verified_authority_vs_anecdotal_claim_source_rule_2026_08_23`
- Truth Invariant: `project_nex_truth_invariant_2026_08_22`
- SCIUD reasoning chain (to be created): `project_nex_source_claim_interpretation_unknown_decision_chain_2026_08_23`
