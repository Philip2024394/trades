// /admin/hero-library/[id] — edit an existing hero image.

import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { HeroEditForm } from "../HeroEditForm";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditHeroImagePage({ params }: PageProps) {
  const { id } = await params;
  const { data, error } = await supabaseAdmin
    .from("hero_library")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[admin/hero-library/edit] load failed:", error);
    return (
      <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="rounded-md bg-red-50 px-3 py-2 text-[13px] text-red-800">
          Load failed: {error.message}
        </div>
      </div>
    );
  }
  if (!data) return notFound();

  return <HeroEditForm mode="edit" initial={data} existingId={id} />;
}
