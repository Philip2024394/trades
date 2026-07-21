/// <reference lib="webworker" />

// Background-removal Web Worker.
//
// Runs RMBG-1.4 on the merchant's device via ONNX Runtime Web.
// WebGPU is tried first (10-20× faster on modern GPUs); falls back
// to WASM SIMD if WebGPU is unavailable. Stays alive across calls
// so the model + device only initialise once.

import * as ort from "onnxruntime-web";

declare const self: DedicatedWorkerGlobalScope;

let session: ort.InferenceSession | null = null;
let sessionBackend: "webgpu" | "wasm"     = "wasm";
let inputSize = 1024;

/** Create the inference session. Tries WebGPU, falls back to WASM
 *  SIMD. Only runs once per worker lifetime. */
async function ensureSession(modelUrl: string, size: number): Promise<void> {
  if (session) return;
  inputSize = size;

  // Configure the WASM backend's assets URL. We use the bundled
  // onnxruntime-web files (Next.js copies them from node_modules).
  ort.env.wasm.wasmPaths = "/_next/static/chunks/";

  // Try WebGPU first — massive speedup on M-series Macs + modern
  // Windows GPUs. Falls through to WASM on failure.
  try {
    session = await ort.InferenceSession.create(modelUrl, {
      executionProviders: ["webgpu"],
      graphOptimizationLevel: "all"
    });
    sessionBackend = "webgpu";
    return;
  } catch (webgpuErr) {
    // WebGPU unavailable — fall through.
    console.warn("[bgremoval-worker] WebGPU failed, falling back to WASM:", webgpuErr);
  }

  session = await ort.InferenceSession.create(modelUrl, {
    executionProviders: ["wasm"],
    graphOptimizationLevel: "all"
  });
  sessionBackend = "wasm";
}

/** Resize + normalise input pixels to the model's expected tensor
 *  shape [1, 3, N, N]. RMBG-1.4 expects RGB in range [0, 1]. */
function preprocess(
  pixels: Uint8ClampedArray,
  srcW: number,
  srcH: number,
  size: number
): Float32Array {
  const offCanvas = new OffscreenCanvas(srcW, srcH);
  const octx = offCanvas.getContext("2d")!;
  // Rebuild Uint8ClampedArray on a plain ArrayBuffer — ImageData's
  // constructor is stricter about buffer type than a raw pixel copy.
  const imageData = new ImageData(new Uint8ClampedArray(pixels), srcW, srcH);
  octx.putImageData(imageData, 0, 0);

  // Resize to size × size via drawImage
  const resized = new OffscreenCanvas(size, size);
  const rctx = resized.getContext("2d")!;
  rctx.drawImage(offCanvas, 0, 0, size, size);
  const { data } = rctx.getImageData(0, 0, size, size);

  // Convert HWC RGBA → CHW RGB float32, normalise to [0, 1]
  const chw = new Float32Array(3 * size * size);
  const plane = size * size;
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    chw[j]             = data[i]     / 255;   // R
    chw[j + plane]     = data[i + 1] / 255;   // G
    chw[j + 2 * plane] = data[i + 2] / 255;   // B
  }
  return chw;
}

/** Composite the model's alpha mask onto the source RGBA pixels
 *  and encode as a transparent PNG. */
async function composite(
  mask: Float32Array,        // shape [1, 1, size, size], values 0..1
  sourcePixels: Uint8ClampedArray,
  srcW: number,
  srcH: number,
  maskSize: number
): Promise<Uint8Array> {
  // Upscale mask from maskSize×maskSize to srcW×srcH via canvas.
  const maskCanvas = new OffscreenCanvas(maskSize, maskSize);
  const mctx = maskCanvas.getContext("2d")!;
  const maskImageData = new ImageData(maskSize, maskSize);
  for (let i = 0; i < maskSize * maskSize; i++) {
    const v = Math.max(0, Math.min(255, Math.round(mask[i] * 255)));
    maskImageData.data[i * 4]     = v;
    maskImageData.data[i * 4 + 1] = v;
    maskImageData.data[i * 4 + 2] = v;
    maskImageData.data[i * 4 + 3] = 255;
  }
  mctx.putImageData(maskImageData, 0, 0);

  const upscaled = new OffscreenCanvas(srcW, srcH);
  const uctx = upscaled.getContext("2d")!;
  uctx.imageSmoothingEnabled = true;
  uctx.imageSmoothingQuality = "high";
  uctx.drawImage(maskCanvas, 0, 0, srcW, srcH);
  const upMask = uctx.getImageData(0, 0, srcW, srcH).data;

  // Apply mask as alpha channel on the source pixels. Copy to a
  // fresh ArrayBuffer so ImageData's constructor accepts it.
  const outBytes = new Uint8ClampedArray(sourcePixels.length);
  outBytes.set(sourcePixels);
  const out = new ImageData(outBytes, srcW, srcH);
  for (let i = 0; i < srcW * srcH; i++) {
    out.data[i * 4 + 3] = upMask[i * 4];
  }
  const finalCanvas = new OffscreenCanvas(srcW, srcH);
  const fctx = finalCanvas.getContext("2d")!;
  fctx.putImageData(out, 0, 0);
  const blob = await finalCanvas.convertToBlob({ type: "image/png" });
  return new Uint8Array(await blob.arrayBuffer());
}

// Message handler.
self.onmessage = async (e: MessageEvent) => {
  const msg = e.data;
  try {
    if (msg.type === "warmup") {
      await ensureSession(msg.modelUrl, msg.inputSize);
      self.postMessage({ type: "ready", backend: sessionBackend });
      return;
    }

    if (msg.type === "remove") {
      await ensureSession(msg.modelUrl, msg.inputSize);
      const size = inputSize;
      const srcW = msg.width as number;
      const srcH = msg.height as number;
      const src  = new Uint8ClampedArray(msg.pixels as ArrayBuffer);

      self.postMessage({ type: "progress", pct: 20 });

      const inputData = preprocess(src, srcW, srcH, size);
      const input     = new ort.Tensor("float32", inputData, [1, 3, size, size]);

      self.postMessage({ type: "progress", pct: 45 });

      const t0 = performance.now();
      const feeds: Record<string, ort.Tensor> = {};
      const inputName = session!.inputNames[0];
      feeds[inputName] = input;
      const out = await session!.run(feeds);
      const inferenceMs = Math.round(performance.now() - t0);

      self.postMessage({ type: "progress", pct: 80 });

      // Output tensor — take the alpha mask (single channel).
      const outName  = session!.outputNames[0];
      const outData  = out[outName].data as Float32Array;

      const png = await composite(outData, src, srcW, srcH, size);

      self.postMessage({ type: "progress", pct: 100 });
      self.postMessage(
        { type: "done", png: png.buffer, inferenceMs, backend: sessionBackend },
        [png.buffer]
      );
      return;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    self.postMessage({ type: "error", error: message });
  }
};
