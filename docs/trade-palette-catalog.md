# Trade → Palette Catalog

Canonical mapping of UK trades to canteen palettes. Locked-in refs prevent live-editing colour surprises. Every REF is Philip-confirmed before it enters this file.

**How this works:**
- Every trade gets a REF (`TP-XX`) mapped to one of the 20 palettes
- Palettes are defined in `src/lib/paletteTokens.ts` (single source of truth)
- Multiple trades can share a palette (Slate serves plumber + tiler + glazier + damp + drainage)
- Row status: ✅ live = demo canteen shipped; 🔜 planned = confirmed REF, not yet seeded; ⏳ pending = awaiting Philip's confirm

## Palettes (20 total, 5 currently ready)

Ordered by mood spectrum — light warm → cool → neutral → dark → signal.

### Light warm (6)
| Slug | Name | Bg | Accent | Personality | Ready? |
|---|---|---|---|---|---|
| `chalk` | Chalk | `#FBF6EC` | `#B8860B` warm gold | Domestic warmth, kitchen/bath | ✅ |
| `oak` | Oak | `#F5EDDF` | `#8B5A2B` medium brown | Natural wood craft | ✅ |
| `blush` | Blush | `#FDF2F0` | `#C2564E` terracotta | Boutique, feminine-warm, soft furnishings | 🔜 |
| `sandstone` | Sandstone | `#F5E9D3` | `#A0522D` sienna | Heritage stone, lime plaster, listed buildings | 🔜 |
| `brick` | Brick | `#FBEEE6` | `#B7451D` rust | Traditional warm structural, tile roofs | 🔜 |
| `copper` | Copper | `#F5EFE6` | `#B87333` copper | Artisan metalwork, patina heritage | 🔜 |

### Light cool (5)
| Slug | Name | Bg | Accent | Personality | Ready? |
|---|---|---|---|---|---|
| `slate` | Slate | `#EEF2F7` | `#1E3A8A` navy | Water precision, cool professional | ✅ |
| `aqua` | Aqua | `#ECFEFF` | `#0891B2` teal | Pool/spa, leisure water | 🔜 |
| `moss` | Moss | `#F2F5EA` | `#4A5D23` deep green | Outdoors alive, utility green | 🔜 |
| `emerald` | Emerald | `#F0FDF4` | `#059669` bright emerald | Luxury outdoors, prestige gardens | ✅ |
| `steel` | Steel | `#EEF2F5` | `#0284C7` electric blue | Metalwork precision, welding | 🔜 |

### Light neutral (3)
| Slug | Name | Bg | Accent | Personality | Ready? |
|---|---|---|---|---|---|
| `ink` | Ink | `#FAFAFA` | `#0A0A0A` pure black | Minimalist, architectural, corporate | 🔜 |
| `concrete` | Concrete | `#E8E8E5` | `#F97316` safety orange | Modern brutalist, on-site concrete | 🔜 |
| `mortar` | Mortar | `#F3F4F6` | `#525252` charcoal | Structural stone, masonry | 🔜 |

### Dark (5)
| Slug | Name | Bg | Accent | Personality | Ready? |
|---|---|---|---|---|---|
| `iron` | Iron | `#0F0F0F` | `#FFB300` amber | Safety-critical technical (Gas Safe, electric) | ✅ |
| `charcoal` | Charcoal | `#1F1F1F` | `#D97706` warm copper | Industrial-luxe, prestige builders | 🔜 |
| `timber` | Timber | `#1F1410` | `#B8722E` bronze | Bespoke luxury craft, fine joinery | ✅ |
| `marine` | Marine | `#0F1F3D` | `#FBBF24` brass | Marina, dock, boat carpentry | 🔜 |
| `storm` | Storm | `#1E293B` | `#F59E0B` amber warning | Storm damage repair, emergency trades | 🔜 |

### Signal / accent (1)
| Slug | Name | Bg | Accent | Personality | Ready? |
|---|---|---|---|---|---|
| `hi-vis` | Hi-Vis | `#FEF3C7` | `#F59E0B` hi-vis orange | Active site, groundwork, safety | 🔜 |

## Trade REFs

### Live (Philip-confirmed 2026-07-15 — demo canteens shipped)
| REF | Trade | Palette | Demo merchant | Status |
|---|---|---|---|---|
| TP-01 | Kitchen fitter | Chalk | Mike Watson (Manchester) | ✅ live |
| TP-02 | Electrician | Iron | Craig McDermott (Leeds) | ✅ live |
| TP-03 | Plumber | Slate | James Holt (Nottingham) | ✅ live |

### Locked ✅ (Philip-confirmed 2026-07-15 — "i follow your recommendations")

All TP-04 through TP-117 (114 trades) are Philip-approved as drafted below. Delegation confirm given via "i follow your recommendations". Any future change requires a new REF confirm.

Trades grouped by best-fit palette.

#### Chalk (light warm — domestic warmth)
| REF | Trade |
|---|---|
| TP-04 | Bathroom fitter |
| TP-05 | Painter / decorator (interior) |
| TP-06 | Wallpaper hanger |
| TP-07 | Curtains / blinds |
| TP-08 | Kitchen designer |

#### Oak (light warm — natural wood)
| REF | Trade |
|---|---|
| TP-09 | Carpenter (1st fix — structural) |
| TP-10 | Carpenter (2nd fix — finishing) |
| TP-11 | Flooring fitter (hardwood) |
| TP-12 | Flooring fitter (laminate) |
| TP-13 | Shopfitter |
| TP-14 | Cabinet maker |

#### Blush (light warm — boutique)
| REF | Trade |
|---|---|
| TP-15 | Interior designer |
| TP-16 | Home stager |
| TP-17 | Soft furnishings specialist |

#### Sandstone (light warm — heritage)
| REF | Trade |
|---|---|
| TP-18 | Stone restoration specialist |
| TP-19 | Lime plaster specialist |
| TP-20 | Listed building specialist |
| TP-21 | Period property specialist |

#### Brick (light warm — traditional structural)
| REF | Trade |
|---|---|
| TP-22 | Roofer (tile) |
| TP-23 | Roofer (slate) |
| TP-24 | Guttering / fascia / soffit |
| TP-25 | Chimney builder |
| TP-26 | Stove installer (wood burner) |
| TP-27 | Fireplace specialist |
| TP-28 | Building merchant |
| TP-29 | Timber merchant |
| TP-30 | Driveway / block paving |

#### Copper (light warm — artisan metal)
| REF | Trade |
|---|---|
| TP-31 | Coppersmith |
| TP-32 | Lead worker / roofer (copper/lead) |
| TP-33 | Metal artisan / bespoke ironwork |

#### Slate (light cool — water/precision)
| REF | Trade |
|---|---|
| TP-34 | Tiler (wall/floor) |
| TP-35 | Glazier |
| TP-36 | Mirror specialist |
| TP-37 | Damp specialist |
| TP-38 | Waterproofer / tanker (basement) |
| TP-39 | Drainage engineer |
| TP-40 | Chimney sweep |
| TP-41 | Bi-fold door specialist |

#### Aqua (light cool — pool/spa)
| REF | Trade |
|---|---|
| TP-42 | Pool builder |
| TP-43 | Hot tub installer |
| TP-44 | Spa fitter |
| TP-45 | Pond / water feature specialist |

#### Moss (light cool — outdoors utility)
| REF | Trade |
|---|---|
| TP-46 | Landscaper |
| TP-47 | Gardener (maintenance) |
| TP-48 | Arborist / tree surgeon |
| TP-49 | Fencing specialist |
| TP-50 | Artificial grass fitter |
| TP-51 | Hedge trimmer |

#### Emerald (light cool — luxury outdoors)
| REF | Trade |
|---|---|
| TP-52 | Luxury landscaper / high-end garden designer |
| TP-53 | Orangery / conservatory specialist |
| TP-54 | Outdoor kitchen builder |

#### Steel (light cool — metalwork precision)
| REF | Trade |
|---|---|
| TP-55 | Welder / metal fabricator |
| TP-56 | Structural steel erector |
| TP-57 | Gate specialist (metal) |
| TP-58 | Balustrade / handrail specialist |

#### Ink (light neutral — architectural minimalist)
| REF | Trade |
|---|---|
| TP-59 | Architect |
| TP-60 | Structural engineer |
| TP-61 | Building surveyor |
| TP-62 | Party wall surveyor |
| TP-63 | Quantity surveyor |
| TP-64 | Planning consultant |

#### Concrete (light neutral — modern brutalist)
| REF | Trade |
|---|---|
| TP-65 | Concrete specialist |
| TP-66 | Formwork / shuttering |
| TP-67 | Resin flooring specialist |
| TP-68 | Polished concrete floor |

#### Mortar (light neutral — structural stone)
| REF | Trade |
|---|---|
| TP-69 | Bricklayer |
| TP-70 | Stonemason |
| TP-71 | Plasterer (skim) |
| TP-72 | Plasterer (render) |
| TP-73 | Rendering specialist (K-Rend, silicone) |

#### Iron (dark — safety-critical technical)
| REF | Trade |
|---|---|
| TP-74 | Electrician (commercial/industrial) |
| TP-75 | Heating engineer (Gas Safe) |
| TP-76 | HVAC / air-conditioning |
| TP-77 | EV charger installer |
| TP-78 | Boiler engineer |
| TP-79 | Locksmith |
| TP-80 | Alarm / security installer |
| TP-81 | CCTV installer |
| TP-82 | Smart home installer |
| TP-83 | Data cabling |
| TP-84 | Solar PV installer |
| TP-85 | Heat pump installer |
| TP-86 | Battery storage installer |
| TP-87 | Safe engineer |

#### Charcoal (dark — industrial-luxe)
| REF | Trade |
|---|---|
| TP-88 | Prestige builder (high-end renovations) |
| TP-89 | Luxury showroom fitter |
| TP-90 | Home cinema installer |

#### Timber (dark — bespoke luxury craft)
| REF | Trade |
|---|---|
| TP-91 | Bespoke joiner (workshop) |
| TP-92 | Furniture maker |
| TP-93 | Kitchen worktop specialist |
| TP-94 | Staircase specialist |
| TP-95 | Sash window restorer |
| TP-96 | Door restoration specialist |

#### Marine (dark — dock/marine)
| REF | Trade |
|---|---|
| TP-97 | Marina / dock builder |
| TP-98 | Boat carpenter / shipwright |
| TP-99 | Marine electrician |

#### Storm (dark — emergency/repair)
| REF | Trade |
|---|---|
| TP-100 | Storm damage repair |
| TP-101 | Roofer (flat / EPDM / GRP) |
| TP-102 | Emergency plumber (24hr) |
| TP-103 | Emergency electrician (24hr) |

#### Hi-Vis (signal — active site)
| REF | Trade |
|---|---|
| TP-104 | Groundworker |
| TP-105 | Scaffolder |
| TP-106 | Demolition contractor |
| TP-107 | Handyman / property maintenance |
| TP-108 | Asbestos removal |
| TP-109 | Mold / mould remediation |
| TP-110 | Waste / skip hire |
| TP-111 | Plant hire |
| TP-112 | Tool hire |
| TP-113 | Machinery hire |
| TP-114 | Pest control |
| TP-115 | Cleaner (builder clean) |
| TP-116 | Removals / house clearance |
| TP-117 | Signwriter / vinyl wraps |

## Rules

1. **Never live-edit palette assignments.** Every change updates this doc first, gets Philip's confirm by REF, then edits code.
2. **Never modify `paletteTokens.ts` hex values without a REF and a confirm.** These are the merchant's brand.
3. Palettes can serve multiple trades — that's expected. Do not fork colours per trade.
4. New palette additions go into `paletteTokens.ts` AND this catalog with a REF number in one PR.
5. Adding a NEW palette to the 20-set requires Philip's explicit approval — the 20-palette lock-in (2026-07-15) is intentional.
