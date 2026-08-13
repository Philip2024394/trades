// scripts/nex-brain/ingest-26-staircase-refs-manifest.mjs
//
// Add rich structured metadata for 26 staircase reference images Philip
// supplied 2026-08-13. Every field below reflects what Claude (multimodal)
// actually observed in the image · nothing invented.
//
// URL ↔ local filename mapping comes from
// data/incoming-image-ingest/2026-08-13/_urls.json.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const NOW_ISO = "2026-08-13T22:00:00.000Z";

// Per-image observations · everything here is evidence-based from a direct
// multimodal read of the corresponding img-NNN.png file. Fields follow the
// ADR-0028 Intelligence Constitution: identity, geometry, materials,
// balustrade, newel, handrail, lighting, walk-line, scene context, purpose.
const IMAGES = [
  {
    file: "img-001.png",
    slug: "ref-001-oak-closed-string-square-newel-panelled",
    scene: {
      geometry: "straight flight · no visible turn",
      viewpoint: "front-on · foot of stairs · centre-line",
      surrounding: "open-plan hallway with wood floor · sitting room to the left · console table + framed art to the right",
    },
    materials: {
      primary_species: "oak · warm mid-tone honey colour · straight grain visible on treads",
      finish: "lacquered / satin sheen",
      tread: "solid oak · plain leading edge · no anti-slip strip",
      riser: "solid oak · closed",
      string: "closed string · left AND right · oak-clad · continuous panelled face",
      floor: "matching oak plank floor",
    },
    components: {
      newel_posts: "two square oak newels · plain flat caps · one at foot of each side of the flight",
      handrail: "oak · rectangular profile · terminates at newel · one both sides",
      balustrade_infill: "solid oak panels between newel and handrail · NO spindles/balusters visible on either side (unusual — infill panel design)",
      starter_step: "standard rectangular starter · flush with strings",
    },
    lighting: "recessed ceiling downlights in the hallway · no visible stair-specific LED",
    walk_line: "clear centre-of-tread walk line · treads present same effective width top to bottom (straight flight)",
    image_type: "reference · marketing scene",
    purpose: "staircase library · design reference · traditional oak closed-string family · full-panelled balustrade variant",
    tags_extra: ["oak", "traditional", "closed-string", "square-newel", "panelled-balustrade", "no-baluster", "carpet-free", "hero-scene"],
    quality: "hero", // suitable for main library display
  },
  {
    file: "img-002.png",
    slug: "ref-002-oak-floating-open-riser-glass-wall-lights",
    scene: {
      geometry: "straight flight · single storey · flight sits against wall on left",
      viewpoint: "side-on · foot of stairs · looking up along the flight",
      surrounding: "hallway → open living space beyond · pale oak floor",
    },
    materials: {
      primary_species: "oak · warm mid-tone · natural finish",
      tread: "solid oak · thick section · rounded nosing · open-riser (no risers)",
      string: "closed cassette-style closed left side (against wall) · open right side",
      floor: "matching pale oak plank",
    },
    components: {
      balustrade_infill: "frameless glass panels on right side · glass runs full flight length",
      glass_fixing: "stainless steel button/point fixings visible along the string",
      handrail: "oak flat handrail sitting on top of the glass panels · returns to wall at top",
      newel_posts: "no traditional newels · glass balustrade terminates at top and bottom to the structure",
      starter_step: "single deeper starter tread · same solid oak · projects into hallway",
    },
    lighting: "SEVEN recessed rectangular LED step lights let into the left wall · one per few treads · warm white · ceiling recessed downlights in living room beyond",
    walk_line: "centre-of-tread walk line clean and clear · treads full width because open-riser design gives visual depth",
    image_type: "reference · high-quality lifestyle scene",
    purpose: "modern floating oak + glass reference · wall-side step lighting exemplar",
    tags_extra: ["oak", "modern", "floating", "open-riser", "glass-balustrade", "frameless-glass", "wall-return-handrail", "led-step-lights", "hero-scene", "contemporary"],
    quality: "hero",
  },
  {
    file: "img-003.png",
    slug: "ref-003-oak-open-riser-wall-mounted-metal-handrail",
    scene: {
      geometry: "straight flight · flight sits against wall on left",
      viewpoint: "side-on · foot of stairs looking toward front door beyond top",
      surrounding: "hallway with pale oak plank floor · dark front door in centre background · jute runner beside stairs · console table right",
    },
    materials: {
      primary_species: "oak · warm mid-tone",
      tread: "solid oak · thick section · rounded nosing · open-riser",
      string: "closed cassette on left · open right",
      floor: "pale oak plank",
    },
    components: {
      handrail: "brushed metal / satin nickel round mopstick-style handrail · wall-mounted on left with visible round brackets · rail returns to wall at both ends",
      balustrade_infill: "no balusters on the open right side · the open side is unguarded in this shot (the aesthetic emphasises floating treads)",
      newel_posts: "none",
      starter_step: "single deeper solid oak starter",
    },
    lighting: "recessed rectangular LED step lights let into the left wall · warm white · ceiling downlights in hall beyond",
    walk_line: "centre-of-tread walk line clear · left side served by handrail · treads open to the room on the right",
    image_type: "reference · lifestyle scene",
    purpose: "wall-only floating oak reference · wall-mounted metal handrail with returns · handrail-bracket exemplar",
    tags_extra: ["oak", "modern", "floating", "open-riser", "wall-mounted-handrail", "handrail-bracket", "metal-handrail", "return-to-wall", "led-step-lights", "hero-scene"],
    quality: "hero",
  },
  {
    file: "img-004.png",
    slug: "ref-004-curved-walnut-floating-black-steel-stringer",
    scene: {
      geometry: "CURVED (helical / spiral-sweep) flight · rises out of frame · sculptural signature staircase",
      viewpoint: "wide-angle · foot of stairs on left · front door background centre",
      surrounding: "hallway · engineered walnut-tone plank floor · arched panelled wooden front door · runner rug with meander border",
    },
    materials: {
      primary_species: "dark walnut · warm reddish-brown · straight grain on treads",
      tread: "solid dark walnut · open-riser · thick section",
      structure: "matt black steel outer curved stringer that forms both the outer edge AND acts as the curved balustrade support",
    },
    components: {
      balustrade_infill: "no spindles · the curved black steel stringer + tread edges ARE the balustrade appearance",
      handrail: "not directly visible in frame — implied continuous top edge on the curved stringer",
      newel_posts: "no traditional newels · the curved steel structure replaces them",
      starter_step: "curved starter follows the helical sweep",
    },
    lighting: "warm floor-level uplighters at the base of the curved stringer casting light up the wall · ceiling downlights in hallway",
    walk_line: "helical walk-line follows the curve · outer edge of tread is the wider walking surface as expected on curved flights",
    image_type: "reference · signature architectural scene",
    purpose: "curved staircase design reference · sculptural black-steel + walnut exemplar",
    tags_extra: ["walnut", "curved", "helical", "floating", "open-riser", "black-steel", "sculptural", "signature", "hero-scene"],
    quality: "hero",
  },
  {
    file: "img-005.png",
    slug: "ref-005-mahogany-closed-string-stainless-bar-balusters",
    scene: {
      geometry: "straight flight · closed string · viewed from foot",
      viewpoint: "front-quarter · foot of stairs · large square newel dominates foreground",
      surrounding: "hallway with matching mahogany-tone plank floor · framed art on wall · potted plant right",
    },
    materials: {
      primary_species: "mahogany or dark cherry · deep warm red-brown · pronounced grain visible on newel face and closed string",
      finish: "lacquered · satin",
      tread: "mahogany · closed riser",
      string: "closed string · same species · visible on both sides",
      floor: "matching mahogany plank",
    },
    components: {
      newel_posts: "large square mahogany newel with brushed stainless steel base sleeve wrap and a plain flat cap · one visible foreground",
      handrail: "mahogany rectangular top-rail",
      balustrade_infill: "brushed stainless steel vertical round bar balusters · closely spaced · terminate into stainless-steel top and bottom shoe fittings on the string cap and under-handrail",
      starter_step: "flush rectangular starter",
    },
    lighting: "recessed square wall LEDs beside the flight (visible on left wall) · recessed ceiling downlights",
    walk_line: "centre-of-tread walk line",
    image_type: "reference · hero product scene",
    purpose: "hardwood + stainless balustrade design reference · newel-with-stainless-base exemplar",
    tags_extra: ["mahogany", "dark-hardwood", "closed-string", "stainless-steel-balustrade", "stainless-bar-balusters", "square-newel", "stainless-newel-base", "hero-scene"],
    quality: "hero",
  },
  {
    file: "img-006.png",
    slug: "ref-006-oak-open-riser-stainless-bars-bullnose-starter",
    scene: {
      geometry: "straight flight ascending to right · large curved bullnose starter step visible at bottom",
      viewpoint: "front-quarter · foot of stairs",
      surrounding: "hallway with pale porcelain-tile floor · framed art on left wall · round mirror right in the back · console",
    },
    materials: {
      primary_species: "oak · warm mid-tone · very smooth finish",
      tread: "oak · open-riser · thick square-edged section",
      string: "oak cassette closed strings both sides",
      floor: "polished porcelain tile",
    },
    components: {
      newel_posts: "oak square newel at foot · brushed stainless base sleeve wrap · flat oak cap · slim proportion",
      handrail: "oak flat rectangular handrail on top",
      balustrade_infill: "brushed stainless steel vertical round bar balusters · evenly spaced · run between top and bottom shoe fittings",
      starter_step: "curved D-shape bullnose starter · projects into the room · deeper than treads above",
    },
    lighting: "recessed square wall LEDs beside the flight on the left wall · ceiling downlights",
    walk_line: "centre-of-tread walk line · widens at the curved bullnose starter",
    image_type: "reference · hero product scene",
    purpose: "oak + stainless bar balustrade design reference · curved bullnose starter exemplar",
    tags_extra: ["oak", "open-riser", "stainless-bar-balusters", "bullnose-starter", "curved-starter", "stainless-newel-base", "hero-scene"],
    quality: "hero",
  },
  {
    file: "img-007.png",
    slug: "ref-007-oak-carpet-glass-panel-black-clamp-brackets-led-newel",
    scene: {
      geometry: "straight flight ascending right",
      viewpoint: "side-on · flight fills right portion of frame",
      surrounding: "gallery-hung framed art on left and right walls · console table with vase and lantern in foreground · pale timber floor",
    },
    materials: {
      primary_species: "oak · light-mid tone · straight-grain natural finish",
      tread: "closed riser · fully carpeted (cream/beige runner) — actual tread material hidden by carpet · oak visible at nosings",
      string: "closed string · painted matt white outer face on left · oak inner face",
    },
    components: {
      newel_posts: "two tall square OAK newels at foot AND at flight top · matt-black square caps · INTEGRATED VERTICAL LED SLOT running most of the newel height on the inner face",
      handrail: "oak flat handrail on top of glass panels",
      balustrade_infill: "frameless glass panels · fixed to oak posts via matt-black clamp brackets (two per panel)",
      starter_step: "single deeper solid oak starter · squared",
    },
    lighting: "matt-black frame LED wall step-lights let into the outer painted string face · warm white · vertical LED slot integrated INTO the newels themselves",
    walk_line: "centre-of-tread walk line · covered by carpet",
    image_type: "reference · hero product lifestyle scene",
    purpose: "oak + glass + black clamp bracket exemplar · newel-integrated-LED exemplar",
    tags_extra: ["oak", "carpeted-runner", "glass-balustrade", "black-clamp-brackets", "led-newel", "vertical-led-slot", "matt-black-hardware", "square-newel", "hero-scene"],
    quality: "hero",
  },
  {
    file: "img-008.png",
    slug: "ref-008-oak-slim-black-metal-balusters-carpet",
    scene: {
      geometry: "straight flight ascending right",
      viewpoint: "side-on · flight fills the right two-thirds",
      surrounding: "gallery-hung art on walls · cream-painted console with vase in foreground left · pale timber floor",
    },
    materials: {
      primary_species: "oak · light-mid tone",
      tread: "closed riser · fully mid-grey-carpeted · oak nosing implied",
      string: "closed string · outer face painted matt white",
    },
    components: {
      newel_posts: "two tall square oak newels · plain flat oak caps · plainer than img-007 (no LED slot on these)",
      handrail: "oak flat handrail top",
      balustrade_infill: "slim black-painted round metal balusters with small central ball detail (turned/knuckle detail mid-height) · closely spaced",
      starter_step: "flush rectangular starter",
    },
    lighting: "no visible stair-specific lighting on the flight itself · ambient hallway light",
    walk_line: "centre-of-tread walk line under carpet",
    image_type: "reference · hero lifestyle scene",
    purpose: "oak + slim-black-metal baluster + carpet exemplar · traditional-modern crossover",
    tags_extra: ["oak", "carpeted", "grey-carpet", "black-metal-balusters", "ball-detail-baluster", "square-newel", "matt-white-outer-string", "traditional-modern", "hero-scene"],
    quality: "hero",
  },
  {
    file: "img-009.png",
    slug: "ref-009-oak-open-riser-glass-clamp-brackets-oval-starter",
    scene: {
      geometry: "straight flight rising with quarter-landing implied top-right",
      viewpoint: "wide side-on · flight dominates centre",
      surrounding: "large hallway · framed prints · natural-stone tile floor · round mirror + sofa background right",
    },
    materials: {
      primary_species: "oak · natural light-mid tone · very clean straight grain",
      tread: "oak · open-riser · thick section · very smooth edges",
      string: "oak cassette closed strings both sides",
      floor: "polished natural-stone tile · warm cream",
    },
    components: {
      newel_posts: "oak square newel at foot · brushed stainless steel base sleeve · flat oak cap",
      handrail: "oak flat handrail on top of glass",
      balustrade_infill: "frameless glass panels · fixed via BRUSHED STAINLESS clamp brackets (contrast to img-007's black clamps)",
      starter_step: "OVAL/D-shape curved bullnose starter · deeper than treads · projects into the room",
    },
    lighting: "square recessed LED wall step-lights on left · warm ceiling downlights",
    walk_line: "centre-of-tread walk line · widens at oval starter",
    image_type: "reference · hero product scene",
    purpose: "oak + glass with brushed-stainless clamps exemplar · oval bullnose starter",
    tags_extra: ["oak", "open-riser", "glass-balustrade", "brushed-stainless-clamps", "oval-bullnose-starter", "stainless-newel-base", "hero-scene"],
    quality: "hero",
  },
  {
    file: "img-010.png",
    slug: "ref-010-oak-glass-brushed-stainless-clamps-oval-starter-portrait",
    scene: {
      geometry: "straight flight (same design family as img-009) · portrait framing",
      viewpoint: "front-quarter · foot of stairs · portrait-orientation frame",
      surrounding: "hallway with framed art on left · natural-stone tile floor · round mirror background",
    },
    materials: {
      primary_species: "oak · natural light-mid tone",
      tread: "oak · open-riser · thick section",
      string: "oak cassette closed strings",
      floor: "polished natural-stone tile",
    },
    components: {
      newel_posts: "oak square newel · brushed stainless base sleeve · pyramid-style top cap on this variant",
      handrail: "oak flat handrail on top of glass",
      balustrade_infill: "frameless glass panels · brushed stainless clamp brackets",
      starter_step: "curved oval bullnose starter",
    },
    lighting: "square recessed LED wall step-lights on left",
    walk_line: "centre-of-tread walk line · widens at oval starter",
    image_type: "reference · hero product scene (portrait companion to img-009)",
    purpose: "same design family as img-009 · different framing angle for the library",
    tags_extra: ["oak", "open-riser", "glass-balustrade", "brushed-stainless-clamps", "oval-bullnose-starter", "pyramid-newel-cap", "portrait", "hero-scene"],
    quality: "hero",
  },
  {
    file: "img-011.png",
    slug: "ref-011-detail-black-newel-vertical-led-planter-inset",
    scene: {
      geometry: "close-up detail shot · newel post + adjacent treads visible",
      viewpoint: "close-up · roughly waist height · newel dominates frame",
      surrounding: "not visible beyond the newel and immediate stair",
    },
    materials: {
      primary_species: "oak (visible on treads / string) + matt-black painted newel exterior",
      tread: "oak, mid-grey wool-loop carpet runner on top",
    },
    components: {
      newel_posts: "detail: matt-black square-section newel · OAK cap (contrast) · vertical rectangular INSET on inner face containing (a) warm-white LED strip along one edge and (b) a small potted plant recessed into the lower half of the inset",
      handrail: "oak flat handrail visible entering top of newel",
      balustrade_infill: "slim black round metal balusters visible either side",
      starter_step: "not in frame",
    },
    lighting: "warm-white LED strip integrated into the vertical newel inset · square recessed wall LED beside newel",
    walk_line: "not the subject of this shot",
    image_type: "reference · detail / feature shot",
    purpose: "component-level detail for the black-newel-with-planter design family · shows exactly how the LED slot + planter inset are constructed",
    tags_extra: ["newel-detail", "black-newel", "oak-cap", "vertical-led-slot", "planter-inset", "black-metal-balusters", "component-detail", "close-up"],
    quality: "hero", // valuable component reference
  },
  {
    file: "img-012.png",
    slug: "ref-012-oak-black-newels-black-balusters-grey-carpet",
    scene: {
      geometry: "straight flight ascending right",
      viewpoint: "side-on wide · full flight",
      surrounding: "gallery-hung art on walls · cream console + vase + lantern foreground · pale timber floor",
    },
    materials: {
      primary_species: "oak (handrail, string face, newel top + string) + matt-black painted newel post bodies + black metal balusters",
      tread: "closed riser · mid-grey wool-loop carpet · oak nosing",
      string: "oak closed string on outer face (not white as in img-008)",
    },
    components: {
      newel_posts: "two matt-black square-section newels · oak flat caps · vertical LED-planter inset feature (same as img-011) on the visible newel",
      handrail: "oak flat handrail",
      balustrade_infill: "slim black round metal balusters (matching balusters used in img-008 but here with black newels)",
      starter_step: "flush rectangular starter",
    },
    lighting: "square recessed LED wall step-lights beside the flight · vertical LED slot integrated into the black newel",
    walk_line: "centre-of-tread walk line under carpet",
    image_type: "reference · full-flight hero scene",
    purpose: "shows the full flight version of the img-011 detail · oak + black newel + black baluster + LED-planter feature",
    tags_extra: ["oak", "black-newel", "black-metal-balusters", "led-newel", "planter-inset", "grey-carpet", "contemporary-black", "hero-scene"],
    quality: "hero",
  },
  {
    file: "img-013.png",
    slug: "ref-013-oak-black-newels-black-balusters-portrait",
    scene: {
      geometry: "same design family as img-012 · slightly different angle",
      viewpoint: "wider side-on · portrait-ish",
      surrounding: "same style hallway with console + gallery art",
    },
    materials: "same as img-012 · oak + matt-black newels + black metal balusters + grey carpet",
    components: "same component set as img-012",
    lighting: "same lighting scheme",
    walk_line: "centre-of-tread walk line",
    image_type: "reference · alternative angle of img-012 design family",
    purpose: "library variant view · same design different framing",
    tags_extra: ["oak", "black-newel", "black-metal-balusters", "led-newel", "planter-inset", "grey-carpet", "alternate-angle"],
    quality: "hero",
  },
  {
    file: "img-014.png",
    slug: "ref-014-oak-floating-black-cable-tension-balustrade-black-newel",
    scene: {
      geometry: "straight floating flight",
      viewpoint: "side-on · full flight · console foreground",
      surrounding: "cream console + vase + lantern · gallery art · pale timber floor",
    },
    materials: {
      primary_species: "oak treads · matt-black metal structure + newel",
      tread: "solid oak · open-riser · thick section · LED underlighting bar under each tread nosing (visible as warm glow)",
      string: "matt-black metal outer stringer",
    },
    components: {
      newel_posts: "matt-black square newels · oak flat cap · vertical LED slot + planter inset (same feature family)",
      handrail: "oak flat handrail top",
      balustrade_infill: "HORIZONTAL BLACK STEEL CABLES / TENSION WIRES · multiple parallel horizontals running between newels",
      starter_step: "curved oval bullnose starter",
    },
    lighting: "warm LED strip along each tread nosing (under-glow) · square wall step-lights beside flight · vertical LED slot in newel",
    walk_line: "centre-of-tread walk line",
    image_type: "reference · hero contemporary scene",
    purpose: "cable/wire tension balustrade exemplar · oak + black steel + tread-nose LED under-lighting reference",
    tags_extra: ["oak", "floating", "open-riser", "cable-tension-balustrade", "wire-balustrade", "horizontal-cable", "black-steel", "led-tread-nosing", "planter-newel", "oval-starter", "hero-scene"],
    quality: "hero",
  },
  {
    file: "img-015.png",
    slug: "ref-015-oak-slim-oak-spindle-balusters-black-newels-carpet",
    scene: {
      geometry: "straight flight ascending right",
      viewpoint: "side-on · full flight",
      surrounding: "gallery art walls · cream console · pale timber floor",
    },
    materials: {
      primary_species: "oak (spindles, handrail, string face) + matt-black painted newel bodies",
      tread: "closed riser · mid-grey carpet · oak nosing",
      string: "oak closed string on outer face",
    },
    components: {
      newel_posts: "matt-black square newels · oak flat cap · vertical LED slot + planter inset feature",
      handrail: "oak flat handrail",
      balustrade_infill: "slim OAK vertical spindle balusters (natural oak · NOT painted black · closely spaced)",
      starter_step: "flush starter",
    },
    lighting: "square wall LED step lights · newel-integrated vertical LED slot",
    walk_line: "centre-of-tread walk line under carpet",
    image_type: "reference · hero scene",
    purpose: "oak-spindles + black-newel variant of the img-012/013 design family · shows contrast between oak balusters (this) vs black metal balusters (012)",
    tags_extra: ["oak", "oak-spindles", "oak-baluster", "black-newel", "led-newel", "planter-inset", "grey-carpet", "hero-scene"],
    quality: "hero",
  },
  {
    file: "img-016.png",
    slug: "ref-016-multi-flight-stairwell-dark-hardwood-looking-down",
    scene: {
      geometry: "MULTI-FLIGHT SWITCHBACK stairwell · looking DOWN through 3+ floors · lift/elevator visible at each landing",
      viewpoint: "top-down looking through the stairwell void from an upper floor",
      surrounding: "grand traditional commercial/institutional interior · panelled walls · wall sconces",
    },
    materials: {
      primary_species: "dark hardwood (walnut or dark stained oak) · treads and handrails",
      tread: "carpeted centre with hardwood edge visible",
      string: "closed panelled string faces",
      floor: "hardwood strip landings",
    },
    components: {
      newel_posts: "large square dark hardwood newels at every landing corner · plain flat caps",
      handrail: "continuous dark hardwood handrail following each flight and landing",
      balustrade_infill: "vertical dark hardwood spindle balusters · traditional profile",
      starter_step: "not clearly visible at this angle · standard rectangular per landing",
    },
    lighting: "landing wall sconces · large round decorative circle inlay in the ground-floor floor pattern visible in centre",
    walk_line: "traditional carpet-runner walk line following each flight · centre of tread",
    image_type: "reference · signature architectural scene",
    purpose: "large multi-floor traditional stairwell reference · shows switchback flight geometry + open stairwell design",
    tags_extra: ["dark-hardwood", "walnut", "multi-flight", "switchback", "commercial-scale", "looking-down", "stairwell-void", "carpet-runner", "traditional", "grand", "signature"],
    quality: "hero",
  },
  {
    file: "img-017.png",
    slug: "ref-017-dark-walnut-closed-string-stainless-bars-led-newel",
    scene: {
      geometry: "straight flight ascending right",
      viewpoint: "front-quarter foot of stairs",
      surrounding: "modern hallway · tan wall · sliding glass door left with garden beyond · minimal styling",
    },
    materials: {
      primary_species: "dark walnut · deep chocolate brown · straight grain",
      tread: "walnut closed-riser · stainless steel nose strip visible on each tread leading edge",
      string: "walnut closed string · continuous face",
      floor: "polished porcelain tile · warm grey",
    },
    components: {
      newel_posts: "large walnut square newel · pale-cream INTEGRATED VERTICAL LED PANEL running most of newel height on both visible faces · brushed stainless flat cap detail on top",
      handrail: "walnut flat rectangular handrail",
      balustrade_infill: "stainless steel vertical round bar balusters",
      starter_step: "flush rectangular",
    },
    lighting: "under-handrail LED strip glowing warm white on the wall side of the flight · newel-integrated vertical LED panels · tread-nose stainless strip catches ambient light",
    walk_line: "centre-of-tread walk line",
    image_type: "reference · hero scene",
    purpose: "dark hardwood + stainless bar + newel-LED design reference · under-handrail LED strip exemplar",
    tags_extra: ["walnut", "dark-hardwood", "closed-string", "stainless-bar-balusters", "stainless-nose-strip", "vertical-led-newel", "under-handrail-led", "modern", "hero-scene"],
    quality: "hero",
  },
  {
    file: "img-018.png",
    slug: "ref-018-oak-straight-stainless-bars-under-handrail-led",
    scene: {
      geometry: "straight flight ascending right · quarter-landing top",
      viewpoint: "side-on wide · full flight visible",
      surrounding: "modern hallway · sliding glass door left · tan wall · minimal styling",
    },
    materials: {
      primary_species: "oak · warm mid-tone honey · straight grain",
      tread: "oak closed-riser · stainless steel nose strip on each tread leading edge",
      string: "oak closed string",
      floor: "polished porcelain tile",
    },
    components: {
      newel_posts: "oak square newel at foot · brushed stainless flat cap · warm-white vertical LED slot on inner face",
      handrail: "oak flat handrail",
      balustrade_infill: "stainless steel vertical round bar balusters",
      starter_step: "single deeper solid oak starter · under-glow LED band around base",
    },
    lighting: "warm-white LED strip integrated UNDER the handrail on the wall side (running the full length of the flight) · newel LED slot · starter step under-glow",
    walk_line: "centre-of-tread walk line",
    image_type: "reference · hero scene",
    purpose: "oak version of the img-017 dark-walnut design · under-handrail LED strip exemplar",
    tags_extra: ["oak", "closed-riser", "stainless-bar-balusters", "stainless-nose-strip", "under-handrail-led", "vertical-led-newel", "starter-under-glow", "modern", "hero-scene"],
    quality: "hero",
  },
  {
    file: "img-019.png",
    slug: "ref-019-oak-stainless-ladder-balustrade-oval-starter",
    scene: {
      geometry: "straight flight ascending right",
      viewpoint: "side-on wide",
      surrounding: "modern hallway · sliding glass door left · minimal styling",
    },
    materials: {
      primary_species: "oak · warm mid-tone",
      tread: "oak closed-riser · stainless nose strip",
      string: "oak closed string",
      floor: "polished porcelain tile",
    },
    components: {
      newel_posts: "oak square newel · brushed stainless flat cap · vertical LED slot on inner face",
      handrail: "oak flat handrail",
      balustrade_infill: "HORIZONTAL stainless steel bar balustrade (ladder-style · multiple horizontal rails between newels · not vertical spindles)",
      starter_step: "curved oval bullnose starter",
    },
    lighting: "under-handrail LED strip on wall side · newel-integrated LED slot",
    walk_line: "centre-of-tread walk line · widens at oval starter",
    image_type: "reference · hero scene",
    purpose: "horizontal-stainless-bar / ladder balustrade exemplar (distinct from vertical bar variants)",
    tags_extra: ["oak", "closed-riser", "horizontal-stainless-bars", "ladder-balustrade", "stainless-nose-strip", "vertical-led-newel", "oval-bullnose-starter", "under-handrail-led", "hero-scene"],
    quality: "hero",
  },
  {
    file: "img-020.png",
    slug: "ref-020-oak-stainless-bars-oval-starter-under-handrail-led",
    scene: {
      geometry: "straight flight ascending right",
      viewpoint: "side-on",
      surrounding: "modern hallway with sliding glass door left",
    },
    materials: {
      primary_species: "oak · warm mid-tone",
      tread: "oak closed-riser · stainless nose strip",
      string: "oak closed string",
      floor: "polished porcelain tile",
    },
    components: {
      newel_posts: "oak square newel · brushed stainless cap detail · vertical LED slot",
      handrail: "oak flat handrail",
      balustrade_infill: "stainless steel vertical round bar balusters (SAME as img-018 but with the curved oval starter of img-019)",
      starter_step: "curved oval bullnose starter · under-glow LED band around base",
    },
    lighting: "under-handrail LED strip · newel LED slot · starter under-glow",
    walk_line: "centre-of-tread walk line",
    image_type: "reference · hero scene",
    purpose: "oak + vertical stainless bars + oval starter · variant combining img-018 balustrade with img-019/010 starter",
    tags_extra: ["oak", "closed-riser", "stainless-bar-balusters", "oval-bullnose-starter", "under-handrail-led", "vertical-led-newel", "starter-under-glow", "hero-scene"],
    quality: "hero",
  },
  {
    file: "img-021.png",
    slug: "ref-021-walnut-stainless-bars-oval-starter-vertical-led-newel",
    scene: {
      geometry: "straight flight ascending right",
      viewpoint: "side-on wide",
      surrounding: "modern hallway · sliding glass door left · tan wall · porcelain tile floor",
    },
    materials: {
      primary_species: "dark walnut · deep chocolate brown · pronounced grain",
      tread: "walnut closed-riser · stainless steel nose strip",
      string: "walnut closed string",
      floor: "polished porcelain tile",
    },
    components: {
      newel_posts: "walnut square newel · brushed stainless cap · vertical LED slot on inner face",
      handrail: "walnut flat handrail",
      balustrade_infill: "stainless steel vertical round bar balusters",
      starter_step: "curved oval bullnose starter · stainless base band",
    },
    lighting: "under-handrail LED strip · newel LED slot · starter step base under-glow",
    walk_line: "centre-of-tread walk line",
    image_type: "reference · hero scene",
    purpose: "walnut variant of img-020 · dark hardwood counterpart to the oak family",
    tags_extra: ["walnut", "dark-hardwood", "closed-riser", "stainless-bar-balusters", "stainless-nose-strip", "vertical-led-newel", "oval-bullnose-starter", "hero-scene"],
    quality: "hero",
  },
  {
    file: "img-022.png",
    slug: "ref-022-mahogany-slim-stainless-bars-led-newel",
    scene: {
      geometry: "straight flight ascending right",
      viewpoint: "side-on",
      surrounding: "modern hallway · sliding glass door left · porcelain tile floor",
    },
    materials: {
      primary_species: "deep mahogany / rosewood · very dark red-brown · pronounced grain",
      tread: "mahogany closed-riser · stainless nose strip",
      string: "mahogany closed string",
      floor: "polished porcelain tile",
    },
    components: {
      newel_posts: "mahogany square newel · brushed stainless cap · vertical LED slot",
      handrail: "mahogany flat handrail",
      balustrade_infill: "SLIM (thin gauge) stainless steel vertical round bar balusters",
      starter_step: "curved oval bullnose starter · stainless base band · under-glow LED",
    },
    lighting: "under-handrail LED · newel LED slot · starter under-glow",
    walk_line: "centre-of-tread walk line",
    image_type: "reference · hero scene",
    purpose: "mahogany variant of img-020/021 family · slim-bar balustrade sub-variant",
    tags_extra: ["mahogany", "rosewood", "dark-hardwood", "closed-riser", "slim-stainless-balusters", "stainless-nose-strip", "vertical-led-newel", "oval-bullnose-starter", "hero-scene"],
    quality: "hero",
  },
  {
    file: "img-023.png",
    slug: "ref-023-scifi-penthouse-floating-oak-led-treads-glass-balustrade",
    scene: {
      geometry: "straight floating flight",
      viewpoint: "wide interior scene · night · cityscape through floor-to-ceiling window",
      surrounding: "sci-fi urban penthouse · night · flying vehicles visible over city skyline · concrete + wood interior · large sofa · plants",
    },
    materials: {
      primary_species: "oak treads · glass balustrade · brushed steel handrail",
      tread: "solid oak · open-riser · thick section · WARM LED underlighting bar on each tread nosing (strong glow visible from front and side)",
      structure: "cantilevered from concrete wall on left",
    },
    components: {
      newel_posts: "not visible · minimal / hidden top-and-bottom termination",
      handrail: "curved brushed-metal handrail returning at both ends · mounted on top of glass",
      balustrade_infill: "frameless glass panels on outer edge",
      starter_step: "cascading tiered starter steps (3 progressively wider oak steps at foot)",
    },
    lighting: "warm-white LED strip along every tread nosing (very dominant · both above and below each tread) · signature under-glow · ambient city lights + interior downlights",
    walk_line: "centre-of-tread walk line",
    image_type: "AI-generated · signature marketing / concept scene",
    purpose: "future-vision aspirational scene · demonstrates full tread-nose LED under-glow AND cascading starter · sci-fi penthouse context is clearly AI-generated fantasy",
    tags_extra: ["oak", "floating", "open-riser", "glass-balustrade", "cantilevered", "led-tread-nosing", "led-under-glow", "cascading-starter", "sci-fi", "ai-generated-scene", "hero-scene", "aspirational"],
    quality: "hero",
    honesty_flag: "scene contains AI-generated sci-fi context (flying vehicles) · use as design/lighting reference not as photograph of real installation",
  },
  {
    file: "img-024.png",
    slug: "ref-024-mahogany-stainless-nose-strips-tall-newel-led",
    scene: {
      geometry: "straight flight · front-on centre view",
      viewpoint: "front-on · foot of stairs · symmetric composition",
      surrounding: "modern hallway · sliding glass door left · tan wall · porcelain tile floor",
    },
    materials: {
      primary_species: "deep mahogany / dark red-brown hardwood · pronounced grain",
      tread: "mahogany closed-riser · PROMINENT stainless steel nose strip on each tread (very visible)",
      string: "mahogany closed string",
      floor: "polished porcelain tile",
    },
    components: {
      newel_posts: "TWO tall mahogany newels · one at foot on right side (with vertical LED slot on inner face) · plain flat cap",
      handrail: "mahogany flat rectangular handrail top",
      balustrade_infill: "stainless steel vertical round bar balusters",
      starter_step: "twin/cascading starter step arrangement · projects into room · stainless base band",
    },
    lighting: "warm under-handrail LED on wall side · newel vertical LED slot · starter step base under-glow · stainless nose strips catch light",
    walk_line: "clear centre-of-tread walk line · symmetric front-on view is ideal for measuring visual walk-line",
    image_type: "reference · hero scene · front-on symmetric",
    purpose: "mahogany + stainless-nose-strip exemplar · front-on symmetric view for the library",
    tags_extra: ["mahogany", "dark-hardwood", "closed-riser", "stainless-bar-balusters", "prominent-stainless-nose-strip", "vertical-led-newel", "twin-starter", "front-on-view", "hero-scene"],
    quality: "hero",
  },
  {
    file: "img-025.png",
    slug: "ref-025-walnut-stainless-nose-strips-twin-starter-front-on",
    scene: {
      geometry: "straight flight · front-on centre view",
      viewpoint: "front-on · foot of stairs · symmetric composition",
      surrounding: "modern hallway · sliding glass door left · tan wall · porcelain tile floor",
    },
    materials: {
      primary_species: "dark walnut · deep chocolate brown",
      tread: "walnut closed-riser · prominent stainless steel nose strip",
      string: "walnut closed string",
      floor: "polished porcelain tile",
    },
    components: {
      newel_posts: "tall walnut newel at foot on right · vertical LED slot on inner face · plain flat cap",
      handrail: "walnut flat handrail top",
      balustrade_infill: "stainless steel vertical round bar balusters",
      starter_step: "twin/cascading starter steps · projects into room · stainless base band",
    },
    lighting: "under-handrail LED · newel LED slot · starter under-glow · stainless nose strips catch light",
    walk_line: "clear centre-of-tread walk line",
    image_type: "reference · hero scene · front-on symmetric",
    purpose: "walnut counterpart to img-024 · same layout different species",
    tags_extra: ["walnut", "dark-hardwood", "closed-riser", "stainless-bar-balusters", "prominent-stainless-nose-strip", "vertical-led-newel", "twin-starter", "front-on-view", "hero-scene"],
    quality: "hero",
  },
  {
    file: "img-026.png",
    slug: "ref-026-walnut-sculptural-sinuous-balusters-led-newel-wide-scene",
    scene: {
      geometry: "straight flight ascending right (with a slight turn implied at top)",
      viewpoint: "wide interior scene · doorway to lounge visible on left · hallway detail on right",
      surrounding: "modern luxury interior · painted-timber slat wall right · dark walnut door · large abstract art · lounge with pendant lights beyond",
    },
    materials: {
      primary_species: "dark walnut · deep chocolate brown",
      tread: "walnut closed-riser · stainless nose strip",
      string: "walnut closed string",
      floor: "polished cream porcelain tile",
    },
    components: {
      newel_posts: "walnut square newel at foot · prominent vertical LED slot on inner face · brushed stainless cap detail",
      handrail: "walnut flat handrail",
      balustrade_infill: "SCULPTURAL SINUOUS 'FLAME' balusters · walnut · undulating curved wave-form profiles · alternating (very unusual · signature design feature)",
      starter_step: "twin/cascading solid walnut starter steps · projects into hallway",
    },
    lighting: "vertical LED slot in newel · under-handrail LED · starter step under-glow · ambient pendant lighting from lounge visible left",
    walk_line: "clear centre-of-tread walk line",
    image_type: "reference · signature contextual scene",
    purpose: "sculptural sinuous baluster design reference · shows unusual walnut wave-form balustrade in luxury home context",
    tags_extra: ["walnut", "dark-hardwood", "closed-riser", "sculptural-balusters", "sinuous-balusters", "wave-form-balusters", "signature-baluster", "vertical-led-newel", "twin-starter", "luxury-context", "hero-scene", "signature"],
    quality: "hero",
  },
];

// URL ↔ file map from the download step
const urlMapPath = join(process.cwd(), "data", "incoming-image-ingest", "2026-08-13", "_urls.json");
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
  if (typeof img.materials === "string") {
    lines.push("  " + img.materials);
  } else {
    for (const [k, v] of Object.entries(img.materials)) lines.push(`  ${k}: ${v}`);
  }
  lines.push("");
  lines.push("COMPONENTS:");
  if (typeof img.components === "string") {
    lines.push("  " + img.components);
  } else {
    for (const [k, v] of Object.entries(img.components)) lines.push(`  ${k}: ${v}`);
  }
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
    // Update with the richer description (safety: this URL wasn't in manifest earlier;
    // but if a previous ingestion added it, we now enrich it).
    manifest.images[url] = {
      ...manifest.images[url],
      description: buildDescription(img),
      tags: Array.from(new Set([...(manifest.images[url].tags ?? []), "staircase-reference-2026-08-13", "philip-supplied", ...(img.tags_extra ?? [])])),
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
      notes: `Ingested with rich structured metadata 2026-08-13 · Claude read the image multimodally and captured components/materials/lighting/walk-line evidence. Slug: ${img.slug}`,
      tags: [
        "staircase",
        "reference",
        "hero-scene",
        "staircase-reference-2026-08-13",
        "philip-supplied",
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
manifest.last_change = `${added} new + ${updated} enriched staircase reference images · rich per-image metadata (parts / grain / materials / walk-line / lighting) from Claude multimodal read · 2026-08-13`;

writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n", "utf8");
console.log(`Manifest updated: added ${added} · enriched ${updated} · skipped ${skipped} · total URLs now: ${Object.keys(manifest.images).length}`);
