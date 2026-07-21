"use client";

// Client-side background remover — spawns a Web Worker that runs
// RMBG-1.4 via ONNX Runtime Web (WebGPU preferred, WASM fallback).
// The worker keeps inference off the main thread so the editor
// canvas stays responsive.
//
// Usage:
//   import { removeBackground, warmup } from "@/lib/backgroundRemoval/client";
//
//   await warmup();                       // optional — preload the model
//   const png = await removeBackground(imageUrl); // returns Blob (transparent PNG)

import { RMBG_MODEL_URL, INPUT_SIZE } from "./config";

let workerPromise: Promise<Worker> | null = null;

function spawnWorker(): Promise<Worker> {
  if (workerPromise) return workerPromise;
  workerPromise = new Promise<Worker>((resolve, reject) => {
    try {
      // The worker is a module worker so it can `import` onnxruntime-web.
      // Next.js bundles it via new URL(..., import.meta.url).
      const worker = new Worker(
        new URL("./worker.ts", import.meta.url),
        { type: "module" }
      );
      worker.onerror = (e) => reject(new Error(e.message || "Worker error"));
      resolve(worker);
    } catch (err) {
      reject(err);
    }
  });
  return workerPromise;
}

/** Kick off model download + WebGPU device init in the background so
 *  the merchant's FIRST call to removeBackground() feels instant.
 *  Safe to call multiple times — the worker only warms up once. */
export async function warmup(): Promise<void> {
  const worker = await spawnWorker();
  return new Promise<void>((resolve, reject) => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "ready") { worker.removeEventListener("message", onMessage); resolve(); }
      if (e.data?.type === "error") { worker.removeEventListener("message", onMessage); reject(new Error(e.data.error)); }
    };
    worker.addEventListener("message", onMessage);
    worker.postMessage({
      type:      "warmup",
      modelUrl:  RMBG_MODEL_URL,
      inputSize: INPUT_SIZE
    });
  });
}

/** Load an image from a URL as raw pixel bytes ready for the model.
 *  Uses a canvas so we get RGBA data. */
async function loadImageBytes(url: string): Promise<{ w: number; h: number; data: Uint8ClampedArray }> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((res, rej) => {
    img.onload  = () => res();
    img.onerror = () => rej(new Error("Image load failed"));
    img.src = url;
  });
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable");
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { w: canvas.width, h: canvas.height, data };
}

export type RemoveBackgroundResult = {
  /** Transparent PNG blob — drop into <img>, upload, or composite. */
  blob:         Blob;
  /** Data URL for immediate preview without an object URL round-trip. */
  dataUrl:      string;
  /** How long inference took, milliseconds. */
  inferenceMs:  number;
  /** Which backend actually ran the model — helps analytics. */
  backend:      "webgpu" | "wasm";
};

/** Remove background from an image URL and return a transparent PNG.
 *  Runs 100% in the merchant's browser. No server round-trip during
 *  inference. */
export async function removeBackground(
  imageUrl: string,
  onProgress?: (pct: number) => void
): Promise<RemoveBackgroundResult> {
  const worker = await spawnWorker();
  const src    = await loadImageBytes(imageUrl);

  return new Promise((resolve, reject) => {
    const onMessage = (e: MessageEvent) => {
      const msg = e.data;
      if (msg.type === "progress") {
        onProgress?.(msg.pct);
        return;
      }
      if (msg.type === "done") {
        worker.removeEventListener("message", onMessage);
        const blob    = new Blob([msg.png], { type: "image/png" });
        const dataUrl = URL.createObjectURL(blob);
        resolve({ blob, dataUrl, inferenceMs: msg.inferenceMs, backend: msg.backend });
        return;
      }
      if (msg.type === "error") {
        worker.removeEventListener("message", onMessage);
        reject(new Error(msg.error));
      }
    };
    worker.addEventListener("message", onMessage);
    worker.postMessage(
      {
        type:      "remove",
        modelUrl:  RMBG_MODEL_URL,
        inputSize: INPUT_SIZE,
        width:     src.w,
        height:    src.h,
        pixels:    src.data.buffer
      },
      [src.data.buffer]
    );
  });
}
