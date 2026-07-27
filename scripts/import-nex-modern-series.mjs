#!/usr/bin/env node
// scripts/import-nex-modern-series.mjs
//
// Batch-imports the NEX Modern Timber + Brushed Stainless Steel Series
// (Philip 2026-07-27). Four product families:
//   - Mahogany (already saved · 1 image)
//   - Oak (2 images)
//   - Walnut (4 images)
//   - Black Matte (2 images)
//
// Every image saves with a rich product-page-quality MASTER DESCRIPTION
// following the parser's expected sectioned format. First image of each
// product family is the "primary" (parent); subsequent images are
// variant angles (children per Rule #14).

const API = "http://localhost:3008/api/admin/image-tagger/save";

// ── Shared helpers ──────────────────────────────────────────────

function buildDescription({
  productName,
  timberSpecies,
  timberFinish,
  timberTone,
  positioning,
  narrativeParagraphs,
  features,
  isVariant,
  primaryUrl,
}) {
  const identity = `IMAGE IDENTITY

Image Name:
${productName}${isVariant ? " (variant angle)" : ""}

Category:
Contemporary Feature Staircase > Timber + Metal > NEX Modern Series

Sub Category:
Luxury Modern Staircase - ${timberSpecies} + Brushed Stainless Steel

Primary Style:
Contemporary architectural feature staircase

Secondary Style:
Timber + Metal combination (NEX signature series)

Photographic Style:
Ultra Photorealistic Architectural Product Render${isVariant && primaryUrl ? `

Parent Image:
${primaryUrl}` : ""}`;

  const description = `IMAGE DESCRIPTION

${narrativeParagraphs.join("\n\n")}`;

  const objects = `OBJECT DETECTION

PRIMARY OBJECTS
- ${timberSpecies} staircase
- Oversized square ${timberSpecies.toLowerCase()} newel post
- Brushed stainless steel newel base
- Brushed stainless steel balusters
- ${timberSpecies} treads with brushed stainless steel nosings
- Brushed stainless steel stringer detailing

SECONDARY OBJECTS
- Handrail
- Balustrade panels
- Landing
- Contemporary interior context

BACKGROUND OBJECTS
- Modern residential interior setting`;

  const materials = `MATERIAL ANALYSIS

Primary Material:
${timberSpecies} ${timberFinish ? "with " + timberFinish + " finish" : "hardwood"}

Secondary Material:
Brushed stainless steel (satin finish, horizontal grain, soft reflections)`;

  const camera = `CAMERA INFORMATION

Image Orientation:
Portrait

Camera Position:
Eye Level

View:
Front three-quarter perspective

Composition:
Architectural product render composition

Lens:
35mm architectural`;

  const lighting = `LIGHTING

Primary Lighting:
Natural interior illumination

Characteristics:
- Soft Shadows
- Realistic Shadows
- High Dynamic Range`;

  const quality = `QUALITY

Resolution:
8k

Realism:
Ultra Photorealistic

Rendering:
Architectural Visualization`;

  const setting = `SETTING

Primary Setting:
Luxury contemporary residential interior

Secondary Setting:
Modern open-plan ${positioning}`;

  const rules = `AI REPRODUCTION RULES

MUST KEEP
- ${timberSpecies} hardwood staircase base
- Brushed stainless steel newel base integrated into oversized square newel post
- Brushed stainless steel stair nosings on every tread
- Slender brushed stainless steel balusters
- Brushed stainless steel stringer detailing
- Contemporary minimalist architectural language

DO NOT CHANGE
- Camera angle
- Composition
- Rendering quality
- Contemporary architectural style
- Timber + Metal design language

ALLOWED MODIFICATIONS
Users may change:
- Timber species (oak - walnut - mahogany - black matte finish)
- Metal finish (brushed stainless - black steel - bronze - brass)
- Balustrade infill (metal balusters - glass panels)
- Property context (modern home - hotel - showroom)`;

  const masterPrompt = `MASTER AI PROMPT

Ultra photorealistic architectural product render of a bespoke NEX contemporary ${timberSpecies.toLowerCase()} staircase with brushed stainless steel detailing. Handcrafted ${timberSpecies.toLowerCase()}${timberTone ? " with " + timberTone : ""} staircase with clean uninterrupted lines. Oversized square ${timberSpecies.toLowerCase()} newel post with a striking brushed stainless steel newel base seamlessly integrated at the foot. Every ${timberSpecies.toLowerCase()} tread finished with a brushed stainless steel stair nosing that adds durability and a refined metallic highlight. Slender brushed stainless steel balusters forming a minimalist open balustrade that allows natural light through the space. Matching brushed stainless steel stringer detailing running from first step to landing creating a cohesive design language.${timberTone ? " " + timberTone.charAt(0).toUpperCase() + timberTone.slice(1) + " contrasting against satin brushed stainless steel with horizontal brushed grain and soft reflections." : ""} Luxury modern residential interior context. Ultra photorealistic architectural visualization quality with realistic lighting, believable structural detail, and premium furniture-grade finish throughout.

FEATURES

${features.map((f) => "- " + f).join("\n")}`;

  return [identity, description, objects, materials, camera, lighting, quality, setting, rules, masterPrompt].join(
    "\n\n"
  );
}

// ── Product families ────────────────────────────────────────────

const PRODUCTS = [
  {
    productName: "NEX Modern Oak & Brushed Stainless Steel Staircase",
    timberSpecies: "European Oak",
    timberFinish: "clear satin",
    timberTone: "warm golden oak grain",
    positioning: "living space",
    urls: [
      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2010_42_40%20PM.png",
      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2010_38_29%20PM.png",
    ],
    narrativeParagraphs: [
      "A perfect balance of natural warmth and contemporary engineering, this exclusive NEX staircase showcases the timeless beauty of European oak paired with precision-crafted brushed stainless steel detailing. Designed for modern homes, it delivers a clean architectural aesthetic while celebrating the character of natural timber.",
      "The handcrafted oak staircase features beautifully grained solid oak, finished to enhance its natural texture and warm golden tones. A bold brushed stainless steel newel base anchors the oversized square newel post, creating a striking contrast between natural wood and refined metal.",
      "Each tread is finished with brushed stainless steel stair nosings, providing a sophisticated contemporary accent while improving durability in high-traffic areas. The sleek balustrade incorporates slim brushed stainless steel balusters, creating an open, light-filled appearance that complements minimalist interiors and modern architecture.",
      "A continuous brushed stainless steel detail follows the stringer, tying the entire design together and highlighting the staircase's clean geometric lines. Every element has been carefully considered to produce a staircase that is both visually impressive and built for everyday living.",
      "Created exclusively by NEX, this staircase represents a new generation of bespoke staircase design—where premium materials, innovative craftsmanship, and modern styling combine to create an exceptional focal point for contemporary homes.",
    ],
    features: [
      "Handcrafted premium European oak staircase",
      "Natural oak grain with a durable clear satin finish",
      "Contemporary brushed stainless steel newel base",
      "Integrated brushed stainless steel stair nosings on every tread",
      "Precision brushed stainless steel balusters with a minimalist profile",
      "Matching brushed stainless steel stringer detailing",
      "Oversized square oak newel posts for a bold architectural appearance",
      "Bespoke NEX design tailored for luxury modern homes",
    ],
  },
  {
    productName: "NEX Modern Walnut & Brushed Stainless Steel Staircase",
    timberSpecies: "American Black Walnut",
    timberFinish: "luxury satin",
    timberTone: "deep chocolate walnut grain",
    positioning: "living space",
    urls: [
      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2009_41_43%20PM.png",
      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2010_32_58%20PM.png",
      "https://ik.imagekit.io/5vv5pw26q/Untitledasdasdfdsfdfsdasd.png",
      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2010_49_14%20PM.png",
    ],
    narrativeParagraphs: [
      "A true showcase of contemporary craftsmanship, this exclusive NEX staircase blends the rich character of American Black Walnut with the refined elegance of brushed stainless steel to create a striking architectural feature for modern homes.",
      "Expertly handcrafted from premium walnut, the staircase highlights the timber's deep chocolate tones and distinctive natural grain, delivering warmth and sophistication throughout the space. A bold brushed stainless steel newel base complements the oversized square walnut newel post, creating a seamless fusion of natural materials and modern engineering.",
      "Every tread is finished with brushed stainless steel stair nosings, adding both durability and a clean contemporary edge. The sleek balustrade features precision brushed stainless steel balusters, allowing light to pass effortlessly through the staircase while maintaining an open, minimalist appearance.",
      "Matching brushed stainless steel detailing continues along the stringer, creating a continuous design language that enhances the staircase's crisp lines and modern aesthetic. Every component has been carefully engineered to achieve the perfect balance between luxury, functionality, and timeless style.",
      "Designed exclusively by NEX, this bespoke staircase demonstrates how premium hardwoods and architectural metalwork can be combined to produce a staircase that is more than a means of access—it becomes the centrepiece of the home.",
    ],
    features: [
      "Handcrafted premium American Black Walnut staircase",
      "Rich walnut grain with a luxury satin finish",
      "Contemporary brushed stainless steel newel base",
      "Integrated brushed stainless steel stair nosings on every tread",
      "Precision brushed stainless steel balusters for a sleek architectural look",
      "Matching brushed stainless steel stringer detailing",
      "Oversized square walnut newel posts with clean modern styling",
      "Bespoke NEX design created for luxury contemporary homes",
      "Engineered for exceptional durability, elegance, and lasting performance",
    ],
  },
  {
    productName: "NEX Modern Black Matte Staircase with Brushed Stainless Steel",
    timberSpecies: "Black Matte Timber",
    timberFinish: "black matte lacquer",
    timberTone: "flawless black matte finish",
    positioning: "living space",
    urls: [
      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2010_58_04%20PM.png",
      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2010_55_32%20PM.png",
    ],
    narrativeParagraphs: [
      "Bold, sophisticated, and unmistakably contemporary, this exclusive NEX staircase is designed for homeowners who appreciate minimalist architecture and premium craftsmanship. Finished in a luxurious black matte timber finish, it is paired with brushed stainless steel detailing to create a striking focal point that defines modern living.",
      "The handcrafted staircase features a flawless black matte finish that enhances the clean lines of the design while allowing the brushed stainless steel elements to stand out with subtle contrast. A substantial brushed stainless steel newel base supports the oversized square newel post, delivering a strong architectural presence from the very first step.",
      "Each tread is fitted with brushed stainless steel stair nosings, providing both a refined contemporary appearance and enhanced durability for everyday use. The sleek balustrade is formed with precision brushed stainless steel balusters, creating an open, elegant aesthetic that allows light to flow naturally through the staircase.",
      "Matching brushed stainless steel detailing continues along the stringer, producing a seamless blend of premium materials and modern engineering. The combination of matte black timber and satin-finished stainless steel creates a timeless design that complements luxury interiors, contemporary homes, and high-end architectural spaces.",
      "Designed exclusively by NEX, this staircase showcases the perfect harmony of bold styling, precision craftsmanship, and innovative materials. It is more than a staircase—it is a bespoke architectural statement created to elevate modern interiors.",
    ],
    features: [
      "Handcrafted staircase with a premium black matte timber finish",
      "Contemporary brushed stainless steel newel base",
      "Integrated brushed stainless steel stair nosings on every tread",
      "Precision brushed stainless steel balusters with a minimalist architectural profile",
      "Matching brushed stainless steel stringer detailing",
      "Oversized square newel posts with clean modern styling",
      "Bespoke NEX staircase design for luxury contemporary homes",
      "Durable, low-maintenance finish with exceptional visual impact",
    ],
  },
];

// ── Batch save ──────────────────────────────────────────────────

async function main() {
  console.log("NEX Modern Series import\n=====================================");
  let totalSaved = 0;
  const savedRows = [];

  for (const product of PRODUCTS) {
    console.log(`\n▶ ${product.productName} (${product.urls.length} images)`);
    for (let i = 0; i < product.urls.length; i++) {
      const url = product.urls[i];
      const isVariant = i > 0;
      const primaryUrl = isVariant ? product.urls[0] : null;
      const description = buildDescription({
        ...product,
        isVariant,
        primaryUrl,
      });
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: {
            [url]: {
              description,
              source: "ai_generated",
              created_by: "philip",
              notes: `NEX Modern Series · ${isVariant ? "variant angle of primary" : "primary product image"}`,
            },
          },
        }),
      });
      const data = await res.json();
      if (data.ok) {
        totalSaved++;
        savedRows.push({ url, product: product.productName, isVariant });
        console.log(`   ${i + 1}. ${isVariant ? "variant" : "primary"} saved`);
      } else {
        console.log(`   ${i + 1}. ERROR:`, data.error, "·", data.reason?.slice(0, 100));
      }
    }
  }

  console.log(`\n=====================================`);
  console.log(`Total saved: ${totalSaved} / ${PRODUCTS.reduce((n, p) => n + p.urls.length, 0)}`);
  console.log(`Family relationships to wire (parent -> children):`);
  for (const product of PRODUCTS) {
    if (product.urls.length > 1) {
      console.log(`  ${product.productName}: 1 primary + ${product.urls.length - 1} variants`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
