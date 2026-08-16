# UK Staircase Trade Market · Stage 3-IE · Ireland Sample Deep-Verify

_20-record stratified sample from stage2-ie-consolidated.json · directly fetched · evidence from actual page content · no snippet uplift · 2026-08-16_

## Aggregate (as requested)

- Records inspected: 20
- Directly reachable (HTTP 2xx-3xx): 19
- Identity confirmed on page: 14

### 4-state verification distribution

| State | Count |
|---|---:|
| FULLY_VERIFIED | 13 |
| SERVICE_EVIDENCED | 1 |
| DIRECTLY_REACHABLE (identity only) | 0 |
| SEARCH_DISCOVERED (identity failed / unreachable) | 6 |

### Per-bucket verification (tests whether rural gap is discovery-side or market-side)

| Bucket | FULLY_VERIFIED | SERVICE_EVIDENCED | DIRECTLY_REACHABLE | SEARCH_DISCOVERED |
|---|---:|---:|---:|---:|
| Dublin/Leinster | 3 | 0 | 0 | 2 |
| Munster | 1 | 0 | 0 | 3 |
| Connacht+RoI Ulster | 3 | 1 | 0 | 0 |
| Refurb/Refacing | 3 | 0 | 0 | 1 |
| Small county | 3 | 0 | 0 | 0 |

### Capability direct evidence (of 20)

| Capability | Records with direct page evidence |
|---|---:|
| manufacture | 11 |
| installation | 10 |
| refurbishment | 4 |
| refacing | 0 |
| balustrade | 6 |
| handrail | 6 |
| glass | 7 |
| metal | 3 |
| kit_or_product_supplier | 2 |

### Business-group classification

| Group | Count |
|---|---:|
| STAIRCASE_MANUFACTURER | 10 |
| MULTI_SERVICE_COMPANY | 7 |
| STAIRCASE_INSTALLER | 1 |
| REFACING_SERVICE_SPECIALIST | 1 |
| REFURBISHMENT_SERVICE_SPECIALIST | 1 |

## Per-record detail (all 20)

### 1. Evolution Stairs

- **Bucket:** Dublin/Leinster
- **Website:** https://www.evolutionstairs.ie/
- **County / country:** Dublin · Ireland
- **Fetch:** HTTP 200 · 367236 bytes · https://www.evolutionstairs.ie/
- **Identity confirmed on page:** true
- **Verification state:** `FULLY_VERIFIED`
- **Quality band:** A
- **Business group:** `STAIRCASE_MANUFACTURER`
- **Direct page evidence per capability:**
  - ✓ manufacture — matched: "manufacturer"
  - ✗ installation
  - ✗ refurbishment
  - ✗ refacing
  - ✗ balustrade
  - ✓ handrail — matched: "Handrail"
  - ✗ glass
  - ✗ metal
  - ✓ bespoke — matched: "BESPOKE"
  - ✓ design — matched: "DESIGNER"
  - ✗ kit_or_product_supplier
- **Materials mentioned:** oak, iroko, glass
- **Stage 2 claimed capabilities:** manufacture, installation, metal, bespoke, design

### 2. Ardara Woodwork (Stairs Dublin)

- **Bucket:** Dublin/Leinster
- **Website:** https://www.stairsdublin.ie/
- **County / country:** Dublin · Ireland
- **Fetch:** HTTP 403 · 71 bytes · https://www.stairsdublin.ie/
- **Identity confirmed on page:** false
- **Verification state:** `SEARCH_DISCOVERED`
- **Quality band:** D
- **Business group:** `MULTI_SERVICE_COMPANY`
- **Stage 2 claimed capabilities:** manufacture, installation, refurbishment, balustrade, handrail, glass, bespoke, design

### 3. Connolly Stairs & Doors

- **Bucket:** Dublin/Leinster
- **Website:** https://www.connollystairs.ie/
- **County / country:** Dublin · Ireland
- **Fetch:** HTTP 200 · 221279 bytes · https://www.connollystairs.ie/
- **Identity confirmed on page:** false
- **Verification state:** `SEARCH_DISCOVERED`
- **Quality band:** D
- **Business group:** `MULTI_SERVICE_COMPANY`
- **Direct page evidence per capability:**
  - ✓ manufacture — matched: "handmade stair"
  - ✓ installation — matched: "installation"
  - ✓ refurbishment — matched: "Refurbish"
  - ✗ refacing
  - ✗ balustrade
  - ✓ handrail — matched: "handrails"
  - ✓ glass — matched: "glass Handrail"
  - ✓ metal — matched: "stainless steel"
  - ✗ bespoke
  - ✓ design — matched: "Designs"
  - ✗ kit_or_product_supplier
- **Materials mentioned:** oak, walnut, glass, stainless steel, carpet
- **Stage 2 claimed capabilities:** manufacture, installation, bespoke, design

### 4. 57 Stairs

- **Bucket:** Dublin/Leinster
- **Website:** https://57stairs.ie/
- **County / country:** Carlow · Ireland
- **Fetch:** HTTP 200 · 65712 bytes · https://57stairs.ie/
- **Identity confirmed on page:** true
- **Verification state:** `FULLY_VERIFIED`
- **Quality band:** A
- **Business group:** `STAIRCASE_MANUFACTURER`
- **Direct page evidence per capability:**
  - ✓ manufacture — matched: "Manufacturer"
  - ✓ installation — matched: "installed"
  - ✗ refurbishment
  - ✗ refacing
  - ✓ balustrade — matched: "balustrade"
  - ✗ handrail
  - ✓ glass — matched: "glass balustrad"
  - ✗ metal
  - ✓ bespoke — matched: "Custom Stair"
  - ✓ design — matched: "design"
  - ✗ kit_or_product_supplier
- **Materials mentioned:** oak, glass
- **Stage 2 claimed capabilities:** manufacture, bespoke, design

### 5. Collins Stairs

- **Bucket:** Dublin/Leinster
- **Website:** https://www.collinsstairs.com/
- **County / country:** Dublin · Ireland
- **Fetch:** HTTP 200 · 24103 bytes · https://www.collinsstairs.com/
- **Identity confirmed on page:** true
- **Verification state:** `FULLY_VERIFIED`
- **Quality band:** A
- **Business group:** `STAIRCASE_MANUFACTURER`
- **Direct page evidence per capability:**
  - ✓ manufacture — matched: "manufacturing"
  - ✓ installation — matched: "fitting"
  - ✗ refurbishment
  - ✗ refacing
  - ✗ balustrade
  - ✓ handrail — matched: "Handrails"
  - ✗ glass
  - ✗ metal
  - ✗ bespoke
  - ✓ design — matched: "design"
  - ✗ kit_or_product_supplier
- **Materials mentioned:** _(none)_
- **Stage 2 claimed capabilities:** manufacture, installation, bespoke, design

### 6. Carrigaline Joinery Ltd

- **Bucket:** Munster
- **Website:** https://carrigalinejoinery.com/
- **County / country:** Cork · Ireland
- **Fetch:** HTTP 200 · 84421 bytes · https://carrigalinejoinery.com/
- **Identity confirmed on page:** true
- **Verification state:** `FULLY_VERIFIED`
- **Quality band:** A
- **Business group:** `MULTI_SERVICE_COMPANY`
- **Direct page evidence per capability:**
  - ✓ manufacture — matched: "manufacture"
  - ✓ installation — matched: "installation"
  - ✓ refurbishment — matched: "Renovation"
  - ✗ refacing
  - ✗ balustrade
  - ✗ handrail
  - ✓ glass — matched: "Glass Stair"
  - ✗ metal
  - ✓ bespoke — matched: "Bespoke"
  - ✓ design — matched: "designs"
  - ✗ kit_or_product_supplier
- **Materials mentioned:** glass
- **Stage 2 claimed capabilities:** manufacture, installation, refurbishment, refacing, balustrade, handrail, glass, bespoke, design

### 7. Jonathan Evans Carpentry Joinery

- **Bucket:** Munster
- **Website:** https://carpentryjoineryballincolligcork.com/
- **County / country:** Cork · Ireland
- **Fetch:** HTTP 403 · 5592 bytes · https://carpentryjoinerycork.ie/
- **Identity confirmed on page:** false
- **Verification state:** `SEARCH_DISCOVERED`
- **Quality band:** D
- **Business group:** `MULTI_SERVICE_COMPANY`
- **Stage 2 claimed capabilities:** manufacture, installation, refurbishment, balustrade, handrail, bespoke, design

### 8. The Stairs Store (RPB Products Ltd)

- **Bucket:** Munster
- **Website:** https://www.thestairsstore.ie/
- **County / country:** Cork · Ireland
- **Fetch:** HTTP 200 · 74257 bytes · https://www.thestairsstore.ie/
- **Identity confirmed on page:** false
- **Verification state:** `SEARCH_DISCOVERED`
- **Quality band:** D
- **Business group:** `STAIRCASE_MANUFACTURER`
- **Direct page evidence per capability:**
  - ✓ manufacture — matched: "MADE TO MEASURE STAIR"
  - ✗ installation
  - ✗ refurbishment
  - ✗ refacing
  - ✗ balustrade
  - ✗ handrail
  - ✗ glass
  - ✗ metal
  - ✓ bespoke — matched: "MADE TO MEASURE"
  - ✓ design — matched: "Designing"
  - ✓ kit_or_product_supplier — matched: "Kit"
- **Materials mentioned:** _(none)_
- **Stage 2 claimed capabilities:** installation, handrail, metal

### 9. Mallow Joinery

- **Bucket:** Munster
- **Website:** https://www.mallowjoinery.com/stairs-cork.php
- **County / country:** Cork · Ireland
- **Fetch:** HTTP 521 · 7050 bytes · https://www.mallowjoinery.com/stairs-cork.php
- **Identity confirmed on page:** false
- **Verification state:** `SEARCH_DISCOVERED`
- **Quality band:** D
- **Business group:** `STAIRCASE_MANUFACTURER`
- **Stage 2 claimed capabilities:** manufacture, installation, bespoke, design

### 10. Kilgallon Stairs Ltd

- **Bucket:** Connacht+RoI Ulster
- **Website:** https://kilgallonstairs.com/
- **County / country:** Sligo · Ireland
- **Fetch:** HTTP 200 · 48640 bytes · https://kilgallonstairs.com/
- **Identity confirmed on page:** true
- **Verification state:** `FULLY_VERIFIED`
- **Quality band:** A
- **Business group:** `MULTI_SERVICE_COMPANY`
- **Direct page evidence per capability:**
  - ✗ manufacture
  - ✗ installation
  - ✗ refurbishment
  - ✗ refacing
  - ✓ balustrade — matched: "Balustrade"
  - ✗ handrail
  - ✓ glass — matched: "Glass Panel"
  - ✗ metal
  - ✗ bespoke
  - ✓ design — matched: "design"
  - ✗ kit_or_product_supplier
- **Materials mentioned:** oak, walnut, glass, concrete
- **Stage 2 claimed capabilities:** manufacture, installation, refacing, balustrade, handrail, glass, metal, bespoke

### 11. Eamonn Burke Stairs Ltd

- **Bucket:** Connacht+RoI Ulster
- **Website:** https://burkestairs.com/
- **County / country:** Sligo · Ireland
- **Fetch:** HTTP 200 · 57138 bytes · https://burkestairs.com/
- **Identity confirmed on page:** true
- **Verification state:** `SERVICE_EVIDENCED`
- **Quality band:** B
- **Business group:** `STAIRCASE_MANUFACTURER`
- **Direct page evidence per capability:**
  - ✓ manufacture — matched: "manufacture"
  - ✗ installation
  - ✗ refurbishment
  - ✗ refacing
  - ✗ balustrade
  - ✗ handrail
  - ✗ glass
  - ✗ metal
  - ✗ bespoke
  - ✓ design — matched: "Design"
  - ✗ kit_or_product_supplier
- **Materials mentioned:** _(none)_
- **Stage 2 claimed capabilities:** manufacture, balustrade, handrail, bespoke, design

### 12. Sligo Glass Company Ltd

- **Bucket:** Connacht+RoI Ulster
- **Website:** https://sligoglass.com/
- **County / country:** Sligo · Ireland
- **Fetch:** HTTP 200 · 700728 bytes · https://sligoglass.com/
- **Identity confirmed on page:** true
- **Verification state:** `FULLY_VERIFIED`
- **Quality band:** A
- **Business group:** `STAIRCASE_INSTALLER`
- **Direct page evidence per capability:**
  - ✗ manufacture
  - ✓ installation — matched: "Installing"
  - ✗ refurbishment
  - ✗ refacing
  - ✓ balustrade — matched: "Balustrades"
  - ✗ handrail
  - ✓ glass — matched: "Glass Balustrad"
  - ✗ metal
  - ✗ bespoke
  - ✓ design — matched: "Design"
  - ✓ kit_or_product_supplier — matched: "Add to cart"
- **Materials mentioned:** glass
- **Stage 2 claimed capabilities:** installation, balustrade, glass, bespoke

### 13. Geraghty Joinery

- **Bucket:** Connacht+RoI Ulster
- **Website:** https://geraghtyjoinery.com/
- **County / country:** Galway · Ireland
- **Fetch:** HTTP 200 · 99384 bytes · https://geraghtyjoinery.com/
- **Identity confirmed on page:** true
- **Verification state:** `FULLY_VERIFIED`
- **Quality band:** A
- **Business group:** `STAIRCASE_MANUFACTURER`
- **Direct page evidence per capability:**
  - ✓ manufacture — matched: "Manufacture"
  - ✓ installation — matched: "Installation"
  - ✗ refurbishment
  - ✗ refacing
  - ✗ balustrade
  - ✗ handrail
  - ✗ glass
  - ✗ metal
  - ✓ bespoke — matched: "Bespoke"
  - ✓ design — matched: "Design"
  - ✗ kit_or_product_supplier
- **Materials mentioned:** oak
- **Stage 2 claimed capabilities:** manufacture, installation, glass, metal, bespoke, design

### 14. OS Holding

- **Bucket:** Refurb/Refacing
- **Website:** https://osholding.ie/
- **County / country:** Dublin · Ireland
- **Fetch:** HTTP 200 · 201061 bytes · https://osholding.ie/
- **Identity confirmed on page:** true
- **Verification state:** `FULLY_VERIFIED`
- **Quality band:** A
- **Business group:** `REFACING_SERVICE_SPECIALIST`
- **Direct page evidence per capability:**
  - ✗ manufacture
  - ✓ installation — matched: "installation"
  - ✓ refurbishment — matched: "refurbishment"
  - ✗ refacing
  - ✗ balustrade
  - ✗ handrail
  - ✗ glass
  - ✗ metal
  - ✗ bespoke
  - ✓ design — matched: "design"
  - ✗ kit_or_product_supplier
- **Materials mentioned:** _(none)_
- **Stage 2 claimed capabilities:** installation, refurbishment, refacing, balustrade, handrail, design

### 15. cosyroom.ie (Attics Dublin)

- **Bucket:** Refurb/Refacing
- **Website:** https://cosyroom.ie/
- **County / country:** Dublin · Ireland
- **Fetch:** ERROR — fetch failed
- **Identity confirmed on page:** false
- **Verification state:** `SEARCH_DISCOVERED`
- **Quality band:** D
- **Business group:** `REFURBISHMENT_SERVICE_SPECIALIST`
- **Stage 2 claimed capabilities:** installation, refurbishment, bespoke, design

### 16. MacLyn Conservation Joinery

- **Bucket:** Refurb/Refacing
- **Website:** https://conservationjoinery.com/
- **County / country:** Dublin · Ireland
- **Fetch:** HTTP 200 · 29552 bytes · https://conservationjoinery.com/
- **Identity confirmed on page:** true
- **Verification state:** `FULLY_VERIFIED`
- **Quality band:** A
- **Business group:** `MULTI_SERVICE_COMPANY`
- **Direct page evidence per capability:**
  - ✗ manufacture
  - ✗ installation
  - ✓ refurbishment — matched: "refurbishing"
  - ✗ refacing
  - ✗ balustrade
  - ✓ handrail — matched: "Handrails"
  - ✗ glass
  - ✗ metal
  - ✓ bespoke — matched: "Bespoke"
  - ✓ design — matched: "Designed"
  - ✗ kit_or_product_supplier
- **Materials mentioned:** _(none)_
- **Stage 2 claimed capabilities:** manufacture, installation, refurbishment, bespoke, design

### 17. Colin Healy Stairs

- **Bucket:** Refurb/Refacing
- **Website:** http://colinhealystairs.com/
- **County / country:** Dublin · Ireland
- **Fetch:** HTTP 200 · 29112 bytes · http://colinhealystairs.com/
- **Identity confirmed on page:** true
- **Verification state:** `FULLY_VERIFIED`
- **Quality band:** A
- **Business group:** `MULTI_SERVICE_COMPANY`
- **Direct page evidence per capability:**
  - ✗ manufacture
  - ✗ installation
  - ✗ refurbishment
  - ✗ refacing
  - ✓ balustrade — matched: "Balustrade"
  - ✓ handrail — matched: "Handrail"
  - ✓ glass — matched: "Glass Balustrad"
  - ✗ metal
  - ✗ bespoke
  - ✓ design — matched: "Design"
  - ✗ kit_or_product_supplier
- **Materials mentioned:** glass
- **Stage 2 claimed capabilities:** manufacture, installation, refurbishment, handrail, bespoke

### 18. AJD Stairs

- **Bucket:** Small county
- **Website:** https://ajdstairs.com/
- **County / country:** Kilkenny · Ireland
- **Fetch:** HTTP 200 · 35285 bytes · https://ajdstairs.com/
- **Identity confirmed on page:** true
- **Verification state:** `FULLY_VERIFIED`
- **Quality band:** A
- **Business group:** `STAIRCASE_MANUFACTURER`
- **Direct page evidence per capability:**
  - ✓ manufacture — matched: "Bespoke Stair"
  - ✓ installation — matched: "installation"
  - ✗ refurbishment
  - ✗ refacing
  - ✗ balustrade
  - ✗ handrail
  - ✗ glass
  - ✗ metal
  - ✓ bespoke — matched: "Bespoke"
  - ✓ design — matched: "designs"
  - ✗ kit_or_product_supplier
- **Materials mentioned:** _(none)_
- **Stage 2 claimed capabilities:** manufacture, installation, balustrade, glass, metal, bespoke, design

### 19. Stairs Ireland by JEA

- **Bucket:** Small county
- **Website:** https://stairsireland.ie/
- **County / country:** Wicklow · Ireland
- **Fetch:** HTTP 200 · 556325 bytes · https://stairsireland.ie/
- **Identity confirmed on page:** true
- **Verification state:** `FULLY_VERIFIED`
- **Quality band:** A
- **Business group:** `STAIRCASE_MANUFACTURER`
- **Direct page evidence per capability:**
  - ✓ manufacture — matched: "Manufacture"
  - ✓ installation — matched: "Installation"
  - ✗ refurbishment
  - ✗ refacing
  - ✓ balustrade — matched: "balustrade"
  - ✓ handrail — matched: "Handrails"
  - ✗ glass
  - ✓ metal — matched: "Steel Stair"
  - ✓ bespoke — matched: "Bespoke"
  - ✓ design — matched: "Design"
  - ✗ kit_or_product_supplier
- **Materials mentioned:** oak, glass
- **Stage 2 claimed capabilities:** manufacture, installation, balustrade, glass, metal, bespoke, design

### 20. Custom Stairs Joinery

- **Bucket:** Small county
- **Website:** https://www.customstairs.ie/
- **County / country:** Kildare · Ireland
- **Fetch:** HTTP 200 · 1938658 bytes · https://www.customstairs.ie/
- **Identity confirmed on page:** true
- **Verification state:** `FULLY_VERIFIED`
- **Quality band:** A
- **Business group:** `STAIRCASE_MANUFACTURER`
- **Direct page evidence per capability:**
  - ✓ manufacture — matched: "manufacture"
  - ✓ installation — matched: "installation"
  - ✗ refurbishment
  - ✗ refacing
  - ✓ balustrade — matched: "Balustrade"
  - ✗ handrail
  - ✓ glass — matched: "Glass Stair"
  - ✓ metal — matched: "Metal Stair"
  - ✓ bespoke — matched: "bespoke"
  - ✓ design — matched: "design"
  - ✗ kit_or_product_supplier
- **Materials mentioned:** oak, glass
- **Stage 2 claimed capabilities:** manufacture, installation, balustrade, glass, metal, bespoke, design

## What Stage 3-IE did NOT do

- Did not contact any Irish company
- Did not upgrade "verified reachable" · used Philip's 4-state model
- Did not import any records to Supabase
- Did not modify the 471 UK records
- Did not start Stage 4-IE · waiting for approval
- Did not touch NEX brain / M4 freeze