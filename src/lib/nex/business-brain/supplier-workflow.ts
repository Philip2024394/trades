// Business Brain · Supplier Preparation Workflow v1 (Philip 2026-08-02)
//
// Four-step conversation state machine. The Staircase Advisor detects
// supplier intent and hands off here. This module owns:
//   1. seeding requirements from context that already exists (country from
//      Regional Layer · staircase_type / style from design_enquiry_context)
//   2. asking the smallest set of extra questions to complete the brief
//   3. rendering the Supplier Brief once required fields are present
//   4. delivering the professional-connection handoff message with matched
//      suppliers or the country-appropriate fallback
//
// Architecture rule (Philip 2026-08-02 verbatim): "This should NOT live
// inside Staircase Brain. Correct separation: Staircase Brain → Customer
// Understanding → Business Brain → Supplier Workflow." Nex prepares the
// meeting — Nex does NOT replace the professional.

import "server-only";

import {
  getOrCreateEnquiry,
  persistEnquiry,
  missingRequiredFields,
  type SupplierEnquiry,
} from "./enquiry-state";

import { formatSupplierBrief, supplierBriefAsRecord } from "./brief-builder";
import { matchSuppliers, getFallbackMessage, type SupplierMatch } from "./supplier-registry";
import { seedFromMessage } from "./supplier-intent";
import { persistBrief } from "./enquiry-persistence";

// ─── Types ────────────────────────────────────────────────────────

export type SupplierSeed = {
  country?:         string;               // from AdvisorState.user_country
  staircase_type?:  string;               // from AdvisorState.design_enquiry_context
  design_style?:    string;
  materials?:       string[];
  install_location?: string;              // "hallway" · "loft" · etc. → project_location free text
  project_type?:    string;               // "new_build" · "renovation" · "replacement"

  // Philip 2026-08-02 · Opportunity 1 · Visual Brain → Supplier Workflow Bridge v1.
  // Trusted image matches (from the Visual Brain retrieval on this turn's context).
  // The bridge extracts image_state + title + materials + style ONLY — it does NOT
  // treat the image as a specification. The customer's own words remain authoritative.
  visual_matches?: Array<{
    design_id:            string;
    title?:               string;
    image_state:          "concept" | "reference" | "manufacturer" | "customer_project";
    transparency_caption: string;
    design_style?:        string;
    staircase_type?:      string;
    materials?:           string[];
  }>;
};

export type SupplierWorkflowResponse = {
  text:            string;
  action:          "supplier_collecting" | "supplier_brief_ready" | "supplier_connected";
  next_field?:     string;                // which requirement is being asked for this turn
  brief_record?:   Record<string, unknown>;
  matches?:        Array<{ name: string; handoff_message: string; matched_capabilities: string[] }>;
  enquiry_id:      string;
};

// ─── Helpers ──────────────────────────────────────────────────────

function normaliseArray(input: string | string[] | undefined): string[] | undefined {
  if (!input) return undefined;
  if (Array.isArray(input)) return input.filter(Boolean);
  return input
    .split(/[,\s]+(?:and\s+)?/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

function seedEnquiry(enquiry: SupplierEnquiry, seed: SupplierSeed, message: string): void {
  // Regional Layer country wins (already validated by detectCountry)
  if (!enquiry.country && seed.country) enquiry.country = seed.country;

  // Staircase context from earlier Staircase Advisor turns
  if (!enquiry.staircase_type && seed.staircase_type) enquiry.staircase_type = seed.staircase_type;
  if (!enquiry.design_style && seed.design_style)     enquiry.design_style   = seed.design_style;
  if (!enquiry.materials && seed.materials && seed.materials.length > 0) {
    enquiry.materials = Array.from(new Set(seed.materials));
  }

  // Message-scoped seeds (customer already said "oak and glass" inside their trigger)
  const fromMsg = seedFromMessage(message);
  if (!enquiry.staircase_type && fromMsg.staircase_type) enquiry.staircase_type = fromMsg.staircase_type;
  if (!enquiry.design_style && fromMsg.design_style)     enquiry.design_style   = fromMsg.design_style;
  if (fromMsg.materials && fromMsg.materials.length > 0) {
    const merged = new Set<string>([...(enquiry.materials ?? []), ...fromMsg.materials]);
    enquiry.materials = Array.from(merged);
  }

  // install_location repurposed as project_location if we have nothing else
  if (!enquiry.project_location && seed.install_location) {
    enquiry.project_location = seed.install_location;
  }
  if (!enquiry.project_type && seed.project_type) enquiry.project_type = seed.project_type;

  // Philip 2026-08-02 · Opportunity 1 · Visual Brain → Supplier Workflow Bridge v1.
  // Fold trusted image metadata into the enquiry:
  //   1. Store the image references as design_references so brief-builder can render
  //      a DESIGN REFERENCE block with the state-appropriate transparency caveat.
  //   2. UNION image-known materials into enquiry.materials (never overwrite customer-
  //      stated values · adds inferred oak/glass when the customer only said "modern").
  //   3. Fill missing style / staircase_type from the top image match ONLY when the
  //      customer has not already stated them. Customer words remain authoritative.
  // Never treats the image as specification · never auto-submits.
  if (seed.visual_matches && seed.visual_matches.length > 0) {
    enquiry.design_references = seed.visual_matches.map((v) => ({
      design_id:            v.design_id,
      title:                v.title,
      image_state:          v.image_state,
      transparency_caption: v.transparency_caption,
      design_style:         v.design_style,
      staircase_type:       v.staircase_type,
      materials:            v.materials,
    }));

    // Union all materials from all matched images (customer values already merged above)
    const imgMaterials = new Set<string>();
    for (const v of seed.visual_matches) {
      for (const m of v.materials ?? []) imgMaterials.add(m);
    }
    if (imgMaterials.size > 0) {
      const merged = new Set<string>([...(enquiry.materials ?? []), ...imgMaterials]);
      enquiry.materials = Array.from(merged).slice(0, 8);
    }

    // Only fill from image when customer has NOT stated their own preference
    const top = seed.visual_matches[0];
    if (!enquiry.design_style && top.design_style)     enquiry.design_style   = top.design_style;
    if (!enquiry.staircase_type && top.staircase_type) enquiry.staircase_type = top.staircase_type;
  }
}

// Extract requirement values from the current user message when we know
// which field we asked for last turn. This is the same skip-ahead trick
// the Staircase Advisor uses.
function extractAnswer(enquiry: SupplierEnquiry, field: string, message: string): void {
  const text = message.trim();
  const lower = text.toLowerCase();

  switch (field) {
    case "project_location":
      enquiry.project_location = text.slice(0, 120);
      break;

    case "project_type":
      if (/(new.?build|newbuild|new house|new home)/.test(lower))      enquiry.project_type = "new_build";
      else if (/(renovation|renovating|refurb)/.test(lower))            enquiry.project_type = "renovation";
      else if (/(replacement|replacing|replace)/.test(lower))           enquiry.project_type = "replacement";
      else if (/(extension|extending)/.test(lower))                     enquiry.project_type = "extension";
      else if (/(loft)/.test(lower))                                    enquiry.project_type = "loft_conversion";
      else                                                              enquiry.project_type = text.slice(0, 60);
      break;

    case "staircase_type": {
      const fromMsg = seedFromMessage(message);
      enquiry.staircase_type = fromMsg.staircase_type ?? text.slice(0, 60);
      break;
    }

    case "materials": {
      const fromMsg = seedFromMessage(message);
      const parsed = normaliseArray(text);
      const merged = new Set<string>([
        ...(enquiry.materials ?? []),
        ...(fromMsg.materials ?? []),
        ...(parsed ?? []),
      ]);
      enquiry.materials = Array.from(merged).slice(0, 8);
      break;
    }

    case "design_style": {
      const fromMsg = seedFromMessage(message);
      enquiry.design_style = fromMsg.design_style ?? text.slice(0, 40);
      break;
    }

    case "approximate_size":
      enquiry.approximate_size = text.slice(0, 120);
      break;

    case "quantity":
      // "one staircase" · "2 staircases + landing" · "1"
      enquiry.quantity = text.slice(0, 80);
      break;

    case "timeframe":
      enquiry.timeframe = text.slice(0, 80);
      break;

    case "use_case":
      if (/(commercial|office|hotel|hospitality|retail|public|contract)/.test(lower)) enquiry.use_case = "commercial";
      else if (/(residential|home|house|domestic)/.test(lower))                       enquiry.use_case = "residential";
      // free text · leave undefined if the answer doesn't match either
      break;

    case "project_stage":
      if      (/(installation|install|fit)/.test(lower))                       enquiry.project_stage = "installation_required";
      else if (/(ready|purchase|order|buying|buy)/.test(lower))                enquiry.project_stage = "ready_to_purchase";
      else if (/(planning|early|thinking|considering|research)/.test(lower))   enquiry.project_stage = "planning";
      break;

    default:
      // ignore unknown field
      break;
  }
}

// Ordered list of collection prompts. First MISSING required field wins.
// Country + staircase_type + materials + quantity are the minimum. Optional
// fields (project_type, design_style, project_location, timeframe) get asked
// if still missing after the required set closes.
const COLLECTION_ORDER: Array<{ field: keyof SupplierEnquiry; prompt: string }> = [
  { field: "country",           prompt: "Which country is the project in? (this shapes which suppliers I can prepare a brief for)" },
  { field: "project_location",  prompt: "Roughly where — a city or region is enough (e.g. Dublin · Manchester · Boston)?" },
  { field: "project_type",      prompt: "Is this a new build, a renovation, or a straight replacement of an existing staircase?" },
  { field: "use_case",          prompt: "Is this a residential (home) or commercial (office / hospitality / public) project?" },
  { field: "staircase_type",    prompt: "What staircase layout — straight flight, quarter-turn, half-turn, spiral, curved, or floating?" },
  { field: "materials",         prompt: "Which materials — for example oak handrail with glass balustrade and stainless fittings?" },
  { field: "design_style",      prompt: "What style — modern, contemporary, traditional, industrial, or luxury?" },
  { field: "quantity",          prompt: "How many staircases — one, two, or a set with landing balustrades too?" },
  { field: "approximate_size",  prompt: "Any rough size — approximate rise (floor-to-floor height), or number of steps if you know it?" },
  { field: "timeframe",         prompt: "Roughly when do you need this — e.g. within 3 months, spring 2026, or no fixed date yet?" },
  { field: "project_stage",     prompt: "What stage are you at — still planning, ready to purchase, or looking to have the installation done?" },
];

const REQUIRED_KEYS = new Set<keyof SupplierEnquiry>([
  "country", "staircase_type", "materials", "quantity",
]);

function hasValue(enquiry: SupplierEnquiry, k: keyof SupplierEnquiry): boolean {
  const v = enquiry[k];
  if (Array.isArray(v)) return v.length > 0;
  return v !== undefined && v !== null && v !== "";
}

function nextFieldToAsk(enquiry: SupplierEnquiry): { field: keyof SupplierEnquiry; prompt: string } | null {
  // Ask required first · then optionals in order
  const required = COLLECTION_ORDER.filter((step) => REQUIRED_KEYS.has(step.field));
  for (const step of required) if (!hasValue(enquiry, step.field)) return step;
  return null; // required set complete · brief can be built
}

const EXPLANATION_LINE =
  "Before connecting you with a staircase professional, I'll help prepare the details they need. " +
  "A supplier is much more likely to give you an accurate response when they understand the design, " +
  "materials and approximate requirements.";

// Philip 2026-08-02 · Step 5 trust caveat · verbatim from the fuller design prompt.
// Appended to every handoff so Nex never over-claims what she can guarantee.
const TRUST_CAVEAT =
  "I can help prepare your enquiry and identify suitable professionals, but final availability, " +
  "pricing and suitability must be confirmed directly with the supplier.";

// ─── Entry point ──────────────────────────────────────────────────

export type RunWorkflowInput = {
  conversationId:    string;
  message:           string;
  isNewTrigger:      boolean;         // true on the very first turn that flipped into supplier intent
  seed:              SupplierSeed;    // context bridged from the Staircase Advisor
};

export function runSupplierWorkflow(input: RunWorkflowInput): SupplierWorkflowResponse {
  const { conversationId, message, isNewTrigger, seed } = input;

  const enquiry = getOrCreateEnquiry(conversationId);

  // On the first trigger turn we seed from context + the trigger message.
  if (isNewTrigger) {
    enquiry.step = "collecting";
    seedEnquiry(enquiry, seed, message);
  } else {
    // Continuation turn · treat this message as an answer to whatever
    // field the previous turn asked for, then fold in any incidental
    // material/style hints from the same message.
    const previouslyAsked = (enquiry as unknown as { last_asked_field?: string }).last_asked_field;
    if (previouslyAsked) extractAnswer(enquiry, previouslyAsked, message);
    // Always fold ambient message seeds (customer may volunteer extras)
    seedEnquiry(enquiry, {}, message);
  }

  // Which field (if any) needs to be asked this turn?
  const next = nextFieldToAsk(enquiry);

  if (next) {
    // Step 1 · collecting requirements
    // Step 2 · explanation line prepended ONCE (on the very first trigger turn)
    (enquiry as unknown as { last_asked_field?: string }).last_asked_field = next.field;
    persistEnquiry(enquiry);

    const preface = isNewTrigger ? EXPLANATION_LINE + "\n\n" : "";
    return {
      text:        preface + next.prompt,
      action:      "supplier_collecting",
      next_field:  next.field,
      enquiry_id:  enquiry.enquiry_id,
    };
  }

  // Required set complete — Step 3 (brief) + Step 4 (handoff) in one turn.
  const brief = formatSupplierBrief(enquiry);
  const matches = matchSuppliers({
    country:        enquiry.country,
    staircase_type: enquiry.staircase_type,
    materials:      enquiry.materials,
  });

  const handoff = buildHandoff(matches, enquiry.country);

  // Advance state · once connected, keep the enquiry in place so follow-ups
  // ("actually can I add a landing rail?") still land in the same workflow.
  enquiry.step = "connected";
  (enquiry as unknown as { last_asked_field?: string }).last_asked_field = undefined;
  enquiry.prepared_at = Date.now();  // Philip 2026-08-02 · explicit lifecycle timestamp
  persistEnquiry(enquiry);

  // Philip 2026-08-02 · Supplier Memory v1 · fire-and-forget persistence.
  // Writes the assembled brief to nex_supplier_enquiries with PII masked.
  // Never awaits · never blocks the customer-facing response.
  const briefRecord = supplierBriefAsRecord(enquiry);
  void persistBrief({
    enquiry,
    brief_record:         briefRecord,
    matched_supplier_ids: matches.map((m) => m.supplier.supplier_id),
  });

  const text = [
    "Here's the brief I've prepared for you:",
    "",
    "```",
    brief,
    "```",
    "",
    handoff,
    "",
    TRUST_CAVEAT,
  ].join("\n");

  return {
    text,
    action:       "supplier_brief_ready",
    enquiry_id:   enquiry.enquiry_id,
    brief_record: briefRecord,
    matches: matches.map((m) => ({
      name:                 m.supplier.name,
      handoff_message:      m.supplier.handoff_message,
      matched_capabilities: m.matched_capabilities,
    })),
  };
}

function buildHandoff(matches: SupplierMatch[], country: string | undefined): string {
  if (matches.length > 0) {
    const primary = matches[0];
    return primary.supplier.handoff_message;
  }
  const fallback = getFallbackMessage(country);
  if (fallback) return fallback;
  return (
    "I don't yet have a partnered manufacturer for that region in my directory. " +
    "The brief above is written the way a professional stair specialist wants to receive an enquiry — " +
    "you can send it directly to any local staircase manufacturer to get an accurate response."
  );
}
