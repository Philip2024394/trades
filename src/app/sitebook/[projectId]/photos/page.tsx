// /sitebook/[projectId]/photos — photo gallery.

import { notFound } from "next/navigation";
import Link from "next/link";
import { getHomeownerFromCookie } from "@/lib/homeowners/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { SiteBookPhoto, SiteBookProject, PhotoStage } from "@/lib/homeowners/types";
import { PhotoUploader } from "./PhotoUploader";

export const dynamic = "force-dynamic";

export default async function PhotosPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const homeowner = (await getHomeownerFromCookie())!;

  const [projRes, photosRes] = await Promise.all([
    supabaseAdmin.from("hammerex_sitebook_projects").select("*").eq("id", projectId).eq("homeowner_id", homeowner.id).maybeSingle(),
    supabaseAdmin.from("hammerex_sitebook_photos").select("*").eq("project_id", projectId).order("created_at", { ascending: false })
  ]);
  if (projRes.error || !projRes.data) notFound();
  const project = projRes.data as SiteBookProject;
  const photos  = (photosRes.data as SiteBookPhoto[]) ?? [];

  const before      = photos.filter((p) => p.stage === "before");
  const inProgress  = photos.filter((p) => p.stage === "in-progress");
  const after       = photos.filter((p) => p.stage === "after");
  const untagged    = photos.filter((p) => !p.stage);

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Link href={`/sitebook/${projectId}`} className="text-[12px] font-bold text-neutral-600 hover:text-neutral-900">← {project.title}</Link>
      <h1 className="mt-3 text-2xl font-black text-neutral-900">Photos ({photos.length})</h1>
      <p className="mt-1 text-[13px] text-neutral-600">Every photo saved forever. Group by stage — before / in progress / after.</p>

      <div className="mt-6 rounded-2xl border-2 bg-white p-5" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
        <p className="text-[10.5px] font-black uppercase tracking-wider text-neutral-500">Upload photo</p>
        <p className="mt-1 text-[11.5px] text-neutral-500">JPG, PNG, WebP, HEIC. Up to 15 MB.</p>
        <PhotoUploader projectId={projectId}/>
      </div>

      {photos.length === 0 ? (
        <p className="mt-8 rounded-2xl border-2 border-dashed bg-white p-8 text-center text-[13px] text-neutral-500">No photos yet. Upload before shots to remember what the space looked like.</p>
      ) : (
        <div className="mt-8 space-y-8">
          <PhotoStageBlock title="Before" photos={before}/>
          <PhotoStageBlock title="In progress" photos={inProgress}/>
          <PhotoStageBlock title="After" photos={after}/>
          {untagged.length > 0 && <PhotoStageBlock title="Other" photos={untagged}/>}
        </div>
      )}
    </section>
  );
}

function PhotoStageBlock({ title, photos }: { title: string; photos: SiteBookPhoto[] }) {
  if (photos.length === 0) return null;
  return (
    <div>
      <h2 className="text-[10.5px] font-black uppercase tracking-[0.22em] text-neutral-500">{title} ({photos.length})</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {photos.map((p) => (
          <figure key={p.id} className="rounded-xl border-2 bg-white p-2" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.storage_url} alt={p.caption || ""} className="aspect-square w-full rounded object-cover"/>
            <figcaption className="mt-2 text-[10.5px] text-neutral-600">
              <span className="font-black text-neutral-900">{p.uploaded_by_name || "Homeowner"}</span>
              {p.caption && <span> — {p.caption}</span>}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
