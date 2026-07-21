// /planning/[project] — Planning Permission Checker.
//
// Highest-search-intent tool in construction SEO after cost calculators.
// "Do I need planning permission for..." queries drive ~50k UK searches
// per month combined. Competitors mostly cover this in generic blog
// posts — we deliver a decision-tree answer per project + PD boundaries
// + Building Regs cross-reference.
//
// Every answer is UK-specific + updated for the 2020 GPDO amendments.

export type PlanningProject =
  | "kitchen-extension"
  | "loft-conversion"
  | "conservatory"
  | "porch"
  | "outbuilding"
  | "garage-conversion"
  | "driveway"
  | "solar-panels"
  | "chimney-removal"
  | "internal-wall-removal";

export const PLANNING_PROJECTS: PlanningProject[] = [
  "kitchen-extension", "loft-conversion", "conservatory", "porch",
  "outbuilding", "garage-conversion", "driveway", "solar-panels",
  "chimney-removal", "internal-wall-removal"
];

export type PermissionVerdict = "usually_pd" | "sometimes_pd" | "usually_planning" | "always_planning";

export type PlanningContent = {
  singular:    string;
  headline:    string;
  /** ~40-word expert answer — AI-snippet ready. */
  aiAnswer:    string;
  /** Overall verdict for the typical case. */
  verdict:     PermissionVerdict;
  /** Decision-tree bullets: when PD applies + when planning is required. */
  pdApplies:   string[];
  planningNeeded: string[];
  /** Building Regs applicability. */
  buildingRegs: string;
  /** Party Wall consideration. */
  partyWall?:   string;
  /** Listed-building / conservation area override. */
  heritageNote?: string;
  /** 6 FAQs. */
  faqs:         { q: string; a: string }[];
  /** Cross-links. */
  relatedCost?: string;    // /cost/[slug]
  relatedTrades: string[];
};

const VERDICT_LABEL: Record<PermissionVerdict, { chip: string; body: string; color: string }> = {
  usually_pd:       { chip: "Usually Permitted Development",      body: "No planning permission needed in most cases", color: "#166534" },
  sometimes_pd:     { chip: "Sometimes Permitted Development",    body: "Depends on size + house type — check conditions", color: "#B8860B" },
  usually_planning: { chip: "Usually needs Planning Permission",  body: "Full planning application required in most cases", color: "#B91C1C" },
  always_planning:  { chip: "Always needs Planning Permission",   body: "No PD rights — full planning always required", color: "#B91C1C" }
};

export function verdictInfo(v: PermissionVerdict) { return VERDICT_LABEL[v]; }

export const PLANNING_CONTENT: Record<PlanningProject, PlanningContent> = {
  "kitchen-extension": {
    singular:  "kitchen extension",
    headline:  "Do I need planning permission for a kitchen extension?",
    aiAnswer:  "Most single-storey rear kitchen extensions in the UK don't need planning permission — they fall under Permitted Development (PD) rights. Rear extensions up to 3m deep (semi-detached) or 4m (detached) are PD, subject to the Neighbour Consultation Scheme for larger sizes.",
    verdict:   "sometimes_pd",
    pdApplies: [
      "Rear extension up to 3m deep (semi/terraced) or 4m (detached), 3m high (eaves 3m from boundary)",
      "Single-storey only — two-storey extensions have separate 3m rear + 7m from rear boundary limits",
      "Uses less than 50% of the original garden area",
      "No verandas, balconies, or raised platforms above 300mm",
      "Materials 'similar in appearance' to the existing house"
    ],
    planningNeeded: [
      "Extending forward of the principal elevation (front extension)",
      "Wrap-around extension (rear + side combined)",
      "Any extension in a Designated Area (conservation area, National Park, AONB, Broads)",
      "Any extension to a Listed Building — always requires Listed Building Consent AND planning permission",
      "Rear extensions between 3-6m (semi) or 4-8m (detached) — Prior Approval via Neighbour Consultation Scheme"
    ],
    buildingRegs: "Building Regulations approval is ALWAYS required regardless of planning status. Covers structure (Part A), fire safety (Part B), thermal insulation (Part L), ventilation (Part F), electrical (Part P), and drainage (Part H).",
    partyWall:    "If any excavation is within 3m of a shared boundary wall (party wall) OR you're building against an existing party wall, you must serve a Party Wall Notice at least 2 months before starting work.",
    heritageNote: "Listed buildings + conservation areas have no PD rights for extensions. Full planning + Listed Building Consent required. Grade I + II* almost always refused for rear extensions.",
    faqs: [
      { q: "How big can I build a kitchen extension without planning permission?",   a: "Up to 3m deep for a semi-detached / terraced house, 4m deep for a detached house — single storey only, 3m eaves height. Sizes 3-6m (semi) or 4-8m (detached) need Prior Approval via the Neighbour Consultation Scheme (a lighter-touch process, not full planning)." },
      { q: "What's the Neighbour Consultation Scheme?",                              a: "A lightweight prior-approval process for larger rear extensions (3-6m semi / 4-8m detached). Your Local Planning Authority notifies your immediate neighbours and gives them 21 days to object. If no objections, approved. If objections, LPA rules." },
      { q: "How long does planning permission take?",                                a: "8 weeks for a householder application (standard rear extension). Larger or contested applications 13 weeks. Add 4-6 weeks for pre-application discussions if going the safe route." },
      { q: "How much does planning permission cost?",                                a: "£258 for a householder application (single dwelling) in England 2026. Wales £230, Scotland £202, NI £249. Add £2,500-£6,000 for architect drawings + planning consultant if used." },
      { q: "What if my extension is bigger than PD allows?",                         a: "You submit a full householder planning application (£258 fee, 8-week decision). Most well-designed applications succeed — LPAs approve ~80% of householder extensions. Grounds for refusal usually: overlooking, overshadowing, or design harm to conservation area." },
      { q: "Can I build without planning permission and apply retrospectively?",     a: "Legally you can, but risky. Enforcement notices can force removal. Retrospective applications succeed at a lower rate. Always cheaper + safer to check with your LPA first via a free pre-application enquiry." }
    ],
    relatedCost:  "kitchen-extension",
    relatedTrades: ["carpenter", "electrician", "plumber"]
  },
  "loft-conversion": {
    singular:  "loft conversion",
    headline:  "Do I need planning permission for a loft conversion?",
    aiAnswer:  "Most UK loft conversions don't need planning permission — Velux (rooflight-only) and rear dormers within volume limits (40m³ terrace, 50m³ semi/detached) fall under Permitted Development. Mansards, side dormers, and larger volumes need full planning.",
    verdict:   "usually_pd",
    pdApplies: [
      "Rear dormer within volume limit: 40m³ (terraced), 50m³ (semi/detached)",
      "Velux / rooflight-only conversions (no dormer)",
      "Dormer no higher than the existing ridge",
      "Materials 'similar in appearance' to the existing roof",
      "Side windows must be obscure-glazed + non-opening below 1.7m from floor"
    ],
    planningNeeded: [
      "Mansard conversion (roof profile change) — always planning + often Building Regs Part B fire escape",
      "Side dormer visible from a highway",
      "Volume exceeds PD limit (40/50m³)",
      "Any conversion in a Designated Area (conservation area, National Park, AONB, Broads)",
      "Any conversion to a Listed Building — Listed Building Consent AND planning required"
    ],
    buildingRegs: "Building Regs approval ALWAYS required. Critical Parts: A (structure — steel beam design + new floor joists), B (fire escape — protected staircase, mains-wired smoke alarms), K (staircase headroom, riser/going geometry), L (insulation to 0.18 U-value), P (electrical).",
    heritageNote: "Listed buildings + conservation areas have no PD rights. Full planning + Listed Building Consent required. Local design guides usually restrict dormers to rear/hidden elevations only.",
    faqs: [
      { q: "Do all loft conversions need planning permission?",           a: "No — most Velux + rear dormer conversions are Permitted Development if within volume limits (40m³ terrace, 50m³ semi/detached) and don't extend forward of the principal elevation." },
      { q: "What's the 40m³ / 50m³ volume limit for loft conversions?",    a: "PD volume added to the loft: 40m³ maximum for terraced houses, 50m³ for semi-detached and detached. Includes ALL previous roof enlargements (garage roof, previous dormer). Volume is measured from the new roofline enclosing the addition." },
      { q: "Do I need planning for a mansard loft conversion?",           a: "Yes — always. Mansards change the roof profile from pitched to steep-vertical, which exceeds all PD limits. Full planning required; often refused in conservation areas." },
      { q: "Can I put windows in the side of a loft conversion?",         a: "Yes under PD, but they must be obscure-glazed and either non-opening or with any openable part 1.7m+ above floor level. This is to prevent overlooking of neighbours." },
      { q: "How long does planning permission take for a loft conversion?", a: "8 weeks for a householder application. Add 4-6 weeks for pre-app discussions and 6-8 weeks for architect drawings + Building Regs application beforehand." },
      { q: "Do I need building control for a loft conversion?",           a: "Always. Even PD conversions need Building Regs approval. Notify Local Authority Building Control OR use an Approved Inspector before starting work. Structural sign-off, fire escape, insulation, and staircase all inspected." }
    ],
    relatedCost:  "loft-conversion",
    relatedTrades: ["carpenter", "roofer", "plumber"]
  },
  "conservatory": {
    singular:  "conservatory",
    headline:  "Do I need planning permission for a conservatory?",
    aiAnswer:  "Most UK conservatories don't need planning permission — same Permitted Development rules apply as rear extensions (3m depth semi, 4m detached, single storey, ≤ 3m eaves). Larger sizes need Prior Approval via Neighbour Consultation.",
    verdict:   "usually_pd",
    pdApplies: [
      "Rear conservatory up to 3m (semi) or 4m (detached), 3m eaves height",
      "Single storey, footprint ≤ 30m²",
      "Uses less than 50% of the original garden area",
      "Not forward of the principal elevation",
      "Building Regs may not apply if separated from house by external-quality doors (usually the case with conservatories)"
    ],
    planningNeeded: [
      "Conservatory exceeding 3m (semi) or 4m (detached) — Prior Approval up to 6m/8m",
      "Conservatory in a Designated Area (conservation area, National Park, AONB, Broads)",
      "Two-storey or contains internal-quality access to the house without doors (would be classed as a heated extension needing Building Regs)"
    ],
    buildingRegs: "Conservatories are EXEMPT from Building Regulations IF: separated from the house by external-quality doors + windows (so it's classed as an unheated addition), and the heating (if any) is independent of the main house system. If it doesn't meet these — it's classed as an extension and needs full Building Regs.",
    faqs: [
      { q: "Do I need planning permission for a conservatory?",        a: "Most don't — same PD rules as rear extensions apply. Up to 3m deep (semi), 4m (detached), single storey, 3m eaves. Sizes 3-6m (semi) or 4-8m (detached) need Prior Approval via Neighbour Consultation Scheme." },
      { q: "Do conservatories need building regulations?",             a: "Usually no — conservatories are exempt IF separated from the house by external doors + windows and heated independently. If open-plan to the house (no separating doors), it's classed as an extension and needs full Building Regs." },
      { q: "What's the biggest conservatory without planning?",        a: "PD limit is 3m depth (semi) / 4m (detached). Prior Approval extends to 6m (semi) / 8m (detached). Anything larger — full planning application." },
      { q: "Can I have a conservatory in a conservation area?",        a: "PD rights are reduced or removed in Article 4 direction areas. Always check with your LPA first. Most conservation areas allow rear conservatories subject to design + materials guidance." },
      { q: "Are lean-to conservatories different from full conservatories?", a: "No — same planning rules. Lean-to and Edwardian styles both count as conservatories under PD. What matters is size + position, not shape." },
      { q: "Do I need planning for a conservatory in a listed building?", a: "Yes — always. Listed buildings have no PD rights. Requires both planning permission AND Listed Building Consent (LBC). Historic England guidance strongly discourages conservatories on Grade I + II*." }
    ],
    relatedCost:  "kitchen-extension",
    relatedTrades: ["carpenter", "plumber"]
  },
  "porch": {
    singular:  "porch",
    headline:  "Do I need planning permission for a porch?",
    aiAnswer:  "A UK porch is Permitted Development if: ground area (external) ≤ 3m², height ≤ 3m, and at least 2m from any highway/boundary with a road. Larger porches need full planning permission.",
    verdict:   "usually_pd",
    pdApplies: [
      "External ground area ≤ 3m² (measured to the outside of the walls)",
      "Height ≤ 3m to the top of the roof",
      "At least 2m from any boundary with a highway",
      "Applies whether at front, side or rear"
    ],
    planningNeeded: [
      "Porch larger than 3m² or taller than 3m",
      "Porch within 2m of a highway boundary",
      "Any porch in a Designated Area (conservation area) — Article 4 removes PD rights",
      "Listed building — always LBC + planning"
    ],
    buildingRegs: "Small porches (external ground area ≤ 30m², glazing safety compliant, no external quality door to the house removed) are EXEMPT from Building Regs. Most residential porches qualify.",
    faqs: [
      { q: "Do I need planning permission to build a porch?",        a: "Not if it's ≤ 3m² external floor area, ≤ 3m tall, and 2m+ from any road boundary. Above those limits, yes — full householder planning application." },
      { q: "Do I need Building Regs for a porch?",                    a: "Usually exempt if: external floor area ≤ 30m², glazing meets safety standards, and any existing external door to the house isn't removed. Most porches qualify for the exemption." },
      { q: "Can I add a porch to a listed building?",                a: "Listed Building Consent required. Historic England generally discourages new porches on Grade I + II* unless there's clear historical evidence one existed. Grade II sometimes approved with sympathetic design." },
      { q: "How much does a porch cost?",                             a: "£2,500-£8,000 typically. Small UPVC porch from £2,500, hardwood + brick from £4,500-£8,000. Large custom porches with tiled roof + solid walls £10,000+." },
      { q: "Can a porch be forward of the principal elevation?",     a: "Yes — porches are the only extension type PD allows forward of the principal elevation, provided the size + boundary rules are met." },
      { q: "What if my porch has a solid roof and heated interior?", a: "Classed as an extension, not a porch. Falls under standard rear/front extension PD rules and needs Building Regs approval." }
    ],
    relatedTrades: ["carpenter", "plasterer"]
  },
  "outbuilding": {
    singular:  "outbuilding",
    headline:  "Do I need planning permission for a garden building or outbuilding?",
    aiAnswer:  "Most UK garden outbuildings — sheds, summer houses, garden offices — don't need planning permission. Must be single-storey, ≤ 2.5m tall (within 2m of boundary), ≤ 4m (pitched roof) elsewhere, and not cover more than 50% of the garden.",
    verdict:   "usually_pd",
    pdApplies: [
      "Single storey only",
      "Max eaves height 2.5m",
      "Max overall height 4m (pitched roof) or 3m (any other roof)",
      "≤ 2.5m tall if within 2m of any boundary",
      "≤ 50% of garden area covered by outbuildings + extensions combined",
      "Not forward of the principal elevation",
      "No verandas, balconies, or raised platforms"
    ],
    planningNeeded: [
      "Any outbuilding used as a dwelling (bedroom, kitchen, bathroom for regular sleeping) — classed as an annexe, needs planning",
      "Outbuilding in front garden",
      "Outbuilding > 4m tall (or > 2.5m near boundary)",
      "In a Designated Area — Article 4 directions often reduce PD",
      "Listed building — LBC + planning always"
    ],
    buildingRegs: "Small garden buildings (< 15m² floor area, no sleeping) are EXEMPT. Between 15-30m² may be exempt if 1m+ from boundary + non-combustible. Above 30m² OR any sleeping accommodation — full Building Regs.",
    faqs: [
      { q: "How big can a garden building be without planning permission?", a: "Single-storey, max 4m tall (pitched roof) or 3m (flat roof), 2.5m if within 2m of a boundary. No limit on floor area IF you stay under 50% total garden coverage from all outbuildings + extensions combined." },
      { q: "Can I sleep in a garden building without planning?",             a: "No — regular sleeping accommodation makes it an 'annexe' or 'ancillary dwelling', which needs planning permission. Occasional guest use is a grey area; LPAs interpret differently." },
      { q: "Do garden offices need planning permission?",                    a: "Not usually — provided you meet the PD size/height limits and don't sleep in it. Working from a garden office is fine. Add-on shower/toilet + kitchen starts moving it toward annexe territory." },
      { q: "Do I need building regulations for a garden office?",            a: "< 15m² and non-residential — exempt. 15-30m² — may be exempt if 1m+ from boundary + non-combustible. Anything with plumbing or > 30m² usually needs full Building Regs." },
      { q: "Can I build a summerhouse in a conservation area?",              a: "PD may apply unless an Article 4 direction removes it. Check with your LPA. Design + materials guidance often applies even where PD stands." },
      { q: "What if my garden building is a workshop?",                      a: "Workshop = fine under PD provided it's not a business open to visiting members of the public. Home-office workshop use = fine. Retail or workshop-for-hire = needs change of use planning permission." }
    ],
    relatedTrades: ["carpenter", "electrician"]
  },
  "garage-conversion": {
    singular:  "garage conversion",
    headline:  "Do I need planning permission for a garage conversion?",
    aiAnswer:  "Most UK garage conversions don't need planning permission — converting the inside of an integral or attached garage into living space is usually Permitted Development. Adding new windows or altering the front elevation may trigger a planning application.",
    verdict:   "usually_pd",
    pdApplies: [
      "Internal conversion only (integral or attached garage)",
      "Existing garage door replaced with wall + window OK if façade materials match",
      "Roof height not raised",
      "Not adding a first floor",
      "Not on a listed building or in a conservation area with Article 4"
    ],
    planningNeeded: [
      "Converting a detached garage into a dwelling (needs Change of Use planning)",
      "Adding a new front-facing window that materially changes the elevation (LPA discretion)",
      "Raising the roof or adding a first floor to the garage",
      "In a Designated Area (conservation area, National Park, AONB) with Article 4",
      "Listed building — always LBC + planning"
    ],
    buildingRegs: "Building Regs ALWAYS apply. Critical Parts: A (structural — floor may need lowering + damp-proofing), C (moisture resistance — DPC + insulation), F (ventilation), K (staircases if going up), L (insulation to 0.18 U-value), P (electrical — new circuit + full RCD protection).",
    faqs: [
      { q: "Do I need planning permission to convert my garage?",           a: "Usually no — internal conversion of an attached / integral garage is Permitted Development. Bricking up the garage door and adding a wall/window is OK provided materials match. Some LPAs have Article 4 directions removing PD for garage conversions to protect on-street parking." },
      { q: "Do I need Building Regs for a garage conversion?",              a: "Always. Structural sign-off (floor + damp), insulation, ventilation, staircase (if extending up), new electrical circuit. Cost £250-£450. Notify Local Authority Building Control OR use an Approved Inspector." },
      { q: "How much does a garage conversion cost?",                       a: "£8,000-£20,000 depending on size + finish. Single-car integral £8-12k, double integral £14-18k, detached garage conversion (which needs planning) £16-25k." },
      { q: "Do I lose on-street parking rights if I convert my garage?",    a: "Sometimes. Some LPAs (especially in Bath, Bristol, London) have Article 4 directions removing PD for garage conversions specifically to protect parking. Check your local Article 4 registry before starting." },
      { q: "Can I convert a detached garage into a granny annexe?",         a: "Needs planning. Detached garage → dwelling is Change of Use, always requires planning. Attached garage internal conversion (used as extra bedroom for the main house) usually PD." },
      { q: "How long does a garage conversion take?",                       a: "2-4 weeks build time typically. Plus 4-6 weeks upfront for Building Regs application + trades scheduling." }
    ],
    relatedCost:  "kitchen-extension",
    relatedTrades: ["carpenter", "electrician", "plumber"]
  },
  "driveway": {
    singular:  "driveway",
    headline:  "Do I need planning permission for a new driveway?",
    aiAnswer:  "A new UK front driveway ≤ 5m² doesn't need planning permission. Larger driveways don't need planning IF you use permeable materials (gravel, permeable block paving, permeable concrete). Impermeable driveways > 5m² require full planning permission.",
    verdict:   "sometimes_pd",
    pdApplies: [
      "Any driveway ≤ 5m² in area",
      "Larger driveway using permeable materials: gravel, permeable block paving, permeable concrete, resin-bound",
      "Rainwater directed to a permeable surface (lawn, border) if using impermeable materials on ≤ 5m²"
    ],
    planningNeeded: [
      "Impermeable driveway larger than 5m² (traditional concrete, tarmac, standard block paving)",
      "New driveway requiring a dropped kerb (kerb needs Highway Authority approval, not planning)",
      "Driveway in a Designated Area with Article 4 direction"
    ],
    buildingRegs: "Building Regs do not apply to residential driveways. Dropped kerb is Highway Authority approval, separate £200-£350 fee + a licensed contractor.",
    faqs: [
      { q: "Do I need planning permission for a new driveway?",         a: "Not if it's under 5m² OR made from permeable materials (gravel, permeable block paving, resin-bound). Impermeable driveways over 5m² need full planning permission." },
      { q: "What are permeable driveway materials?",                     a: "Gravel, permeable block paving (blocks with gaps that allow water through), permeable concrete, and resin-bound aggregate. All allow rainwater to drain into the ground rather than running off into public sewers." },
      { q: "How much does a new driveway cost in the UK?",               a: "£45-£90/m² for block paving, £75-£120/m² for resin-bound, £120-£180/m² for natural stone (granite / porphyry). Typical 40m² driveway £2,500-£7,000." },
      { q: "Do I need a dropped kerb for my driveway?",                  a: "Yes if crossing a public footpath. Apply to your local Highway Authority (not the LPA). £200-£350 fee + must be installed by a Highway-approved contractor (£1,500-£3,500 typically). Separate to any planning application." },
      { q: "Can I turn my front lawn into a driveway?",                  a: "Yes with permeable materials OR ≤ 5m² of impermeable. Larger impermeable — planning permission required. Every LPA has this on the radar since 2008 (contributes to flash flooding)." },
      { q: "How long does a driveway install take?",                     a: "2-5 days for a typical 30-50m² driveway. Add 4-6 weeks upfront for dropped kerb approval + install if needed." }
    ],
    relatedTrades: ["landscaper"]
  },
  "solar-panels": {
    singular:  "solar panels",
    headline:  "Do I need planning permission for solar panels?",
    aiAnswer:  "Most UK domestic solar panel installations don't need planning permission — they're Permitted Development if they don't project more than 200mm from the roof or wall, and don't cover more than 50% of the wall/roof area.",
    verdict:   "usually_pd",
    pdApplies: [
      "Roof-mounted PV or solar-thermal panels projecting < 200mm from the roof slope",
      "Panels covering < 50% of the wall or roof area",
      "Standalone panels ≤ 9m² (no more than 4m tall), 5m+ from boundary",
      "Not on the highest part of the roof (excluding chimneys)"
    ],
    planningNeeded: [
      "Panels on a Listed Building — LBC + planning always",
      "Panels in a conservation area or World Heritage Site — planning if on a wall or roof slope facing a highway",
      "Ground-mounted array > 9m²",
      "Panels projecting > 200mm from the roof (e.g. integrated tilted arrays on a low-pitch roof)"
    ],
    buildingRegs: "Building Regs apply to any structural attachment. Roof-mounted installs need Part A (structural — roof must take load) + Part P (electrical — inverter + isolator install is notifiable). Most MCS-certified installers handle both.",
    faqs: [
      { q: "Do I need planning permission for solar panels?",              a: "Most don't — roof-mounted panels projecting < 200mm and covering < 50% of the roof are Permitted Development. Listed buildings and conservation-area facades facing a highway need planning." },
      { q: "Can I put solar panels on a listed building?",                  a: "Listed Building Consent required. Historic England guidance discourages Grade I + II* installations. Grade II sometimes approved with sensitive placement (rear roof, hidden from public view)." },
      { q: "What's the MCS certification for solar panels?",                a: "Microgeneration Certification Scheme — required to claim SEG (Smart Export Guarantee) payments for exporting electricity to the grid. Also required for most solar grants. Non-MCS installs still work but exclude you from most incentives." },
      { q: "How much does a solar panel installation cost?",                a: "£5,000-£10,000 for a typical 3-4 kW residential system fitted. Battery storage adds £3,500-£6,000. Payback typically 7-11 years including SEG earnings." },
      { q: "Are there any solar panel grants in the UK 2026?",              a: "ECO4 covers low-income households. Home Upgrade Grant (HUG2) for off-gas homes in some regions. Boiler Upgrade Scheme £7,500 for air-source heat pumps replacing gas boilers. Check gov.uk grant checker for current schemes." },
      { q: "Do solar panels need building regulations?",                    a: "Yes — Part A (structural load on roof) and Part P (electrical work is notifiable). MCS-certified installers self-certify Part P as part of the install; Part A may need a structural engineer sign-off for older or steel-frame roofs." }
    ],
    relatedTrades: ["electrician", "roofer"]
  },
  "chimney-removal": {
    singular:  "chimney removal",
    headline:  "Do I need planning permission to remove a chimney?",
    aiAnswer:  "Removing a chimney externally (the stack above the roof) doesn't usually need planning permission unless the property is listed or in a conservation area. Internal chimney breast removal doesn't need planning but ALWAYS needs Building Regs approval + often a Party Wall notice.",
    verdict:   "usually_pd",
    pdApplies: [
      "Chimney stack removal from a non-listed, non-conservation-area property",
      "Internal chimney breast removal (no planning needed, but Building Regs required)",
      "Removing a defunct flue"
    ],
    planningNeeded: [
      "Listed building — Listed Building Consent required for ANY chimney removal",
      "Conservation area — often planning if visible from a highway (Article 4 usually)",
      "External appearance materially changes (dependent on LPA)"
    ],
    buildingRegs: "Internal chimney breast removal ALWAYS requires Building Regs. Structural approval needed — the breast + stack above must be supported by new steel or Gallow brackets. LABC application typically £250-£400. Retrospective sign-off is difficult + risky.",
    partyWall:    "Chimney breast removal from a semi-detached / terraced house almost always triggers Party Wall Act 1996 — the chimney is often on a shared party wall. Serve a Party Wall Notice at least 2 months before starting work. Neighbours can dissent → Party Wall Surveyor process (£800-£2,500 per side).",
    faqs: [
      { q: "Do I need planning permission to remove a chimney breast?",   a: "Not usually — internal removal is Permitted Development. Listed buildings + conservation areas often need consent. Building Regs approval is ALWAYS required — never skip this." },
      { q: "Do I need building regulations to remove a chimney breast?", a: "Yes, always. Structural approval for the support system (steel beam OR Gallow brackets holding the remaining stack). LABC application £250-£400 + structural engineer £400-£800." },
      { q: "Do I need a Party Wall Notice for chimney removal?",         a: "Almost always for semi-detached / terraced houses — the chimney sits on the shared party wall. Serve Party Wall Notice 2 months before work. Neighbour can dissent, triggering the Party Wall Surveyor process (£800-£2,500 per side)." },
      { q: "How much does chimney breast removal cost?",                  a: "£1,500-£3,500 for a single-floor removal (living room only). £3,500-£6,500 for full-height removal (living room + bedroom above). £6,500-£10,000 if removing the external stack too." },
      { q: "Can I remove a chimney breast myself?",                       a: "Legally you can, but strongly advised against. Structural risk + Building Regs sign-off + Party Wall complications mean most DIY removals cause problems that cost more to fix. Hire a builder with a structural engineer report." },
      { q: "What happens to the neighbour's chimney if I remove mine?",  a: "In semi-detached / terraced houses, chimneys often share a party wall. Removing yours may destabilise theirs. Party Wall Surveyor process handles this — you're liable for any damage caused." }
    ],
    relatedTrades: ["general-builder"]
  },
  "internal-wall-removal": {
    singular:  "internal wall removal",
    headline:  "Do I need planning permission to remove an internal wall?",
    aiAnswer:  "Removing an internal wall in a UK home doesn't need planning permission — internal alterations are outside the planning system. Building Regs approval IS required for load-bearing wall removal (structural steel beam sign-off + Part A + P if disturbing electrics).",
    verdict:   "usually_pd",
    pdApplies: [
      "Any internal wall removal (planning-wise)",
      "Non-load-bearing partition walls — no Building Regs application either (though electrical work is still notifiable under Part P)"
    ],
    planningNeeded: [
      "Listed building — Listed Building Consent required for ANY internal alteration",
      "Nothing else planning-wise; internal alterations are outside planning"
    ],
    buildingRegs: "Load-bearing wall removal ALWAYS requires Building Regs. Structural engineer designs the beam (steel or timber), specifies bearing padstones. LABC or Approved Inspector inspects. Non-load-bearing walls don't need Building Regs unless disturbing services (electrics = Part P, plumbing = Part G if adding to drainage).",
    partyWall:    "Not usually — internal walls aren't party walls. Exception: removing a wall right against a shared party wall may affect its stability, triggering Party Wall notification.",
    heritageNote: "Listed Building Consent required for ALL internal alterations to listed buildings — even a partition wall. Grade I + II* rarely approved without special justification (fire escape, disability access).",
    faqs: [
      { q: "Do I need planning permission to knock down an internal wall?", a: "No — internal alterations are outside the planning system unless the property is listed. Building Regs approval IS required for load-bearing wall removal." },
      { q: "How do I know if a wall is load-bearing?",                       a: "Signs: sits directly above another wall on the floor below; runs perpendicular to floor/ceiling joists; is a solid brick wall (not stud). Definitive test: structural engineer visit (£150-£400). Never assume." },
      { q: "How much does load-bearing wall removal cost?",                  a: "£2,500-£5,500 including structural engineer, RSJ, install, plaster + make-good. Larger openings (double garage door width) £5,500-£9,000. Add £250-£400 for LABC / Approved Inspector." },
      { q: "Do I need building regs for a non-load-bearing wall?",           a: "Not for the wall itself. But any electrical work as part of the removal (removing a socket, re-routing a switch) is notifiable Part P and must be signed off by a registered installer OR by LABC (£150+ retrospective fee)." },
      { q: "How long does load-bearing wall removal take?",                  a: "2-3 days on-site: 1 day for props + install, 1 day for plaster + make-good. Add 2-3 weeks upfront for structural engineer + Building Regs application + steel beam order." },
      { q: "Can I remove a wall in a listed building?",                      a: "Requires Listed Building Consent — separate from Building Regs. Historic England guidance strongly discourages internal alterations. Grade I + II* rarely approved. Grade II sometimes approved for fire escape or accessibility reasons." }
    ],
    relatedTrades: ["general-builder", "electrician"]
  }
};

export function isValidPlanningProject(s: string): s is PlanningProject {
  return (PLANNING_PROJECTS as string[]).includes(s);
}
