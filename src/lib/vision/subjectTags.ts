// Subject tag detection via Anthropic multimodal.
//
// Ships REAL detection when ANTHROPIC_API_KEY is set. Uses a strict
// tag vocabulary matching our taxonomy (trades / services / materials
// / stages / safety signals / competitor brands) so the model can't
// invent labels outside the platform's ontology.
//
// Cost: ~$0.003–$0.008 per image on Sonnet 4.6.
// Latency: ~600–1800ms per call — runs OFF the merchant's tap path
// (preprocess endpoint is called before /capture submit and shows a
// spinner during vision).

import sharp from "sharp";
import { askVisionJson } from "@/lib/llm/multimodal";

export type SubjectFindings = {
  trade: string | null;
  service: string | null;
  materials: string[];
  stage: string | null;
  safety_signals: string[];
  competitor_brands: string[];
  confidence: number;
  provider: string;
};

const EMPTY: SubjectFindings = {
  trade: null,
  service: null,
  materials: [],
  stage: null,
  safety_signals: [],
  competitor_brands: [],
  confidence: 0,
  provider: "stub"
};

const TAG_VOCABULARY = `
Trades: builder, plumber, electrician, roofer, landscaper, carpenter,
decorator, groundworker, driveway_installer, kitchen_fitter,
bathroom_installer, window_installer, plasterer.

Services (typical, non-exhaustive): extension, refurb, boiler_install,
rewire, ev_charger, slate_re_tile, concrete_re_tile, patio, decking,
skirting, kitchen, resin_bound, block_paving, upvc_windows, skim.

Materials (typical): welsh_slate, spanish_slate, concrete_tile,
clay_tile, lead, sandstone, porcelain, limestone, granite, resin,
brick, block, steel, timber, oak, pine, quartz, ceramic, marble.

Stages: started, in_progress, completed.

Safety signals: hi_vis, hard_hat, safety_boots, harness, safety_line,
scaffold_present, work_platform.

Competitor brands: any commercial paint / material / tool brand
clearly visible (Dulux, Crown, Farrow_Ball, Bosch, DeWalt, Makita, etc.)
`;

const SYSTEM_PROMPT = `You classify photos of UK trade work. Respond in JSON only.
Use ONLY tags from the vocabulary provided. Do not invent tags.
If uncertain, return null / empty array rather than guessing.

${TAG_VOCABULARY}`;

export async function detectSubjectTags(
  input: Buffer
): Promise<SubjectFindings> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ...EMPTY };
  // Downscale to reduce token cost while keeping enough detail for
  // subject detection.
  let resized: Buffer;
  let mime = "image/jpeg";
  try {
    resized = await sharp(input)
      .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
  } catch {
    resized = input;
    mime = "image/png";
  }

  const result = await askVisionJson<{
    trade?: string | null;
    service?: string | null;
    materials?: string[];
    stage?: string | null;
    safety_signals?: string[];
    competitor_brands?: string[];
    confidence?: number;
  }>({
    imageBase64: resized.toString("base64"),
    imageMimeType: mime,
    system: SYSTEM_PROMPT,
    userText: `Analyse this photo. Return JSON with:
{
  "trade": one trade slug or null,
  "service": one service slug or null,
  "materials": array of material slugs (empty if none clearly visible),
  "stage": one of "started" | "in_progress" | "completed" | null,
  "safety_signals": array of safety signal slugs (empty if none),
  "competitor_brands": array of commercial brand names clearly visible on labels/logos
    (empty if none — this is important for our compliance step),
  "confidence": 0.0–1.0 overall confidence
}`,
    maxTokens: 400
  });

  if (!result) return { ...EMPTY };

  return {
    trade: result.trade ?? null,
    service: result.service ?? null,
    materials: Array.isArray(result.materials) ? result.materials : [],
    stage: result.stage ?? null,
    safety_signals: Array.isArray(result.safety_signals)
      ? result.safety_signals
      : [],
    competitor_brands: Array.isArray(result.competitor_brands)
      ? result.competitor_brands
      : [],
    confidence: typeof result.confidence === "number" ? result.confidence : 0.5,
    provider: "anthropic_multimodal"
  };
}
