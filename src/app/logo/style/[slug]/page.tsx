// /logo/style/[slug] — dedicated per-style browse page.
//
// Lands here when a user picks a style from the modal (or clicks
// through from the landing page's styles strip). Shows every sample
// for that style with:
//   • Search bar (matches trade/supply label or slug)
//   • Trade/supply dropdown filter
//   • Grid of samples, tap any to head to the name step with that
//     sample pre-selected.

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { styleBySlug } from "@/lib/logo/catalog";
import { StyleBrowser } from "./StyleBrowser";

export const dynamic = "force-static";

export function generateMetadata({ params }: { params: { slug: string } }) {
  const style = styleBySlug(params.slug);
  return {
    title:       style ? `${style.name} logos — The Networkers` : "Logo style — The Networkers",
    description: style?.description
  };
}

export default async function LogoStylePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const style    = styleBySlug(slug);
  if (!style) notFound();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <Link href="/logo/build" className="mb-6 inline-flex items-center gap-1.5 text-[12px] font-black text-neutral-600 hover:text-neutral-900">
        <ArrowLeft size={13}/> Back to styles
      </Link>

      <div className="mb-8">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">Style</p>
        <h1 className="mt-1 text-3xl font-black sm:text-4xl">{style.name}</h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-neutral-700">{style.description}</p>
      </div>

      <StyleBrowser style={style}/>
    </div>
  );
}
