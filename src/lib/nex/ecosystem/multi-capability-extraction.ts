// src/lib/nex/ecosystem/multi-capability-extraction.ts
//
// UWI · Wave 8.C · Multi-capability extraction primitive
// Founder-authorised programme (Rule 5o.T §5-§6 · one repository → many capabilities).
//
// Reframes Wave 8.A's single-capability heuristic into a list-returning
// primitive so a single source (repository / space / dataset) can yield
// MULTIPLE independent capability findings. Each capability is a distinct
// audit target that may become its own Product Candidate downstream.
//
// This is a heuristic scaffold matching Wave 8.A's discipline (regex
// against a code sample). A proper capability-taxonomy classifier is
// Wave 8.G+ scope. What this delivers TODAY is honest per-signal
// decomposition rather than collapsing everything into one report.

import type { CapabilityExtractionReport } from "./types";
import type { EcosystemResource } from "./types";

// ─── Capability signal library (deterministic · pattern-driven) ─────
// Each capability signal is: (category, regex, technique-description).
// Wave 8.G will replace this heuristic library with a proper classifier.

interface CapabilitySignal {
  readonly category: string;
  readonly pattern: RegExp;
  readonly technique: string;
  readonly rebuildable: boolean;
}

const CAPABILITY_SIGNALS: ReadonlyArray<CapabilitySignal> = [
  { category: "OCR",                   pattern: /(?:ocr|tesseract|paddleocr|easyocr)/i, technique: "optical character recognition · text extraction from images", rebuildable: true },
  { category: "neural_architecture",   pattern: /(?:transformer|attention_mask|self_attention|multi_head_attention|encoder_layer|decoder_layer)/i, technique: "transformer / attention-based neural architecture", rebuildable: false },
  { category: "document_processing",   pattern: /(?:pdf(?:kit|parse|extract)|parse_document|extract_text_from_pdf|docx_parse)/i, technique: "document parsing and text/structure extraction", rebuildable: true },
  { category: "similarity_measurement",pattern: /(?:cosine_similarity|dot_product_similarity|jaccard|embedding_distance)/i, technique: "similarity / distance measurement over feature vectors", rebuildable: true },
  { category: "clustering",            pattern: /(?:kmeans|k_means|dbscan|hdbscan|agglomerative_clustering)/i, technique: "unsupervised clustering", rebuildable: true },
  { category: "graph_algorithm",       pattern: /(?:adjacency_(?:list|matrix)|dijkstra|bfs|dfs|pagerank|topological_sort)/i, technique: "graph algorithm (traversal / ranking / ordering)", rebuildable: true },
  { category: "time_series",           pattern: /(?:time_series|forecast|arima|prophet|stl_decompose|seasonal_decompose)/i, technique: "time-series decomposition or forecasting", rebuildable: true },
  { category: "web_acquisition",       pattern: /(?:sitemap|robots\.txt|conditional_get|if_modified_since|crawl_delay)/i, technique: "polite web acquisition (sitemap / robots / conditional GET)", rebuildable: true },
  { category: "video_timeline",        pattern: /(?:video_timeline|track_manager|keyframe|scrubber|playhead|clip_boundary)/i, technique: "video timeline / track / keyframe editing", rebuildable: true },
  { category: "webgl_rendering",       pattern: /(?:webgl|gl_program|shader_program|fragment_shader|vertex_shader|compileShader)/i, technique: "WebGL rendering / shader pipeline", rebuildable: true },
  { category: "webcodecs_export",      pattern: /(?:VideoEncoder|AudioEncoder|EncodedVideoChunk|webcodecs)/i, technique: "WebCodecs media encoding pipeline", rebuildable: true },
  { category: "image_masking",         pattern: /(?:mask_layer|alpha_channel|composite_over|luma_matte|chroma_key)/i, technique: "image / video masking and compositing", rebuildable: true },
  { category: "particle_system",       pattern: /(?:particle_(?:system|emitter|pool)|emit_particle|particle_update)/i, technique: "particle-system simulation and rendering", rebuildable: true },
  { category: "keyframe_animation",    pattern: /(?:keyframe|tween|animate_property|easing_function|spring_physics)/i, technique: "keyframe-based property animation with easing", rebuildable: true },
  { category: "audio_processing",      pattern: /(?:audiocontext|audio_worklet|fft|spectrogram|noise_gate|compressor_node)/i, technique: "audio signal processing / synthesis", rebuildable: true },
  { category: "speech_processing",     pattern: /(?:speech_to_text|voice_activity_detection|phoneme|whisper|deepspeech)/i, technique: "speech recognition or voice activity detection", rebuildable: false },
  { category: "geospatial_processing", pattern: /(?:geojson|lat_lon|haversine|geohash|geodesic|tile_scheme)/i, technique: "geospatial / mapping computation", rebuildable: true },
  { category: "data_visualisation",    pattern: /(?:d3\.|charting|scale_(?:linear|log)|axis_bottom|axis_left|render_chart)/i, technique: "data visualisation (charts / scales / axes)", rebuildable: true },
];

// ─── Public extraction API ──────────────────────────────────────────
export interface MultiCapabilityExtractionInput {
  readonly resource: EcosystemResource;
  readonly code_sample: string;               // may be empty for metadata-only audits
  readonly files_hint?: ReadonlyArray<string>; // optional file list · used for path-based signals if code sample is thin
}

export interface MultiCapabilityExtractionReport {
  readonly checked_at_iso: string;
  readonly capabilities: ReadonlyArray<CapabilityExtractionReport>;
  readonly notes: readonly string[];
}

export function extractCapabilities(input: MultiCapabilityExtractionInput): MultiCapabilityExtractionReport {
  const now_iso = new Date().toISOString();
  const found: CapabilityExtractionReport[] = [];
  const seen = new Set<string>();
  const notes: string[] = [];

  const haystack = input.code_sample + (input.files_hint ? "\n" + input.files_hint.join("\n") : "");

  for (const signal of CAPABILITY_SIGNALS) {
    if (signal.pattern.test(haystack) && !seen.has(signal.category)) {
      seen.add(signal.category);
      found.push({
        checked_at_iso: now_iso,
        capability_summary: `${signal.category} · detected in ${input.resource.resource_kind} '${input.resource.id}'`,
        underlying_technique: signal.technique,
        nex_reusable_directly: false,          // conservative default per Wave 8.A discipline
        nex_rebuildable_natively: signal.rebuildable,
        capability_category: signal.category,
        notes: [`heuristic pattern match · ${signal.pattern.source.slice(0, 80)}...`],
      });
    }
  }

  if (found.length === 0) {
    notes.push("no capability signals matched · returning single unknown-category placeholder");
    found.push({
      checked_at_iso: now_iso,
      capability_summary: `no capability signals matched for ${input.resource.resource_kind} '${input.resource.id}'`,
      underlying_technique: "unknown · needs Wave 8.G capability-taxonomy classifier or human triage",
      nex_reusable_directly: false,
      nex_rebuildable_natively: false,
      capability_category: "unknown",
      notes: ["heuristic library returned zero matches"],
    });
  } else {
    notes.push(`extracted ${found.length} capability signal${found.length > 1 ? "s" : ""} · deterministic heuristic library`);
  }

  return {
    checked_at_iso: now_iso,
    capabilities: found,
    notes,
  };
}
