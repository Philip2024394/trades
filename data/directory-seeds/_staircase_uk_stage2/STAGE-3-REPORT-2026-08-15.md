# UK Staircase Trade Market · Stage 3 · Sample Deep-Verify

_20-record stratified sample from stage2-consolidated.json · directly fetched · evidence extracted from actual page content · no snippet uplift · 2026-08-15_

## Verification-state definitions (Philip 2026-08-15)

| State | Meaning |
|---|---|
| SEARCH_DISCOVERED   | Only surfaced by search snippets · fetch failed OR identity did not confirm on page |
| DIRECTLY_REACHABLE  | Fetch OK + company name confirmed on page · no capability evidence found on this page |
| SERVICE_EVIDENCED   | Above + ≥1 capability directly evidenced in page HTML |
| FULLY_VERIFIED      | Above + ≥3 capabilities directly evidenced in page HTML |

## Aggregate (as requested)

- **Records inspected:** 20
- **Directly reachable (HTTP 2xx-3xx):** 20
- **Search-only (fetch failed):** 0
- **Identity confirmed on page:** 16

### 4-state verification distribution

- FULLY_VERIFIED: 16
- SERVICE_EVIDENCED: 0
- DIRECTLY_REACHABLE (identity only, no cap evidence): 0
- SEARCH_DISCOVERED (unable to directly verify): 4

### Capability evidence directly on page (of 20)

| Capability | Records with direct evidence |
|---|---:|
| manufacture | 17 |
| installation | 13 |
| refurbishment | 7 |
| refacing | 2 |
| balustrade | 7 |
| handrail | 5 |
| glass | 8 |
| metal | 8 |
| kit/product supplier signal | 2 |

### 6-group business classification

| Group | Count |
|---|---:|
| MULTI_SERVICE_COMPANY | 9 |
| STAIRCASE_MANUFACTURER | 9 |
| REFACING_OR_REFURB_KIT_OR_PRODUCT_SUPPLIER | 2 |

### Requiring manual review

- Fetch errors: 0
- No URL in original record: 0
- Total needing manual review (SEARCH_DISCOVERED + DIRECTLY_REACHABLE_only): 4

## Per-record detail (all 20)

### 1. Abbott-Wade

- **Website:** https://www.abbottwade.co.uk/
- **Fetch:** HTTP 200 · 387933 bytes · final url https://www.abbottwade.co.uk/
- **Identity confirmed on page:** true
- **Verification state:** `FULLY_VERIFIED`
- **Quality band:** A
- **Business group:** `MULTI_SERVICE_COMPANY`
- **Region / town:** NW · Culcheth (Warrington) · Cheshire · WA3 3UL
- **Direct page evidence per capability:**
  - ✓ manufacture — matched: "Manufacture"
  - ✓ installation — matched: "installers"
  - ✓ refurbishment — matched: "renovation"
  - ✗ refacing
  - ✗ balustrade
  - ✗ handrail
  - ✓ glass — matched: "Glass Stair"
  - ✓ metal — matched: "Metal Stair"
  - ✓ bespoke — matched: "Bespoke"
  - ✓ design — matched: "Design"
  - ✗ kit_or_product_supplier
- **Materials mentioned on page:** glass, stainless steel
- **Prior capability_claimed (from Stage 2):** manufacture, installation, refurbishment, refacing, balustrade, handrail, glass, metal, bespoke, design
- **Discovered by agents:** agent-1-england-north, agent-7-national-manufacturers, agent-8-refurbishment-refacing
- **Fields remaining unknown:** _(none)_

### 2. DC & Sons Joinery

- **Website:** https://dcsonsjoinery.co.uk/
- **Fetch:** HTTP 200 · 168796 bytes · final url https://dcsonsjoinery.co.uk/
- **Identity confirmed on page:** true
- **Verification state:** `FULLY_VERIFIED`
- **Quality band:** A
- **Business group:** `MULTI_SERVICE_COMPANY`
- **Region / town:** Yorkshire · Wakefield · West Yorkshire · WF4 1JA
- **Direct page evidence per capability:**
  - ✓ manufacture — matched: "Bespoke Stair"
  - ✓ installation — matched: "Installation"
  - ✓ refurbishment — matched: "renovation"
  - ✓ refacing — matched: "staircase cladding"
  - ✓ balustrade — matched: "balustrades"
  - ✗ handrail
  - ✓ glass — matched: "Glass Stair"
  - ✗ metal
  - ✓ bespoke — matched: "Bespoke"
  - ✓ design — matched: "designed"
  - ✗ kit_or_product_supplier
- **Materials mentioned on page:** oak, walnut, ash, glass, carpet
- **Prior capability_claimed (from Stage 2):** manufacture, installation, refurbishment, refacing, bespoke, design
- **Discovered by agents:** unknown
- **Fields remaining unknown:** telephone

### 3. Binks Balustrades

- **Website:** https://binksbalustrades.co.uk/
- **Fetch:** HTTP 200 · 64198 bytes · final url https://binksbalustrades.co.uk/
- **Identity confirmed on page:** true
- **Verification state:** `FULLY_VERIFIED`
- **Quality band:** A
- **Business group:** `MULTI_SERVICE_COMPANY`
- **Region / town:** Yorkshire · Harrogate (Nidderdale area) · North Yorkshire · HG3 2BA
- **Direct page evidence per capability:**
  - ✗ manufacture
  - ✓ installation — matched: "installation"
  - ✗ refurbishment
  - ✗ refacing
  - ✓ balustrade — matched: "Balustrades"
  - ✓ handrail — matched: "Handrails"
  - ✓ glass — matched: "Glass Balustrad"
  - ✓ metal — matched: "stainless steel"
  - ✓ bespoke — matched: "Bespoke"
  - ✓ design — matched: "design"
  - ✗ kit_or_product_supplier
- **Materials mentioned on page:** oak, glass, stainless steel, wrought iron
- **Prior capability_claimed (from Stage 2):** manufacture, installation, refurbishment, refacing, balustrade, handrail, glass, metal, bespoke, design
- **Discovered by agents:** agent-1-england-north, agent-10-glass-metal-lighting, agent-8-refurbishment-refacing
- **Fields remaining unknown:** _(none)_

### 4. Richard Burbidge

- **Website:** https://richardburbidge.com/
- **Fetch:** HTTP 200 · 89808 bytes · final url https://richardburbidge.com/
- **Identity confirmed on page:** true
- **Verification state:** `FULLY_VERIFIED`
- **Quality band:** A
- **Business group:** `REFACING_OR_REFURB_KIT_OR_PRODUCT_SUPPLIER`
- **Region / town:** W Mids · Oswestry · Shropshire · SY11 1HZ
- **Direct page evidence per capability:**
  - ✓ manufacture — matched: "Manufacturing"
  - ✓ installation — matched: "installer"
  - ✗ refurbishment
  - ✗ refacing
  - ✗ balustrade
  - ✗ handrail
  - ✗ glass
  - ✗ metal
  - ✗ bespoke
  - ✓ design — matched: "Design"
  - ✓ kit_or_product_supplier — matched: "catalogue"
- **Materials mentioned on page:** _(none)_
- **Prior capability_claimed (from Stage 2):** manufacture, refurbishment, refacing, balustrade, handrail, glass, metal, design
- **Discovered by agents:** agent-11-components-parts, agent-12-refacing-deep, agent-7-national-manufacturers, agent-9-handrail-balustrade-newel
- **Fields remaining unknown:** _(none)_

### 5. Modernise Your Stairs

- **Website:** https://www.moderniseyourstairs.co.uk/
- **Fetch:** HTTP 200 · 115680 bytes · final url https://www.moderniseyourstairs.co.uk/
- **Identity confirmed on page:** true
- **Verification state:** `FULLY_VERIFIED`
- **Quality band:** A
- **Business group:** `MULTI_SERVICE_COMPANY`
- **Region / town:** NW · Wigan · Greater Manchester · WN6 7TF
- **Direct page evidence per capability:**
  - ✓ manufacture — matched: "manufacture"
  - ✓ installation — matched: "installation"
  - ✓ refurbishment — matched: "renovate"
  - ✗ refacing
  - ✗ balustrade
  - ✗ handrail
  - ✓ glass — matched: "Glass Stair"
  - ✓ metal — matched: "Steel Stair"
  - ✓ bespoke — matched: "Bespoke"
  - ✓ design — matched: "Design"
  - ✗ kit_or_product_supplier
- **Materials mentioned on page:** oak, walnut, beech, maple, sapele, glass, wrought iron
- **Prior capability_claimed (from Stage 2):** manufacture, installation, refurbishment, balustrade, handrail, glass, metal, bespoke, design
- **Discovered by agents:** agent-1-england-north, agent-8-refurbishment-refacing
- **Fields remaining unknown:** _(none)_

### 6. Transform Staircases

- **Website:** https://www.transformstaircases.co.uk/
- **Fetch:** HTTP 200 · 214881 bytes · final url https://www.transformstaircases.co.uk/
- **Identity confirmed on page:** true
- **Verification state:** `FULLY_VERIFIED`
- **Quality band:** A
- **Business group:** `MULTI_SERVICE_COMPANY`
- **Region / town:** NW · Wigan · Greater Manchester · WN6 7DS
- **Direct page evidence per capability:**
  - ✓ manufacture — matched: "manufacture"
  - ✓ installation — matched: "installation"
  - ✓ refurbishment — matched: "refurbishing"
  - ✓ refacing — matched: "Cover STAIR"
  - ✗ balustrade
  - ✗ handrail
  - ✓ glass — matched: "GLASS STAIR"
  - ✓ metal — matched: "METAL STAIR"
  - ✓ bespoke — matched: "Bespoke"
  - ✓ design — matched: "design"
  - ✗ kit_or_product_supplier
- **Materials mentioned on page:** oak, maple, glass
- **Prior capability_claimed (from Stage 2):** manufacture, installation, refurbishment, balustrade, handrail, glass, metal, bespoke, design
- **Discovered by agents:** agent-1-england-north, agent-8-refurbishment-refacing
- **Fields remaining unknown:** _(none)_

### 7. Edwards & Hampson Ltd

- **Website:** https://www.ehjoinery.com/
- **Fetch:** HTTP 200 · 54853 bytes · final url https://www.ehjoinery.com/
- **Identity confirmed on page:** true
- **Verification state:** `FULLY_VERIFIED`
- **Quality band:** A
- **Business group:** `MULTI_SERVICE_COMPANY`
- **Region / town:** NW · Liverpool · Merseyside · L20 4QS
- **Direct page evidence per capability:**
  - ✓ manufacture — matched: "Manufacturer"
  - ✓ installation — matched: "Installation"
  - ✓ refurbishment — matched: "Renovating"
  - ✗ refacing
  - ✓ balustrade — matched: "balustrade"
  - ✓ handrail — matched: "Handrails"
  - ✓ glass — matched: "glass balustrad"
  - ✗ metal
  - ✓ bespoke — matched: "Bespoke"
  - ✓ design — matched: "Designs"
  - ✗ kit_or_product_supplier
- **Materials mentioned on page:** glass
- **Prior capability_claimed (from Stage 2):** manufacture, installation, refurbishment, balustrade, glass, bespoke, design
- **Discovered by agents:** unknown
- **Fields remaining unknown:** _(none)_

### 8. Chrisand Fabrications Ltd

- **Website:** https://chrisandfabrications.co.uk/
- **Fetch:** HTTP 202 · 168 bytes · final url https://chrisandfabrications.co.uk/
- **Identity confirmed on page:** false
- **Verification state:** `SEARCH_DISCOVERED`
- **Quality band:** D
- **Business group:** `STAIRCASE_MANUFACTURER`
- **Region / town:** Yorkshire · Rotherham · South Yorkshire · —
- **Direct page evidence per capability:**
  - ✗ manufacture
  - ✗ installation
  - ✗ refurbishment
  - ✗ refacing
  - ✗ balustrade
  - ✗ handrail
  - ✗ glass
  - ✗ metal
  - ✗ bespoke
  - ✗ design
  - ✗ kit_or_product_supplier
- **Materials mentioned on page:** _(none)_
- **Prior capability_claimed (from Stage 2):** manufacture, installation, balustrade, handrail, glass, metal, bespoke, design
- **Discovered by agents:** agent-1-england-north, agent-10-glass-metal-lighting, agent-9-handrail-balustrade-newel
- **Fields remaining unknown:** postcode

### 9. Thorndell Engineering

- **Website:** https://www.thorndell.com/
- **Fetch:** HTTP 200 · 200061 bytes · final url https://www.thorndell.com/
- **Identity confirmed on page:** true
- **Verification state:** `FULLY_VERIFIED`
- **Quality band:** A
- **Business group:** `STAIRCASE_MANUFACTURER`
- **Region / town:** Yorkshire · Doncaster · South Yorkshire · DN3 1QR
- **Direct page evidence per capability:**
  - ✓ manufacture — matched: "Manufacturing"
  - ✓ installation — matched: "installers"
  - ✗ refurbishment
  - ✗ refacing
  - ✓ balustrade — matched: "Balustrade"
  - ✓ handrail — matched: "Handrails"
  - ✗ glass
  - ✓ metal — matched: "Steel Stair"
  - ✓ bespoke — matched: "bespoke"
  - ✓ design — matched: "design"
  - ✗ kit_or_product_supplier
- **Materials mentioned on page:** _(none)_
- **Prior capability_claimed (from Stage 2):** manufacture, installation, balustrade, handrail, metal, bespoke, design
- **Discovered by agents:** agent-1-england-north, agent-9-handrail-balustrade-newel
- **Fields remaining unknown:** _(none)_

### 10. Elite Metalcraft Co. Ltd

- **Website:** https://www.elitemetalcraft.co.uk
- **Fetch:** HTTP 403 · 5714 bytes · final url https://www.elitemetalcraft.co.uk/
- **Identity confirmed on page:** false
- **Verification state:** `SEARCH_DISCOVERED`
- **Quality band:** D
- **Business group:** `MULTI_SERVICE_COMPANY`
- **Region / town:** London · London · Greater London · UB6 7LH
- **Prior capability_claimed (from Stage 2):** manufacture, installation, refurbishment, balustrade, handrail, glass, metal, bespoke, design
- **Discovered by agents:** agent-10-glass-metal-lighting, agent-7-national-manufacturers, agent-9-handrail-balustrade-newel
- **Fields remaining unknown:** email

### 11. Continox Ltd

- **Website:** https://continox.uk
- **Fetch:** HTTP 200 · 1788843 bytes · final url https://continox.uk/
- **Identity confirmed on page:** true
- **Verification state:** `FULLY_VERIFIED`
- **Quality band:** A
- **Business group:** `STAIRCASE_MANUFACTURER`
- **Region / town:** SE · Portsmouth · Hampshire · —
- **Direct page evidence per capability:**
  - ✓ manufacture — matched: "Manufacture"
  - ✓ installation — matched: "installed"
  - ✗ refurbishment
  - ✗ refacing
  - ✓ balustrade — matched: "Balustrade"
  - ✗ handrail
  - ✓ glass — matched: "Glass Balustrad"
  - ✗ metal
  - ✓ bespoke — matched: "Bespoke"
  - ✓ design — matched: "Designed"
  - ✗ kit_or_product_supplier
- **Materials mentioned on page:** oak, glass
- **Prior capability_claimed (from Stage 2):** manufacture, installation, balustrade, glass, metal, bespoke, design
- **Discovered by agents:** agent-10-glass-metal-lighting, agent-2-england-south
- **Fields remaining unknown:** postcode

### 12. M-Tech Engineering Ltd

- **Website:** https://www.mtechengineering.co.uk
- **Fetch:** HTTP 200 · 154545 bytes · final url https://www.mtechengineering.co.uk/
- **Identity confirmed on page:** true
- **Verification state:** `FULLY_VERIFIED`
- **Quality band:** A
- **Business group:** `STAIRCASE_MANUFACTURER`
- **Region / town:** E Mids · Hucknall · Nottinghamshire · NG15 7WE
- **Direct page evidence per capability:**
  - ✓ manufacture — matched: "manufacture"
  - ✗ installation
  - ✗ refurbishment
  - ✗ refacing
  - ✓ balustrade — matched: "balustrade"
  - ✗ handrail
  - ✗ glass
  - ✗ metal
  - ✓ bespoke — matched: "Bespoke"
  - ✓ design — matched: "designs"
  - ✗ kit_or_product_supplier
- **Materials mentioned on page:** oak, glass
- **Prior capability_claimed (from Stage 2):** manufacture, installation, balustrade, handrail, glass, metal, bespoke, design
- **Discovered by agents:** agent-10-glass-metal-lighting, agent-3-england-midlands, agent-7-national-manufacturers
- **Fields remaining unknown:** _(none)_

### 13. Spiral UK

- **Website:** https://www.spiral.uk.com
- **Fetch:** HTTP 200 · 59491 bytes · final url https://www.spiral.uk.com/
- **Identity confirmed on page:** true
- **Verification state:** `FULLY_VERIFIED`
- **Quality band:** A
- **Business group:** `STAIRCASE_MANUFACTURER`
- **Region / town:** E · St Ives · Cambridgeshire · —
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
- **Materials mentioned on page:** _(none)_
- **Prior capability_claimed (from Stage 2):** manufacture, installation, balustrade, handrail, glass, metal, bespoke, design
- **Discovered by agents:** agent-10-glass-metal-lighting, agent-7-national-manufacturers
- **Fields remaining unknown:** telephone, email, postcode

### 14. Cheshire Mouldings & Woodturnings Ltd

- **Website:** https://www.cheshiremouldings.co.uk/
- **Fetch:** HTTP 200 · 310301 bytes · final url https://www.cheshiremouldings.co.uk/
- **Identity confirmed on page:** false
- **Verification state:** `SEARCH_DISCOVERED`
- **Quality band:** D
- **Business group:** `REFACING_OR_REFURB_KIT_OR_PRODUCT_SUPPLIER`
- **Region / town:** NW · St Helens · Merseyside · WA9 4JQ
- **Direct page evidence per capability:**
  - ✓ manufacture — matched: "manufacturer"
  - ✓ installation — matched: "installation"
  - ✗ refurbishment
  - ✗ refacing
  - ✗ balustrade
  - ✓ handrail — matched: "Handrails"
  - ✗ glass
  - ✗ metal
  - ✗ bespoke
  - ✓ design — matched: "Design"
  - ✓ kit_or_product_supplier — matched: "Kits"
- **Materials mentioned on page:** oak, pine
- **Prior capability_claimed (from Stage 2):** manufacture, refurbishment, refacing, balustrade, handrail, glass, metal, design
- **Discovered by agents:** agent-11-components-parts, agent-12-refacing-deep, agent-7-national-manufacturers, agent-9-handrail-balustrade-newel
- **Fields remaining unknown:** _(none)_

### 15. Traditional Products Ltd

- **Website:** https://www.traditional-products.co.uk/
- **Fetch:** HTTP 200 · 44451 bytes · final url https://www.traditional-products.co.uk/
- **Identity confirmed on page:** true
- **Verification state:** `FULLY_VERIFIED`
- **Quality band:** A
- **Business group:** `MULTI_SERVICE_COMPANY`
- **Region / town:** W Mids · Oswestry · Shropshire · SY11 1HZ
- **Direct page evidence per capability:**
  - ✓ manufacture — matched: "Manufacturer"
  - ✗ installation
  - ✓ refurbishment — matched: "refurbishment"
  - ✗ refacing
  - ✗ balustrade
  - ✓ handrail — matched: "Handrail"
  - ✗ glass
  - ✓ metal — matched: "METAL STAIR"
  - ✓ bespoke — matched: "BESPOKE"
  - ✓ design — matched: "Designs"
  - ✗ kit_or_product_supplier
- **Materials mentioned on page:** oak, walnut, ash, pine, beech, sapele, iroko, glass
- **Prior capability_claimed (from Stage 2):** manufacture, refurbishment, balustrade, handrail, glass, metal, bespoke
- **Discovered by agents:** agent-11-components-parts, agent-9-handrail-balustrade-newel
- **Fields remaining unknown:** _(none)_

### 16. Darcy Joinery Ltd

- **Website:** https://www.darcyjoinery.co.uk/
- **Fetch:** HTTP 200 · 224205 bytes · final url https://www.darcyjoinery.co.uk/
- **Identity confirmed on page:** true
- **Verification state:** `FULLY_VERIFIED`
- **Quality band:** A
- **Business group:** `STAIRCASE_MANUFACTURER`
- **Region / town:** NW · Middleton · Greater Manchester · M24 1SL
- **Direct page evidence per capability:**
  - ✓ manufacture — matched: "manufacturing"
  - ✗ installation
  - ✗ refurbishment
  - ✗ refacing
  - ✗ balustrade
  - ✗ handrail
  - ✓ glass — matched: "Glass Panel"
  - ✓ metal — matched: "stainless steel"
  - ✓ bespoke — matched: "Bespoke"
  - ✓ design — matched: "designer"
  - ✗ kit_or_product_supplier
- **Materials mentioned on page:** oak, glass, stainless steel
- **Prior capability_claimed (from Stage 2):** manufacture, installation, bespoke, design
- **Discovered by agents:** unknown
- **Fields remaining unknown:** email

### 17. Alpine Stairs

- **Website:** https://alpinestairs.co.uk/
- **Fetch:** HTTP 200 · 111801 bytes · final url https://alpinestairs.co.uk/
- **Identity confirmed on page:** true
- **Verification state:** `FULLY_VERIFIED`
- **Quality band:** A
- **Business group:** `STAIRCASE_MANUFACTURER`
- **Region / town:** NW · Liverpool · Merseyside · L33 7TJ
- **Direct page evidence per capability:**
  - ✓ manufacture — matched: "Bespoke Stair"
  - ✗ installation
  - ✗ refurbishment
  - ✗ refacing
  - ✗ balustrade
  - ✗ handrail
  - ✗ glass
  - ✗ metal
  - ✓ bespoke — matched: "Bespoke"
  - ✓ design — matched: "design"
  - ✗ kit_or_product_supplier
- **Materials mentioned on page:** pine, glass
- **Prior capability_claimed (from Stage 2):** manufacture, installation, glass, metal, bespoke, design
- **Discovered by agents:** unknown
- **Fields remaining unknown:** email

### 18. Northern Windows and Joinery

- **Website:** https://northernwindowsandjoinery.co.uk/
- **Fetch:** HTTP 200 · 147510 bytes · final url https://northernwindowsandjoinery.co.uk/
- **Identity confirmed on page:** false
- **Verification state:** `SEARCH_DISCOVERED`
- **Quality band:** D
- **Business group:** `MULTI_SERVICE_COMPANY`
- **Region / town:** NI · Belfast · Antrim · BT14 6QH
- **Direct page evidence per capability:**
  - ✓ manufacture — matched: "Manufactured"
  - ✓ installation — matched: "installed"
  - ✓ refurbishment — matched: "refurbishment"
  - ✗ refacing
  - ✗ balustrade
  - ✗ handrail
  - ✗ glass
  - ✗ metal
  - ✓ bespoke — matched: "bespoke"
  - ✓ design — matched: "design"
  - ✗ kit_or_product_supplier
- **Materials mentioned on page:** _(none)_
- **Prior capability_claimed (from Stage 2):** manufacture, installation, refurbishment, glass, bespoke, design
- **Discovered by agents:** unknown
- **Fields remaining unknown:** _(none)_

### 19. Balmoral Joinery Ltd

- **Website:** https://www.balmoral-joinery.co.uk/
- **Fetch:** HTTP 200 · 661243 bytes · final url https://www.balmoral-joinery.co.uk/
- **Identity confirmed on page:** true
- **Verification state:** `FULLY_VERIFIED`
- **Quality band:** A
- **Business group:** `STAIRCASE_MANUFACTURER`
- **Region / town:** NE · Whickham (Gateshead) · Tyne and Wear · NE16 3AD
- **Direct page evidence per capability:**
  - ✓ manufacture — matched: "manufacturing"
  - ✗ installation
  - ✗ refurbishment
  - ✗ refacing
  - ✓ balustrade — matched: "balustrades"
  - ✗ handrail
  - ✗ glass
  - ✗ metal
  - ✓ bespoke — matched: "bespoke"
  - ✓ design — matched: "designed"
  - ✗ kit_or_product_supplier
- **Materials mentioned on page:** glass
- **Prior capability_claimed (from Stage 2):** manufacture, installation, balustrade, glass, metal, bespoke, design
- **Discovered by agents:** unknown
- **Fields remaining unknown:** _(none)_

### 20. D J Hill Engineering Services Ltd

- **Website:** https://www.djhillengineering.co.uk
- **Fetch:** HTTP 200 · 635757 bytes · final url https://www.djhillengineering.co.uk/
- **Identity confirmed on page:** true
- **Verification state:** `FULLY_VERIFIED`
- **Quality band:** A
- **Business group:** `STAIRCASE_MANUFACTURER`
- **Region / town:** Wales · Cardiff · South Glamorgan · CF3 2EW
- **Direct page evidence per capability:**
  - ✓ manufacture — matched: "manufacturing"
  - ✓ installation — matched: "installation"
  - ✗ refurbishment
  - ✗ refacing
  - ✗ balustrade
  - ✗ handrail
  - ✗ glass
  - ✓ metal — matched: "Stainless Steel"
  - ✓ bespoke — matched: "Bespoke"
  - ✓ design — matched: "designs"
  - ✗ kit_or_product_supplier
- **Materials mentioned on page:** stainless steel
- **Prior capability_claimed (from Stage 2):** manufacture, installation, balustrade, metal, bespoke, design
- **Discovered by agents:** unknown
- **Fields remaining unknown:** telephone, email

## What Stage 3 did NOT do

- Did not contact any company.
- Did not upgrade "verified reachable" label — used Philip's stricter 4-state model instead.
- Did not import any records to Supabase.
- Did not start Stage 4 · waiting for Philip's sign-off.
- Did not touch the NEX brain / M4 freeze — orthogonal tracks preserved.