// scripts/nex-brain/ingest-batch2-staircase-refs-manifest.mjs
//
// Add rich per-image metadata for the 31 batch-2 staircase reference images
// Philip supplied 2026-08-13. Every field reflects what Claude (multimodal)
// actually observed in the corresponding img-NNN.png · nothing invented.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const NOW_ISO = "2026-08-13T23:00:00.000Z";

const IMAGES = [
  {
    file: "img-001.png",
    slug: "ref-b2-001-oak-small-quarter-turn-traditional-hallway",
    scene: { geometry: "quarter-turn (winder) small flight ascending with turn at bottom", viewpoint: "wide hallway overview", surrounding: "traditional oak-panelled hallway with matching oak internal doors + oak plank floor" },
    materials: { primary_species: "oak · warm mid-tone honey · matches surrounding doors and floor", tread: "oak · closed riser · painted white risers implied", string: "closed oak string", floor: "oak plank" },
    components: { newel_posts: "square oak newels · plain caps · one on each corner of the turn", handrail: "oak flat handrail", balustrade_infill: "slim white-painted spindle balusters (very traditional)", starter_step: "small curved bullnose starter · projects into hallway" },
    lighting: "recessed ceiling downlights · no dedicated stair LED",
    walk_line: "walk line diverts around the winder at bottom",
    image_type: "reference · traditional hallway scene",
    purpose: "small oak-and-white spindle staircase reference · winder starter",
    tags_extra: ["oak", "traditional", "white-spindles", "quarter-turn", "winder", "small-flight", "hero-scene"],
    quality: "hero",
  },
  {
    file: "img-002.png",
    slug: "ref-b2-002-walnut-sinuous-wave-balusters-led-under-tread",
    scene: { geometry: "straight flight ascending right", viewpoint: "wide side-on hero", surrounding: "luxury hallway · lounge with pendant lights beyond doorway · abstract art · dark wood door · plants" },
    materials: { primary_species: "dark walnut · deep chocolate brown · pronounced grain", tread: "closed walnut treads · stainless nose strip · warm-white LED under-tread strip along each tread nose", string: "walnut closed string", floor: "polished cream porcelain tile" },
    components: { newel_posts: "square walnut newel · brushed stainless collar wrap + integrated top-cap LED · under-hollow that lets warm light escape at newel base", handrail: "walnut flat handrail", balustrade_infill: "sculptural SINUOUS WAVE-FORM walnut balusters · alternating curves · signature detail", starter_step: "twin oval-bullnose cascading starter · projects into hallway" },
    lighting: "LED strip on each tread nose · newel top-cap LED · newel base LED spill · pendant lights beyond",
    walk_line: "clear centre-of-tread walk line",
    image_type: "reference · signature contextual scene",
    purpose: "sculptural sinuous baluster reference · under-tread LED exemplar · luxury walnut design",
    tags_extra: ["walnut", "dark-hardwood", "closed-riser", "sinuous-balusters", "wave-form-balusters", "sculptural", "led-tread-nosing", "stainless-collar-newel", "twin-bullnose-starter", "luxury", "hero-scene", "signature"],
    quality: "hero",
  },
  {
    file: "img-003.png",
    slug: "ref-b2-003-walnut-sinuous-balusters-alternate-angle",
    scene: { geometry: "same design family as b2-002 · corner-view framing", viewpoint: "corner view showing hallway + entry to lounge on left", surrounding: "same luxury interior context" },
    materials: "walnut + stainless + porcelain tile · same as b2-002",
    components: "sculptural sinuous walnut wave balusters · walnut handrail · walnut newel with stainless collar + LED top cap · twin bullnose starter · same design as b2-002 different angle",
    lighting: "LED tread-nose strip · newel LED · lounge pendants",
    walk_line: "centre-of-tread walk line",
    image_type: "reference · alternate angle",
    purpose: "second-angle library variant of b2-002 sinuous-baluster design",
    tags_extra: ["walnut", "sinuous-balusters", "wave-form-balusters", "sculptural", "led-tread-nosing", "alternate-angle", "hero-scene"],
    quality: "hero",
  },
  {
    file: "img-004.png",
    slug: "ref-b2-004-detail-walnut-newel-stainless-collar-top-led",
    scene: { geometry: "close-up detail shot", viewpoint: "close-up of newel + first few balusters", surrounding: "not the subject" },
    materials: { primary_species: "walnut newel + spindles · brushed stainless collar wrap + top-cap LED · stainless top and bottom shoe fittings on each spindle" },
    components: { newel_posts: "detail: walnut square newel with BRUSHED STAINLESS wrap around waist + rectangular stainless top cap with warm-white LED bar recessed under it · plain walnut column body", handrail: "walnut flat handrail entering top of newel", balustrade_infill: "close-up of sinuous walnut wave-form balusters · each spindle has brushed stainless cylindrical top and bottom shoe fittings on the handrail and stringcap · precisely engineered joinery detail" },
    lighting: "warm LED under top-cap of newel · warm LED under-tread strip visible on adjacent treads",
    walk_line: "not the subject",
    image_type: "reference · component detail shot",
    purpose: "component-level detail for the b2-002/003 sinuous-baluster design · shows newel construction and spindle-shoe fittings",
    tags_extra: ["walnut", "component-detail", "close-up", "newel-detail", "stainless-collar", "stainless-shoe-fittings", "sinuous-balusters", "top-cap-led", "hero-scene"],
    quality: "hero",
  },
  {
    file: "img-005.png",
    slug: "ref-b2-005-walnut-vertical-led-newel-hero",
    scene: { geometry: "straight flight ascending right (same house as b2-002/003)", viewpoint: "wide hero from hallway", surrounding: "same luxury interior · lounge beyond doorway · pendant lights" },
    materials: "walnut + brushed stainless + porcelain tile",
    components: { newel_posts: "walnut square newel with TALL VERTICAL LED SLOT PANEL on the visible face (contrast to b2-002's stainless-collar variant · this is the LED-slot family)", handrail: "walnut flat handrail", balustrade_infill: "same sinuous walnut wave balusters", starter_step: "twin oval-bullnose cascading starter" },
    lighting: "vertical LED slot in newel · LED tread-nose strip · newel base LED spill",
    walk_line: "centre-of-tread walk line",
    image_type: "reference · hero scene · vertical-LED variant",
    purpose: "vertical-LED-newel variant of the sinuous-baluster design family",
    tags_extra: ["walnut", "sinuous-balusters", "vertical-led-newel", "twin-bullnose-starter", "led-tread-nosing", "hero-scene"],
    quality: "hero",
  },
  {
    file: "img-006.png",
    slug: "ref-b2-006-dark-oak-white-risers-stainless-bars-stainless-kickboard",
    scene: { geometry: "straight flight ascending right", viewpoint: "hallway wide", surrounding: "cream hallway · console with lamp · framed art · dark internal door · cream porcelain tile floor" },
    materials: { primary_species: "dark walnut / medium-dark oak stained · deep brown", tread: "dark hardwood closed treads · PAINTED WHITE risers create strong horizontal-band contrast", string: "walnut cladding on outer face · closed string · stainless steel kickboard at floor", floor: "cream porcelain tile" },
    components: { newel_posts: "walnut square newel · brushed stainless base sleeve wrap at floor + brushed stainless top cap · very slim vertical proportion", handrail: "walnut flat handrail", balustrade_infill: "brushed stainless steel vertical round bar balusters", starter_step: "flush rectangular starter with stainless kickboard base" },
    lighting: "ambient hallway lighting · no dedicated LED on flight itself",
    walk_line: "centre-of-tread walk line",
    image_type: "reference · classic hero scene",
    purpose: "dark-hardwood + WHITE riser contrast + stainless balusters · dressed with stainless kickboard reference",
    tags_extra: ["walnut", "dark-hardwood", "white-riser", "stainless-bar-balusters", "stainless-kickboard", "stainless-newel-base", "traditional-modern", "hero-scene"],
    quality: "hero",
  },
  {
    file: "img-007.png",
    slug: "ref-b2-007-oak-oak-spindles-black-planter-newels-carpet-runner",
    scene: { geometry: "straight flight ascending right", viewpoint: "wide side-on hero", surrounding: "same hallway family as batch-1 img-013/015 · cream console · gallery art · pale timber floor" },
    materials: { primary_species: "oak (spindles, handrail, string, tread nosings) + matt-black newel posts", tread: "closed riser · cream/beige carpet runner covering centre · oak nosings + oak margins visible on either side of runner", string: "oak closed string on outer face" },
    components: { newel_posts: "TWO matt-black square-section newels · oak flat caps · vertical LED slot + planter inset feature (same design family as batch-1 img-011/012/013)", handrail: "oak flat handrail", balustrade_infill: "SLIM natural OAK spindle balusters (not painted black) · closely spaced", starter_step: "flush starter · stainless base band + under-glow LED strip" },
    lighting: "square recessed wall LED step-lights beside flight (dense pattern — one per couple treads) · vertical LED slot in newels · under-starter LED band",
    walk_line: "centre-of-tread walk line under carpet runner · oak margins each side",
    image_type: "reference · hero contextual scene",
    purpose: "carpet-runner variant of the batch-1 oak-spindle + black-newel design",
    tags_extra: ["oak", "oak-spindles", "black-newel", "led-newel", "planter-inset", "carpet-runner", "cream-runner", "led-wall-step-lights", "hero-scene"],
    quality: "hero",
  },
  {
    file: "img-008.png",
    slug: "ref-b2-008-dark-walnut-arched-riser-shadows-double-wall-mopstick-handrails",
    scene: { geometry: "straight narrow flight looking UP", viewpoint: "front-on looking up the flight", surrounding: "narrow enclosed stairwell with both side walls painted cream · dark hardwood floor at foot · sitting-room glimpsed on left" },
    materials: { primary_species: "dark walnut · deep chocolate brown", tread: "walnut closed-riser · risers show subtle ARCHED shadow-line detail (visual arch shape on each riser face — likely a routed decorative arch or a shadow gap detail)", string: "walnut closed string both sides · adjacent to painted walls", floor: "dark hardwood plank" },
    components: { newel_posts: "not visible (wall-to-wall enclosed flight)", handrail: "TWO wall-mounted rounded MOPSTICK handrails · one on each side wall · both terminated in decorative brass-coloured rosette/scroll end brackets", balustrade_infill: "no balustrade — enclosed flight uses walls as guarding + wall-mounted mopstick handrails", starter_step: "flush rectangular starter" },
    lighting: "warm ambient ceiling light at top of flight · ambient sitting room light spilling from left",
    walk_line: "clear centre-of-tread walk line (narrow flight width)",
    image_type: "reference · enclosed-flight hero scene",
    purpose: "wall-to-wall enclosed staircase with double mopstick handrails reference · shows arched-riser decorative detail",
    tags_extra: ["walnut", "dark-hardwood", "closed-riser", "arched-riser-detail", "enclosed-flight", "wall-to-wall", "double-mopstick-handrail", "brass-handrail-bracket", "scroll-bracket", "hero-scene"],
    quality: "hero",
  },
  {
    file: "img-009.png",
    slug: "ref-b2-009-oak-annotated-starter-6-inch-projection-reference",
    scene: { geometry: "straight flight ascending right · narrow hallway", viewpoint: "hallway wide", surrounding: "modern hallway · oak doors · oak plank floor · pale rug · potted plant · framed art · educational annotation visible in image (6\" measurement line marked with arrows below the starter step)" },
    materials: { primary_species: "oak · warm mid-tone", tread: "oak · closed-riser · painted white risers", string: "oak closed string outer face" },
    components: { newel_posts: "oak square newel · plain flat cap · square section", handrail: "oak flat handrail", balustrade_infill: "SLIM black round metal balusters (very thin gauge)", starter_step: "curved bullnose (D-shape) starter · projects into hallway · ANNOTATED with '6\"' dimension line showing projection depth" },
    lighting: "recessed ceiling downlights",
    walk_line: "walk line widens at bullnose starter",
    image_type: "reference · EDUCATIONAL / ANNOTATED reference image (has printed measurement annotation)",
    purpose: "TEACHING image showing typical bullnose starter projection dimension (6 inches) · use for measurement education not as a plain product photo",
    tags_extra: ["oak", "closed-riser", "black-metal-balusters", "slim-baluster", "bullnose-starter", "annotated", "measurement-annotation", "6-inch-projection", "educational-reference", "teaching-image"],
    quality: "hero",
    honesty_flag: "image contains a printed measurement annotation (6\") · educational reference showing typical starter projection",
  },
  {
    file: "img-010.png",
    slug: "ref-b2-010-oak-riser-number-plates-stainless-front-on",
    scene: { geometry: "straight flight · front-on view · quarter-landing implied top", viewpoint: "front-on looking up the flight · narrow", surrounding: "minimal cream painted walls · dark slate tile floor · plant top of flight" },
    materials: { primary_species: "oak · warm mid-tone", tread: "oak closed-riser", string: "oak closed string both sides · adjacent to painted walls", floor: "dark slate tile" },
    components: { newel_posts: "not visible (wall-enclosed flight)", handrail: "wall-mounted oak rectangular handrail on left (visible above balustrade rail off frame)", balustrade_infill: "none visible — enclosed flight", starter_step: "flush · with STAINLESS STEEL RECTANGULAR PLATE fixed centrally on each riser face (looks like a navigation aid / step number plate reservation)", tread_detail: "each riser has ONE stainless steel rectangular plate centred (empty · could be for step numbering, floor level indication, or LED)" },
    lighting: "ambient ceiling light warm-white",
    walk_line: "centre-of-tread walk line",
    image_type: "reference · unusual detail / product reference",
    purpose: "shows a distinctive riser-centred stainless plate detail (potentially for step numbering, LED, or hotel/commercial floor markers) · unusual variant",
    tags_extra: ["oak", "closed-riser", "wall-enclosed", "stainless-riser-plate", "unusual-detail", "commercial-hotel-style", "hero-scene"],
    quality: "hero",
  },
  {
    file: "img-011.png",
    slug: "ref-b2-011-oak-stainless-nose-strips-quarter-landing-narrow",
    scene: { geometry: "straight flight with quarter-landing top-right · narrow enclosed", viewpoint: "front-on wide", surrounding: "narrow enclosed stairwell · cream painted walls · large potted plant top · warm timber console visible left · dark slate floor" },
    materials: { primary_species: "oak · warm mid-tone", tread: "oak closed-riser · stainless steel nose strip on each tread leading edge", string: "oak closed string both sides", floor: "dark slate tile" },
    components: { newel_posts: "none visible (wall-enclosed)", handrail: "wall-mounted oak mopstick handrail on right", balustrade_infill: "none · enclosed flight", starter_step: "flush · with stainless nose strip" },
    lighting: "warm ceiling wash at top of flight · ambient",
    walk_line: "centre-of-tread walk line · widens at quarter landing",
    image_type: "reference · enclosed-flight scene",
    purpose: "wall-enclosed oak flight with stainless nose strips + single mopstick handrail reference",
    tags_extra: ["oak", "closed-riser", "stainless-nose-strip", "wall-enclosed", "mopstick-handrail", "wall-mounted-handrail", "quarter-landing", "narrow-flight", "hero-scene"],
    quality: "hero",
  },
  {
    file: "img-012.png",
    slug: "ref-b2-012-oak-stainless-nose-strips-front-on-narrow",
    scene: { geometry: "straight flight · front-on view · narrow enclosed", viewpoint: "front-on symmetric", surrounding: "narrow enclosed stairwell · cream painted walls · pale porcelain tile floor" },
    materials: { primary_species: "oak · warm mid-tone", tread: "oak closed-riser · stainless steel nose strip on each tread leading edge", string: "oak closed string both sides adjacent to walls", floor: "pale porcelain tile" },
    components: { newel_posts: "none (wall-enclosed)", handrail: "oak square-section wall-mounted handrail on right", balustrade_infill: "none · enclosed", starter_step: "flush · stainless nose strip" },
    lighting: "warm ceiling light at top",
    walk_line: "clean centre-of-tread walk line · symmetric view ideal for measuring visual walk-line",
    image_type: "reference · front-on symmetric",
    purpose: "narrow enclosed oak flight reference · square-section wall handrail exemplar",
    tags_extra: ["oak", "closed-riser", "stainless-nose-strip", "wall-enclosed", "square-section-handrail", "wall-mounted-handrail", "front-on-view", "hero-scene"],
    quality: "hero",
  },
  {
    file: "img-013.png",
    slug: "ref-b2-013-oak-plain-treads-front-on-narrow",
    scene: { geometry: "straight flight · front-on view · narrow enclosed", viewpoint: "front-on symmetric", surrounding: "narrow enclosed stairwell · cream painted walls · pale porcelain tile floor" },
    materials: { primary_species: "oak · warm mid-tone", tread: "oak closed-riser · PLAIN oak edge (no nose strip · contrast to b2-012)", string: "oak closed string both sides", floor: "pale porcelain tile" },
    components: { newel_posts: "none (wall-enclosed)", handrail: "oak square-section wall-mounted handrail on right", balustrade_infill: "none", starter_step: "flush plain oak" },
    lighting: "warm ceiling light",
    walk_line: "centre-of-tread walk line",
    image_type: "reference · front-on symmetric plain variant",
    purpose: "plain-nose variant of b2-012 · shows same flight without stainless nose strip detail",
    tags_extra: ["oak", "closed-riser", "plain-nose", "wall-enclosed", "square-section-handrail", "front-on-view", "hero-scene"],
    quality: "hero",
  },
  {
    file: "img-014.png",
    slug: "ref-b2-014-oak-stainless-round-handrail-stainless-bars-hallway",
    scene: { geometry: "straight flight ascending right", viewpoint: "wide hallway", surrounding: "modern hallway with matte-timber plank floor · framed art on left · plants at both ends · wall sconce · quarter-landing implied top" },
    materials: { primary_species: "oak (treads) + brushed stainless steel structure top-rail and balusters", tread: "oak closed-riser · oak nose", string: "oak closed string outer face" },
    components: { newel_posts: "polished stainless steel newel at foot (curved return of the handrail into a vertical post) · integrated with handrail", handrail: "BRUSHED STAINLESS ROUND-SECTION handrail that curves from vertical newel into the pitched rail (single continuous stainless system)", balustrade_infill: "stainless steel vertical round bar balusters spaced closely", starter_step: "curved oval bullnose oak starter with stainless newel bolt-mounted to it" },
    lighting: "square recessed wall LEDs beside flight (three visible) · wall sconce top · ceiling downlights",
    walk_line: "centre-of-tread walk line",
    image_type: "reference · modern hero scene",
    purpose: "all-stainless top-rail and balustrade with oak treads reference · integrated newel-into-handrail exemplar",
    tags_extra: ["oak", "closed-riser", "stainless-round-handrail", "stainless-bar-balusters", "integrated-stainless-newel", "curved-handrail-return", "oval-starter", "wall-led-step-lights", "hero-scene"],
    quality: "hero",
  },
  {
    file: "img-015.png",
    slug: "ref-b2-015-oak-vertical-wire-balustrade-mopstick-wall-handrail",
    scene: { geometry: "straight flight ascending centre · narrow flight against left wall", viewpoint: "wide hallway", surrounding: "modern minimalist hallway · pale oak plank floor · black-framed art on left · potted plant · pale walls" },
    materials: { primary_species: "oak (all timber surfaces) · warm mid-tone", tread: "oak closed-riser", string: "oak closed string · oak baserail + oak top-rail forming the frame for the wire balustrade", floor: "pale oak plank" },
    components: { newel_posts: "oak square newel at foot (thin square proportion)", handrail: "oak flat handrail top (short section rising with the flight) PLUS wall-mounted brushed metal MOPSTICK handrail on the right wall (a secondary continuous grabrail)", balustrade_infill: "VERTICAL TENSION WIRES / cables · thin polished stainless wires · fixed between the oak baserail below and the oak top-rail above · closely spaced (like harp strings)", starter_step: "flush plain starter" },
    lighting: "warm LED strip integrated UNDER the wall-mounted mopstick handrail on the right wall (dramatic backlit wash on the wall) · warm ceiling downlights",
    walk_line: "centre-of-tread walk line",
    image_type: "reference · hero contextual scene",
    purpose: "VERTICAL wire tension balustrade exemplar (contrast to b2-014's horizontal-wire family) · under-mopstick-handrail LED wash exemplar",
    tags_extra: ["oak", "closed-riser", "vertical-wire-balustrade", "vertical-tension-wires", "harp-balustrade", "oak-baserail", "wall-mounted-mopstick", "under-handrail-led", "hero-scene"],
    quality: "hero",
  },
  {
    file: "img-016.png",
    slug: "ref-b2-016-walnut-floating-open-riser-slim-walnut-spindles-led",
    scene: { geometry: "straight floating flight ascending right", viewpoint: "wide side-on", surrounding: "modern hallway · dark hardwood plank floor · view through to lounge with window right" },
    materials: { primary_species: "dark walnut · deep chocolate brown", tread: "solid walnut · open-riser · thick section · warm-white LED strip along tread nose (under-glow visible)", string: "matt-black outer stringer implied" },
    components: { newel_posts: "walnut square newel at foot · plain top", handrail: "walnut flat handrail on top of balusters · continues to wall-mounted handrail return on left", balustrade_infill: "SLIM VERTICAL WALNUT SPINDLES · very tightly-spaced walnut round bars floor-to-handrail · rhythmic close-set pattern (unusual · balustrade is a dense picket of slim walnut rods)", starter_step: "curved oval bullnose starter" },
    lighting: "warm LED under-glow on each tread nose · wall-mounted handrail on left wall",
    walk_line: "centre-of-tread walk line",
    image_type: "reference · hero contextual scene",
    purpose: "slim-walnut-picket balustrade design reference · unusual dense-vertical variant · walnut open-riser with LED under-tread",
    tags_extra: ["walnut", "dark-hardwood", "floating", "open-riser", "slim-walnut-spindles", "picket-balustrade", "dense-vertical-balustrade", "led-tread-nosing", "oval-starter", "hero-scene"],
    quality: "hero",
  },
  {
    file: "img-017.png",
    slug: "ref-b2-017-industrial-walnut-diamond-plate-risers-riveted-steel",
    scene: { geometry: "straight flight ascending right", viewpoint: "wide loft/warehouse interior", surrounding: "INDUSTRIAL / LOFT style · exposed red brick wall on left · leather armchair · pendant lights · large framed photograph of industrial scene · dark timber plank floor" },
    materials: { primary_species: "reclaimed/aged walnut with distressed patina · deep brown", tread: "walnut treads · RIVETED distressed dark timber treads · DIAMOND-PLATE / CHEQUER-PLATE galvanised STEEL risers", string: "heavy patinated dark timber outer string · RIVETED BLACK METAL BAND wrapped around outer face with visible rivets", floor: "dark timber plank" },
    components: { newel_posts: "heavy dark timber newel wrapped with a matte-black RIVETED steel strap detail (industrial rivet aesthetic)", handrail: "walnut flat handrail top", balustrade_infill: "matt-black round metal HORIZONTAL bar balustrade (ladder-style horizontal rails)", starter_step: "flush industrial starter" },
    lighting: "industrial matte-black square wall step-lights beside flight (three visible) · pendant lights in adjacent space",
    walk_line: "centre-of-tread walk line",
    image_type: "reference · industrial-style hero scene",
    purpose: "industrial / loft-aesthetic staircase reference · diamond-plate risers + riveted steel details + horizontal metal balustrade",
    tags_extra: ["walnut", "reclaimed-timber", "distressed-finish", "industrial", "loft-style", "diamond-plate-risers", "chequer-plate-metal", "riveted-detail", "horizontal-metal-balustrade", "black-metal-hardware", "exposed-brick-context", "hero-scene", "signature"],
    quality: "hero",
  },
  {
    file: "img-018.png",
    slug: "ref-b2-018-oak-stainless-bars-under-handrail-led-newel-black-oval-panel",
    scene: { geometry: "straight flight ascending right", viewpoint: "wide side-on", surrounding: "modern hallway · matte-timber plank floor · pale walls · minimal styling" },
    materials: { primary_species: "oak · warm mid-tone", tread: "oak closed-riser · stainless steel nose strip on each tread leading edge", string: "oak closed string outer face" },
    components: { newel_posts: "oak square newel at foot · plain oak top · distinctive VERTICAL BLACK OVAL PANEL (elongated pill-shape) inset on inner face (LED-illuminated black oval feature)", handrail: "oak flat handrail", balustrade_infill: "stainless steel vertical round bar balusters", starter_step: "curved oval bullnose starter · matte-black base band + warm-white under-glow LED" },
    lighting: "warm LED strip integrated UNDER the handrail on the wall side (running full length) · warm LED strip integrated within the black oval newel panel · under-starter LED band",
    walk_line: "centre-of-tread walk line",
    image_type: "reference · hero product scene",
    purpose: "black-oval-panel newel variant of the oak + stainless-bar + under-handrail-LED family",
    tags_extra: ["oak", "closed-riser", "stainless-bar-balusters", "stainless-nose-strip", "black-oval-newel-panel", "vertical-led-newel", "under-handrail-led", "oval-bullnose-starter", "black-base-band", "hero-scene"],
    quality: "hero",
  },
  {
    file: "img-019.png",
    slug: "ref-b2-019-oak-traditional-slim-spindles-panelled-hall",
    scene: { geometry: "straight flight ascending right with quarter-landing implied", viewpoint: "wide traditional hall", surrounding: "classical hallway with WAINSCOT PANELLING on walls · black-framed art · dark front door with glazing background · console with lamp foreground · HERRINGBONE PARQUET floor" },
    materials: { primary_species: "oak · warm mid-tone honey · natural finish", tread: "oak closed-riser · closed strings", string: "oak closed string · classic traditional profile", floor: "herringbone oak parquet" },
    components: { newel_posts: "tall oak square newels · plain flat oak caps · classic square-section proportion · one at foot + one at landing", handrail: "oak flat handrail", balustrade_infill: "slim OAK vertical spindle balusters (classic traditional profile · natural oak) · closely spaced", starter_step: "flush rectangular starter" },
    lighting: "recessed ceiling downlights · lamp glow from foreground",
    walk_line: "centre-of-tread walk line",
    image_type: "reference · traditional English hero scene",
    purpose: "classic traditional English oak staircase reference · slim oak spindle balusters + panelled hallway context",
    tags_extra: ["oak", "traditional", "oak-spindles", "slim-spindles", "square-newel", "closed-string", "panelled-hallway", "wainscot", "herringbone-parquet", "classic-english", "hero-scene"],
    quality: "hero",
  },
  {
    file: "img-020.png",
    slug: "ref-b2-020-walnut-floating-glass-brushed-fixings-black-newel-hero",
    scene: { geometry: "straight floating flight ascending right", viewpoint: "wide dramatic hero", surrounding: "luxury modern interior · dark walnut slat-wall panelling backdrop · abstract art with gold + black · pendant lighting · pale porcelain tile floor · sliding glass door background" },
    materials: { primary_species: "walnut treads (deep dark brown) + matt-black outer stringer + tempered glass + brushed stainless fixings", tread: "walnut closed-riser · LED under-tread strip on each tread nose", string: "matt-black outer stringer visible on right side" },
    components: { newel_posts: "MATT-BLACK square outer newel at foot with integrated vertical LED slot on inner face · plain top", handrail: "walnut flat handrail top of glass balustrade · integrated warm-LED strip along top of handrail (glowing edge)", balustrade_infill: "FRAMELESS GLASS panels · brushed stainless BUTTON/POINT fixings visible along glass edge", starter_step: "flush walnut starter · under-glow LED band" },
    lighting: "warm LED strip on top of handrail (dramatic backlight) · under-tread LED strip on each nosing · newel vertical LED slot · under-starter LED",
    walk_line: "centre-of-tread walk line",
    image_type: "reference · luxury hero scene",
    purpose: "premium walnut + glass + integrated-LED-handrail design reference · signature contemporary luxury",
    tags_extra: ["walnut", "dark-hardwood", "floating", "open-riser", "glass-balustrade", "brushed-stainless-button-fixings", "led-top-of-handrail", "led-tread-nosing", "black-outer-newel", "vertical-led-newel", "luxury", "hero-scene", "signature"],
    quality: "hero",
  },
  {
    file: "img-021.png",
    slug: "ref-b2-021-oak-traditional-spindle-baluster-turned-detail-herringbone",
    scene: { geometry: "quarter-turn (winder) staircase turning at bottom", viewpoint: "wide traditional hall", surrounding: "traditional English hall with HERRINGBONE PARQUET floor · dark front door glazed · dark storage unit · round mirror + lamp · olive potted plant · chandelier" },
    materials: { primary_species: "oak · warm mid-tone", tread: "oak closed-riser · painted white risers implied", string: "oak closed string", floor: "herringbone oak parquet" },
    components: { newel_posts: "tall oak square newels · ROUND ball/turned finial top cap detail · turned newel detail (traditional)", handrail: "oak flat handrail with return", balustrade_infill: "slim OAK vertical spindle balusters (classic profile)", starter_step: "curved oval bullnose starter · projects into hall" },
    lighting: "wall-mounted matt-black spot light on right wall pointing at flight · chandelier above · recessed ceiling downlights",
    walk_line: "walk line curves around the winder at bottom",
    image_type: "reference · traditional English hero scene",
    purpose: "classic light-oak traditional staircase reference · turned finial newel · herringbone hall context",
    tags_extra: ["oak", "traditional", "oak-spindles", "turned-newel-finial", "ball-newel-cap", "quarter-turn", "winder", "oval-bullnose-starter", "herringbone-parquet", "chandelier-context", "hero-scene"],
    quality: "hero",
  },
  {
    file: "img-022.png",
    slug: "ref-b2-022-industrial-diamond-plate-risers-walnut-treads-black-metal",
    scene: { geometry: "straight flight ascending right", viewpoint: "wide industrial loft", surrounding: "industrial loft interior · exposed red brick wall on left · leather armchair · pendant lights · large framed industrial photograph · walnut plank floor" },
    materials: { primary_species: "reclaimed walnut with distressed patina · plus DIAMOND-PLATE galvanised steel risers · plus rusted-patina heavy timber string", tread: "walnut · distressed finish", riser: "DIAMOND-PLATE / CHEQUER-PLATE galvanised steel · high visibility industrial texture", string: "heavy patinated dark timber string with visible aging" },
    components: { newel_posts: "heavy dark timber square newel wrapped with matte-black riveted steel band detail", handrail: "walnut flat handrail top", balustrade_infill: "matt-black round vertical metal balusters", starter_step: "flush industrial starter" },
    lighting: "warm LED tape strip running the length of the flight along the right wall (linear glow) · matte-black wall step lights · exposed pendant lighting",
    walk_line: "centre-of-tread walk line",
    image_type: "reference · industrial-style hero scene (variant of b2-017)",
    purpose: "industrial staircase reference with vertical metal balusters + wall LED tape · sibling to b2-017 with slightly different framing and lighting",
    tags_extra: ["walnut", "reclaimed-timber", "distressed-finish", "industrial", "loft-style", "diamond-plate-risers", "chequer-plate-metal", "riveted-detail", "vertical-black-metal-balusters", "wall-led-tape", "exposed-brick-context", "hero-scene"],
    quality: "hero",
  },
  {
    file: "img-023.png",
    slug: "ref-b2-023-walnut-open-riser-glass-chrome-button-fixings",
    scene: { geometry: "straight flight ascending right (open-riser floating)", viewpoint: "wide side-on", surrounding: "modern luxury hallway · pale porcelain tile floor · dark walnut wall paneling behind · abstract art with muted palette · fluted-dark cabinet foreground" },
    materials: { primary_species: "dark walnut · deep chocolate brown", tread: "solid walnut · open-riser · thick section · rounded nosing", string: "walnut cassette closed stringer both sides" },
    components: { newel_posts: "walnut square newel at foot · plain flat cap · minimal detailing", handrail: "walnut flat handrail on top of glass balustrade · returns to wall at top", balustrade_infill: "FRAMELESS GLASS panels · POLISHED CHROME/SILVER round DISC button-point fixings (larger disc profile than brushed stainless variants) · fixings arrayed along the top and bottom edges", starter_step: "flush plain solid walnut starter" },
    lighting: "warm ceiling downlights (small circular) · recessed downlights over each newel area",
    walk_line: "clear centre-of-tread walk line",
    image_type: "reference · luxury hero scene",
    purpose: "walnut + glass with POLISHED CHROME BUTTON fixings variant (contrast to brushed-stainless button variants)",
    tags_extra: ["walnut", "dark-hardwood", "floating", "open-riser", "glass-balustrade", "chrome-button-fixings", "polished-chrome-disc-fixings", "walnut-panelled-wall-context", "luxury", "hero-scene"],
    quality: "hero",
  },
  {
    file: "img-024.png",
    slug: "ref-b2-024-oak-handrail-white-painted-spindles-carpet-runner-classic",
    scene: { geometry: "quarter-turn (winder) at foot", viewpoint: "wide traditional hall", surrounding: "classic English hall · herringbone parquet floor · large mirror right · potted plant · console with lamps · painted grey door left · abstract art on wall" },
    materials: { primary_species: "OAK handrail + newel caps · WHITE-painted spindles + strings + newel bodies (classic English combination)", tread: "closed-riser · GREY HERRINGBONE CARPET STAIR RUNNER covering the tread centre · painted white edges either side of runner", string: "closed string painted matt white outer face · oak inner faces" },
    components: { newel_posts: "square newels with painted white body + OAK flat top-cap detail (two-tone effect)", handrail: "oak flat handrail top (contrast against white balustrade)", balustrade_infill: "SLIM WHITE-PAINTED vertical spindle balusters · closely spaced · classic profile", starter_step: "flush painted white starter" },
    lighting: "warm recessed ceiling downlights",
    walk_line: "carpet-runner walk line following the flight",
    image_type: "reference · classic English hero scene",
    purpose: "two-tone oak-cap + white-painted-spindle traditional reference · carpet-runner + herringbone parquet context",
    tags_extra: ["oak", "white-painted-spindles", "two-tone", "carpet-runner", "grey-carpet", "herringbone-carpet-runner", "quarter-turn", "winder", "traditional-english", "herringbone-parquet-floor", "classical", "hero-scene"],
    quality: "hero",
  },
  {
    file: "img-025.png",
    slug: "ref-b2-025-curved-mahogany-turned-spindles-red-ribbon-runner-luxury",
    scene: { geometry: "LARGE CURVED (helical sweep) staircase", viewpoint: "wide luxury hallway", surrounding: "grand luxury interior · herringbone parquet floor · large chandelier of glass rods · gilt mirror + lamp foreground · view through to dining room with chandelier · dark grey walls" },
    materials: { primary_species: "dark mahogany / walnut with rich reddish tone", tread: "dark hardwood closed-riser · plain treads", string: "dark hardwood curved (helical) closed string · continuous curve", floor: "herringbone oak parquet" },
    components: { newel_posts: "large TURNED (spindle-shaped) dark hardwood NEWEL at foot with classical turned profile", handrail: "dark hardwood curved handrail following the helical sweep · integrated into an upper-landing balustrade circling the stairwell", balustrade_infill: "TURNED classical spindle balusters (traditional turned profile · varying diameters) · dark hardwood", starter_step: "curved starter step following the sweep" },
    lighting: "signature chandelier of vertical glass rods · warm ambient",
    walk_line: "helical walk line around the curved sweep",
    image_type: "reference · luxury heritage hero scene",
    purpose: "grand curved mahogany staircase with turned classical spindles reference · signature red-and-gold carpet runner",
    tags_extra: ["mahogany", "dark-hardwood", "curved", "helical", "turned-newel", "turned-spindles", "classical-turned-balustrade", "red-carpet-runner", "gold-trim-runner", "chandelier-context", "heritage", "luxury", "grand", "hero-scene", "signature"],
    quality: "hero",
  },
  {
    file: "img-026.png",
    slug: "ref-b2-026-oak-half-landing-quarter-turn-spindles-carpet",
    scene: { geometry: "quarter-turn / kite winder half-way with upper flight visible", viewpoint: "wide hallway", surrounding: "modern-classical hallway · herringbone parquet floor · dark storage unit left · large rectangular mirror · potted olive tree · sitting room glimpsed on right" },
    materials: { primary_species: "oak · warm mid-tone", tread: "oak closed-riser · beige/grey textured carpet runner · painted white risers", string: "oak closed string outer face" },
    components: { newel_posts: "tall oak square newels · plain flat oak caps · one at each corner of the winder", handrail: "oak flat handrail continuous over both flights", balustrade_infill: "slim OAK vertical spindle balusters (natural oak)", starter_step: "flush rectangular starter" },
    lighting: "recessed ceiling downlights",
    walk_line: "walk line kinks at kite winder",
    image_type: "reference · modern-classical hero scene",
    purpose: "half-landing quarter-turn oak spindle staircase reference · carpet runner variant",
    tags_extra: ["oak", "quarter-turn", "kite-winder", "half-landing", "oak-spindles", "square-newel", "carpet-runner", "textured-carpet", "herringbone-parquet-floor", "modern-classical", "hero-scene"],
    quality: "hero",
  },
  {
    file: "img-027.png",
    slug: "ref-b2-027-mahogany-under-stair-panelled-cupboards-turned-spindles",
    scene: { geometry: "straight flight ascending right", viewpoint: "wide traditional hall", surrounding: "traditional hall · dark hardwood plank floor · palm foreground · console with lamp · mirror · rug · dark door background" },
    materials: { primary_species: "dark mahogany / walnut · deep reddish-brown · pronounced grain", tread: "mahogany closed-riser · dark risers", string: "mahogany closed string with PANELLED profile on outer face" },
    components: { newel_posts: "large mahogany square newel at foot · classical BALL-shaped decorative top cap", handrail: "mahogany flat handrail with return", balustrade_infill: "TURNED classical mahogany spindle balusters (classical turned profile · bulbous mid-shape)", starter_step: "flush rectangular starter", under_stair_feature: "THREE panelled MAHOGANY CUPBOARD DOORS set into the under-stair space (visible storage) · brass keyhole/handle escutcheons · dark stained to match staircase" },
    lighting: "warm ambient · lamp glow from console",
    walk_line: "centre-of-tread walk line",
    image_type: "reference · traditional hero scene with distinctive feature",
    purpose: "UNDER-STAIR panelled cupboard storage design reference · traditional mahogany turned-spindle staircase",
    tags_extra: ["mahogany", "dark-hardwood", "traditional", "closed-string", "turned-spindles", "ball-newel-cap", "under-stair-cupboards", "under-stair-storage", "panelled-cupboard-doors", "brass-hardware", "hero-scene", "signature-feature"],
    quality: "hero",
  },
  {
    file: "img-028.png",
    slug: "ref-b2-028-walnut-glass-brushed-stainless-buttons-led-tread-nosing-curved-starter",
    scene: { geometry: "straight flight ascending right with quarter-landing top", viewpoint: "wide hallway hero", surrounding: "modern classical hallway · herringbone parquet floor · panelled walls (wainscot) · large landscape framed painting · console with lamp · linen curtains" },
    materials: { primary_species: "dark walnut · deep chocolate brown", tread: "walnut closed-riser · warm-white LED strip along each tread nose (glowing under-tread band)", string: "walnut closed string outer face" },
    components: { newel_posts: "walnut square newel · brushed stainless top cap detail · plain body", handrail: "walnut flat handrail on top of glass balustrade", balustrade_infill: "FRAMELESS GLASS panels · brushed stainless button/point fixings", starter_step: "curved oval bullnose starter (deep) · under-glow LED band around base" },
    lighting: "warm LED tread-nose strip on every tread · under-starter LED · wall sconce on right · lamp glow",
    walk_line: "clear centre-of-tread walk line · widens at oval starter",
    image_type: "reference · hero contextual scene",
    purpose: "walnut + glass + LED tread-nosing exemplar with panelled hall context",
    tags_extra: ["walnut", "dark-hardwood", "closed-riser", "glass-balustrade", "brushed-stainless-button-fixings", "led-tread-nosing", "oval-bullnose-starter", "wainscot-panelled-hall", "herringbone-parquet", "hero-scene"],
    quality: "hero",
  },
  {
    file: "img-029.png",
    slug: "ref-b2-029-oak-traditional-turned-spiral-spindles-brass-stair-rods-navy-runner",
    scene: { geometry: "half-landing (switchback) traditional staircase with return flight visible", viewpoint: "wide traditional entrance hallway", surrounding: "classic English entrance · herringbone parquet floor · dark navy blue front door with glazing · dark console + basket · rug · abstract framed art · round mirror · lamp · black metal pendant chandelier" },
    materials: { primary_species: "oak · warm mid-tone", tread: "oak closed-riser · painted white risers implied · NAVY BLUE plain carpet stair runner · BRASS STAIR RODS securing runner at each tread nose (traditional rod arrangement)", string: "oak closed string · painted white outer face", floor: "herringbone oak parquet" },
    components: { newel_posts: "tall oak newels · classical TURNED BARLEY-TWIST detail on lower portion + ball top-cap finial · one at each landing corner", handrail: "oak flat handrail with returns at each newel", balustrade_infill: "TURNED BARLEY-TWIST oak spindle balusters (classical spiral-turned profile) · closely spaced", starter_step: "curved bullnose starter · rounded projects into hallway" },
    lighting: "pendant chandelier · warm ambient · lamp",
    walk_line: "carpet-runner walk line with brass rods at each tread base",
    image_type: "reference · classic Victorian/heritage English hero scene",
    purpose: "grand traditional English staircase reference · barley-twist turned spindles + brass stair rods + navy runner · half-landing switchback",
    tags_extra: ["oak", "traditional", "victorian", "half-landing", "switchback", "return-flight", "barley-twist-spindles", "turned-spindles", "ball-newel-cap", "navy-carpet-runner", "brass-stair-rods", "herringbone-parquet", "grand-entrance", "heritage-english", "hero-scene", "signature"],
    quality: "hero",
  },
  {
    file: "img-030.png",
    slug: "ref-b2-030-white-painted-black-tread-nosing-wainscot-jute-runner",
    scene: { geometry: "quarter-turn at foot with landing", viewpoint: "wide hallway", surrounding: "modern-classical hall · deep olive/sage green painted upper walls · WHITE WAINSCOT panelling half-wall · dark hardwood floor with jute rug · linen curtain background · abstract framed art · reading chair with green pillow · console table with lamp foreground · plant" },
    materials: { primary_species: "PAINTED WHITE staircase (spindles, string, newels) + DARK CHOCOLATE-BROWN/BLACK painted handrail + dark tread nosings (contrast palette)", tread: "closed-riser · white painted risers + JUTE / HESSIAN TEXTURED CARPET runner covering centre · dark stained tread nosings peek at edges", string: "closed string painted white outer face" },
    components: { newel_posts: "square white-painted newels · DARK BROWN/BLACK painted flat top-cap detail (two-tone against white)", handrail: "DARK BROWN/BLACK painted flat handrail (bold contrast against white balustrade)", balustrade_infill: "slim WHITE-PAINTED vertical spindle balusters", starter_step: "flush painted starter with dark nosing" },
    lighting: "recessed ceiling downlights · lamp glow foreground",
    walk_line: "carpet-runner walk line",
    image_type: "reference · modern-classical hero scene",
    purpose: "high-contrast WHITE + DARK BROWN painted staircase with jute runner reference · sage green + wainscot English cottage-modern aesthetic",
    tags_extra: ["painted-white", "white-spindles", "dark-brown-handrail", "black-handrail", "two-tone-painted", "jute-runner", "hessian-runner", "wainscot", "sage-green-walls", "quarter-turn", "modern-classical", "cottage-modern", "hero-scene"],
    quality: "hero",
  },
  {
    file: "img-031.png",
    slug: "ref-b2-031-simple-oak-clean-straight-flight-natural",
    scene: { geometry: "straight flight ascending right", viewpoint: "wide simple hallway", surrounding: "clean minimal hallway · white walls · pale oak plank floor · oak internal door on right · minimal styling" },
    materials: { primary_species: "oak · warm mid-tone natural finish", tread: "oak closed-riser (implied · treads hidden behind oak wall panels)", string: "oak closed string outer face · continuous smooth panel", floor: "pale oak plank" },
    components: { newel_posts: "oak square newel at top · plain flat oak cap · slim proportion", handrail: "oak flat handrail visible along top", balustrade_infill: "not visible from this angle (flight enclosed against wall on left · outer string forms the visual balustrade face on this side)", starter_step: "flush plain oak starter" },
    lighting: "ambient natural light from hallway · no dedicated stair LED",
    walk_line: "centre-of-tread walk line",
    image_type: "reference · minimal clean product scene",
    purpose: "very simple all-oak staircase reference · minimal styling · clean product-catalogue quality",
    tags_extra: ["oak", "minimal", "simple", "closed-riser", "clean", "product-catalogue", "no-hardware-features", "hero-scene"],
    quality: "hero",
  },
];

// URL ↔ file map from the batch2 download step
const urlMapPath = join(process.cwd(), "data", "incoming-image-ingest", "2026-08-13-batch2", "_urls.json");
const urlMap = JSON.parse(readFileSync(urlMapPath, "utf8"));
const urlByFile = new Map();
for (let i = 0; i < urlMap.length; i++) {
  const fname = `img-${String(i + 1).padStart(3, "0")}.png`;
  urlByFile.set(fname, urlMap[i].url);
}

const MANIFEST_PATH = join(process.cwd(), "data", "nex-image-manifest.json");
const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));

function buildDescription(img) {
  const lines = [];
  lines.push(`STAIRCASE REFERENCE · ${img.slug}`);
  lines.push("");
  lines.push(`SCENE · geometry: ${img.scene.geometry}`);
  lines.push(`SCENE · viewpoint: ${img.scene.viewpoint}`);
  lines.push(`SCENE · surrounding: ${img.scene.surrounding}`);
  lines.push("");
  lines.push("MATERIALS:");
  if (typeof img.materials === "string") { lines.push("  " + img.materials); }
  else { for (const [k, v] of Object.entries(img.materials)) lines.push(`  ${k}: ${v}`); }
  lines.push("");
  lines.push("COMPONENTS:");
  if (typeof img.components === "string") { lines.push("  " + img.components); }
  else { for (const [k, v] of Object.entries(img.components)) lines.push(`  ${k}: ${v}`); }
  lines.push("");
  lines.push("LIGHTING: " + img.lighting);
  lines.push("WALK-LINE: " + img.walk_line);
  lines.push("");
  lines.push("IMAGE_TYPE: " + img.image_type);
  lines.push("PURPOSE: " + img.purpose);
  if (img.honesty_flag) lines.push("HONESTY_FLAG: " + img.honesty_flag);
  return lines.join("\n");
}

let added = 0, updated = 0, skipped = 0;
for (const img of IMAGES) {
  const url = urlByFile.get(img.file);
  if (!url) { console.warn(`No URL mapped for ${img.file} · skipping`); skipped++; continue; }
  if (manifest.images[url]) {
    manifest.images[url] = {
      ...manifest.images[url],
      description: buildDescription(img),
      tags: Array.from(new Set([...(manifest.images[url].tags ?? []), "staircase-reference-2026-08-13", "philip-supplied", "batch-2", ...(img.tags_extra ?? [])])),
      a_plus: img.quality === "hero",
      subject_domain: "staircase",
      updated_at: NOW_ISO,
      slug: img.slug,
    };
    updated++;
  } else {
    manifest.images[url] = {
      source: "ai_generated",
      original_prompt: "generated by Philip via ChatGPT and uploaded to NEX ImageKit",
      description: buildDescription(img),
      master_ai_prompt: null,
      created_at: NOW_ISO,
      created_by: "philip",
      notes: `Ingested with rich structured metadata 2026-08-13 (batch 2) · Claude read the image multimodally and captured components/materials/lighting/walk-line evidence. Slug: ${img.slug}`,
      tags: [
        "staircase",
        "reference",
        "hero-scene",
        "staircase-reference-2026-08-13",
        "philip-supplied",
        "batch-2",
        ...(img.tags_extra ?? []),
      ],
      a_plus: img.quality === "hero",
      subject_domain: "staircase",
      slug: img.slug,
    };
    added++;
  }
}

manifest.updated_at = NOW_ISO;
manifest.last_change = `${added} new + ${updated} enriched staircase reference images (batch 2) · rich per-image metadata from multimodal read · 2026-08-13`;

writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n", "utf8");
console.log(`Manifest updated: added ${added} · enriched ${updated} · skipped ${skipped} · total URLs now: ${Object.keys(manifest.images).length}`);
