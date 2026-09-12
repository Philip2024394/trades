// src/lib/nex/live-chat-completion/voice/real-providers.ts
//
// Founder Phase 12 · P12-3 · Real whisper.cpp + Piper providers with
// honest UNKNOWN fallback.
//
// Discipline mirror of image-gen/sd-provider.ts:
//   · Detect binary availability at construction time (no fabrication).
//   · If binary is missing, provider still exists but marks
//     completed=false + error="binary_not_available" · never invents audio.
//   · Real path shells out to whisper.cpp / piper CLIs when they exist.

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SttProvider, SttRequest, SttResult, TtsProvider, TtsRequest, TtsResult } from "./contract";
import { hashAudioBase64, hashText } from "./contract";

function detectBinary(cmd: string): string | null {
  const which = process.platform === "win32" ? "where" : "which";
  const r = spawnSync(which, [cmd], { encoding: "utf8" });
  if (r.status === 0 && r.stdout && r.stdout.trim()) {
    return r.stdout.split(/\r?\n/)[0].trim();
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════
// Real STT · whisper.cpp binary "whisper"
// ═══════════════════════════════════════════════════════════════════

export function makeWhisperSttProvider(): SttProvider {
  const bin = detectBinary("whisper") ?? detectBinary("whisper.cpp");
  const model = process.env.NEX_WHISPER_MODEL ?? "ggml-base.en.bin";

  return {
    name: "whisper.cpp",
    async transcribe(input: SttRequest): Promise<SttResult> {
      const t0 = performance.now();
      const audio_hash = hashAudioBase64(input.audio_base64);
      if (!bin) {
        return {
          transcript_id: `stt:${audio_hash}`,
          text: "",
          language: input.language === "auto" ? "en" : input.language,
          confidence: 0,
          duration_s: null,
          audio_hash,
          provider: "whisper.cpp",
          model_id: model,
          request_ms: Math.round(performance.now() - t0),
          completed: false,
          error: "binary_not_available",
        };
      }
      const dir = join(tmpdir(), "nex-stt");
      try { mkdirSync(dir, { recursive: true }); } catch { /* exists */ }
      const inPath = join(dir, `${audio_hash}.wav`);
      const outPath = join(dir, `${audio_hash}.txt`);
      try {
        writeFileSync(inPath, Buffer.from(input.audio_base64, "base64"));
        const args = ["-m", model, "-f", inPath, "-of", outPath.replace(/\.txt$/, ""), "-otxt", "-nt"];
        const r = spawnSync(bin, args, { encoding: "utf8", timeout: input.budget_ms });
        if (r.status !== 0) {
          return {
            transcript_id: `stt:${audio_hash}`,
            text: "",
            language: "en",
            confidence: 0,
            duration_s: null,
            audio_hash,
            provider: "whisper.cpp",
            model_id: model,
            request_ms: Math.round(performance.now() - t0),
            completed: false,
            error: `whisper_exit_${r.status ?? "timeout"}`,
          };
        }
        const text = existsSync(outPath) ? readFileSync(outPath, "utf8").trim() : "";
        return {
          transcript_id: `stt:${audio_hash}`,
          text,
          language: input.language === "auto" ? "en" : input.language,
          confidence: text.length > 0 ? 0.9 : 0,
          duration_s: null,
          audio_hash,
          provider: "whisper.cpp",
          model_id: model,
          request_ms: Math.round(performance.now() - t0),
          completed: text.length > 0,
        };
      } finally {
        try { if (existsSync(inPath)) unlinkSync(inPath); } catch { /* ignore */ }
        try { if (existsSync(outPath)) unlinkSync(outPath); } catch { /* ignore */ }
      }
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// Real TTS · Piper binary "piper"
// ═══════════════════════════════════════════════════════════════════

export function makePiperTtsProvider(): TtsProvider {
  const bin = detectBinary("piper");
  const modelDir = process.env.NEX_PIPER_MODEL_DIR ?? "";

  return {
    name: "piper",
    async synthesize(input: TtsRequest): Promise<TtsResult> {
      const t0 = performance.now();
      const text_hash = hashText(input.text, input.voice);
      if (!bin) {
        return {
          synth_id: `tts:${text_hash}`,
          content_base64: "",
          mime_type: "audio/wav",
          duration_s: null,
          text_hash,
          voice: input.voice,
          provider: "piper",
          model_id: input.model_id ?? input.voice,
          request_ms: Math.round(performance.now() - t0),
          completed: false,
          error: "binary_not_available",
        };
      }
      const dir = join(tmpdir(), "nex-tts");
      try { mkdirSync(dir, { recursive: true }); } catch { /* exists */ }
      const outPath = join(dir, `${text_hash}.wav`);
      const modelPath = modelDir ? join(modelDir, `${input.voice}.onnx`) : `${input.voice}.onnx`;
      try {
        const args = ["--model", modelPath, "--output_file", outPath];
        const r = spawnSync(bin, args, { encoding: "utf8", input: input.text, timeout: input.budget_ms });
        if (r.status !== 0 || !existsSync(outPath)) {
          return {
            synth_id: `tts:${text_hash}`,
            content_base64: "",
            mime_type: "audio/wav",
            duration_s: null,
            text_hash,
            voice: input.voice,
            provider: "piper",
            model_id: input.model_id ?? input.voice,
            request_ms: Math.round(performance.now() - t0),
            completed: false,
            error: `piper_exit_${r.status ?? "timeout"}`,
          };
        }
        const content_base64 = readFileSync(outPath).toString("base64");
        return {
          synth_id: `tts:${text_hash}`,
          content_base64,
          mime_type: "audio/wav",
          duration_s: null,
          text_hash,
          voice: input.voice,
          provider: "piper",
          model_id: input.model_id ?? input.voice,
          request_ms: Math.round(performance.now() - t0),
          completed: true,
        };
      } finally {
        try { if (existsSync(outPath)) unlinkSync(outPath); } catch { /* ignore */ }
      }
    },
  };
}
