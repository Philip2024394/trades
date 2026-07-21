// /admin/site-editor/templates — server component listing every
// editor template with row actions (Edit / Toggle active / Delete)
// and a "New template" button that deep-links to the editor with
// ?admin_template=new so the editor knows to render the Save-as-
// template panel.
//
// Data comes from supabaseAdmin (service role) via the same
// hammerex_site_editor_templates table the public
// /api/site/editor/templates endpoint reads (but this page returns
// EVERYTHING including inactive drafts).

import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { AdminTemplateRowActions } from "./AdminTemplateRowActions";

export const dynamic = "force-dynamic";

type TemplateRow = {
  id:            string;
  slug:          string;
  label:         string;
  category:      string;
  frame_slug:    string;
  thumbnail_url: string | null;
  min_tier:      string | null;
  active:        boolean;
  display_order: number;
  updated_at:    string;
};

async function loadTemplates(): Promise<TemplateRow[]> {
  const res = await supabaseAdmin
    .from("hammerex_site_editor_templates")
    .select("id, slug, label, category, frame_slug, thumbnail_url, min_tier, active, display_order, updated_at")
    .order("display_order", { ascending: true })
    .order("updated_at", { ascending: false });
  if (res.error) {
    console.error("[admin/site-editor/templates] load failed:", res.error);
    return [];
  }
  return (res.data ?? []) as TemplateRow[];
}

export default async function AdminTemplatesPage() {
  const templates = await loadTemplates();
  const activeCount   = templates.filter((t) => t.active).length;
  const inactiveCount = templates.length - activeCount;

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-neutral-900">Editor templates</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {templates.length} total · {activeCount} live · {inactiveCount} draft
          </p>
        </div>
        <Link
          href="/site/editor?admin_template=new"
          className="inline-flex h-10 items-center gap-2 rounded-md bg-black px-4 text-[11px] font-black uppercase tracking-wider text-yellow-400 hover:brightness-110"
        >
          + New template
        </Link>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 p-12 text-center text-sm text-neutral-500">
          No templates yet. Tap <strong>New template</strong> to author your first offer / promo / testimonial.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-left text-[12px]">
            <thead className="bg-neutral-50 text-[10px] font-black uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-3 py-2">Preview</th>
                <th className="px-3 py-2">Label</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Frame</th>
                <th className="px-3 py-2">Tier gate</th>
                <th className="px-3 py-2">Order</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                  <td className="px-3 py-2">
                    {t.thumbnail_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={t.thumbnail_url} alt={t.label} className="h-12 w-12 rounded-md object-cover"/>
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-neutral-100 text-[9px] font-black uppercase text-neutral-400">
                        No pic
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-black text-neutral-900">{t.label}</div>
                    <div className="text-[10px] text-neutral-400">{t.slug}</div>
                  </td>
                  <td className="px-3 py-2 text-neutral-700">{t.category}</td>
                  <td className="px-3 py-2 text-neutral-700">{t.frame_slug}</td>
                  <td className="px-3 py-2 text-neutral-700">{t.min_tier ?? "free"}</td>
                  <td className="px-3 py-2 text-neutral-700">{t.display_order}</td>
                  <td className="px-3 py-2">
                    <span
                      className="inline-flex h-6 items-center rounded-full px-2 text-[9px] font-black uppercase tracking-wider"
                      style={{
                        backgroundColor: t.active ? "#166534" : "#9ca3af",
                        color:           "white"
                      }}
                    >
                      {t.active ? "Live" : "Draft"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <AdminTemplateRowActions
                      id={t.id}
                      slug={t.slug}
                      active={t.active}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
