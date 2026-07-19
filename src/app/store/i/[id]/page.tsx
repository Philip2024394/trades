// /store/i/[id] — Site Interest image detail + buy.
//
// Large watermarked preview, subject/keywords, licence summary,
// checkout form (buyer email → Stripe session).

import Link from "next/link";
import { notFound } from "next/navigation";
import { storeImageById } from "@/lib/storeLibrary.server";
import { BuyImageForm } from "./BuyImageForm";
import { currentMemberEmail, isActiveMember } from "@/lib/storeMemberSession";
import { STORE_VARIANTS } from "@/lib/storeImageVariants";
import { PreviewViewer } from "./PreviewViewer";

export const dynamic = "force-dynamic";

export default async function ImageDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const img = await storeImageById(decodeURIComponent(id));
  if (!img) notFound();

  // Members bypass the buy panel entirely — see MemberDownloadPanel
  // component below (rendered when active).
  const memberEmail = await currentMemberEmail();
  const isMember    = memberEmail ? await isActiveMember(memberEmail) : false;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex items-center gap-2 text-[11px] text-neutral-500">
        <Link href="/store" className="hover:text-neutral-900">Site Interest</Link>
        <span>›</span>
        <Link href="/store/browse" className="hover:text-neutral-900">Browse</Link>
        <span>›</span>
        <span className="text-neutral-700">{img.id}</span>
      </div>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_360px]">
        {/* Interactive crop preview — buyer taps a preset to see the
            image at that crop + size before purchase. */}
        <div>
          <PreviewViewer imageUrl={img.url} subject={img.alt}/>
        </div>

        {/* Buy panel — swaps to member download panel when active. */}
        <aside>
          <div
            className="sticky top-20 space-y-4 rounded-2xl border p-5"
            style={{ borderColor: "rgba(0,0,0,0.08)" }}
          >
            {isMember ? (
              <>
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-green-600 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">
                    ✓ Unlimited member
                  </div>
                  <div className="mt-2 text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">
                    Download
                  </div>
                  <div className="mt-1 text-[16px] font-black text-neutral-900">
                    Free — included in your plan
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-[9px] font-black uppercase tracking-wider text-neutral-500">
                    Pick your crop — every variant included
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {STORE_VARIANTS.map((v) => (
                      <a
                        key={v.slug}
                        href={`/api/store/member-download?item=${encodeURIComponent(img.id)}&variant=${v.slug}`}
                        className="flex flex-col items-start gap-0 rounded-md border bg-white px-2.5 py-1.5 transition hover:bg-neutral-50"
                        style={{ borderColor: "rgba(0,0,0,0.15)" }}
                      >
                        <div className="flex items-baseline gap-1">
                          <span className="text-[10px] font-black text-neutral-900">{v.label}</span>
                          <span className="rounded px-1 py-px text-[8px] font-black uppercase tracking-wider" style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}>
                            {v.ratio}
                          </span>
                        </div>
                        <span className="text-[9px] font-bold text-neutral-500">{v.sub}</span>
                      </a>
                    ))}
                  </div>
                </div>
                <p className="text-center text-[10px] text-neutral-500">
                  Signed in as <span className="font-black">{memberEmail}</span>
                </p>
              </>
            ) : (
              <>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">
                    Single image
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <div className="text-[36px] font-black leading-none text-neutral-900">£10</div>
                    <div className="text-[11px] font-bold text-neutral-500">one-off · commercial licence</div>
                  </div>
                </div>
                <BuyImageForm imageId={img.id}/>
              </>
            )}

            <div className="space-y-1 text-[11px] leading-snug text-neutral-600">
              <div className="flex items-start gap-1.5">
                <span className="text-green-600">✓</span>
                <span>Full-resolution download (watermark-free)</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="text-green-600">✓</span>
                <span>4 ready-to-use crops (see below)</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="text-green-600">✓</span>
                <span>Commercial use — ads, print, web, social</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="text-green-600">✓</span>
                <span>Perpetual licence — no expiry</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="text-red-500">✗</span>
                <span>No resale, redistribution, or stock-site upload</span>
              </div>
            </div>

            {/* "What's included" strip removed — the main preview
                viewer above now shows all 4 crops interactively. */}

            <Link
              href="/legal/image-licence"
              className="block text-center text-[10px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900"
            >
              Full licence terms →
            </Link>

            {/* Volume nudge */}
            <div
              className="rounded-lg p-3 text-center text-[11px] text-neutral-700"
              style={{ backgroundColor: "#FFFBEB" }}
            >
              <div className="font-black">Buying multiple?</div>
              <div className="mt-0.5 text-neutral-600">
                Packs from £39 (£7.80/img). <Link href="/store#pricing" className="underline">See packs →</Link>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Meta below */}
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">Subject</div>
          <p className="mt-1 text-[14px] leading-snug text-neutral-800">{img.alt}</p>
        </div>
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">Tagged for</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {img.trade_slugs.map((k) => (
              <Link
                key={k}
                href={`/store/browse?q=${encodeURIComponent(k)}`}
                className="rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-neutral-700 hover:bg-neutral-50"
                style={{ borderColor: "rgba(0,0,0,0.10)" }}
              >
                {k}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
