#!/usr/bin/env node
// Batch 4 staircase seed — fills the remaining gaps identified in
// Philip's 2026-07-25 second-round paste. Focus areas:
//   1. Specific timber-species detail (walnut, ash, maple, cherry,
//      mahogany, European vs American oak, rustic vs prime oak)
//   2. Timber grades, knots, quarter-sawn, straight grain
//   3. Solid vs engineered vs veneer comparison
//   4. Finishes technical: 2-pack lacquer, cracking, peeling,
//      surface prep, curing, silicone problems, water damage
//   5. Cleaning & maintenance practical detail
//   6. Component gaps: turned vs square spindles, replacing spindles,
//      loose handrail specifics, staircase well finishes
//
// Skips: installation basics, plastering timing, main-parts terminology,
// baluster/spindle basic definitions, and anything else covered by
// Batches 1-3 (which already gave the brain ~140 entries on those areas).

import fs from "node:fs";
import path from "node:path";

const FILE = path.resolve("knowledge/staircase.json");
if (!fs.existsSync(FILE)) { console.error("missing knowledge/staircase.json"); process.exit(1); }

const NEW = [
  // ─── Specific timber species ────────────────────────────
  { q: "What is European oak and why is it popular for staircases?",
    a: "European oak (Quercus robur / petraea) is the classic UK and mainland-European staircase timber — warmer tone than American oak, more character in the grain, and the medullary rays give it that distinctive figured look on quarter-sawn boards. It's what most people picture when they hear 'oak staircase'. Widely grown in France, Germany and the UK, so supply's stable and matching replacement components years later is straightforward.",
    audience: 3, classification: "expert_observation" },

  { q: "What is American white oak and how is it different from European oak?",
    a: "American white oak (Quercus alba) grows straighter and taller than European oak, so you get longer clear boards with fewer knots and a more uniform grain. It's a paler, cooler tone — often preferred for modern, minimal staircase designs where European oak's warm character would feel too traditional. Slightly harder than European oak on the Janka scale and takes stains very evenly, which is why furniture and staircase makers love it.",
    audience: 3, classification: "expert_observation" },

  { q: "What is rustic-grade oak?",
    a: "Oak selected to include natural features rather than screen them out — visible knots, sound cracks, colour variation, sapwood and figuring. It's the character-full end of the oak grade spectrum and it's genuinely the timber that suits farmhouses, cottages, converted barns and Arts-and-Crafts homes. Not lower quality, just deliberately non-uniform. Usually less expensive per m³ than prime because more of the tree can be used.",
    audience: 3, classification: "expert_observation" },

  { q: "What is prime-grade oak?",
    a: "Oak selected for a clean, near-knot-free, uniform-colour appearance — the tightly-controlled end of the oak grade spectrum. It's what you want if the staircase has to sit in a minimal, modern interior where any dark knot or splash of sapwood would jump out. More expensive than rustic because a lot more of each tree gets rejected to yield prime boards.",
    audience: 3, classification: "expert_observation" },

  { q: "Is walnut a good timber for a staircase?",
    a: "Yes — American black walnut is one of the finest staircase timbers you can pick if budget allows. Naturally rich chocolate-brown tone with darker striping through the grain, and it gets warmer and richer as it ages. It's what you use when the staircase needs to be the design centrepiece of the hallway. Downsides: significantly more expensive than oak, and darker timber shows dust and scratches more readily.",
    audience: 3, classification: "expert_observation" },

  { q: "What is ash timber like for a staircase?",
    a: "Pale, almost cream-blond with a very open, straight grain — visually the closest hardwood to oak in figure but noticeably lighter in colour. Ash is nearly as hard as oak, takes stains and finishes beautifully, and it's a great choice for a bright modern staircase where oak would feel too golden. Traditionally used for tool handles and sports gear because it's tough and shock-resistant — the same qualities help it survive family life on stairs.",
    audience: 3, classification: "expert_observation" },

  { q: "What is maple timber like for a staircase?",
    a: "Very pale — almost white — with an extremely fine, smooth grain and a subtle sheen. Rock maple (hard maple) is one of the hardest common staircase hardwoods, harder than oak, which is why it's the traditional choice for basketball courts and bowling alleys. On a staircase it gives you a clean, bright, contemporary look. Some maple can yellow slightly under UV over the years, so it works best away from strong direct sunlight.",
    audience: 3, classification: "expert_observation" },

  { q: "What is cherry timber like for a staircase?",
    a: "American cherry starts as a warm pinkish-brown and deepens over the first year or two into a rich, red-brown patina — that colour development is one of the reasons people choose it. Silky-smooth grain, takes a beautiful polish, and it sits perfectly in traditional and Arts-and-Crafts interiors. Softer than oak so it dents a little more easily, but the ageing character usually more than makes up for it.",
    audience: 3, classification: "expert_observation" },

  { q: "What is mahogany like for a staircase?",
    a: "The classic Georgian and Victorian staircase timber — deep reddish-brown, tight straight grain, and it polishes to a mirror finish that few other timbers match. Genuine mahogany (Swietenia species) is now covered by CITES trade restrictions, so most 'mahogany' staircases today are sapele, sipo or utile — all closely-related African species with similar tone and behaviour. Ask which specifically before you buy.",
    audience: 3, classification: "professional_recommendation" },

  { q: "Why does oak vary so much in colour and grain between staircases?",
    a: "Because oak's a natural material, not a manufactured one. Two oak trees from the same forest can have different tones, different grain density, different knot patterns and different figure — depending on their age, growing conditions, aspect and how the boards were cut. Even one tree can produce planks that look quite different from each other. That variation is why every oak staircase looks slightly individual; the flip side is you can't guarantee a perfect uniform match on components ordered years apart.",
    audience: 2, classification: "expert_observation" },

  // ─── Grades, knots, cuts ────────────────────────────────
  { q: "What does 'timber grade' mean for a staircase?",
    a: "A grade classification that tells you how clean, defect-free and uniform the timber is — usually a scale like Prime → Select → Character → Rustic, with each grade allowing progressively more knots, colour variation and natural features. The grade drives the price and the look. Prime for minimal modern interiors, Rustic for character-heavy farmhouse or cottage. Ask specifically what grade a quote is based on — 'oak staircase' by itself doesn't tell you.",
    audience: 3, classification: "professional_recommendation" },

  { q: "Are knots in staircase timber bad?",
    a: "Not automatically. Small, tight, sound knots add natural character and are fine both structurally and visually — that's what character-grade timber is all about. Big, loose, or 'dead' knots are a different matter: they can drop out, split, or weaken a component that's carrying load. A quality staircase maker cuts around problem knots when selecting boards for structural parts like strings and treads, and puts character knots where they'll show but not carry major stress.",
    audience: 3, classification: "expert_observation" },

  { q: "What is straight-grain timber and why does it matter on a staircase?",
    a: "Timber where the wood fibres run cleanly along the length of the board rather than diagonally or in swirls. Straight-grain timber is more stable (moves less with humidity), stronger along the length, and finishes more evenly. Staircase strings and long handrail sections benefit hugely from straight-grain stock — a swirly-grain string is more likely to bow, twist or crack over time.",
    audience: 4, classification: "manufacturer_guidance" },

  { q: "What is quarter-sawn timber?",
    a: "Timber cut so the growth rings meet the face of the board at close to 90° — you get boards with tight, straight, parallel grain lines and often a characteristic 'ray fleck' figure on oak. Quarter-sawn is significantly more stable (moves less across the grain), harder-wearing and more decorative than plain-sawn timber of the same species. Downside: much more waste from each tree, so it costs more. Premium furniture and quality staircase treads often specify quarter-sawn stock for a reason.",
    audience: 4, classification: "expert_observation" },

  { q: "What is timber movement and why does it happen on a staircase?",
    a: "Timber's a living material that swells slightly when humidity rises and shrinks slightly when it drops — that's timber movement. UK indoor conditions typically swing between 40-60% relative humidity through the year, and a staircase quietly moves with them. Movement is normal, expected and designed for; problems only arise when the movement's excessive (timber was too wet when installed) or when a component was locked in with no allowance for expansion.",
    audience: 3, classification: "expert_observation" },

  { q: "Why should a new staircase be acclimatised before installation?",
    a: "Timber picks up or loses moisture until it's in equilibrium with the air around it. If a workshop stores at 55% humidity and your house sits at 40%, an unacclimatised staircase will shrink after fitting — you'll get gaps and squeaks weeks later. Leave the delivered staircase indoors, wrapped or partially wrapped, in the room it'll be installed, for a week or two before install. It's a small delay that stops a lot of future noise.",
    audience: 3, classification: "professional_recommendation" },

  // ─── Solid, engineered, veneer ──────────────────────────
  { q: "What is solid timber on a staircase — and what are its advantages?",
    a: "Solid timber means the component is one piece of natural wood all the way through — a solid oak tread is 20+ mm of actual oak. Advantages: natural depth of grain and colour, ages beautifully, deep enough to sand and refinish multiple times over decades, and structurally the most repairable. It's what quality bespoke staircases are made from throughout.",
    audience: 3, classification: "expert_observation" },

  { q: "What are the disadvantages of solid timber on a staircase?",
    a: "Higher cost per board, more natural movement with humidity, more variation piece-to-piece (which some people call disadvantage, others call character), and heavier to handle. None of these are dealbreakers — they're just characteristics of using real, natural wood rather than an engineered substitute. Manage them properly (moisture-conditioned timber, acclimatisation before install, appropriate finishing) and solid timber outperforms almost anything.",
    audience: 3, classification: "expert_observation" },

  { q: "What is engineered timber on a staircase?",
    a: "Engineered timber is made by laminating a solid hardwood top layer (the 'wear layer', usually 4-6 mm) onto a stable multi-layer core of cross-bonded softwood or plywood. Because the layers are bonded with grain running in different directions, the whole board moves much less with humidity than a solid plank of the same species. Common on modern staircase treads where dimensional stability matters — long treads on wide flights, or homes with underfloor heating.",
    audience: 4, classification: "expert_observation" },

  { q: "Is engineered timber lower quality than solid timber on a staircase?",
    a: "Not automatically — it's a different tool for a different job. A well-made engineered oak tread with a 6 mm real-oak wear layer looks identical to a solid oak tread and moves less. Downside: only that 6 mm can be sanded and refinished, versus 20+ mm on a solid tread, so it has a shorter refinishing lifespan. For a staircase you plan to have for 100 years, solid wins; for a modern interior with underfloor heating, engineered often makes better sense.",
    audience: 3, classification: "professional_recommendation" },

  { q: "What is a timber veneer and where's it used on a staircase?",
    a: "A veneer is a thin (typically 0.5-1 mm) slice of real wood glued onto a stable substrate like MDF or plywood. On a staircase, veneers are most commonly seen on newel posts, decorative panels, and sometimes riser faces where a premium timber appearance is wanted without the cost or movement of solid stock. Quality veneered work looks identical to solid — but veneers can't be sanded back if damaged, so a deep gouge means replacing the panel, not refinishing it.",
    audience: 3, classification: "expert_observation" },

  { q: "Are veneered staircase parts lower quality?",
    a: "Not necessarily — it depends on the veneer quality, the substrate and the edge detailing. A skilled joiner using a good-quality veneer on a stable substrate produces work that reads identical to solid timber and is often more dimensionally stable. Where veneer falls down is repairs — you can't sand into a 0.5 mm veneer without going through, so any deep damage means a full component replacement. Fine for decorative parts, less ideal for high-wear areas like treads.",
    audience: 3, classification: "professional_recommendation" },

  { q: "How do I choose between solid timber, engineered timber and veneered components for my staircase?",
    a: "Rough guide: TREADS and HANDRAILS are the parts you wear out fastest, so solid or engineered is the right call — never veneer on a tread. STRINGS, RISERS, NEWEL POSTS, SPINDLES sit in the middle — solid is best but engineered or well-veneered is fine. DECORATIVE PANELS and CAPS work well in veneer. Ask your staircase maker to spell out what's solid, what's engineered and what's veneered before you sign off the quote — good makers will tell you plainly.",
    audience: 3, classification: "professional_recommendation" },

  // ─── Finishes — what they are, what fails ───────────────
  { q: "Why does a staircase need a proper high-traffic finish?",
    a: "Because stairs are one of the highest-wear surfaces in the whole house — every footstep is hundreds of times harder on the finish than any equivalent surface on a floor. A finish made for furniture or shelving simply hasn't been engineered for that abuse and will start failing (going dull, wearing through, cracking) within a year or two of install. Always specify a floor-grade or staircase-grade finish, and confirm the product's rated for stair use before it's applied.",
    audience: 3, classification: "professional_recommendation" },

  { q: "What is a 2-pack lacquer (or 2K lacquer) for staircases?",
    a: "A finish that comes as two components — the base lacquer and a hardener — which react chemically when mixed to produce a much tougher, more chemically-resistant cured film than any single-pack product. 2-pack polyurethane lacquers are the workhorse of professional staircase finishing because they'll take years of foot traffic without dulling or wearing through. Downside: shorter pot life after mixing, and DIY-unfriendly — usually applied by a specialist.",
    audience: 4, classification: "manufacturer_guidance" },

  { q: "Is a harder staircase finish always the best choice?",
    a: "No — hardness alone doesn't win. A great staircase finish balances hardness (so it doesn't wear through), flexibility (so it moves slightly with the timber rather than cracking), adhesion (so it doesn't peel), and repairability (so you can touch it up in ten years). Ultra-hard finishes with no flex will craze or crack when the timber moves seasonally; ultra-flexible finishes wear through fast. Trust your finisher's product choice — they know what balances these for your timber.",
    audience: 4, classification: "manufacturer_guidance" },

  { q: "Why does staircase varnish sometimes crack?",
    a: "Cracking usually means the finish couldn't move with the timber underneath. Common causes: wrong product (a rigid finish on a species that moves a lot), too-thick coats trapping stress in the film, the timber being applied when it was too wet (it shrunk under the finish), or a fresh cold-cured coat over an old flexible one it isn't compatible with. Cracks are usually a sign to strip back and refinish properly, not to just recoat.",
    audience: 4, classification: "diagnostic_procedure" },

  { q: "Why does staircase lacquer peel?",
    a: "Peeling is nearly always an adhesion failure — the finish never bonded properly to what it was applied over. Usual causes: dust, wax or polish residue on the timber before coating; oil or moisture in the timber; wrong product for the surface (e.g. a water-based coat over an old solvent-based one without prep); or coating over a very smooth machined surface without keying. The fix is to strip back to bare timber in the affected area, prep it properly, and recoat — patching over a peeling area rarely lasts.",
    audience: 4, classification: "diagnostic_procedure" },

  { q: "Why is surface preparation so important before varnishing a staircase?",
    a: "Because 90% of a finish's performance comes from what you do BEFORE the first coat goes on. Poorly-prepared timber means poor adhesion (peeling), trapped dust and grit (bumpy finish), residual wax or old polish (fisheyes and beads), or trapped moisture (clouding and blistering). Proper prep — sanding through grits, vacuuming, tack-clothing, letting it settle — is what separates a finish that lasts 15 years from one that fails in 15 months.",
    audience: 3, classification: "industry_good_practice" },

  { q: "Why does a newly-sanded staircase need to rest before the first coat of finish?",
    a: "Two reasons: airborne sanding dust needs time to settle so it doesn't drop into a fresh wet coat, and the timber itself needs a moment to release any surface moisture picked up during sanding. Rush straight from sander to brush and you'll trap dust in the film and risk a hazy, uneven finish. A vacuum, a tack-cloth wipe, and an hour of settling is the minimum — a full overnight rest is even better.",
    audience: 4, classification: "industry_good_practice" },

  { q: "Why must a staircase be completely dry before applying finish?",
    a: "Because moisture trapped under a finish film has nowhere to go and causes exactly the problems that ruin the job: cloudiness, blistering, poor adhesion, peeling, and finish that never cures properly. Freshly-sanded timber, timber that's been wiped with a damp cloth, or timber that's still acclimatising after a wet building phase all need proper drying time before coating. Timber moisture-meter readings should be steady before you start.",
    audience: 4, classification: "manufacturer_guidance" },

  { q: "How long should a newly-finished staircase cure before it's used and cleaned?",
    a: "Depends on the product — always follow the finish manufacturer's data sheet, not internet guesses. Broad ranges: most modern water-based lacquers are foot-traffic-safe in 24-48 hours but only fully cured after 7-14 days. 2-pack polyurethanes are usually usable within a day but need 7-10 days for full chemical cure. Cleaning with anything other than a dry microfibre cloth should wait until full cure. Use it gently early on — full grip and hardness aren't there yet.",
    audience: 3, classification: "manufacturer_guidance" },

  { q: "Can sunlight damage a staircase finish?",
    a: "Yes — UV breaks down the polymers in most clear finishes over years, causing yellowing, cloudiness or gradual loss of protection. It also bleaches or darkens the timber underneath depending on the species (oak yellows, walnut lightens, cherry darkens). Staircases in south-facing hallways with strong direct sunlight show it fastest. Modern UV-resistant lacquers slow the process significantly but don't eliminate it — sheer curtains on hallway windows help more than most people realise.",
    audience: 3, classification: "expert_observation" },

  // ─── Cleaning practices ─────────────────────────────────
  { q: "Can any household cleaner be used on a wooden staircase?",
    a: "No — most household spray cleaners contain something that'll shorten your finish's life. Bleach, ammonia, strong alkaline degreasers, acid-based bathroom cleaners and citrus solvents all attack modern lacquers to some degree. The safe list is very short: pH-neutral cleaner made for finished timber floors, applied damp (not wet) with a microfibre cloth. Or a plain damp cloth for routine dust. That's it — anything more aggressive is a risk not a benefit.",
    audience: 2, classification: "industry_good_practice" },

  { q: "Should furniture polish sprays be used on a wooden staircase?",
    a: "No — never. Furniture polishes contain silicones or waxes that build up a slippery film on the tread surface, which is genuinely dangerous on stairs. They also leave residues that stop any future recoat or repair from bonding — a stair polished with silicone for ten years can be almost impossible to refinish. Stick to a plain damp microfibre cloth for weekly clean-up and a pH-neutral timber floor cleaner for occasional deeper cleaning.",
    audience: 2, classification: "safety_advice" },

  { q: "Should I steam-clean my wooden staircase?",
    a: "No — the combination of heat, high-pressure moisture and prolonged contact is exactly what wooden staircase finishes are NOT designed for. Steam forces water past the finish into the timber, softens some lacquer types, and can lift joints. Steam cleaners are marketed for hard floors but manufacturers of quality timber finishes universally advise against them. A damp microfibre cloth does everything a steam cleaner does on a staircase, safely.",
    audience: 2, classification: "safety_advice" },

  { q: "Why is too much water bad for a wooden staircase?",
    a: "Because water is the one thing timber's finish tries hardest to keep out — and if enough sits on the surface long enough, it eventually gets past. Water sitting in a puddle causes the finish to whiten (a condition called 'blushing'), timber to swell locally, joints to open, and eventually finish failure. Clean with a damp cloth, not a wet mop. If anything spills, wipe it up straightaway, not later.",
    audience: 2, classification: "industry_good_practice" },

  { q: "Why are silicone-based products particularly bad for staircases?",
    a: "Because silicone contamination is the single most common cause of a refinish failing. Silicone (found in some furniture polishes, air fresheners over-sprayed near stairs, some 'wood care' products) leaves an invisible film that migrates deep into the timber pores. Years later when you try to refinish, the new lacquer beads and won't bond, and stripping the silicone out is extremely difficult. If you value being able to refinish the staircase one day, keep silicone products away from it now.",
    audience: 3, classification: "expert_observation" },

  { q: "Should I test a cleaning product on a staircase before using it?",
    a: "Always — pick a hidden area (underneath a tread nosing, side of a bottom newel, back of a spindle) and try a small dab. Wait 15-20 minutes. Look for cloudiness, softening, stickiness or dullness. If anything changes, don't use that product on the visible surface. Even products marketed as safe can react unexpectedly with specific finishes; the two-minute test saves a hallway of regret.",
    audience: 2, classification: "professional_recommendation" },

  { q: "What's the best routine for regular cleaning of a wooden staircase?",
    a: "Weekly: vacuum the corners and tread edges to lift grit before it scratches, then dust the horizontal surfaces with a dry microfibre. Fortnightly: wipe the treads with a slightly damp (not wet) microfibre cloth. Monthly to quarterly: same wipe with a small amount of pH-neutral timber-floor cleaner mixed as per the manufacturer's dilution. That's it — most staircase finish failures come from over-cleaning with the wrong products, not under-cleaning.",
    audience: 2, classification: "industry_good_practice" },

  { q: "Why are the walking areas on my staircase darker than the rest?",
    a: "Two possible causes and it's worth working out which. Cause one: dirt building up in the wear line — a proper cleaning brings it back to normal. Cause two: the finish has worn through and dirt has ground into the bare timber underneath — cleaning won't fix it and you're looking at a refinish. Simple test: clean a small area properly. If it comes back to match, it was just dirt; if it stays dark, the finish has gone.",
    audience: 2, classification: "diagnostic_procedure" },

  { q: "How do I tell whether my staircase needs cleaning or refinishing?",
    a: "Wet a fingertip and rub a suspect area. If a dull patch comes back to shine when it's damp, the finish is intact — it just needs cleaning. If it stays dull when wet, the finish has worn through and you're into refinishing territory. If you see actual bare wood or fibres lifting, definitely refinish. Getting this diagnosis right saves you either buying refinish products you don't need, or over-scrubbing a stair that's actually asking for a recoat.",
    audience: 3, classification: "diagnostic_procedure" },

  { q: "Should I keep a record of what finish is on my staircase?",
    a: "Yes — write down the brand, product name, colour or shade, application date and number of coats, and store it somewhere obvious (an envelope in the drawer with warranty paperwork). In five or ten years when you need a touch-up or a full recoat, knowing exactly what's on there means the new finish will match and bond properly. Refinishing 'unknown' is significantly harder than refinishing 'the Bona Traffic HD applied 2020'.",
    audience: 3, classification: "professional_recommendation" },

  // ─── Component detail gaps ──────────────────────────────
  { q: "Do turned spindles collect more dust than square or plain spindles on a staircase?",
    a: "Yes — every groove, curl and turned bead is a shelf for household dust. Traditional turned oak or mahogany spindles look magnificent but need a proper dusting run every couple of weeks, especially the flat facets. Square section or plain-tapered spindles are much easier to keep clean, which is one reason they're often specified for allergy-conscious households or high-traffic hallways. A soft brush attachment on the vacuum handles it in five minutes.",
    audience: 2, classification: "expert_observation" },

  { q: "Why have square newel posts and spindles become so popular in modern staircases?",
    a: "Two reasons — visual and practical. Visually, plain square profiles complement modern minimal interiors and pair naturally with glass panels, steel details and painted finishes. Practically, they're much easier to keep clean than turned traditional profiles, and the flat faces take stain and paint more evenly. Turned newels and spindles are still absolutely correct for period and cottage homes; squares just suit the last 20 years of house style.",
    audience: 2, classification: "expert_observation" },

  { q: "Where can I buy replacement spindles or balusters for my staircase?",
    a: "In order of best-first: the original staircase manufacturer if they still exist (a perfect match), a specialist staircase or joinery supplier, or a good timber merchant with joinery capability. Take one of the existing spindles with you if possible — or clear photos plus these measurements: overall length, top diameter, bottom diameter, any decorative bead positions, and the fixing detail at both ends (dowelled, tenoned, glued into base rail). The more specific you can be, the closer the match.",
    audience: 3, classification: "professional_recommendation" },

  { q: "Can I replace just one damaged spindle on my staircase?",
    a: "Yes — a single spindle replacement is usually a straightforward job for a joiner, provided you can source a matching one. The harder part is often the colour match: a 20-year-old oak spindle has aged and darkened; a new one straight from the mill hasn't. It'll blend in eventually as it ages too, but for the first few years it'll be noticeably paler. Ask about a tinted finish to bring it closer to the aged tone.",
    audience: 3, classification: "professional_recommendation" },

  { q: "Why has my staircase handrail become loose over the years?",
    a: "Almost always one of three things: the handrail fixings into the newel post at each end have worked loose (the most common), the newel post itself is loose in its base fixing (second most common), or the join between two lengths of handrail has opened up with timber movement. A joiner can usually diagnose which in about ten minutes by feeling where the movement is. Don't ignore it — a loose handrail is a genuine safety issue on a staircase.",
    audience: 2, classification: "safety_advice" },

  { q: "Should I just add more screws to fix a loose staircase handrail?",
    a: "No — you need to find WHERE the movement is first. Adding screws blindly can damage the visible handrail face, split hidden joints, and hide the real cause without fixing it. The fix depends on the location: loose handrail-to-newel fixing needs the existing bolt or dowel tightening or replacing; loose newel-to-base needs the newel refixing (which might need lifting a floorboard); loose handrail joint needs the joint dismantling, cleaning and re-gluing.",
    audience: 3, classification: "professional_recommendation" },

  // ─── Staircase well & surrounding finishes ─────────────
  { q: "What is the staircase well?",
    a: "The whole open area around and underneath the staircase — the wall down the side, the space beside the flight, the underside of the treads if it's an open-riser design, and any open landing above. Getting the well finish right (plasterboard, timber panelling, feature wall, etc.) makes almost as much difference to how the staircase looks in the room as the staircase itself does. Plan the well finish alongside the staircase, not as an afterthought.",
    audience: 2, classification: "expert_observation" },

  { q: "Should I use plasterboard or timber panelling to finish the wall beside my staircase?",
    a: "Plasterboard is the default — clean, minimal, painted to match the hallway, low maintenance. Timber panelling (tongue-and-groove, feature panels, half-height wainscot) makes the staircase feel like a design set-piece rather than a functional structure, and it hides fingerprints and scuffs far better than paint. Which fits depends entirely on the interior style: minimal modern goes plaster, traditional cottage or Arts-and-Crafts goes panelled. Both work brilliantly when done well.",
    audience: 2, classification: "professional_recommendation" },

  { q: "What is tongue-and-groove panelling around a staircase?",
    a: "Timber boards machined with a tongue on one edge and a matching groove on the other, so they interlock as they're fitted. Very common as feature panelling on the wall alongside a traditional staircase — typically fitted vertically up to dado height or full-height, painted white or in a heritage colour. Practical benefits: hard-wearing, easily painted, and hides small wall imperfections. Character-heavy without being fussy.",
    audience: 2, classification: "expert_observation" },

  { q: "Can the staircase maker use their offcut timber for feature panelling around the staircase?",
    a: "Sometimes — worth asking. If the staircase is in oak and there's a workshop with offcuts of the same batch, matching-timber panelling on the wall alongside can look stunning. Depends on quantity and offcut sizes though: staircase manufacturing produces varied offcuts and there isn't always enough clean stock left in the right species for a full panel run. Ask early — before manufacturing starts, not after.",
    audience: 3, classification: "professional_recommendation" },

  { q: "Should the staircase well finish match the staircase style?",
    a: "Ideally yes — they read as one composition when you walk into a hallway. Modern staircase with painted plaster walls; traditional turned-baluster staircase with painted panelled walls; oak staircase with a natural stone-tile floor at the base. The mistake is treating them separately, ending up with a beautiful staircase against a wall that visually fights it. Design the whole hallway envelope around the staircase, or vice versa.",
    audience: 2, classification: "expert_observation" }
];

// ─── Load + append with dedup ─────────────────────────────────
const doc = JSON.parse(fs.readFileSync(FILE, "utf8"));
if (!Array.isArray(doc.entries)) doc.entries = [];

const nextN = doc.entries.reduce((a, e) => {
  const m = String(e.id ?? "").match(/-(\d+)$/);
  return m ? Math.max(a, parseInt(m[1], 10)) : a;
}, 0) + 1;

const norm = (q) => String(q ?? "").toLowerCase().replace(/[?.!,;:'"]/g, "").replace(/\s+/g, " ").trim();
const existing = new Set(doc.entries.map((e) => norm(e.question)));

let added = 0, skipped = 0;
for (const item of NEW) {
  if (existing.has(norm(item.q))) { skipped += 1; continue; }
  const entry = {
    id: `staircase-faq-${String(nextN + added).padStart(3, "0")}`,
    kind: "faq",
    question: item.q,
    answer: item.a,
    category_tag: "staircase",
    audience_level: item.audience ?? null,
    classification: item.classification ?? "industry_good_practice",
    safety_note: item.safety ?? null,
    source_verified_at: null,
    fact_check_flag: null
  };
  doc.entries.push(entry);
  existing.add(norm(item.q));
  added += 1;
}
doc.count = doc.entries.length;
doc.generated_at = new Date().toISOString();
fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + "\n", "utf8");
console.log(`✅ Batch 4 (species + finishes + cleaning + gaps): Added ${added} new entries (${skipped} skipped). Total: ${doc.entries.length}`);
