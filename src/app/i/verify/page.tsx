// /i/verify — the public "was this image stolen from xrated trades?"
// decoder. Any visitor can drop an image here and we'll try to read
// the steganographic payload + match its perceptual hash to our
// catalogue.
//
// This is the counterpart to the SEO backlink page: theft → decode →
// canonical source → we get credit (and a potential lead).

"use client";

import { AlertCircle, CheckCircle2, Loader2, ShieldCheck, Upload } from "lucide-react";
import { useState } from "react";
import Link from "next/link";

type VerifyResult = {
  payload: string | null;
  ahash: string;
  matches: Array<{
    imageId: string;
    distance: number;
    confidence: "high" | "medium" | "low";
  }>;
};

export default function VerifyPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerifyResult | null>(null);

  const onFile = async (file: File) => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/image/verify", { method: "POST", body: form });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = (await res.json()) as VerifyResult;
      setResult(data);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-700">
        <ShieldCheck className="h-3.5 w-3.5" />
        Image provenance decoder
      </div>
      <h1 className="text-2xl font-bold text-neutral-900 md:text-3xl">
        Was this image stolen from xrated trades?
      </h1>
      <p className="mt-1 text-[13px] text-neutral-700">
        Every image in our library carries an invisible mark embedded in
        its pixels. Drop the image below and we&apos;ll read it — even if
        the visible watermark has been cropped out.
      </p>

      <label
        htmlFor="file-input"
        className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-neutral-300 bg-white p-10 text-center transition hover:border-neutral-400"
      >
        <Upload className="h-6 w-6 text-neutral-500" />
        <div className="mt-2 text-[13px] font-semibold text-neutral-900">
          Choose an image
        </div>
        <div className="mt-0.5 text-[11px] text-neutral-500">
          JPG, PNG or WebP up to 20 MB
        </div>
        <input
          id="file-input"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.currentTarget.files?.[0];
            if (f) onFile(f);
          }}
        />
      </label>

      {busy ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-neutral-100 p-3 text-[12px] text-neutral-700">
          <Loader2 className="h-4 w-4 animate-spin" /> Decoding — this
          takes a second on large images…
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-[12px] text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <div>Sorry — verification failed: {error}</div>
        </div>
      ) : null}

      {result ? <VerifyResultView result={result} /> : null}
    </main>
  );
}

function VerifyResultView({ result }: { result: VerifyResult }) {
  const stegHit = result.payload && result.payload.includes("thenetworkers.app");
  const bestMatch = result.matches[0];
  const hashHit = bestMatch && bestMatch.confidence !== "low";

  if (!stegHit && !hashHit) {
    return (
      <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5">
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-neutral-500" />
          <div>
            <div className="text-[14px] font-semibold text-neutral-900">
              No xrated trades mark detected
            </div>
            <div className="mt-1 text-[12px] text-neutral-700">
              This image doesn&apos;t appear to be from our library. If you
              believe it should be, the mark may have been destroyed by
              heavy compression or filtering.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const imageId = stegHit
    ? result.payload!.split("/").pop()!
    : bestMatch.imageId;

  return (
    <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
      <div className="flex items-start gap-2">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
        <div>
          <div className="text-[14px] font-semibold text-neutral-900">
            Match found — this is an xrated trades image
          </div>
          <div className="mt-1 text-[12px] text-neutral-700">
            {stegHit ? (
              <>Steganographic URL recovered: <span className="font-mono">{result.payload}</span></>
            ) : (
              <>
                Perceptual hash matches image <span className="font-mono">{bestMatch.imageId}</span>{" "}
                (distance {bestMatch.distance}, {bestMatch.confidence} confidence).
              </>
            )}
          </div>
          <Link
            href={`/i/${imageId}`}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-neutral-800"
          >
            View original + licence options
          </Link>
        </div>
      </div>
    </div>
  );
}
