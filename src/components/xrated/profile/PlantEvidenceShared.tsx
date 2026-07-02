"use client";

// Shared building blocks for the delivery + damage evidence forms:
//   - PhotoUploader (uploads to Supabase Storage via existing endpoint)
//   - SignaturePad (canvas → PNG data URL → uploaded to storage)
//   - MachineSelect
//
// Kept in one file so both routes stay tight.

import { useEffect, useRef, useState } from "react";
import { PLANT_CATEGORIES, type PlantCategorySlug } from "@/lib/plantHire";

export function PhotoUploader({
  label,
  values,
  onChange,
  required,
  minPhotos = 3,
  maxPhotos = 8
}: {
  label: string;
  values: string[];
  onChange: (urls: string[]) => void;
  required?: boolean;
  minPhotos?: number;
  maxPhotos?: number;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const handle = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const uploaded: string[] = [];
      for (const f of Array.from(files).slice(0, maxPhotos)) {
        const fd = new FormData();
        fd.append("file", f);
        const r = await fetch("/api/trade-off/upload-photo", { method: "POST", body: fd });
        const j = (await r.json()) as { url?: string; error?: string };
        if (!r.ok || !j.url) throw new Error(j.error ?? "upload failed");
        uploaded.push(j.url);
      }
      onChange([...values, ...uploaded].slice(0, maxPhotos));
    } catch (e) {
      setError(e instanceof Error ? e.message : "upload error");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <span className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
        {label}
      </span>
      {values.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {values.map((u, i) => (
            <div
              key={u + i}
              className="group relative aspect-square overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => onChange(values.filter((_, j) => j !== i))}
                className="absolute right-1 top-1 rounded-full bg-neutral-900/90 px-2 py-0.5 text-[10px] font-extrabold text-white opacity-0 transition group-hover:opacity-100"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <label
        className={`flex h-24 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed text-[12px] font-bold transition ${
          busy ? "border-neutral-300 text-neutral-400" : "border-neutral-300 text-neutral-500 hover:border-[#FFB300] hover:text-neutral-900"
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => handle(e.target.files)}
        />
        {busy ? "Uploading…" : values.length === 0 ? "Tap to upload photos" : "+ Add more"}
      </label>
      {error && <p className="text-[11px] font-bold text-red-600">{error}</p>}
      <p className="text-[11px] text-neutral-500">
        {values.length}/{maxPhotos} photos ·{" "}
        {required
          ? values.length >= minPhotos
            ? "✓ minimum met"
            : `${minPhotos - values.length} more required`
          : "optional"}
      </p>
    </div>
  );
}

export function SignaturePad({
  value,
  onChange,
  label = "Signature"
}: {
  value: string;
  onChange: (dataUrl: string) => void;
  label?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0a0a0a";
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height
    };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const p = point(e);
    if (!p) return;
    drawing.current = true;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    canvas.setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const p = point(e);
    if (!p) return;
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };
  const end = () => {
    drawing.current = false;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    onChange("");
  };

  const upload = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setUploading(true);
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      if (!blob) throw new Error("could not build signature");
      const fd = new FormData();
      fd.append("file", new File([blob], "signature.png", { type: "image/png" }));
      const r = await fetch("/api/trade-off/upload-photo", { method: "POST", body: fd });
      const j = (await r.json()) as { url?: string; error?: string };
      if (!r.ok || !j.url) throw new Error(j.error ?? "upload failed");
      onChange(j.url);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <span className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
        {label}
      </span>
      <div className="rounded-xl border border-neutral-300 bg-white p-1">
        <canvas
          ref={canvasRef}
          width={800}
          height={200}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          style={{ touchAction: "none" }}
          className="h-40 w-full cursor-crosshair rounded-lg"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={clear}
          className="inline-flex h-9 items-center rounded-lg border border-neutral-200 bg-white px-3 text-[11px] font-extrabold uppercase tracking-widest text-neutral-700 hover:bg-neutral-50"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={upload}
          disabled={uploading}
          className={`inline-flex h-9 items-center rounded-lg px-3 text-[11px] font-extrabold uppercase tracking-widest ${
            uploading
              ? "cursor-not-allowed bg-neutral-200 text-neutral-500"
              : value
                ? "bg-emerald-600 text-white"
                : "bg-neutral-900 text-white hover:bg-black"
          }`}
        >
          {uploading ? "Uploading…" : value ? "✓ Signature saved" : "Save signature"}
        </button>
        {value && (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center rounded-lg border border-neutral-200 bg-white px-3 text-[11px] font-extrabold uppercase tracking-widest text-neutral-700 hover:bg-neutral-50"
          >
            Open PNG →
          </a>
        )}
      </div>
    </div>
  );
}

export function MachineSelect({
  fleet,
  value,
  onChange,
  customValue,
  onCustomChange
}: {
  fleet: { slug: PlantCategorySlug; label: string }[];
  value: PlantCategorySlug | "";
  onChange: (v: PlantCategorySlug | "") => void;
  customValue: string;
  onCustomChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="block">
        <span className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
          Machine
        </span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as PlantCategorySlug | "")}
          className="mt-1 h-12 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-[14px] outline-none focus:border-[#FFB300] focus:bg-white"
        >
          <option value="">— pick from fleet —</option>
          {fleet.map((f) => (
            <option key={f.slug} value={f.slug}>
              {PLANT_CATEGORIES.find((m) => m.slug === f.slug)?.label ?? f.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
          Or specific model
        </span>
        <input
          type="text"
          value={customValue}
          onChange={(e) => onCustomChange(e.target.value)}
          placeholder="e.g. JCB 8018 CTS · Serial 12345"
          className="mt-1 h-12 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-[14px] outline-none focus:border-[#FFB300] focus:bg-white"
        />
      </label>
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
  type
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "text" | "tel" | "email" | "numeric";
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
        {label}
      </span>
      <input
        type={type ?? "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="mt-1 h-12 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-[14px] outline-none focus:border-[#FFB300] focus:bg-white"
      />
    </label>
  );
}
