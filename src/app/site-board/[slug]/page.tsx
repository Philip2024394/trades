// /site-board/[slug] — Site Board view page.
//
// Public boards are visible to everyone (share-friendly URLs).
// Private boards return 404 for anyone but the cookie owner.
// Every card carries the same image + watermark treatment as
// Site Interest so shared boards read as extensions of the
// platform, not a separate surface.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { boardBySlug } from "@/lib/siteBoards";
import { watermarkImageUrl } from "@/lib/imageWatermark";
import { BRAND } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await boardBySlug(slug);
  if (!result) return { title: `Site Board — ${BRAND.name}` };
  return {
    title: `${result.board.name} · Site Board | ${BRAND.name}`,
    description: result.board.description ?? `${result.board.itemCount} project ideas saved to Site Board — construction inspiration from ${BRAND.name}.`,
    openGraph: {
      type: "website",
      siteName: BRAND.name,
      title: `${result.board.name} · Site Board`,
      description: result.board.description ?? undefined,
      images: result.board.coverImageUrl ? [result.board.coverImageUrl] : undefined
    }
  };
}

export default async function SiteBoardPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await boardBySlug(slug);
  if (!result) notFound();
  const { board, items } = result;

  return (
    <main
      className="mx-auto min-h-screen max-w-6xl px-3 pb-16 pt-8 md:px-6 md:pt-12"
      style={{ backgroundColor: "#FBF6EC", color: "#1B1A17" }}
    >
      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
        Site Board
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-3">
        <h1
          className="text-[28px] font-black leading-tight text-neutral-900 md:text-[36px]"
          style={{ fontFamily: '"Playfair Display", Georgia, "Times New Roman", serif' }}
        >
          {board.name}
        </h1>
        <span className="text-[10.5px] font-black uppercase tracking-wider text-neutral-500">
          {board.itemCount} saved
        </span>
      </div>
      {board.description && (
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-neutral-700">{board.description}</p>
      )}

      {items.length === 0 ? (
        <div
          className="mt-8 rounded-2xl border-2 border-dashed p-8 text-center"
          style={{ borderColor: "rgba(139,69,19,0.20)" }}
        >
          <div className="text-[14px] font-black text-neutral-900">Nothing saved yet.</div>
          <p className="mx-auto mt-1.5 max-w-md text-[12.5px] leading-relaxed text-neutral-600">
            Browse{" "}
            <Link href="/trade-off/search" className="underline decoration-neutral-400 underline-offset-2 hover:decoration-neutral-900">
              Site Interest
            </Link>{" "}
            and tap the bookmark on any image to add it here.
          </p>
        </div>
      ) : (
        <div
          className="mt-6 [column-count:2] sm:[column-count:3] lg:[column-count:4]"
          style={{ columnGap: "12px" }}
        >
          {items.map((item) => (
            <figure
              key={item.id}
              className="mb-3 overflow-hidden rounded-2xl border bg-white shadow-sm"
              style={{ borderColor: "rgba(139,69,19,0.12)", breakInside: "avoid" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={watermarkImageUrl(item.imageUrl)}
                alt={item.subject ?? ""}
                loading="lazy"
                draggable={false}
                className="block h-auto w-full select-none"
                style={{ userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" }}
              />
              {item.subject && (
                <figcaption className="p-2.5">
                  <p className="line-clamp-2 text-[11.5px] leading-snug text-neutral-700">{item.subject}</p>
                  {item.note && (
                    <p className="mt-1 text-[10.5px] italic text-neutral-500">&ldquo;{item.note}&rdquo;</p>
                  )}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      )}

      <div className="mt-10 border-t pt-4 text-center text-[10.5px] text-neutral-500" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
        <Link href="/trade-off/search" className="hover:underline">Browse more Site Interest</Link>
        <span className="mx-2">·</span>
        <Link href="/legal/image-license" className="hover:underline">Image use terms</Link>
      </div>
    </main>
  );
}
