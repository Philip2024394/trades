// Extend Universal Q&A with the Materials batch from Philip's 2026-08-02 dump.
// All answers verbatim (Rule A · no fabrication).
// Source: data/nex-author-notes/2026-08-02-materials-raw.md

import { readFileSync, writeFileSync } from "node:fs";

const PATH = "data/nex-universal-qa.json";
const d = JSON.parse(readFileSync(PATH, "utf8"));

const MATERIALS_QA = [
  // ── OSB ──
  {
    q: "What is OSB?",
    a: "OSB (Oriented Strand Board) is made from large wood strands arranged in layers and compressed with resin. The strands are oriented in different directions to improve strength. Common grades are OSB/1 (general indoor use), OSB/2 (dry structural use), OSB/3 (moisture-resistant structural board) and OSB/4 (heavy-duty structural use). OSB is stronger than MDF in many structural situations because the long wood strands handle shear forces, structural loading and fixings better than MDF. It is a construction board, not usually a finishing board.",
  },
  {
    q: "Can OSB be used for a staircase?",
    a: "OSB is well suited to hidden staircase work — structural boxing, temporary stair construction, under-stair structures, wall panels and hidden supports. It is not suited to painted risers (unless heavily prepared), handrails, or any visible premium staircase parts because the surface is rough and shows chips and texture. Edges can also swell if wet.",
  },

  // ── Acrylic ──
  {
    q: "What is acrylic?",
    a: "Acrylic is a plastic sheet made from polymethyl methacrylate (PMMA). It is a transparent or coloured alternative to glass, is around 10–20 times more impact resistant than glass, lightweight, and UV-resistant grades are available. It can be laser cut, CNC machined and polished.",
  },
  {
    q: "Can acrylic be used for a stair balustrade?",
    a: "Yes. Acrylic balustrade panels are very popular — clear, frosted or coloured — and can be used for decorative stair inserts and lighting features. Acrylic is not suitable for stair treads, structural strings, or any load-bearing parts.",
  },

  // ── HPL / Compact Laminate / PVC Foam / ACP ──
  {
    q: "What is HPL?",
    a: "HPL stands for High Pressure Laminate. Products like Formica and compact laminate are common examples. HPL is normally used as a surface layer over MDF, plywood or particle board. It is very hard, scratch-resistant, water-resistant and available in a huge colour range. Typical uses are kitchen doors, worktops and stair side panels.",
  },
  {
    q: "What is compact laminate?",
    a: "Compact laminate is a premium solid laminate sheet, typically 6mm, 8mm, 10mm or 12mm thick. It is waterproof, extremely durable and self-supporting. Common uses include toilet partitions, commercial interiors and high-use areas.",
  },

  // ── MDF core ──
  {
    q: "Will MDF paint the same as solid wood?",
    a: "MDF usually produces a very smooth painted finish because it has no visible grain. Solid timber has a natural grain pattern that can sometimes show through paint, depending on the species and finish. When both are professionally prepared and painted in the same colour, many people cannot tell the difference from a normal viewing distance. Up close, solid timber may still show subtle grain texture, while MDF generally appears smoother.",
  },
  {
    q: "Why do many painted staircases use MDF?",
    a: "Many painted staircases use MDF for selected painted components because it offers a very smooth painted finish, a consistent surface, no knots, no grain raising, stable flat panels and excellent machining quality. It is common to find MDF used for painted risers, painted strings, painted fascia panels, decorative mouldings and wall panelling. This is an established practice within the staircase industry.",
  },
  {
    q: "Is MDF suitable for a staircase?",
    a: "Yes, when used appropriately. MDF has been used successfully in staircases for many years, particularly for painted components. The suitability depends on which component it is used for, the grade of MDF, the design, the environment and the manufacturer's construction methods. Many high-quality painted staircases include MDF alongside solid timber.",
  },
  {
    q: "Should treads be MDF?",
    a: "Solid timber or engineered timber treads are generally preferred because they receive the greatest wear from foot traffic. While MDF may be suitable for some decorative parts of a staircase, walking surfaces are commonly manufactured from stronger timber-based materials designed for repeated use.",
  },
  {
    q: "Are MDF risers acceptable?",
    a: "Yes. Painted MDF risers are very common. Because risers are not normally walked on, they experience much less wear than treads, making MDF a practical choice in many staircase designs.",
  },
  {
    q: "Can staircase strings be made from MDF?",
    a: "Yes. Many painted closed-string staircases use MDF strings successfully. The choice depends on staircase design, span, loading, construction method and the manufacturer's engineering. Where structural performance is critical, manufacturers may use engineered timber, plywood or solid timber instead.",
  },
  {
    q: "Will an MDF bullnose step wear out?",
    a: "The answer depends on how it is constructed. If the bullnose is manufactured correctly using suitable materials and finishes, it can provide many years of service. However, the front edge of any staircase receives frequent contact from shoes, vacuum cleaners and everyday use. Over time, all materials — including timber — may show signs of wear. If you are considering an MDF bullnose, ask the manufacturer how it is constructed and finished.",
  },
  {
    q: "Can MDF chip?",
    a: "Like many manufactured boards, MDF edges can be damaged by heavy impacts. Good painting systems and careful everyday use help protect the surface, but no painted material is completely immune to knocks.",
  },
  {
    q: "How are MDF edges sealed?",
    a: "Professional manufacturers normally prepare MDF edges carefully before painting. Typical preparation may include sanding, edge sealing, priming, filling where required, additional primer coats, and a final paint finish. The exact process varies between manufacturers, but proper edge preparation is important for achieving a durable painted finish.",
  },
  {
    q: "Does MDF absorb moisture?",
    a: "Standard MDF is generally more sensitive to prolonged moisture exposure than many hardwoods. However, interior staircases are normally installed in dry indoor environments, moisture-resistant grades of MDF are available for appropriate applications, and good sealing and painting help protect MDF surfaces. If your staircase is for an unusually humid environment, discuss suitable materials with the manufacturer.",
  },
  {
    q: "Will MDF swell if it gets wet?",
    a: "Excessive water exposure can damage many building materials, including MDF. A professionally painted interior staircase should not normally be exposed to prolonged moisture. If flooding or significant water damage occurs, affected components should be inspected.",
  },
  {
    q: "Is solid oak always better than MDF?",
    a: "Not necessarily. Each material has strengths. Solid timber offers natural grain, traditional appearance, refinishing potential and high durability. MDF offers a smooth painted finish, stable flat panels, no knots and a consistent appearance. The best choice depends on the component, the desired finish and the design.",
  },
  {
    q: "Can you tell if a staircase is MDF?",
    a: "Not always. A professionally manufactured and painted MDF component can be very difficult to distinguish from painted timber once installed.",
  },
  {
    q: "Will my staircase company mix materials?",
    a: "Yes. Many bespoke staircases combine different materials to achieve the best balance of appearance, strength and cost. A common combination is oak treads, oak handrails, MDF painted strings, MDF painted risers, hardwood newel posts and hardwood balusters. Using different materials for different components is common practice.",
  },
  {
    q: "Should I insist on solid timber everywhere on my staircase?",
    a: "Not necessarily. Rather than focusing on one material throughout, it is often more useful to ask why a particular material has been chosen for each component. A reputable manufacturer should be able to explain the reasoning behind their specification.",
  },
  {
    q: "What if I'm unsure about the material specification of my staircase?",
    a: "Nex will explain the general advantages and limitations of common staircase materials, but it won't guess whether one manufacturer's specification is better than another without evidence. If you would like independent clarification, Nex can, with your permission, help prepare your questions and connect you with an experienced staircase manufacturer to explain why a particular material has been recommended for your project.",
  },
  {
    q: "Can I buy MDF stair risers from a building supplier?",
    a: "Usually yes for risers. Most building suppliers sell MDF sheets that can be cut into stair risers — 9mm, 12mm, 15mm or 18mm thickness in 2440×1220mm sheets. MDF stair TREADS are not normally sold as a finished product because MDF is not ideal as a walking surface. A tread receives foot impact, point loading from heels, dirt and moisture, and edge wear. Better tread materials are oak, beech, ash, engineered timber and laminated hardwood.",
  },
  {
    q: "Will glue stick to MDF?",
    a: "Yes. MDF actually has very good glue adhesion. Common adhesives include PVA wood glue (D3 or D4 waterproof), PU glue (very strong and moisture resistant) and construction adhesive (for fixing risers and decorative panels). Preparation matters: clean the surface, remove dust, apply the correct adhesive, clamp or hold firmly and allow full curing time. The face of MDF bonds extremely well; the edges are more absorbent and may need sealing first.",
  },
  {
    q: "Why do some people say MDF is a cheap material?",
    a: "For three main reasons. First, MDF has no natural wood value — solid oak has grain, character, natural variation and premium appearance, whereas MDF is made from wood fibres, so people associate it with flat-pack furniture and budget cabinets. Second, cheap MDF products give it a bad reputation — low-quality MDF furniture often fails because thin MDF is used with poor edge sealing, cheap screws and poor assembly, and people remember failures. Third, traditional joiners prefer timber because it feels natural, can be repaired and shows visible craftsmanship. In reality MDF is a specialised engineered material — a well-designed staircase using MDF in the correct places can last decades.",
  },
  {
    q: "Can MDF be used as a landing board?",
    a: "Generally no, not as the structural landing board. A landing board carries people standing on it, turning loads, furniture movement and long-term weight, so it needs structural strength. Better materials are solid timber, glulam or engineered timber, structural-grade plywood, timber floor boards or structural panels designed for flooring. MDF can be used as a decorative finished surface over a structural landing, but not as the load-carrying board itself.",
  },
  {
    q: "Can MDF be used to cover the back of stairs?",
    a: "Yes, MDF is commonly used for the staircase underside — covering the underside of stair flights, creating a smooth painted ceiling underneath stairs, or closing the rear of open risers. Typical thicknesses are 9mm, 12mm or 18mm. The MDF is only a covering panel, not carrying the stairs. The structure should still be timber strings, steel frame or concrete.",
  },
  {
    q: "Can MDF be used for a staircase well trimmer?",
    a: "No. A staircase well trimmer is a structural component supporting the floor opening, joists, landing structure and stair loads. MDF is not suitable because it has lower structural strength, does not hold heavy fixings as well as timber, moisture can weaken it, and it is not designed for structural framing. Use C24 structural timber, laminated timber, glulam or steel sections instead.",
  },
  {
    q: "How does MDF compare to plywood in cost and strength?",
    a: "Plywood is stronger than MDF, but MDF is significantly cheaper. As an approximate 18mm sheet (2440×1220mm) comparison: standard MDF is the base price, moisture-resistant MDF 120–160% of that, plywood 180–300%, birch plywood 250–400%, OSB 120–180%, chipboard 70–100%, solid timber board 250–600%+, laminated timber panel 200–400%. These are typical industry ranges, not fixed prices — actual cost depends on country, thickness, grade and supplier.",
  },
  {
    q: "What is the professional rule for choosing staircase materials?",
    a: "Use MDF where you want beauty and a painted finish. Use plywood, timber or steel where you need strength. That is why many expensive staircases still contain MDF — it is not because they are cheap, it is because MDF performs extremely well in the correct location.",
  },
];

// Idempotent · overwrite if question already present, otherwise append.
const existingByQ = new Map(d.qa.map((x, i) => [x.q.toLowerCase().trim(), i]));
let added = 0;
let updated = 0;

for (const item of MATERIALS_QA) {
  const key = item.q.toLowerCase().trim();
  if (existingByQ.has(key)) {
    d.qa[existingByQ.get(key)] = item;
    updated++;
  } else {
    d.qa.push(item);
    added++;
  }
}

d.updated_at = new Date().toISOString();
writeFileSync(PATH, JSON.stringify(d, null, 2), "utf8");

const authored = d.qa.filter((x) => x.a && x.a.trim().length > 0).length;
console.log("Universal Q&A · materials batch");
console.log("  added:   ", added);
console.log("  updated: ", updated);
console.log("  total Qs:", d.qa.length);
console.log("  authored:", authored);
