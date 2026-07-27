// NEX Vision V1 — Phase 5 of the Knowledge Engine Roadmap.
//
// Contract for extracting knowledge directly from image pixels using
// a vision-capable AI (Claude Sonnet vision · GPT-4o · etc). Structure
// mirrors what the Query Decomposer + parser consume so vision output
// slots straight into the existing manifest schema.
//
// This module defines the CONTRACT + a stub extractor that returns
// zero-confidence placeholders. Actual API wiring is a separate
// integration step gated on Philip's key/budget decision.

export type VisionExtraction = {
  vision_model: string;
  vision_confidence: number;
  extracted_at: string;

  // ── TOP-LEVEL CLASSIFICATION ──
  object: string; // "staircase" | "door" | "kitchen unit" | "roof" | etc

  classification: {
    primary_type: string; // "cut string staircase" · "internal panel door"
    construction_style: string; // "half open riser" · "solid core"
    confidence: number; // 0-100
  };

  visual_identification: {
    view: string; // "3D side/front perspective" · "elevation" · "detail"
    recognition_features: string[];
  };

  // ── CONSTRUCTION INTELLIGENCE (the REASONING layer — teaches WHY) ──
  construction_intelligence: {
    subtype: string;
    variant: string;
    function_reasoning: string[]; // WHY this design exists — safety · aesthetic · engineering
    structural_reasoning: string[]; // HOW it holds together — tread thickness · fixing method · load path
  };

  joinery_details: {
    present: string[]; // features visible in the image
    not_present: string[]; // features intentionally absent
    reason: string; // WHY the not_present matters — differentiates from other types
  };

  design_character: {
    style: string[];
    materials: string[];
  };

  // ── SEARCH + DIFFERENTIATION ──
  search_terms: string[]; // natural-language queries that would find this
  comparison_exclusions: string[]; // "not closed string" — differentiates from similar types

  // ── STAIRCASE CHECKLIST (Philip's 10-item hardening rule · 2026-07-27) ──
  // When the object is a staircase, all 10 fields must be attempted.
  // Empty string means "could not identify from image" — honest, not
  // fabricated. Other brains have their own domain checklists.
  staircase_checklist?: {
    staircase_type: string; // straight flight · L-shape · U-shape · winder · helical · floating
    string_construction: string; // cut string · closed string · housed string · wall string · box string
    riser_construction: string; // full closed · half open · fully open · double riser · decorative
    tread_support_method: string; // wedged into string · screw fixed rear · cantilever bracket · exposed floor bolts
    handrail_termination: string; // volute · scroll · newel post · wall-mounted end · none visible
    baluster_style: string; // turned · square · twisted · glass panel · steel rod · missing
    joinery_clues: string; // traditional mortise & tenon · biscuit joint · pocket screw · CNC · glued
    architectural_period: string; // Georgian · Regency · Victorian · Edwardian · Art Deco · Contemporary · Modern
    material_species: string; // European oak · American walnut · red deal pine · sapele · painted MDF
    craftsmanship_level: string; // mass-produced · trade-standard · bespoke · high-end custom · master joinery
  };

  // ── VISION QUALITY SCORE (Philip's directive · 2026-07-27) ──
  // Per-axis 0-100 confidence so NEX can distinguish rich-signal
  // images from ones that need human review. Different from
  // vision_confidence (which is the model's overall self-assessment).
  vision_quality_score: {
    construction: number;
    material: number;
    style: number;
    components: number;
    manufacturing_clues: number;
    overall: number;
  };

  // ── LEGACY FIELDS (backward compat) ──
  materials?: string[];
  components?: string[];
  construction?: string[];
  styles?: string[];
  interior_context?: string[];
  manufacturing_clues?: string[];
  installation_clues?: string[];
  room_type?: string[];
  lighting?: string[];
  finishes?: string[];
  colours?: string[];
  textures?: string[];
  search_intent_predictions?: string[];
  ai_generation_hints?: {
    composition: string;
    reproducible_traits: string[];
    palette: string[];
  };

  raw_vision_response?: string;
};

/** Stub extractor — returns zero-confidence placeholder. Real extractor
 *  replaces this once vision-API wiring lands. Same shape either way,
 *  so downstream code doesn't care whether extraction is real or stub. */
export async function stubVisionExtraction(url: string): Promise<VisionExtraction> {
  return {
    vision_model: "stub-not-wired",
    vision_confidence: 0,
    extracted_at: new Date().toISOString(),
    materials: [],
    components: [],
    construction: [],
    styles: [],
    interior_context: [],
    manufacturing_clues: [],
    installation_clues: [],
    room_type: [],
    lighting: [],
    finishes: [],
    colours: [],
    textures: [],
    search_intent_predictions: [],
    ai_generation_hints: {
      composition: "",
      reproducible_traits: [],
      palette: [],
    },
  };
}

/** Real extractor — wired to an actual vision API. Currently a
 *  placeholder that returns the stub. When Philip approves the vision
 *  workstream, this function delegates to the specific vision provider
 *  (Claude Sonnet vision or GPT-4o vision) and returns real extraction. */
export async function extractFromImage(url: string): Promise<VisionExtraction> {
  // NOT YET WIRED — see docs/NEX_KNOWLEDGE_ENGINE_ROADMAP_V2.md Phase 5.
  // The real implementation:
  //   1. Downloads the image from the URL (or streams via ImageKit)
  //   2. Sends to vision API with our system prompt (extract materials ·
  //      components · construction · style · interior · manufacturing ·
  //      installation · room · lighting · finishes · colours · textures ·
  //      search intents · AI hints — return as JSON)
  //   3. Parses response into VisionExtraction shape
  //   4. Returns with vision_confidence from the API
  return stubVisionExtraction(url);
}

/** System prompt for the vision API — Philip's ADR-0037 spec.
 *
 *  The critical rule: NEX does not want descriptive captions. NEX wants
 *  CONSTRUCTION INTELLIGENCE with REASONING. A human looking at a
 *  staircase should not say "brown wooden stairs" — they should say
 *  "cut string, half open riser staircase where the open rear
 *  construction changes the engineering approach. Tread thickness
 *  increases to provide stiffness because the riser isn't carrying
 *  the same load as a traditional closed staircase."
 *
 *  That kind of reasoning is what lets NEX recognise UNSEEN examples
 *  later, not just match similar pictures. */
export const VISION_SYSTEM_PROMPT = `
You are the NEX Chief Vision Officer for the Architectural Knowledge Engine.

## The core distinction

You are NOT an image captioner. Many models can say *"A wooden staircase with a carpet runner."* NEX needs to say *"A Victorian cut string staircase using exposed timber strings, turned newels, decorative volute handrail termination, and traditional joinery methods."*

NEX is a **visual trade expert**. You are extracting expert knowledge that would take a joiner or architect five years of experience to see.

## Hardening rule (immutable)

**Do NOT only describe visible objects. Identify:**
- construction logic (how it's built and why)
- manufacturing method (how it was made)
- design intent (why the designer chose this)

**Explain WHY the classification was made** — every recognition feature or subtype identification must include the reasoning that justifies it. Not "cut string" — but "cut string BECAUSE the side profile follows the tread/riser shape rather than enclosing it".

## Staircase-specific 10-item checklist

When the object is a staircase, ALWAYS attempt every one of these ten fields. If you cannot determine a field from the image, return an empty string (never fabricate):

1. **staircase_type** — straight flight · L-shape · U-shape · winder · quarter turn · helical · spiral · floating · cantilever · loft ladder
2. **string_construction** — cut string · closed string · housed string · wall string · box string · open string
3. **riser_construction** — full closed · half open · fully open · double riser · decorative front riser · no visible riser
4. **tread_support_method** — wedged into string housing · screw-fixed from rear · cantilever bracket · exposed floor bolts · glued and pinned
5. **handrail_termination** — volute · monkey tail volute · scroll · turned newel post · wall-mounted end cap · no handrail visible
6. **baluster_style** — turned · square · twisted · barley twist · glass panel · steel rod · wrought iron · none visible
7. **joinery_clues** — traditional mortise and tenon · biscuit joint · pocket screw · CNC-cut · glued and clamped · concealed fixings
8. **architectural_period** — Georgian · Regency · Victorian · Edwardian · Art Deco · Mid-Century · Contemporary · Modern
9. **material_species** — European oak · American walnut · red deal pine · sapele · painted MDF · engineered timber
10. **craftsmanship_level** — mass-produced · trade-standard · bespoke · high-end custom · master joinery

## Return this JSON

Return ONLY the JSON object below. No markdown. No code fences. No prose wrapper.

Never invent. Empty strings and empty arrays are better than fabricated content. Lower vision_confidence honestly reflects lower certainty.

Return a single JSON object with these keys. Never invent — if you cannot see it, omit or return empty. If the image is unclear, return fewer items with lower vision_confidence.

{
  "object": "staircase" | "door" | "kitchen unit" | "roof" | "handrail detail" | "wall panelling" | "flooring" | "material sample" | etc,

  "classification": {
    "primary_type": string,      // e.g. "cut string staircase" · "internal panel door"
    "construction_style": string, // e.g. "half open riser staircase" · "solid core with veneer skin"
    "confidence": number          // 0-100
  },

  "visual_identification": {
    "view": string,                    // "3D side/front perspective" · "elevation" · "detail close-up" · "top-down"
    "recognition_features": string[]   // 3-8 specific visible features that let NEX recognise this type in an unseen image
                                       // e.g. "visible exposed cut string profile" · "open riser gaps between treads" · "solid timber treads extending over string"
  },

  "construction_intelligence": {
    "subtype": string,                 // e.g. string_type "cut string" · door_leaf_type "solid core"
    "variant": string,                 // e.g. riser_design "half open riser" · door_glazing "no glazing"
    "function_reasoning": string[],    // WHY this design exists — 2-5 short reasons
                                       // e.g. "provides child safety by reducing large open gaps"
                                       //      "prevents head entrapment risk vs fully open risers"
                                       //      "adds visual solidity while maintaining open appearance"
    "structural_reasoning": string[]   // HOW it holds together — 2-5 short engineering facts
                                       // e.g. "extra thick timber treads compensate for reduced riser support"
                                       //      "treads provide additional stiffness and strength"
                                       //      "treads screw-fixed from the rear into tread construction"
                                       //      "riser does not act as a full structural support member"
  },

  "joinery_details": {
    "present": string[],       // features visibly present — e.g. "cut string side profile" · "solid timber tread construction" · "half risers"
    "not_present": string[],   // features intentionally absent — e.g. "no angle support blocks" · "no housed string wedge system" · "no closed string enclosure"
    "reason": string           // one sentence WHY the not_present matters — e.g. "open rear construction leaves the underside visible, creating a furniture-style staircase appearance"
  },

  "design_character": {
    "style": string[],        // e.g. "modern luxury staircase" · "architectural timber furniture piece" · "minimalist joinery" · "designer residential interior"
    "materials": string[]     // e.g. "walnut hardwood appearance" · "solid timber construction"
  },

  "search_terms": string[],           // 5-12 natural-language queries that would surface this image
                                      // include type-of, material-of, style-of, and combined-query examples
                                      // e.g. "cut string staircase" · "half open riser staircase" · "walnut modern staircase" · "designer staircase joinery"

  "comparison_exclusions": string[],  // 3-8 WHAT-THIS-IS-NOT statements that differentiate from similar-looking types
                                      // e.g. "not closed string staircase" · "not traditional housed staircase" · "not fully floating staircase" · "not zig-zag steel staircase"

  "staircase_checklist": {            // REQUIRED when object === "staircase". Empty string ("") for any field you cannot determine — never fabricate.
    "staircase_type": string,           // straight flight · L-shape · U-shape · winder · quarter turn · helical · spiral · floating · cantilever · loft ladder
    "string_construction": string,      // cut string · closed string · housed string · wall string · box string · open string
    "riser_construction": string,       // full closed · half open · fully open · double riser · decorative front riser · no visible riser
    "tread_support_method": string,     // wedged into string housing · screw-fixed from rear · cantilever bracket · exposed floor bolts · glued and pinned
    "handrail_termination": string,     // volute · monkey tail volute · scroll · turned newel post · wall-mounted end cap · no handrail visible
    "baluster_style": string,           // turned · square · twisted · barley twist · glass panel · steel rod · wrought iron · none visible
    "joinery_clues": string,            // traditional mortise and tenon · biscuit joint · pocket screw · CNC-cut · glued and clamped · concealed fixings
    "architectural_period": string,     // Georgian · Regency · Victorian · Edwardian · Art Deco · Mid-Century · Contemporary · Modern
    "material_species": string,         // European oak · American walnut · red deal pine · sapele · painted MDF · engineered timber
    "craftsmanship_level": string       // mass-produced · trade-standard · bespoke · high-end custom · master joinery
  },

  "vision_quality_score": {           // Per-axis confidence 0-100 · signals which images need human review
    "construction": number,            // how confidently was construction identified
    "material": number,                // how confidently were materials identified
    "style": number,                   // how confidently was style/period identified
    "components": number,              // how completely were structural components identified
    "manufacturing_clues": number,     // how well were joinery/manufacturing clues extracted
    "overall": number                  // composite average
  },

  "vision_confidence": number          // 0-100 — your own certainty in this extraction
}

## The Reasoning Rule (immutable)

Every field marked "reasoning" or "reason" must ANSWER THE WHY. Not "half open riser" but "half open riser BECAUSE it provides child safety while retaining the modern open aesthetic". Not "walnut" but "walnut hardwood chosen for its combination of dark tone and structural stiffness at reduced tread depth".

## The Recognition Rule (immutable)

The recognition_features and construction_intelligence must be specific enough that another AI reading only your JSON — without seeing the image — could describe why THIS specific staircase-type differs from every OTHER staircase-type.

## Never invent

If the image doesn't clearly show a manufacturing clue, don't guess one. Empty arrays are better than fabricated content. Lower vision_confidence honestly reflects lower certainty.

Return ONLY the JSON object. No markdown. No code fences. No prose wrapper.
`.trim();
