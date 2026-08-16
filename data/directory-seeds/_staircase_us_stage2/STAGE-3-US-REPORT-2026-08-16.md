# UK Staircase Trade Market · Stage 3-USA · Sample Deep-Verify

_20-record stratified sample from stage2-us-consolidated.json · directly fetched · evidence from actual page content · no snippet uplift · 2026-08-16_

## Aggregate

- Records inspected: 20
- Directly reachable (HTTP 2xx-3xx): 19
- Identity confirmed on page: 17

### 4-state verification distribution

| State | Count |
|---|---:|
| FULLY_VERIFIED | 17 |
| SERVICE_EVIDENCED | 0 |
| DIRECTLY_REACHABLE (identity only) | 0 |
| SEARCH_DISCOVERED (identity failed / unreachable) | 3 |

### Per-bucket verification

| Bucket | FULLY_VERIFIED | SERVICE_EVIDENCED | DIRECTLY_REACHABLE | SEARCH_DISCOVERED |
|---|---:|---:|---:|---:|
| Northeast | 2 | 0 | 0 | 0 |
| Southeast | 0 | 0 | 0 | 2 |
| Midwest | 2 | 0 | 0 | 0 |
| Southwest | 2 | 0 | 0 | 0 |
| West | 2 | 0 | 0 | 0 |
| California | 3 | 0 | 0 | 0 |
| Texas | 2 | 0 | 0 | 1 |
| Refacing | 2 | 0 | 0 | 0 |
| Small state | 2 | 0 | 0 | 0 |

### Capability direct evidence (of 20)

| Capability | Records with direct page evidence |
|---|---:|
| manufacture | 16 |
| installation | 14 |
| refurbishment | 11 |
| refacing | 0 |
| balustrade | 13 |
| handrail | 3 |
| glass | 4 |
| metal | 12 |
| kit_or_product_supplier | 2 |

### Business-group classification

| Group | Count |
|---|---:|
| MULTI_SERVICE_COMPANY | 11 |
| STAIRCASE_MANUFACTURER | 6 |
| REFACING_OR_REFURB_KIT_OR_PRODUCT_SUPPLIER | 2 |
| REFURBISHMENT_SERVICE_SPECIALIST | 1 |

### Failure analysis

- Fetch errors: 1
- No URL: 0

## Per-record detail (all 20)

### 1. NYC Stair

- **Bucket:** Northeast
- **Website:** https://nycstairs.com/
- **State / country:** NY · USA
- **Fetch:** HTTP 200 · 106274 bytes · https://nycstairs.com/
- **Identity confirmed:** true
- **Verification:** `FULLY_VERIFIED`
- **Quality band:** A
- **Business group:** `STAIRCASE_MANUFACTURER`
- **Direct page evidence:**
  - ✓ manufacture — "Manufacturer"
  - ✓ installation — "installing"
  - ✓ balustrade — "railings"
  - ✓ metal — "metal stair"
  - ✓ bespoke — "Custom Stair"
  - ✓ design — "designs"
- **Materials mentioned:** steel
- **Stage 2 claimed:** manufacture, installation, balustrade, handrail, metal, bespoke, design

### 2. Steel Masters NYC

- **Bucket:** Northeast
- **Website:** https://steelmastersnyc.com/
- **State / country:** NY · USA
- **Fetch:** HTTP 200 · 166505 bytes · https://steelmastersnyc.com/
- **Identity confirmed:** true
- **Verification:** `FULLY_VERIFIED`
- **Quality band:** A
- **Business group:** `MULTI_SERVICE_COMPANY`
- **Direct page evidence:**
  - ✓ manufacture — "staircase built"
  - ✓ installation — "installation"
  - ✓ refurbishment — "Repairs"
  - ✓ balustrade — "Railings"
  - ✓ metal — "Metal Stair"
- **Materials mentioned:** steel
- **Stage 2 claimed:** manufacture, installation, balustrade, handrail, metal, bespoke, design

### 3. Southern Staircase

- **Bucket:** Southeast
- **Website:** https://southernstaircase.com/
- **State / country:** GA · USA
- **Fetch:** HTTP 403 · 1084 bytes · https://southernstaircase.com/
- **Identity confirmed:** false
- **Verification:** `SEARCH_DISCOVERED`
- **Quality band:** D
- **Business group:** `STAIRCASE_MANUFACTURER`
- **Stage 2 claimed:** manufacture, installation, balustrade, handrail, metal, bespoke, design

### 4. Vision Stairways & Millwork

- **Bucket:** Southeast
- **Website:** https://visionstairwaysandmillwork.com/
- **State / country:** GA · USA
- **Fetch:** HTTP 202 · 168 bytes · https://visionstairwaysandmillwork.com/
- **Identity confirmed:** false
- **Verification:** `SEARCH_DISCOVERED`
- **Quality band:** D
- **Business group:** `MULTI_SERVICE_COMPANY`
- **Direct page evidence:**
  - (none directly evidenced)
- **Materials mentioned:** _(none)_
- **Stage 2 claimed:** manufacture, installation, refurbishment, balustrade, handrail, metal, bespoke, design

### 5. Designed Stairs Inc.

- **Bucket:** Midwest
- **Website:** https://designedstairs.com/
- **State / country:** IL · USA
- **Fetch:** HTTP 200 · 170537 bytes · https://www.designedstairs.com/
- **Identity confirmed:** true
- **Verification:** `FULLY_VERIFIED`
- **Quality band:** A
- **Business group:** `REFACING_OR_REFURB_KIT_OR_PRODUCT_SUPPLIER`
- **Direct page evidence:**
  - ✓ manufacture — "Custom Stair"
  - ✓ installation — "Installation"
  - ✓ refurbishment — "Remodeling"
  - ✓ balustrade — "Balustrade"
  - ✓ glass — "Glass Balustrad"
  - ✓ metal — "Metal Stair"
  - ✓ bespoke — "Custom Stair"
  - ✓ design — "Designed"
  - ✓ kit_or_product_supplier — "Kit"
- **Materials mentioned:** glass
- **Stage 2 claimed:** manufacture, installation, refurbishment, balustrade, handrail, metal, bespoke, design

### 6. HL Stairs

- **Bucket:** Midwest
- **Website:** https://hlstairs.com/
- **State / country:** IL · USA
- **Fetch:** HTTP 200 · 151990 bytes · https://hlstairs.com/
- **Identity confirmed:** true
- **Verification:** `FULLY_VERIFIED`
- **Quality band:** A
- **Business group:** `MULTI_SERVICE_COMPANY`
- **Direct page evidence:**
  - ✓ manufacture — "Custom Stair"
  - ✓ installation — "installation"
  - ✓ refurbishment — "renovation"
  - ✓ balustrade — "railings"
  - ✓ handrail — "Handrails"
  - ✓ glass — "glass rail"
  - ✓ metal — "Stainless Steel"
  - ✓ bespoke — "Bespoke"
  - ✓ design — "Designed"
- **Materials mentioned:** oak, walnut, ash, maple, hickory, glass, stainless steel, steel
- **Stage 2 claimed:** manufacture, installation, balustrade, handrail, glass, metal, bespoke, design

### 7. Arizona Stairs, Inc.

- **Bucket:** Southwest
- **Website:** https://www.arizonastairs.com/
- **State / country:** AZ · USA
- **Fetch:** HTTP 200 · 15984 bytes · https://www.arizonastairs.com/
- **Identity confirmed:** true
- **Verification:** `FULLY_VERIFIED`
- **Quality band:** A
- **Business group:** `MULTI_SERVICE_COMPANY`
- **Direct page evidence:**
  - ✓ manufacture — "Custom Stair"
  - ✓ installation — "installation"
  - ✓ refurbishment — "Remodeling"
  - ✓ balustrade — "Railing"
  - ✓ metal — "Stainless Steel"
  - ✓ bespoke — "Custom Stair"
  - ✓ design — "Design"
- **Materials mentioned:** glass, stainless steel, steel
- **Stage 2 claimed:** custom_staircase, stair_remodel, railings, wood_stairs, commercial

### 8. Artistic Stairs US

- **Bucket:** Southwest
- **Website:** https://artisticstairs-us.com/
- **State / country:** AZ · USA
- **Fetch:** HTTP 200 · 157902 bytes · https://artisticstairs-us.com/
- **Identity confirmed:** true
- **Verification:** `FULLY_VERIFIED`
- **Quality band:** A
- **Business group:** `MULTI_SERVICE_COMPANY`
- **Direct page evidence:**
  - ✓ manufacture — "Manufacturing"
  - ✓ refurbishment — "Remodels"
  - ✓ balustrade — "Railings"
  - ✓ handrail — "handrails"
  - ✓ glass — "glass panel"
  - ✓ metal — "Iron Stair"
  - ✓ bespoke — "Custom Stair"
  - ✓ design — "Design"
- **Materials mentioned:** glass, stainless steel, steel
- **Stage 2 claimed:** custom_staircase, stair_remodel, railings, wood_stairs, metal_stairs, glass_stairs, spiral_stairs, curved_stairs, commercial

### 9. West Coast Stair Co.

- **Bucket:** West
- **Website:** https://www.westcoaststairco.com/
- **State / country:** WA · USA
- **Fetch:** HTTP 200 · 261384 bytes · https://www.westcoaststairco.com/
- **Identity confirmed:** true
- **Verification:** `FULLY_VERIFIED`
- **Quality band:** A
- **Business group:** `STAIRCASE_MANUFACTURER`
- **Direct page evidence:**
  - ✓ manufacture — "custom stair"
  - ✓ installation — "Installation"
  - ✓ balustrade — "Railings"
  - ✓ metal — "metal stair"
  - ✓ bespoke — "custom stair"
  - ✓ design — "design"
- **Materials mentioned:** _(none)_
- **Stage 2 claimed:** custom_stairs, wood_stairs, curved_stairs, railings, renovation

### 10. Brookfield Stairs

- **Bucket:** West
- **Website:** https://www.brookfieldstairs.com/
- **State / country:** WA · USA
- **Fetch:** HTTP 200 · 144848 bytes · https://www.brookfieldstairs.com/
- **Identity confirmed:** true
- **Verification:** `FULLY_VERIFIED`
- **Quality band:** A
- **Business group:** `REFACING_OR_REFURB_KIT_OR_PRODUCT_SUPPLIER`
- **Direct page evidence:**
  - ✓ manufacture — "manufactures"
  - ✓ installation — "installation"
  - ✓ refurbishment — "remodel"
  - ✓ bespoke — "Custom Design"
  - ✓ design — "Designs"
  - ✓ kit_or_product_supplier — "KITS"
- **Materials mentioned:** glass, steel
- **Stage 2 claimed:** custom_stairs, wood_stairs, metal_stairs, floating_stairs, railings

### 11. Bay Area Stairs, Inc.

- **Bucket:** California
- **Website:** https://bayareastairs.com
- **State / country:** CA · USA
- **Fetch:** HTTP 200 · 84828 bytes · https://bayareastairs.com/
- **Identity confirmed:** true
- **Verification:** `FULLY_VERIFIED`
- **Quality band:** A
- **Business group:** `MULTI_SERVICE_COMPANY`
- **Direct page evidence:**
  - ✓ manufacture — "bespoke stair"
  - ✓ installation — "installation"
  - ✓ refurbishment — "renovating"
  - ✓ balustrade — "railing"
  - ✓ metal — "stainless steel"
  - ✓ bespoke — "bespoke"
  - ✓ design — "designs"
- **Materials mentioned:** walnut, glass, stainless steel, steel
- **Stage 2 claimed:** manufacture, installation, balustrade, handrail, glass, metal, bespoke, design

### 12. Classical Stairways, Inc.

- **Bucket:** California
- **Website:** https://www.classicalstairwaysinc.org
- **State / country:** CA · USA
- **Fetch:** HTTP 200 · 780644 bytes · https://www.classicalstairwaysinc.org/
- **Identity confirmed:** true
- **Verification:** `FULLY_VERIFIED`
- **Quality band:** A
- **Business group:** `STAIRCASE_MANUFACTURER`
- **Direct page evidence:**
  - ✓ manufacture — "Manufacturing"
  - ✓ installation — "Installation"
  - ✓ bespoke — "Custom Stair"
  - ✓ design — "Design"
- **Materials mentioned:** _(none)_
- **Stage 2 claimed:** manufacture, installation, balustrade, handrail, bespoke, design

### 13. Naddour's Custom Metalworks

- **Bucket:** California
- **Website:** https://www.naddourscustommetalworks.com
- **State / country:** CA · USA
- **Fetch:** HTTP 200 · 271822 bytes · https://www.naddourscustommetalworks.com/
- **Identity confirmed:** true
- **Verification:** `FULLY_VERIFIED`
- **Quality band:** A
- **Business group:** `STAIRCASE_MANUFACTURER`
- **Direct page evidence:**
  - ✓ manufacture — "Manufacturer"
  - ✓ balustrade — "RAILINGS"
  - ✓ metal — "iron stair"
- **Materials mentioned:** wrought iron, steel
- **Stage 2 claimed:** manufacture, installation, balustrade, handrail, metal, bespoke, design

### 14. Houston Stair Company, Inc.

- **Bucket:** Texas
- **Website:** https://www.houstonstair.com/
- **State / country:** TX · USA
- **Fetch:** HTTP 200 · 607636 bytes · https://www.houstonstair.com/
- **Identity confirmed:** true
- **Verification:** `FULLY_VERIFIED`
- **Quality band:** A
- **Business group:** `REFURBISHMENT_SERVICE_SPECIALIST`
- **Direct page evidence:**
  - ✓ installation — "installation"
  - ✓ refurbishment — "Makeover"
  - ✓ balustrade — "RAILING"
  - ✓ glass — "GLASS STAIR"
  - ✓ metal — "IRON RAIL"
- **Materials mentioned:** glass, stainless steel, steel
- **Stage 2 claimed:** wood, iron, glass, cable, custom, remodel, railings

### 15. Precision Stair Co.

- **Bucket:** Texas
- **Website:** https://precisionstairco.com/
- **State / country:** TX · USA
- **Fetch:** HTTP 200 · 170272 bytes · https://www.precisionstairco.com/
- **Identity confirmed:** true
- **Verification:** `FULLY_VERIFIED`
- **Quality band:** A
- **Business group:** `MULTI_SERVICE_COMPANY`
- **Direct page evidence:**
  - ✓ manufacture — "Staircase Make"
  - ✓ installation — "Installation"
  - ✓ refurbishment — "Remodeling"
  - ✓ balustrade — "Railings"
  - ✓ metal — "iron stair"
  - ✓ bespoke — "Custom Stair"
  - ✓ design — "Design"
- **Materials mentioned:** tile
- **Stage 2 claimed:** wood, iron, custom, remodel, railings

### 16. Ironwood Connection (Houston)

- **Bucket:** Texas
- **Website:** https://ironwoodusa.com/
- **State / country:** TX · USA
- **Fetch:** ERROR — This operation was aborted
- **Identity confirmed:** false
- **Verification:** `SEARCH_DISCOVERED`
- **Quality band:** D
- **Business group:** `MULTI_SERVICE_COMPANY`
- **Stage 2 claimed:** wood, iron, glass, cable, floating, custom, remodel, railings

### 17. New York Wood Stairs

- **Bucket:** Refacing
- **Website:** https://nywoodstairs.com/
- **State / country:** NY · USA
- **Fetch:** HTTP 200 · 246085 bytes · https://nywoodstairs.com/
- **Identity confirmed:** true
- **Verification:** `FULLY_VERIFIED`
- **Quality band:** A
- **Business group:** `MULTI_SERVICE_COMPANY`
- **Direct page evidence:**
  - ✓ manufacture — "manufacturing"
  - ✓ refurbishment — "existing stair"
  - ✓ design — "design"
- **Materials mentioned:** oak, steel
- **Stage 2 claimed:** manufacture, installation, refurbishment, balustrade, handrail, glass, metal, bespoke, design

### 18. Stairway to Heaven of NY

- **Bucket:** Refacing
- **Website:** https://www.stairsny.com/
- **State / country:** NY · USA
- **Fetch:** HTTP 200 · 1175090 bytes · https://www.stairsny.com/
- **Identity confirmed:** true
- **Verification:** `FULLY_VERIFIED`
- **Quality band:** A
- **Business group:** `MULTI_SERVICE_COMPANY`
- **Direct page evidence:**
  - ✓ manufacture — "Manufacturing"
  - ✓ installation — "Installation"
  - ✓ refurbishment — "Restoration"
  - ✓ balustrade — "railings"
  - ✓ bespoke — "custom stair"
  - ✓ design — "Design"
- **Materials mentioned:** _(none)_
- **Stage 2 claimed:** manufacture, installation, refurbishment, balustrade, handrail, bespoke, design

### 19. Hardwood Design Inc.

- **Bucket:** Small state
- **Website:** https://www.hdistair.com/
- **State / country:** RI · USA
- **Fetch:** HTTP 200 · 72017 bytes · https://www.hdistair.com/
- **Identity confirmed:** true
- **Verification:** `FULLY_VERIFIED`
- **Quality band:** A
- **Business group:** `STAIRCASE_MANUFACTURER`
- **Direct page evidence:**
  - ✓ manufacture — "stair building"
  - ✓ installation — "installation"
  - ✓ design — "Design"
- **Materials mentioned:** oak, walnut
- **Stage 2 claimed:** manufacture, installation, balustrade, handrail, bespoke, design

### 20. Vermont Custom Handrails & Metalwork

- **Bucket:** Small state
- **Website:** https://www.vthandrailsandmetal.com/
- **State / country:** VT · USA
- **Fetch:** HTTP 200 · 233619 bytes · https://www.vthandrailsandmetal.com/
- **Identity confirmed:** true
- **Verification:** `FULLY_VERIFIED`
- **Quality band:** A
- **Business group:** `MULTI_SERVICE_COMPANY`
- **Direct page evidence:**
  - ✓ manufacture — "Custom Stair"
  - ✓ installation — "installation"
  - ✓ balustrade — "Railing"
  - ✓ handrail — "Handrails"
  - ✓ metal — "metal stair"
  - ✓ bespoke — "Custom Stair"
  - ✓ design — "design"
- **Materials mentioned:** stainless steel, steel
- **Stage 2 claimed:** manufacture, installation, refurbishment, balustrade, handrail, metal, bespoke, design

## What Stage 3-USA did NOT do

- Did not contact any US company
- Did not modify UK 471 or IE 50 production records
- Did not import to Supabase
- Did not delete any candidate
- Did not start Stage 4-USA · waiting for approval
- Did not touch NEX brain / M4 freeze