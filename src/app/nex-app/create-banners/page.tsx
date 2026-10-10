// src/app/nex-app/create-banners/page.tsx
//
// NEX Chat → Keypad → Create Banners · UI entry point · 2026-09-23
// ================================================================
// Founder Authorisation A + sandbox demo.
// Every output remains UNPROVEN · watermarked · not published · not manifest-written.

import Link from "next/link";
import { Suspense } from "react";
import {
  BANNER_FORMATS,
  DEFAULT_QUALITY_STATUS_UNTIL_EVALUATION_PASSES,
  qualityStatusUserFacingLabel,
} from "@/lib/nex/create-banners";
import CreateBannersClient from "./CreateBannersClient";

export const dynamic = "force-dynamic";

export default function CreateBannersPage() {
  const currentQuality = DEFAULT_QUALITY_STATUS_UNTIL_EVALUATION_PASSES;
  const label = qualityStatusUserFacingLabel(currentQuality);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 text-[15px]">
      <nav className="mb-4 text-xs text-neutral-500">
        <Link href="/nex-app" className="hover:underline">
          NEX Chat
        </Link>
        <span className="mx-2">→</span>
        <span>Keypad</span>
        <span className="mx-2">→</span>
        <span className="font-medium text-neutral-800">Create Banners</span>
      </nav>

      <h1 className="mb-2 text-2xl font-semibold text-neutral-900">
        Create Banners
      </h1>
      <p className="mb-6 text-neutral-700">
        NEX-owned banner creation using local generation, NEX composition, and
        the existing Social Poster publishing surface (publish gated behind
        Authorisation B).
      </p>

      <div
        role="status"
        className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4"
      >
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
          Generation quality status
        </div>
        <div className="text-base font-medium text-amber-900">{label}</div>
        <div className="mt-2 text-xs text-amber-800">
          The Create Banners architecture is built. Production-quality visual
          generation remains{" "}
          <span className="font-semibold">UNPROVEN</span> until the Banner
          Evaluation Plan passes. Every banner produced here is watermarked,
          not saved to the image manifest, and not eligible for publication.
        </div>
      </div>

      {/*
        Suspense wraps the client because CreateBannersClient calls
        useSearchParams() (to read ?product_id= for product-aware
        auto-fill). Next.js requires a Suspense boundary around any
        client subtree that uses useSearchParams so the app can
        pre-render the static shell independently of URL state.
      */}
      <Suspense fallback={<div className="rounded-lg border border-neutral-200 bg-white p-4 text-sm text-neutral-600">Loading…</div>}>
        <CreateBannersClient />
      </Suspense>

      <section className="mb-8 mt-8">
        <h2 className="mb-3 text-lg font-semibold text-neutral-900">
          Supported formats
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {BANNER_FORMATS.map((f) => (
            <li
              key={f.id}
              className="rounded-md border border-neutral-200 bg-white p-3"
            >
              <div className="text-sm font-medium text-neutral-900">
                {f.label}
              </div>
              <div className="text-xs text-neutral-600">
                {f.width} × {f.height}
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-wide text-neutral-500">
                {f.aspect} · {f.role.replace(/_/g, " ")}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
