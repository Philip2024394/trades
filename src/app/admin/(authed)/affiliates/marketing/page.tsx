// Admin — affiliate marketing-pack assets.
//
// Upload form on top, table below. Uploads land in the
// `product-images` bucket under `marketing-pack/<kind>/<uuid>.<ext>`
// (see /api/admin/affiliates/marketing). The table is rendered server-
// side with a single Supabase query; row actions (delete, toggle
// featured) are wired through the client island MarketingRowActions.
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { MarketingUploadForm } from "./MarketingUploadForm";
import { MarketingRowActions } from "./MarketingRowActions";

export const dynamic = "force-dynamic";

type Asset = {
  id: string;
  kind: string;
  title: string;
  description: string | null;
  file_url: string;
  thumbnail_url: string | null;
  file_size_bytes: number | null;
  featured: boolean;
  created_at: string;
};

function fmtBytes(b: number | null): string {
  if (!b) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB");
  } catch {
    return iso;
  }
}

export default async function AdminMarketingPage() {
  const { data } = await supabaseAdmin
    .from("hammerex_affiliate_marketing_assets")
    .select("*")
    .order("created_at", { ascending: false });
  const assets = (data ?? []) as Asset[];

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[13px] text-brand-muted">
            <Link href="/admin/affiliates" className="hover:underline">
              &larr; Affiliates
            </Link>
          </p>
          <h1 className="text-2xl font-extrabold">Marketing pack</h1>
          <p className="mt-1 text-[13px] text-brand-muted">
            {assets.length} assets available to affiliates. Featured assets
            appear first in the affiliate dashboard.
          </p>
        </div>
      </header>

      <section className="rounded-xl border border-brand-line bg-brand-surface p-5">
        <h2 className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-brand-accent">
          Upload new asset
        </h2>
        <div className="mt-4">
          <MarketingUploadForm />
        </div>
      </section>

      <section className="overflow-x-auto rounded-xl border border-brand-line bg-brand-surface">
        <table className="min-w-full text-[13px]">
          <thead className="bg-brand-bg/40 text-left text-[13px] uppercase tracking-wider text-brand-muted">
            <tr>
              <th className="px-3 py-2">Preview</th>
              <th className="px-3 py-2">Kind</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Size</th>
              <th className="px-3 py-2">Featured</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a) => (
              <tr key={a.id} className="border-t border-brand-line align-top">
                <td className="px-3 py-2">
                  {a.kind === "video" ? (
                    <video
                      src={a.file_url}
                      className="block h-14 w-20 rounded border border-brand-line bg-black object-cover"
                      muted
                    />
                  ) : a.kind === "pdf" ? (
                    <a
                      href={a.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-14 w-20 items-center justify-center rounded border border-brand-line bg-brand-bg text-[13px] font-bold text-brand-accent"
                    >
                      PDF
                    </a>
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={a.file_url}
                      alt={a.title}
                      className="block h-14 w-20 rounded border border-brand-line bg-black object-contain"
                    />
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-[13px] uppercase">
                  {a.kind}
                </td>
                <td className="px-3 py-2">
                  <div className="font-bold text-brand-text">{a.title}</div>
                  {a.description && (
                    <div className="text-[13px] text-brand-muted">
                      {a.description}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-brand-muted">
                  {fmtBytes(a.file_size_bytes)}
                </td>
                <td className="px-3 py-2">
                  {a.featured ? (
                    <span className="rounded bg-brand-accent px-2 py-0.5 text-[13px] font-bold text-black">
                      Yes
                    </span>
                  ) : (
                    <span className="text-brand-muted">No</span>
                  )}
                </td>
                <td className="px-3 py-2 text-brand-muted">
                  {fmt(a.created_at)}
                </td>
                <td className="px-3 py-2">
                  <MarketingRowActions
                    id={a.id}
                    featured={a.featured}
                    fileUrl={a.file_url}
                  />
                </td>
              </tr>
            ))}
            {assets.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-6 text-center text-brand-muted"
                >
                  No marketing assets uploaded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
