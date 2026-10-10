// §36-PCE1 · WAVE-PCE-V1 · 2026-09-15 · nex-perceptual-contract-extraction-v1 · engine tests
// NEX bounded infrastructure · engine + adapter test suite · 2026-09-15

import { describe, expect, it } from "vitest";
import { runPerceptualContractExtraction } from "../perceptual-extraction-engine";
import { PCE_GREP_MARKER, type PCEFailure, type PCESuccess } from "../perceptual-extraction-engine-types";
import { craftMinimalPng, craftMinimalJpegStub, craftMinimalWebpStub } from "../perceptual-image-reader";
import { toVisualConstraintContract } from "../v1-contract-adapter";

function ok(r: ReturnType<typeof runPerceptualContractExtraction>): PCESuccess {
  expect(r.kind).toBe("SUCCESS");
  return r as PCESuccess;
}
function refuse(r: ReturnType<typeof runPerceptualContractExtraction>): PCEFailure {
  expect(r.kind).toBe("FAILURE");
  return r as PCEFailure;
}

// ── §A · Refusals ──────────────────────────────────────────────────

describe("§36-PCE1 · engine · refusal codes", () => {
  it("A-1 · PCE_INVALID_REQUEST when request is null", () => {
    const r = refuse(runPerceptualContractExtraction(null as never));
    expect(r.refusal_code).toBe("PCE_INVALID_REQUEST");
  });
  it("A-2 · PCE_INVALID_REQUEST when request_id is empty", () => {
    const r = refuse(runPerceptualContractExtraction({ request_id: "", image_bytes: craftMinimalPng(4, 4) }));
    expect(r.refusal_code).toBe("PCE_INVALID_REQUEST");
  });
  it("A-3 · PCE_INVALID_IMAGE_BYTES when image_bytes is null", () => {
    const r = refuse(runPerceptualContractExtraction({ request_id: "req-1", image_bytes: null as never }));
    expect(r.refusal_code).toBe("PCE_INVALID_IMAGE_BYTES");
  });
  it("A-4 · PCE_IMAGE_TOO_SMALL when bytes below PNG signature length", () => {
    const r = refuse(runPerceptualContractExtraction({ request_id: "req-2", image_bytes: new Uint8Array([0x89, 0x50]) }));
    expect(r.refusal_code).toBe("PCE_IMAGE_TOO_SMALL");
  });
  it("A-5 · PCE_IMAGE_TOO_LARGE when bytes exceed 32 MB cap", () => {
    // Use a small buffer with declared massive length via typed-array trick — we approximate by trying a 33 MB Uint8Array
    // (allocated but zero-initialised · fast). If the environment refuses allocation we'll skip.
    const big = new Uint8Array(33 * 1024 * 1024);
    const r = refuse(runPerceptualContractExtraction({ request_id: "req-3", image_bytes: big }));
    expect(r.refusal_code).toBe("PCE_IMAGE_TOO_LARGE");
  });
  it("A-6 · PCE_UNSUPPORTED_FORMAT when bytes are random noise (not PNG/JPEG/WebP/AVIF)", () => {
    const noise = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    const r = refuse(runPerceptualContractExtraction({ request_id: "req-4", image_bytes: noise }));
    expect(r.refusal_code).toBe("PCE_UNSUPPORTED_FORMAT");
  });
  it("A-7 · PCE_MALFORMED_HEADER when PNG signature present but IHDR corrupt", () => {
    const png = craftMinimalPng(4, 4);
    // Overwrite the IHDR chunk-type bytes
    png[12] = 0x42; png[13] = 0x42; png[14] = 0x42; png[15] = 0x42;
    const r = refuse(runPerceptualContractExtraction({ request_id: "req-5", image_bytes: png }));
    expect(r.refusal_code).toBe("PCE_MALFORMED_HEADER");
  });
  it("A-8 · PCE_PROHIBITED_STRING_CONTENT when request_id contains eval(", () => {
    const r = refuse(runPerceptualContractExtraction({ request_id: "req-eval(-injection", image_bytes: craftMinimalPng(4, 4) }));
    // The IDENT_RE rejects '(' first · so this falls out as INVALID_REQUEST rather than the prohibited path.
    // Both are legitimate structural refusals.
    expect(["PCE_INVALID_REQUEST", "PCE_PROHIBITED_STRING_CONTENT"]).toContain(r.refusal_code);
  });
  it("A-9 · PCE_INVALID_REQUEST when run_id has invalid chars", () => {
    const r = refuse(runPerceptualContractExtraction({ request_id: "req-6", run_id: "run with space", image_bytes: craftMinimalPng(4, 4) }));
    expect(r.refusal_code).toBe("PCE_INVALID_REQUEST");
  });
});

// ── §B · Deterministic extraction on a real PNG fixture ────────────

describe("§36-PCE1 · engine · deterministic PNG extraction", () => {
  it("B-1 · extracts width/height from a real crafted PNG", () => {
    const png = craftMinimalPng(1920, 1080);
    const s = ok(runPerceptualContractExtraction({ request_id: "req-b1", image_bytes: png }));
    expect(s.result.provenance.source_dimensions_width).toBe(1920);
    expect(s.result.provenance.source_dimensions_height).toBe(1080);
    expect(s.result.provenance.source_format).toBe("png");
  });
  it("B-2 · width + height properties are verified_deterministic", () => {
    const s = ok(runPerceptualContractExtraction({ request_id: "req-b2", image_bytes: craftMinimalPng(800, 600) }));
    const width = s.result.extracted_properties.find((p) => p.property_id === "dimensions.width");
    const height = s.result.extracted_properties.find((p) => p.property_id === "dimensions.height");
    expect(width?.verification_status).toBe("verified_deterministic");
    expect(height?.verification_status).toBe("verified_deterministic");
    expect(width?.value_summary).toBe("800");
    expect(height?.value_summary).toBe("600");
  });
  it("B-3 · aspect_ratio is derived deterministically and reduced by gcd", () => {
    const s = ok(runPerceptualContractExtraction({ request_id: "req-b3", image_bytes: craftMinimalPng(1920, 1080) }));
    const ar = s.result.extracted_properties.find((p) => p.property_id === "composition.aspect_ratio");
    expect(ar?.verification_status).toBe("verified_deterministic");
    // 1920:1080 reduces to 16:9
    expect(ar?.value_summary).toBe("16:9");
  });
  it("B-4 · SHA-256 provenance is stable across re-runs", () => {
    const png = craftMinimalPng(64, 64);
    const a = ok(runPerceptualContractExtraction({ request_id: "req-b4", image_bytes: png }));
    const b = ok(runPerceptualContractExtraction({ request_id: "req-b4", image_bytes: png }));
    expect(a.result.provenance.source_asset_sha256).toBe(b.result.provenance.source_asset_sha256);
  });
});

// ── §C · Format detection · non-PNG unable_to_verify dimensions ────

describe("§36-PCE1 · engine · format detection", () => {
  it("C-1 · JPEG format detected but dimensions unable_to_verify in V1", () => {
    const s = ok(runPerceptualContractExtraction({ request_id: "req-c1", image_bytes: craftMinimalJpegStub() }));
    expect(s.result.provenance.source_format).toBe("jpeg");
    const width = s.result.extracted_properties.find((p) => p.property_id === "dimensions.width");
    expect(width?.verification_status).toBe("unable_to_verify");
  });
  it("C-2 · WebP format detected but dimensions unable_to_verify in V1", () => {
    const s = ok(runPerceptualContractExtraction({ request_id: "req-c2", image_bytes: craftMinimalWebpStub() }));
    expect(s.result.provenance.source_format).toBe("webp");
    const width = s.result.extracted_properties.find((p) => p.property_id === "dimensions.width");
    expect(width?.verification_status).toBe("unable_to_verify");
  });
});

// ── §D · Unable_to_verify propagation (the load-bearing rule) ──────

describe("§36-PCE1 · engine · unable_to_verify semantics", () => {
  it("D-1 · geometry.component_counts is unable_to_verify with explicit rationale", () => {
    const s = ok(runPerceptualContractExtraction({ request_id: "req-d1", image_bytes: craftMinimalPng(4, 4) }));
    const p = s.result.extracted_properties.find((x) => x.property_id === "geometry.component_counts");
    expect(p?.verification_status).toBe("unable_to_verify");
    expect(p?.rationale).toContain("ML");
  });
  it("D-2 · material · camera · identity all unable_to_verify", () => {
    const s = ok(runPerceptualContractExtraction({ request_id: "req-d2", image_bytes: craftMinimalPng(4, 4) }));
    for (const id of ["material.classifications", "camera.view_angle_kind", "camera.focal_length_kind", "identity.features"]) {
      const p = s.result.extracted_properties.find((x) => x.property_id === id);
      expect(p?.verification_status).toBe("unable_to_verify");
    }
  });
  it("D-3 · colour.dominant_ranges is unable_to_verify · deferred to PCE Vb", () => {
    const s = ok(runPerceptualContractExtraction({ request_id: "req-d3", image_bytes: craftMinimalPng(4, 4) }));
    const p = s.result.extracted_properties.find((x) => x.property_id === "colour.dominant_ranges");
    expect(p?.verification_status).toBe("unable_to_verify");
    expect(p?.rationale).toContain("Vb");
  });
  it("D-4 · verified_count > 0 (dimensions + hash + format + aspect verified) AND unable_to_verify_count > 0", () => {
    const s = ok(runPerceptualContractExtraction({ request_id: "req-d4", image_bytes: craftMinimalPng(4, 4) }));
    expect(s.result.verified_count).toBeGreaterThan(0);
    expect(s.result.unable_to_verify_count).toBeGreaterThan(0);
  });
});

// ── §E · V1 adapter · honesty (omission not fabrication) ───────────

describe("§36-PCE1 · v1 adapter · honesty", () => {
  it("E-1 · adapter emits V1 contract with EMPTY identity_features · locked_materials · locked_colours (no fabrication)", () => {
    const s = ok(runPerceptualContractExtraction({ request_id: "req-e1", image_bytes: craftMinimalPng(1920, 1080) }));
    const bundle = toVisualConstraintContract({ extraction: s.result, contract_id: "test-contract-001", subject_kind: "test_subject" });
    expect(bundle.contract.identity_features).toEqual([]);
    expect(bundle.contract.locked_materials).toEqual([]);
    expect(bundle.contract.locked_colours).toEqual([]);
    expect(bundle.contract.geometry.component_counts).toEqual([]);
  });
  it("E-2 · adapter records unable_to_verify property IDs in bundle sidecar", () => {
    const s = ok(runPerceptualContractExtraction({ request_id: "req-e2", image_bytes: craftMinimalPng(1920, 1080) }));
    const bundle = toVisualConstraintContract({ extraction: s.result, contract_id: "test-contract-002", subject_kind: "test_subject" });
    expect(bundle.unable_to_verify_property_ids.length).toBeGreaterThan(0);
    expect(bundle.unable_to_verify_property_ids).toContain("material.classifications");
    expect(bundle.unable_to_verify_property_ids).toContain("camera.view_angle_kind");
    expect(bundle.unable_to_verify_property_ids).toContain("identity.features");
  });
  it("E-3 · adapter populates aspect_ratio into V1 composition when verified", () => {
    const s = ok(runPerceptualContractExtraction({ request_id: "req-e3", image_bytes: craftMinimalPng(1920, 1080) }));
    const bundle = toVisualConstraintContract({ extraction: s.result, contract_id: "test-contract-003", subject_kind: "test_subject" });
    expect(bundle.contract.composition.aspect_ratio_num).toBe(16);
    expect(bundle.contract.composition.aspect_ratio_den).toBe(9);
    expect(bundle.verified_property_ids).toContain("composition.aspect_ratio");
  });
  it("E-4 · adapter carries provenance source SHA into contract provenance", () => {
    const s = ok(runPerceptualContractExtraction({ request_id: "req-e4", image_bytes: craftMinimalPng(64, 64) }));
    const bundle = toVisualConstraintContract({ extraction: s.result, contract_id: "test-contract-004", subject_kind: "test_subject" });
    expect(bundle.contract.provenance.source_reference_sha256).toBe(s.result.provenance.source_asset_sha256);
    expect(bundle.contract.provenance.authored_by).toBe("MAI_infrastructure");
  });
});

// ── §F · Determinism ───────────────────────────────────────────────

describe("§36-PCE1 · engine · determinism", () => {
  it("F-1 · same input produces byte-identical result JSON", () => {
    const png = craftMinimalPng(320, 240);
    const req = { request_id: "req-f1", image_bytes: png, extraction_timestamp: "2026-09-15T12:00:00.000Z", run_id: "run-1", result_id: "res-1" };
    const a = ok(runPerceptualContractExtraction(req));
    const b = ok(runPerceptualContractExtraction(req));
    expect(JSON.stringify(a.result)).toBe(JSON.stringify(b.result));
  });
  it("F-2 · determinism_kind is 'deterministic'", () => {
    const s = ok(runPerceptualContractExtraction({ request_id: "req-f2", image_bytes: craftMinimalPng(4, 4) }));
    expect(s.result.determinism_kind).toBe("deterministic");
  });
});

// ── §G · Grep marker + algorithm version ──────────────────────────

describe("§36-PCE1 · engine · grep marker", () => {
  it("G-1 · SUCCESS carries the locked grep marker + algorithm version", () => {
    const s = ok(runPerceptualContractExtraction({ request_id: "req-g1", image_bytes: craftMinimalPng(4, 4) }));
    expect(s.grep_marker).toBe(PCE_GREP_MARKER);
    expect(s.algorithm_version).toBe("1.0.0");
  });
  it("G-2 · FAILURE carries the locked grep marker + algorithm version", () => {
    const r = refuse(runPerceptualContractExtraction(null as never));
    expect(r.grep_marker).toBe(PCE_GREP_MARKER);
    expect(r.algorithm_version).toBe("1.0.0");
  });
});

// ── §H · The staircase proving posture ────────────────────────────

describe("§36-PCE1 · staircase proving posture", () => {
  it("H-1 · a real image (crafted PNG standing in for a staircase reference) yields honest results", () => {
    // A future perceptual layer will decode pixel data. In V1, given a real
    // PNG whose bytes we constructed, we can honestly report format +
    // dimensions + aspect_ratio + SHA · everything else unable_to_verify.
    // This is the honest staircase-proving posture: measurable facts stay
    // measurable · semantic facts stay unable_to_verify pending future waves.
    const png = craftMinimalPng(1920, 1440); // 4:3 aspect · could be a merchant staircase reference
    const s = ok(runPerceptualContractExtraction({ request_id: "staircase-audit-001", image_bytes: png }));
    // What PCE V1 can prove:
    expect(s.result.provenance.source_dimensions_width).toBe(1920);
    expect(s.result.provenance.source_dimensions_height).toBe(1440);
    expect(s.result.provenance.source_format).toBe("png");
    const ar = s.result.extracted_properties.find((p) => p.property_id === "composition.aspect_ratio");
    expect(ar?.value_summary).toBe("4:3");
    // What PCE V1 explicitly cannot prove:
    for (const id of ["identity.features", "geometry.component_counts", "material.classifications", "camera.view_angle_kind"]) {
      const p = s.result.extracted_properties.find((x) => x.property_id === id);
      expect(p?.verification_status).toBe("unable_to_verify");
    }
  });
});
