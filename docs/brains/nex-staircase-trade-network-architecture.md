# NEX Staircase Trade Network Architecture

**Purpose:** Design layer for NEX's connection between customers, staircase makers, installers, surveyors, architects, interior designers, builders, apprentices and specialist suppliers.

Not a knowledge base — a **network**. Every actor in the staircase industry has a first-class profile in NEX, and NEX's job is to route work, projects, apprentices and materials between them.

---

## The problem this solves

The staircase industry is fragmented. A homeowner starting a project touches:

1. **Design decisions** → often no professional consulted, or an architect who doesn't specialise in stairs
2. **Manufacturer** → chosen from Google, no real quality signal
3. **Installer** → often the manufacturer's own team, or a builder's contact
4. **Materials suppliers** → chosen by manufacturer, invisible to homeowner
5. **Aftercare** → nobody's responsibility once the invoice is paid

The industry side is worse:
- Small workshops with excellent craft have no distribution
- Installers travel to whichever manufacturer calls first
- Apprentices cannot find the workshops that would take them
- Manufacturers can't find installers, and vice versa
- Cancelled orders and spare parts have no market

NEX's role: the connection layer that makes these relationships discoverable and trustworthy.

---

## Actor profiles

### 1. Staircase manufacturers

```
company_name
region + town + postcode
years_trading
speciality: [traditional | modern | glass | floating | oak | commercial]
services: [design | manufacture | installation | renovation | surveying]
capacity: [small_workshop | medium_manufacturer | large_production]
workshop_photos[]
portfolio[]                  # completed projects with photos
materials_used[]
certifications[]
insurance
reviews[]
average_response_time
NEX network score (see below)
```

### 2. Independent stair makers (small workshops)

Same fields as manufacturer plus:
- `owner_name` — often a one-person or family business
- `craft_categories`:
  - **Traditional craftsman** → mortise joints, turned spindles, hardwood stairs
  - **Modern stair specialist** → floating, glass, metal, minimal
  - **Renovation specialist** → oak caps, balustrade replacement, upgrades

Small workshops are the industry's craft backbone but often invisible online. Getting them discoverable is one of NEX's highest-value contributions.

### 3. Installers

```
installer_name / company
location + travel_radius (miles)
experience_types: [new_stairs | renovations | glass | oak | floating | curved | spiral]
insurance (public liability + trade)
reviews[]
availability_calendar (integration or manual)
tier: platinum | gold | new
```

**Tier definitions:**
- **Platinum** — verified identity + business + insurance + excellent review pattern + photos
- **Gold** — experienced + good feedback + basic verification
- **New Installer** — building portfolio, in apprenticeship or transition

Tier is a trust signal for customers, not a quality judgment. New installers must be able to enter the network — the ladder is the value.

### 4. Surveyors

```
surveyor_name
region + travel_radius
tools: [laser_measurement | 3D_scanner | traditional_tape]
outputs: [CAD_drawings | PDF_report | measured_sketch]
building_experience_years
stair_experience_years
insurance
```

Measurement errors are the leading source of expensive staircase mistakes. Specialist stair surveyors are a distinct role from general building surveyors — they know what to measure (finished floor levels, wall out-of-square, opening variation at different heights).

### 5. Architects

```
practice_name
location
style_focus: [modern | traditional | luxury | heritage]
project_types: [new_build | renovation | extension | listed_building]
```

Architects influence premium staircase sales. A staircase company on an architect's approved-supplier list wins jobs before quotes are ever exchanged.

### 6. Interior designers

```
designer_name
location
design_style: [modern | traditional | farmhouse | minimalist | luxury_contemporary]
typical_project_size
```

Interior designers drive premium package sales because their clients expect a finished result. A staircase quote in front of an interior designer typically converts at a higher price than the same quote in front of the homeowner.

### 7. Builders (subcontract channel)

```
builder_company
region
build_types: [extensions | new_homes | renovations | commercial]
staircase_needs_per_year
preferred_suppliers[]
```

Many builders do not manufacture stairs — they subcontract. Being on a builder's rolodex means repeat work without repeat sales effort.

### 8. Apprentices

```
name
age
location + willingness_to_travel
interest: [joinery | carpentry | CNC | design]
current_experience: [none | some_woodworking | qualified_joiner | experienced]
learning_track: [stair_joinery | CNC | design]
availability
portfolio (starter projects, sample work)
```

The staircase industry has an ageing workforce and a training gap. The apprentice profile turns "18-year-old looking for work" into "person interested in becoming a staircase specialist" — a much more compelling introduction to a workshop.

**Career ladder within the apprentice profile:**
- Year 1: workshop assistant (timber handling, tools, sanding, assembly)
- Year 2: stair apprentice (strings, treads, risers, newels)
- Year 3: advanced (CNC, CAD, installation)
- Year 5+: senior maker, designer, workshop manager, business owner

---

## Marketplace opportunities

The network structure enables specific marketplaces:

### Buy
- **Used staircases** — reclaimed period stairs, cancelled orders, ex-display
- **Timber stock** — end-of-line, cancelled bulk orders
- **Machinery** — small workshops upgrading, larger workshops selling old kit
- **Tools** — surplus and used

### Sell
- **Stair components** — spare handrails, newels, spindles
- **Cancelled orders** — near-finished bespoke stairs the workshop needs to move
- **Workshop capacity** — idle CNC time offered to other manufacturers

### Hire
- **Installers** — manufacturers who need a fitter for a specific job
- **CNC machines** — small workshops needing occasional CNC access
- **Spray booths** — outsourced finishing for small workshops

### Find
- **Apprentices** — workshops advertising positions matched against apprentice profiles
- **Employees** — permanent hires
- **Subcontractors** — one-off collaboration on a job

---

## NEX Network Score

Every professional profile in the network carries a composite score across:

| Dimension | Signal |
|---|---|
| **Experience** | Years trading + project count |
| **Material skill** | Range of species / systems handled |
| **Design skill** | Portfolio breadth and originality |
| **Installation skill** | Return-visit rate, defect rate |
| **Customer reviews** | Verified purchase + verified review |
| **Response time** | Time-to-first-reply on enquiries |
| **Location coverage** | Travel range × active project count |
| **Verified status** | Identity + business + insurance verification |

Score is composite but each dimension is visible so a customer choosing an installer can weight their own priorities.

---

## Trust protection rules

Two hard rules to prevent the network becoming a lead-selling scheme:

1. **Never sell leads.** NEX makes money from subscriptions and per-transaction marketplace fees — never from selling the same enquiry to multiple manufacturers. Consistent with the platform-wide rule in `CLAUDE.md`.

2. **Reviews must be from verified transactions.** A review posted by a customer who cannot be traced back to a real completed project does not appear. Fake reviews destroy trust in the whole network.

---

## Connection routing

The network's core routine: **enquiry → routed to matching professionals → customer chooses.**

Example: user says *"I want a modern oak and glass staircase in Leeds."*

NEX routes to:
1. **Manufacturers** — filtered by Leeds region + oak specialisation + glass capability + capacity
2. **Materials suppliers** — Howarth Timber (oak) + Latham (veneer sheets) + CRL (glass hardware) + Screwfix (fixings) from the merchant directory
3. **Installers** — Leeds-area installers with glass and oak experience, platinum tier first
4. **Interior designers** — Leeds-area designers with modern-luxury portfolio (optional add-on)

Customer sees a shortlist, not a single answer. The choice is theirs; NEX's job is to make sure the shortlist is any good.

---

## Data structure (future JSON files)

When the network is built:

```
data/staircase-network/
  manufacturers.json
  installers.json
  surveyors.json
  architects.json
  interior-designers.json
  builders.json
  apprentices.json
  marketplace-listings.json
```

Each file follows the actor profile schemas above. Cross-references (manufacturer preferred-installer relationships, apprentice-workshop matches) are stored as `related_ids` fields on the primary record.

---

## The vision

The staircase industry moves from a set of disconnected local businesses to a **network**. A homeowner in Leeds who does not know a single staircase professional today can, through NEX, find:

- A designer to talk through the idea
- A manufacturer with the craft to build it
- The materials suppliers who stock what the design needs
- An installer with the right specialisation
- A digital passport that records who did what for future resale

For the industry side, the same network gives:

- Manufacturers a route to customers beyond Google Ads
- Installers a route to steady work beyond word-of-mouth
- Apprentices a route into the industry
- Small workshops distribution equal to volume players
- Suppliers visibility on the projects that will need their stock

That is the difference between a chatbot that answers staircase questions and an operating system for the staircase industry.
