// /admin/nex/teach — Teach Nex upload page.
// Staff uploads a PDF / photo / guide → row lands in
// hammerex_nex_teaching_uploads with status='queued'.
// The extraction worker (background job, not shipped this pass)
// reads queued rows, parses them, and files review-queue items.

import Link from "next/link";
import { listUploads } from "@/lib/nex/intelligence";
import { TeachNex } from "@/components/admin/nex/TeachNex";

export const dynamic = "force-dynamic";
export const metadata = { title: "Teach Nex · Admin", robots: { index: false } };

export default async function Page() {
  const uploads = await listUploads({ limit: 25 });
  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex items-baseline justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Nex Intelligence</p>
            <h1 className="mt-1 text-2xl font-black">Teach Nex</h1>
            <p className="mt-1 text-[12px] text-neutral-600">
              Drop in a PDF, manufacturer guide, or photo. Nex reads it, drafts the knowledge, and sends it to Review.
            </p>
          </div>
          <div className="flex gap-2 text-[11px] font-black">
            <Link href="/admin/nex/knowledge" className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 hover:border-neutral-900">Knowledge</Link>
            <Link href="/admin/nex/review"    className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 hover:border-neutral-900">Review queue</Link>
          </div>
        </div>

        <TeachNex uploads={uploads}/>
      </div>
    </div>
  );
}
