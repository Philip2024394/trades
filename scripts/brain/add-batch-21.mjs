// Batch 21 — installation intelligence: removal, fitting, poorly-fitted
// problem solving, loose handrail repair, new-install handrail shake, and
// landing bounce. Deduplicated against existing loose-handrail entries
// 317/318 (which cover over-time loosening + DIY-vs-professional advice).

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = resolve(HERE, "..", "..", "knowledge", "staircase.json");

const raw = JSON.parse(readFileSync(FILE, "utf8"));
const arr = Array.isArray(raw) ? raw : raw.entries || raw.faqs || Object.values(raw).find((v) => Array.isArray(v));

const baseTemplate = (id, question, answer, opts = {}) => ({
  id: `staircase-faq-${id}`,
  kind: "faq",
  question,
  answer,
  category_tag: "staircase",
  audience_level: opts.level ?? 2,
  classification: opts.cls ?? "industry_good_practice",
  safety_note: opts.safety ?? null,
  source_verified_at: null,
  fact_check_flag: null,
  diagram: null,
});

let nextId = 1772;
const add = (q, a, opts) => arr.push(baseTemplate(nextId++, q, a, opts));

// ============================================================
// REMOVING OLD STAIRCASES (19)
// ============================================================
add(
  "Why treat old staircase removal as a planned operation rather than demolition?",
  "A staircase is part of the building structure and connects floors, walls, landings, balustrades and sometimes supporting walls. Ripping it out without a plan risks damage to plaster, floors, ceilings, skirtings, electrical cables and plumbing that runs adjacent. A professional installer sequences the removal like the reverse of the original installation, not like a smash-out.",
  { cls: "safety_advice", level: 2 },
);
add(
  "What are the common reasons customers remove an old staircase?",
  "Four main reasons: (1) modernisation — replacing pine or carpeted stairs with oak, glass, metal or floating designs. (2) Damage — loose treads, squeaking, cracked timber, water damage or rot. (3) Layout change — different direction, wider stairs, more open design. (4) Renovation projects — loft conversion, extension, open-plan redesign that changes the stair position.",
  { cls: "industry_good_practice" },
);
add(
  "What must be checked before touching an old staircase?",
  "How it is fixed (screws, nails, wedges, bolts), where it is supported (walls, trimmers, joists), finished floor levels top and bottom, wall connections, and any electrical cables or plumbing running through or under the staircase. Discovery of a live cable behind a string mid-removal is a bad time to find out.",
  { cls: "safety_advice" },
);
add(
  "How do different old staircase construction types affect removal?",
  "Traditional timber stairs are usually screwed, nailed, wedged and glued — dismantle in reverse. Modern staircases may include steel supports, hidden fixings and glass systems that need specialist handling and torx or hex bits. Concrete staircases are far harder — breaking equipment, structural planning, skip logistics and dust control all step up in scale.",
  { cls: "industry_good_practice", level: 3 },
);
add(
  "What tools does a staircase installer bring for a removal job?",
  "Pry bars, claw hammer, reciprocating saw (for cutting fixings and jammed timber), drill/driver, screwdrivers of the fixings' original type, chisels, crowbar, and dust extraction. On finished-home jobs add floor protection sheets, plastic dust barriers and rubbish bags for immediate off-site removal.",
  { cls: "industry_good_practice" },
);
add(
  "What is the typical sequence for removing a timber staircase?",
  "Reverse of installation: (1) remove handrail. (2) Remove spindles / balusters. (3) Remove newel posts. (4) Remove treads and risers. (5) Remove strings. (6) Prepare the opening for the new staircase. Doing it in this order keeps the structure controlled at every stage — pulling strings first would collapse the whole assembly.",
  { cls: "industry_good_practice" },
);
add(
  "How is a carpeted staircase removed?",
  "The carpet is removed first: lift the covering, pull out gripper rods along the tread nosings, remove underlay, scrape off any adhesive residue. Only then can the timber structure be properly inspected — problems like rot, split treads and previous poor fixings are often hidden until the carpet comes up.",
  { cls: "industry_good_practice" },
);
add(
  "Which parts of an old staircase can be reused?",
  "Sometimes reusable: oak handrails, newel posts, spindles and clean timber sections. Depends entirely on condition, style compatibility with the new design, and damage caused during removal. Careful removal preserves reuse value; brutal removal destroys it. Reclaimed period parts have real value to renovators — do not skip them without asking.",
  { cls: "industry_good_practice" },
);
add(
  "What happens to old staircase timber that cannot be reused in the new staircase?",
  "Options: sold to reclaimed-timber specialists, used for shelves and small furniture, cut down for firewood, or handed to salvage companies. Premium species (oak, walnut) always have downstream value. Softwood usually goes to skip or firewood. NEX marketplace could match old staircases against renovators actively looking for period parts.",
  { cls: "professional_recommendation" },
);
add(
  "Who might buy an old staircase or its components?",
  "Renovators of period properties, builders looking for character elements, salvage companies, and DIY customers hunting for cheap timber. Useful information to list: age, material species, dimensions, condition and photos of the parts. A Victorian pitch-pine newel that would be skipped today is worth real money to someone restoring a matching house.",
  { cls: "professional_recommendation" },
);
add(
  "What hidden problems are commonly discovered during old staircase removal?",
  "Uneven floors that were disguised by the old stringer packing, poor previous installation (missing fixings, over-notched joists), water damage or rot from bathrooms above, and incorrect original fixings (nails only where bolts were needed). Most old houses have at least one surprise — quote allowance for remedial work before the new stair goes in.",
  { cls: "expert_observation", level: 3 },
);
add(
  "Why are old houses challenging for staircase replacement?",
  "Walls are usually out of square, floors slope, and dimensions vary at different measurement points. A staircase designed to a single set of nominal dimensions may not fit a real Victorian opening. Survey every measurement multiple times at different heights, and expect 5-15mm variation across the opening as normal, not a mistake.",
  { cls: "expert_observation", level: 3 },
);
add(
  "What is the correct professional sequence for staircase replacement?",
  "Survey → design new staircase → CAD drawing → customer approval → remove old stairs → prepare opening → install new staircase. The mistake is ripping out the old stairs before the new design is signed off — leaving the customer with no stairs and a house full of dust while decisions are still being made.",
  { cls: "industry_good_practice" },
);
add(
  "How do you keep a house safe during staircase removal?",
  "The house still needs safe movement between floors. Solutions: temporary steps of scaffold-board construction, temporary handrails on the exposed opening, restricted access with clear signage, and agreed working hours so residents know when the stair will be down. Never leave an open stairwell overnight without guarding.",
  { cls: "safety_advice", level: 2 },
);
add(
  "What should the customer be told before removal starts?",
  "Expected noise level and hours, dust generation and extraction plan, access restrictions during the work, total time from removal to new staircase usable, and protection measures for floors, walls and furniture. Set expectation once upfront — a customer surprised on day one by three days of dust is a customer complaining on day two.",
  { cls: "professional_recommendation" },
);
add(
  "How is dust controlled during staircase removal in a finished home?",
  "Dust extraction connected directly to power tools, plastic protection sheets sealing the work area from adjacent rooms, floor coverings on all traffic routes, and vacuuming as work progresses rather than at the end. Premium companies use HEPA extractors — the household still cleans for a week afterwards but the damage is contained.",
  { cls: "industry_good_practice" },
);
add(
  "Why is staircase removal often more expensive than customers expect?",
  "The cost is not only labour. It includes protection materials, waste removal (skip hire), remedial repair to any damage found, preparation work on the opening, and often the coordination fee for electrician / plumber if services are disturbed. Quote all five separately so the customer sees where the money goes.",
  { cls: "expert_observation", level: 2 },
);
add(
  "What is the difference between staircase refurbishment and full replacement?",
  "Refurbishment keeps the underlying structure — strings, risers, treads — and replaces only the visible finishes: new stair caps over old treads, new handrail, glass panels replacing spindles, new paint. Full replacement takes everything out. Refurbishment is cheaper and less disruptive; replacement gives full design freedom. Not every staircase is a candidate for refurbishment — the underlying structure has to be sound.",
  { cls: "professional_recommendation" },
);
add(
  "What is a typical staircase refurbishment example?",
  "Before: carpeted pine stairs with painted spindles. After: oak stair caps overlaid on the existing treads, new oak handrail, glass balustrade panels replacing the spindles, everything clear-lacquered. Same structure, completely new look, at a fraction of a full replacement cost.",
  { cls: "professional_recommendation" },
);

// ============================================================
// INSTALLATION INTELLIGENCE (18)
// ============================================================
add(
  "Why is staircase measuring the most important stage of the whole job?",
  "A staircase manufactured perfectly in a workshop can still fail if the site survey was wrong. The stairs must fit the floor opening, the ceiling height, the finished floor levels (both top and bottom), the walls, the landing, and building regulations. A single-centimetre error at the survey stage propagates through every step of the finished staircase.",
  { cls: "safety_advice", level: 2 },
);
add(
  "What measurements does a professional staircase survey capture?",
  "Floor height from finished lower floor to finished upper floor, stairwell opening (length, width, position), available headroom at every point along the flight, and wall positions including out-of-square variation. Multiple readings at different heights and depths — walls that read straight at floor level can bow inwards at head height.",
  { cls: "industry_good_practice" },
);
add(
  "Why does 'finished' floor level matter so much for stair measurements?",
  "Mistakes happen when the survey is done before the final floor covering is known: tile thickness, engineered flooring thickness, or carpet+underlay depth. If the stair is manufactured to the subfloor level but the customer then adds a 22mm floor, the bottom step becomes 22mm shorter than the rest — a serious trip hazard and a regs failure.",
  { cls: "safety_advice", level: 2 },
);
add(
  "What are the pros of laser measuring technology on a staircase survey?",
  "Faster than tape (single-person operation), more accurate over long spans, and creates digital records that can be pushed straight into CAD. Modern surveyors use laser distance meters, digital levels and increasingly 3D scanners that capture the whole stairwell as a point cloud. Traditional tape + spirit level is still valid in experienced hands but no longer faster.",
  { cls: "industry_good_practice" },
);
add(
  "What is the professional approval workflow before manufacturing a new staircase?",
  "Customer enquiry → site survey → CAD drawing produced → customer approval signed → then manufacturing starts. The signature before manufacturing is critical — every subsequent change costs the workshop money and delays the job. NEX-era quoting should sign-off drawings digitally rather than emailing PDFs back and forth.",
  { cls: "industry_good_practice" },
);
add(
  "What must be checked when preparing the opening for a new staircase?",
  "Opening size against the manufactured stair dimensions (with tolerance), structural support (the trimmer joists must carry the stair loads), floor strength around the landing, and access route into the house for the delivered staircase. All four checks before delivery day — discovering a load problem when the stair is already on the truck is expensive.",
  { cls: "safety_advice", level: 2 },
);
add(
  "How is a new staircase typically delivered to site?",
  "Four common formats: fully assembled (small straight flights only), part-assembled (strings and treads together, balustrade separate), flat-packed for on-site assembly, or as individual components for full site build. Large or curved staircases usually arrive in sections that combine on-site because they simply cannot pass through the front door assembled.",
  { cls: "industry_good_practice" },
);
add(
  "Why are staircases often delivered in sections rather than fully assembled?",
  "Fully-assembled flights often do not fit through the front door, hallway or stairwell of the receiving house. Sections make delivery physically possible, keep the parts protected in transit, and let the installer stage assembly in the right order for the confined space they have to work in.",
  { cls: "industry_good_practice" },
);
add(
  "How is a premium staircase protected during delivery?",
  "Blankets over finished surfaces (never bare straps directly on lacquer), cardboard corner protectors, foam wrap around fragile components (spindles, glass panels), and clear protective film on any exposed pre-finished timber. Damage in transit is preventable damage — pay the small protection cost every time.",
  { cls: "industry_good_practice" },
);
add(
  "What are the challenges of carrying a new staircase into a finished house?",
  "Narrow hallways, tight corners at doorways, low ceilings on approach routes, and freshly-decorated walls that mark on contact. Walk the route with a mock-up template before delivery day; check the tightest pinch point matches the largest section coming in. Plan the fallback: unstack, cut a section shorter, or take a window out — decide before the truck arrives.",
  { cls: "industry_good_practice", level: 3 },
);
add(
  "What tools does a staircase installer bring to site?",
  "Cordless drill and driver with a full bit set, impact driver for heavy fixings, spirit levels (short and long), clamps of various sizes, timber and plastic packers, appropriate adhesive, fixings in the correct type, and site measuring tools. Plus dust protection kit even if the customer thinks the site is finished — it always gets messier than expected.",
  { cls: "industry_good_practice" },
);
add(
  "What fixing methods are used for a modern staircase installation?",
  "Screws — standard for timber-to-timber connections, hidden where possible. Adhesive — used alongside screws to reduce movement and prevent future squeaks (glue does the long-term work, screws hold it while cure). Bolts — used for heavy structural connections and metal or steel-supported systems. Fixing choice matches the load path, not just what is in the installer's bag.",
  { cls: "industry_good_practice" },
);
add(
  "What are packers and why do installers use them?",
  "Small timber or plastic shims used to fill gaps between staircase components and the surrounding structure (floor, wall, trimmer). Houses are never perfectly square or level, so packers create solid full-contact bearing instead of point-loading a single edge. Correctly packed stairs are silent; unpacked stairs squeak the moment they take load.",
  { cls: "industry_good_practice" },
);
add(
  "What is dry fitting a staircase and why does it matter?",
  "Assembling the staircase temporarily on site without glue or final fixings to check fit, alignment, and appearance before committing to permanent fixing. Any problem found at dry-fit stage is cheap to fix; the same problem found after final gluing is expensive or unrepairable. Premium installers dry-fit every job as standard.",
  { cls: "industry_good_practice" },
);
add(
  "What is the installation order for an open-riser or floating staircase?",
  "More demanding than a closed staircase because every gap and fixing is visible. Open-riser: strings and treads must align perfectly because there is no riser to hide small misalignments. Floating: needs engineered structural support (often steel stringer or cantilever brackets bolted into a load-bearing wall) — this is not a job for a general carpenter without an engineer's spec.",
  { cls: "safety_advice", level: 3 },
);
add(
  "When are glass balustrade panels installed on a new staircase?",
  "After the timber structure is fully installed, adjusted and squared. Glass panels are heavy, fragile and unforgiving — they need the timber to be dead accurate before they go in, because the panels do not flex to accommodate an out-of-line channel. Handle with suction cups and gloves; a single edge-chip means a new panel.",
  { cls: "safety_advice" },
);
add(
  "What final checks does a professional installer make before handover?",
  "Test every tread for squeak by walking the full flight, push and pull every handrail joint and newel to detect movement, sight every glass panel for chips and alignment, inspect all visible finishes for scratches or glue marks, and confirm no fixings are missing or protruding. Any defect gets fixed before the customer walks the stair, not after.",
  { cls: "industry_good_practice" },
);
add(
  "What should be in the customer handover pack for a new staircase?",
  "Care instructions (what cleaning products to use and avoid), warranty information with clear scope and duration, a maintenance schedule (when to re-oil or re-lacquer high-wear surfaces), the name of the installer and a route to report any post-install issue, and a copy of the CAD drawing for future reference. Premium companies deliver a printed pack in a branded folder, not a scribbled email.",
  { cls: "professional_recommendation" },
);

// ============================================================
// POORLY FITTED STAIRCASE — CUSTOMER PROBLEM SOLVING (10)
// ============================================================
add(
  "My staircase has been poorly fitted — what should I do first?",
  "Do not panic and do not remove or repair anything yourself yet. Document the problems first: photos, videos of movement, dates, keep the original quotation and drawings, and put any messages with the installer in writing. Then contact the installer for a site inspection. Evidence protects your position if the dispute escalates.",
  { cls: "professional_recommendation", level: 1 },
);
add(
  "What are the common signs of a poorly fitted staircase?",
  "Movement (staircase moves when walked on, newel posts wobble, handrail feels loose), squeaking (loose tread joints, gaps between components, poor adhesive), uneven steps (some risers taller — a serious trip and regs issue), gaps (between tread and riser, between string and wall, around newel posts), and poor finishing (scratches, glue marks, uneven paint, damaged timber).",
  { cls: "diagnostic_procedure", level: 1 },
);
add(
  "What evidence should I gather before contacting my staircase installer?",
  "Dated photos of every visible problem, videos showing any movement or noise (a static photo cannot show a wobble), a copy of the original quotation and specification, the CAD drawings if you were given them, and all messages with the installer converted to writing. Do not rely on phone conversations — get the summary emailed back to yourself.",
  { cls: "professional_recommendation", level: 1 },
);
add(
  "How should I first contact my installer about a poorly fitted staircase?",
  "In writing, calmly and factually. A good template: 'I have identified several issues with the staircase installation and would like a site inspection to discuss repairs and a solution.' Attach the evidence. Do not accuse, threaten or demand a specific outcome yet — the first message is asking them to look at it. A professional installer will inspect and correct.",
  { cls: "professional_recommendation", level: 1 },
);
add(
  "Should I fix a poorly fitted staircase myself?",
  "No, not straight away. If you drill holes, remove parts or alter fixings, it becomes harder to prove the original problem existed and the installer can claim your work caused the damage. Give the installer a documented opportunity to inspect and correct first. DIY repair is a last resort after the installer has refused to help.",
  { cls: "professional_recommendation", level: 1 },
);
add(
  "What should a proper inspection of a suspect staircase installation check?",
  "Fixings (right type, right length, right number, correctly torqued), structural movement (any give when loaded), step dimensions (rise, going, nosing overhang — all must comply with Doc K), balustrade security (handrail, newels, spindles all firm), and finish quality (any damage, glue marks, missed sanding). Any professional inspector should cover all five categories.",
  { cls: "diagnostic_procedure", level: 2 },
);
add(
  "What can I do if my staircase installer refuses to fix a poor installation?",
  "Escalate in order: written complaint to the company, independent inspection by a different qualified staircase specialist (this becomes your evidence), Trading Standards or Citizens Advice contact, and legal advice if the sums are significant. Consumer Rights Act 2015 covers workmanship. Do not skip the written complaint stage — courts want to see you gave a chance to fix.",
  { cls: "professional_recommendation", level: 2 },
);
add(
  "Can a poorly fitted staircase always be fixed, or does it need replacing?",
  "Most problems are fixable. Loose newels can be re-fixed and reinforced with hidden fixings. Squeaks can be traced and tightened or re-glued. Poor finish can be sanded and re-finished. Replacement is only needed when the structure is unsafe, step dimensions are wrong (regs failure), major components are made incorrectly, or the fixing method is fundamentally wrong for the design.",
  { cls: "repair_procedure", level: 2 },
);
add(
  "What is the correct diagnostic order for a staircase problem?",
  "Safety first (is anyone at risk of falling right now?), then structure (is the stair itself sound?), then fixings (are individual connections secure?), then appearance (finish quality, visual defects). Fixing a scratched tread on a stair that wobbles is the wrong order. A beautiful staircase that moves or feels unsafe is not a successful installation.",
  { cls: "expert_observation", level: 2 },
);
add(
  "Could NEX help homeowners diagnose staircase installation problems?",
  "Yes — a NEX Staircase Health Check feature would let a homeowner upload photos and short videos, run the AI diagnostic across safety / structure / fixings / appearance, and generate a professional report identifying likely issues before the installer visits. Turns a vague complaint into an evidence pack the installer cannot dismiss.",
  { cls: "professional_recommendation", level: 2 },
);

// ============================================================
// LOOSE HANDRAIL REPAIR (8)
// ============================================================
add(
  "How do I find where a loose handrail is actually coming loose?",
  "Push and pull the handrail slowly along its full length while watching each connection point. Three common locations: (A) at the wall — bracket has come loose; (B) at the newel post — the handrail-to-newel joint has failed; (C) whole newel post is moving, and the handrail itself is fine but the support underneath is loose. The fix is completely different for each — diagnose before repairing.",
  { cls: "diagnostic_procedure", level: 2 },
);
add(
  "How is a loose wall-mounted handrail repaired?",
  "Loosen or remove any bracket cover, check the existing screws for pull-out, replace weak or short screws with longer ones into the wall structure using correct wall plugs for the substrate, and tighten securely. Critical: the fixing must reach solid structure — timber stud, masonry, or a proper structural fixing plate. Screws into plasterboard alone are not a handrail fixing.",
  { cls: "repair_procedure", level: 2 },
);
add(
  "How is a handrail that has come loose at the newel post repaired?",
  "Two methods depending on access. Method 1: tighten the existing fixing (accessible screws / bolts through the newel into the handrail), often with wood glue added to the joint. Method 2: install a hidden reinforcement — long stair-fixing screw, timber dowel or specialist stair connector — that adds new pull-out resistance, then conceal the repair with a plug or filler.",
  { cls: "repair_procedure", level: 2 },
);
add(
  "How do I fix a loose newel post that makes the handrail feel loose?",
  "Common causes: poor original installation, loose wedges under the post, movement of the surrounding floor structure, or seasonal timber shrinkage. Fixes: tighten any accessible fixing bolts, re-secure from underneath the floor if you have access below, or add hidden reinforcement (long structural screws, steel angle bracket concealed inside a cupboard). Loose newel is a safety issue — fix, do not ignore.",
  { cls: "repair_procedure", level: 2 },
);
add(
  "Why is squirting glue into visible gaps a bad handrail repair?",
  "Glue on the outside does not reach the joint that is actually moving, does not strengthen the structural connection, looks messy on visible timber, and the movement continues underneath the cosmetic bead of glue. The repair must address the failed structural fixing — a screw, bolt or hidden reinforcement — not decorate over the symptom.",
  { cls: "expert_observation", level: 2 },
);
add(
  "My staircase is new — should I DIY-repair a loose handrail?",
  "No. A new staircase should not have a loose handrail — it is an installation defect, not normal wear. DIY-repairing it voids the warranty and removes your evidence. Photograph the problem, record a short video showing the movement, and contact the installer for correction under warranty. Repair is their responsibility, not yours.",
  { cls: "professional_recommendation", level: 1 },
);
add(
  "What safety precautions should I take with a loose handrail while waiting for repair?",
  "Do not rely heavily on the handrail for support — grip the wall or the balustrade spindles instead where possible. Warn children and elderly household members verbally, then keep the warning visible (a note or ribbon at each end of the handrail). Do not push or pull the handrail 'to test it' repeatedly — repeated force worsens the failure.",
  { cls: "safety_advice", level: 1 },
);
add(
  "Is a small amount of handrail flex ever normal on a new staircase?",
  "A very small amount of flex can be normal on very long timber handrails because timber has natural elasticity. But a handrail that you can feel moving when you hold it, or that gives visibly when pushed and pulled with normal use force, is not acceptable on a new installation. If in doubt, video the movement and ask the installer to inspect.",
  { cls: "expert_observation", level: 1 },
);

// ============================================================
// NEW HANDRAIL SHAKE (4)
// ============================================================
add(
  "Should a new staircase handrail shake or wobble?",
  "No. A properly fitted new staircase handrail should feel firm, secure and confident under normal use — solid newel posts, secure handrail joints, tight balustrade connections, no rattling spindles, no visible movement when pushed or pulled normally. Wobble on a new install is an installation defect, not a settling-in period.",
  { cls: "expert_observation", level: 1 },
);
add(
  "What does a properly fitted new staircase handrail feel like?",
  "Firm, secure, confident. When you hold the handrail and apply normal pressure — including your full weight if you were catching a fall — it should not deflect visibly, joints should not creak, and spindles should not rattle. That is the baseline acceptance standard for a new installation, not the premium version.",
  { cls: "expert_observation", level: 1 },
);
add(
  "What causes a new staircase handrail to shake?",
  "Four common causes: (1) newel post not properly fixed to the floor structure — the whole assembly moves. (2) Handrail-to-newel joint under-fixed. (3) Spindles / balusters loose in the baserail or handrail groove — the balustrade feels weak. (4) Rarely, timber shrinkage during the first heating season — but even that should not create noticeable shake on a new install.",
  { cls: "diagnostic_procedure", level: 2 },
);
add(
  "What action should I take about a shaky new-install handrail?",
  "Video the movement (a static photo cannot show it), photograph the newel posts, handrail joints and spindles from multiple angles, and contact the installer in writing asking for an inspection. A professional installer should return and correct the defect under warranty — this is exactly what a new-install guarantee period exists for.",
  { cls: "professional_recommendation", level: 1 },
);

// ============================================================
// LANDING BOUNCE (7)
// ============================================================
add(
  "Is spring or bounce in landing boards normal on a new staircase installation?",
  "No. A landing should feel solid, stable and firm underfoot — not springy like a trampoline. Small timber flexibility exists, but a noticeable bounce on a new install is a sign of an underlying problem and should be investigated, not accepted as 'wood does that'.",
  { cls: "expert_observation", level: 1 },
);
add(
  "What causes a landing to spring or bounce underfoot?",
  "Five possible causes: (1) insufficient support underneath — missing noggins, too few joists, weak framing. (2) Boards too thin for the span. (3) Poor fixing — not enough screws, wrong length, fixings missing the joists, missing glue. (4) Floating floor system designed with some movement (but the structural floor under it should still feel solid). (5) Ongoing timber movement from humidity change — usually creaks rather than bounce.",
  { cls: "diagnostic_procedure", level: 2 },
);
add(
  "How do I diagnose a bouncy landing?",
  "Walk it and observe. If the whole landing moves as one, it is a structural support issue — joists, noggins or trimmer. If only one board moves, it is a fixing issue on that board. If you can see a board deflect visibly under foot, the board itself is too thin for the span or has insufficient bearing. Different symptoms — different fixes.",
  { cls: "diagnostic_procedure", level: 2 },
);
add(
  "What should a staircase installer check on a bouncy landing complaint?",
  "Landing joists (size, spacing, span), board thickness against span rating, fixings (correct number, correct length, hitting the joists), support underneath the landing perimeter, and the connection between the staircase and the floor structure. A landing sitting on a stair that is itself moving will bounce even if the landing boards are correct.",
  { cls: "diagnostic_procedure", level: 2 },
);
add(
  "When should landing bounce be treated as urgent rather than cosmetic?",
  "Urgent if the movement is increasing over time, if you hear cracking sounds when you cross it, if the boards feel loose underfoot, or if the staircase itself moves in sympathy with the landing. Any of those signs points to a real structural problem that can degrade — not a minor snag to raise at the six-month follow-up.",
  { cls: "safety_advice", level: 2 },
);
add(
  "Is a landing bounce ever explained by a floating floor covering?",
  "Yes — engineered flooring, laminate and some engineered board systems are designed with a small floating movement. But the structural floor underneath the covering should still feel solid. If both the floor covering and the subfloor bounce together, the problem is structural, not just the covering system.",
  { cls: "diagnostic_procedure", level: 2 },
);
add(
  "What is the expert view on landing bounce with a new staircase?",
  "A staircase is a system: stairs + landing + floor structure + handrail. The staircase itself may be perfect but if the landing support is poor, the whole installation reads as low quality to the customer. Ask the installer to inspect — never accept noticeable spring as 'that's how wood behaves'. On a new install, that answer is wrong.",
  { cls: "expert_observation", level: 3 },
);

writeFileSync(FILE, JSON.stringify(arr, null, 2));
console.log(`Added entries up to staircase-faq-${nextId - 1}. Total entries: ${arr.length}`);
