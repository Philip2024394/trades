// §36-V3-SDXL · WAVE-P1-CAMPAIGN · 2026-09-15 · nex-sdxl-engine-adapter · unit tests
// Bounded NEX infrastructure · runs without SDXL weights · exercises guards only.
//
// These tests exist to satisfy G-8 (hostile self-review) of the sealed acceptance
// gate ladder. They verify:
//   U-1 · Adapter refuses malformed request
//   U-2 · Adapter refuses missing options
//   U-3 · Anti-injection guard rejects eval(
//   U-4 · Anti-injection guard rejects new Function
//   U-5 · Anti-injection guard rejects child_process
//   U-6 · Anti-injection guard rejects <script>
//   U-7 · Anti-injection guard rejects __proto__
//   U-8 · Anti-injection guard rejects constructor.prototype
//   U-9 · Adapter refuses when python_exe path is missing
//   U-10 · Adapter refuses when script_path is missing
//   U-11 · Grep marker + adapter version + native slug are frozen constants
//   U-12 · Zero-length prompt is refused (isValidV3Request)

import { describe, expect, it } from "vitest";
import { runNexSdxlAdapter } from "../nex-sdxl-adapter";
import {
  NEX_SDXL_ADAPTER_GREP_MARKER,
  NEX_SDXL_ADAPTER_VERSION,
  NEX_SDXL_NATIVE_SLUG,
} from "../nex-sdxl-adapter-types";
import type { V3GenerationRequest } from "../../nex-visual-intelligence-v3/visual-generation-contract";

const NEVER_EXIST_PATH = "C:/this/path/absolutely/does/not/exist/xyzq-9999.tmp";
const wellFormedRequest: V3GenerationRequest = {
  request_id: "unit-guard-001",
  generation_kind: "unconditional",
  prompt: "a plain wooden staircase",
  output_format: "png",
  max_output_images: 1,
};

describe("§36-V3-SDXL · adapter guards (unit · no SDXL required)", () => {
  it("U-1 · refuses malformed request", async () => {
    const r = await runNexSdxlAdapter({} as unknown as never);
    expect(r.kind).toBe("FAILURE");
    if (r.kind === "FAILURE") expect(r.refusal_code).toBe("NEX_SDXL_INVALID_REQUEST");
  });

  it("U-2 · refuses missing options", async () => {
    const r = await runNexSdxlAdapter({ request: wellFormedRequest } as unknown as never);
    expect(r.kind).toBe("FAILURE");
    if (r.kind === "FAILURE") expect(r.refusal_code).toBe("NEX_SDXL_INVALID_REQUEST");
  });

  const banned = [
    ["eval(", "eval() injection"],
    ["new Function", "Function constructor injection"],
    ["child_process", "child_process access"],
    ["<script>", "script tag injection"],
    ["__proto__", "prototype pollution"],
    ["constructor.prototype", "constructor prototype access"],
  ] as const;

  for (const [idx, [needle, description]] of banned.entries()) {
    it(`U-${3 + idx} · anti-injection guard rejects ${description}`, async () => {
      const r = await runNexSdxlAdapter({
        request: { ...wellFormedRequest, request_id: `guard-${idx}`, prompt: `a staircase ${needle} malicious` },
        options: {
          python_exe: NEVER_EXIST_PATH,
          script_path: NEVER_EXIST_PATH,
          output_dir: NEVER_EXIST_PATH,
          request_json_path: NEVER_EXIST_PATH,
        },
      });
      expect(r.kind).toBe("FAILURE");
      if (r.kind === "FAILURE") {
        expect(r.refusal_code).toBe("NEX_SDXL_PROHIBITED_STRING_CONTENT");
        expect(r.reason).toContain(needle);
      }
    });
  }

  it("U-9 · refuses when python_exe path is missing", async () => {
    const r = await runNexSdxlAdapter({
      request: wellFormedRequest,
      options: {
        python_exe: NEVER_EXIST_PATH,
        script_path: NEVER_EXIST_PATH,
        output_dir: NEVER_EXIST_PATH,
        request_json_path: NEVER_EXIST_PATH,
      },
    });
    expect(r.kind).toBe("FAILURE");
    if (r.kind === "FAILURE") expect(r.refusal_code).toBe("NEX_SDXL_PYTHON_NOT_AVAILABLE");
  });

  it("U-10 · refuses when script_path is missing (given valid python_exe)", async () => {
    // We synthesise a "valid" python_exe path pointing at a real existing file
    // that isn't actually python — the script_path check runs before spawn.
    // Any real file the test can rely on: use process.execPath (node itself).
    const nodePath = process.execPath;
    const r = await runNexSdxlAdapter({
      request: wellFormedRequest,
      options: {
        python_exe: nodePath,
        script_path: NEVER_EXIST_PATH,
        output_dir: NEVER_EXIST_PATH,
        request_json_path: NEVER_EXIST_PATH,
      },
    });
    expect(r.kind).toBe("FAILURE");
    if (r.kind === "FAILURE") expect(r.refusal_code).toBe("NEX_SDXL_SCRIPT_MISSING");
  });

  it("U-11 · exports frozen identity constants", () => {
    expect(NEX_SDXL_ADAPTER_GREP_MARKER).toBe("§36-V3-SDXL · WAVE-P1-CAMPAIGN · 2026-09-15 · nex-sdxl-engine-adapter");
    expect(NEX_SDXL_ADAPTER_VERSION).toBe("0.1.0");
    expect(NEX_SDXL_NATIVE_SLUG).toBe("nex-visual-engine-primary");
  });

  it("U-12 · refuses zero-length prompt", async () => {
    const r = await runNexSdxlAdapter({
      request: { ...wellFormedRequest, prompt: "" },
      options: {
        python_exe: NEVER_EXIST_PATH,
        script_path: NEVER_EXIST_PATH,
        output_dir: NEVER_EXIST_PATH,
        request_json_path: NEVER_EXIST_PATH,
      },
    });
    expect(r.kind).toBe("FAILURE");
    if (r.kind === "FAILURE") expect(r.refusal_code).toBe("NEX_SDXL_INVALID_REQUEST");
  });
});
