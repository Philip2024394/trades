// /archive/[merchantId] — the merchant-facing "ask your archive"
// surface. One text box, one submit, results below with the LLM's
// summary + a facet chip cloud + the underlying records.
//
// Server component that wraps a client island for the interactive
// ask flow.

import { AskArchive } from "./AskArchive";

type PageProps = { params: Promise<{ merchantId: string }> };

export const metadata = {
  title: "Your Archive · xrated studio",
  description: "Ask questions about your business history."
};

export default async function ArchivePage({ params }: PageProps) {
  const { merchantId } = await params;
  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-neutral-50 px-4 py-8">
      <header className="mb-6">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-700">
          Your Archive
        </div>
        <h1 className="mt-2 text-2xl font-bold text-neutral-900">
          Ask your business history
        </h1>
        <p className="mt-1 text-[13px] text-neutral-700">
          Everything you&apos;ve captured, tagged, and completed. Ask in
          plain English.
        </p>
      </header>
      <AskArchive merchantId={merchantId} />
    </main>
  );
}
