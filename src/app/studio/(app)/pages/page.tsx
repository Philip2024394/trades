// Pages list — every page the merchant can edit for the current brand.
//
// Module 18 (this file) reads studio_pages, exposes "New page", and
// the page cards are dedicated LinkPickers so home stays pinned first.

import { loadStudioSession } from "@/lib/studio/session";
import { listPagesForBrand } from "@/lib/studio/pagesLoader";
import { StudioPagesManager } from "@/components/studio/StudioPagesManager";

const YELLOW = "#FFB300";

export const dynamic = "force-dynamic";

export default async function StudioPagesIndex() {
  const session = await loadStudioSession();
  if (!session) return null;
  const pages = await listPagesForBrand(session.brand.id);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
      <p
        className="text-[10px] font-extrabold uppercase tracking-widest"
        style={{ color: YELLOW }}
      >
        Pages
      </p>
      <h1 className="mt-2 text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
        Your website pages
      </h1>
      <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-neutral-600">
        Every page you can edit for the {session.brand.name} brand. Tap any
        page to open the visual editor, or create a new one.
      </p>

      <StudioPagesManager initialPages={pages} />
    </div>
  );
}
