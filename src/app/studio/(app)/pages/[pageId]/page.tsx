// Page editor host — mounts StudioLiveMirror around the preview iframe.
// The mirror owns the draft layout and postMessage bus; this route is a
// thin server-side loader for the initial layout.
//
// Module 18: pages resolved from studio_pages, not the old KNOWN_PAGES
// hard-code. Passes a full page catalog into the mirror so the editor
// can render a page-switcher chip.

import { notFound } from "next/navigation";
import { loadStudioSession } from "@/lib/studio/session";
import { loadLayoutForPage } from "@/lib/studio/layoutLoader";
import { listPagesForBrand, findPage } from "@/lib/studio/pagesLoader";
import { StudioLiveMirror } from "@/components/studio/StudioLiveMirror";

export const dynamic = "force-dynamic";

export default async function StudioPageEditor({
  params
}: {
  params: Promise<{ pageId: string }>;
}) {
  const { pageId } = await params;
  const session = await loadStudioSession();
  if (!session) return null;

  const [page, pages] = await Promise.all([
    findPage(session.brand.id, pageId),
    listPagesForBrand(session.brand.id)
  ]);
  if (!page) notFound();

  const initialLayout = await loadLayoutForPage({
    merchantId: session.merchant.id,
    brandId: session.brand.id,
    pageId
  });

  return (
    <div className="min-w-0">
      <div className="border-b border-neutral-200 bg-white px-6 py-4">
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
          Editing
        </p>
        <h1 className="mt-0.5 text-[20px] font-extrabold text-neutral-900">
          {page.name}
        </h1>
      </div>
      <StudioLiveMirror
        merchantSlug={session.merchant.slug}
        brandSlug={session.brand.slug}
        pageId={pageId}
        token={session.token}
        initialLayout={initialLayout}
        pages={pages}
      />
    </div>
  );
}
