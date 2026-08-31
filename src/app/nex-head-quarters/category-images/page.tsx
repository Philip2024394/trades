// NEX HQ · Category Image Library · Philip 2026-08-27 (E).
//
// /nex-head-quarters/category-images
//
// Where Philip registers curated fallback images per category. Reads live from
// nex.category_image_library · uses Server Actions from
// src/lib/nex-hq/category-image-library.ts.
//
// Doctrine (Philip): "beautiful and visually consistent with the NEX
// directory, rather than random stock-looking pictures." This page shows a
// visual grid per category so quality can be judged at a glance.

import { loadLibrary, addImage, toggleActive, deleteImage } from "@/lib/nex-hq/category-image-library";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "NEX HQ · Category Images", robots: { index: false } };

const KNOWN_SERVICE_SLUGS = [
  "gyms", "salons", "dentists", "opticians", "pharmacies", "car-repair",
];
const LEGACY_SLUGS = ["food", "accommodation"];
const KNOWN_CATEGORIES = [...KNOWN_SERVICE_SLUGS, ...LEGACY_SLUGS, "*"];

// Server Action form handler · uses FormData to keep the page zero-JS.
async function submitAddImage(formData: FormData) {
  "use server";
  const category_slug   = String(formData.get("category_slug") ?? "").trim();
  const variant_tag_raw = String(formData.get("variant_tag") ?? "").trim();
  const url             = String(formData.get("url") ?? "").trim();
  const attribution     = String(formData.get("attribution") ?? "").trim() || null;
  const licence         = String(formData.get("licence") ?? "").trim() || null;
  const notes           = String(formData.get("notes") ?? "").trim() || null;
  const priorityRaw     = String(formData.get("priority") ?? "100");
  const priority        = Number.parseInt(priorityRaw, 10) || 100;
  await addImage({
    category_slug,
    variant_tag: variant_tag_raw || null,
    url,
    attribution,
    licence,
    priority,
    notes,
  });
}

async function submitToggle(formData: FormData) {
  "use server";
  const id     = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  await toggleActive(id, active);
}

async function submitDelete(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  await deleteImage(id);
}

export default async function CategoryImagesPage() {
  const rows = await loadLibrary();

  // Group by category for the visual grid.
  const byCategory = new Map<string, typeof rows>();
  for (const r of rows) {
    if (!byCategory.has(r.category_slug)) byCategory.set(r.category_slug, []);
    byCategory.get(r.category_slug)!.push(r);
  }

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, sans-serif", background: "var(--nex-cream-50, #faf8f3)", minHeight: "100vh" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, letterSpacing: 1.2, color: "var(--nex-stone-500, #78716c)", textTransform: "uppercase" }}>
          NEX HQ · Category Image Library
        </div>
        <h1 style={{ fontSize: 28, margin: "4px 0 4px 0", color: "var(--nex-ink-900, #1c1917)" }}>
          Category Fallback Images
        </h1>
        <div style={{ fontSize: 13, color: "var(--nex-stone-600, #57534e)", maxWidth: 820 }}>
          Curated fallback images used when a business has no OWNER_IMAGE and no VERIFIED_REAL.
          Resolver order: <b>OWNER_IMAGE → VERIFIED_REAL → CATEGORY_FALLBACK</b>. Use variant
          tags (e.g. <code>mens-barber</code>, <code>modern-gym</code>) for finer selection.
          Category <code>*</code> is a whole-directory last-resort fallback.
        </div>
      </div>

      {/* Add form */}
      <section style={{ background: "#fff", border: "1px solid var(--nex-stone-200, #e7e5e4)", borderRadius: 8, padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--nex-stone-600, #57534e)", marginBottom: 10 }}>
          Add curated image
        </div>
        <form action={submitAddImage} style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          <label style={labelStyle}>
            Category
            <select name="category_slug" required style={inputStyle} defaultValue="">
              <option value="" disabled>choose…</option>
              {KNOWN_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label style={labelStyle}>
            Variant tag (optional)
            <input name="variant_tag" placeholder="e.g. mens-barber" style={inputStyle} />
          </label>
          <label style={{ ...labelStyle, gridColumn: "span 2" }}>
            Image URL
            <input name="url" required type="url" placeholder="https://cdn.example.com/..." style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Attribution (optional)
            <input name="attribution" placeholder="e.g. NEX in-house" style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Licence (optional)
            <input name="licence" placeholder="e.g. in-house, CC0" style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Priority (lower = preferred)
            <input name="priority" type="number" defaultValue="100" style={inputStyle} />
          </label>
          <label style={{ ...labelStyle, gridColumn: "span 4" }}>
            Notes (optional)
            <input name="notes" placeholder="anything worth remembering" style={inputStyle} />
          </label>
          <div style={{ gridColumn: "span 4", display: "flex", justifyContent: "flex-end" }}>
            <button type="submit" style={buttonStyle}>Add to library</button>
          </div>
        </form>
      </section>

      {/* Per-category grids */}
      {[...byCategory.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([category, group]) => (
        <section key={category} style={{ background: "#fff", border: "1px solid var(--nex-stone-200, #e7e5e4)", borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--nex-ink-900, #1c1917)", marginBottom: 10 }}>
            {category === "*" ? "Generic (whole-directory fallback)" : category}{" "}
            <span style={{ fontSize: 11, color: "var(--nex-stone-500, #78716c)", fontWeight: 400 }}>
              · {group.length} image{group.length === 1 ? "" : "s"}
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
            {group.map((r) => (
              <div key={r.id} style={{ border: "1px solid var(--nex-stone-200, #e7e5e4)", borderRadius: 6, overflow: "hidden", opacity: r.active ? 1 : 0.5 }}>
                <div style={{ position: "relative", aspectRatio: "16/9", background: "var(--nex-stone-100, #f5f5f4)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.url} alt={r.variant_tag ?? r.category_slug}
                       style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                <div style={{ padding: "8px 10px", fontSize: 11 }}>
                  <div style={{ fontWeight: 600, color: "var(--nex-ink-900, #1c1917)" }}>
                    {r.variant_tag ?? <span style={{ color: "var(--nex-stone-500, #78716c)" }}>no variant</span>}
                  </div>
                  <div style={{ color: "var(--nex-stone-500, #78716c)" }}>
                    priority {r.priority} · {r.active ? "active" : "inactive"}
                  </div>
                  {r.attribution && (
                    <div style={{ color: "var(--nex-stone-500, #78716c)", marginTop: 3 }}>{r.attribution}</div>
                  )}
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    <form action={submitToggle}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="active" value={String(!r.active)} />
                      <button type="submit" style={smallButtonStyle}>{r.active ? "Deactivate" : "Activate"}</button>
                    </form>
                    <form action={submitDelete}>
                      <input type="hidden" name="id" value={r.id} />
                      <button type="submit" style={{ ...smallButtonStyle, background: "#fee2e2", color: "#991b1b" }}>Delete</button>
                    </form>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {rows.length === 0 && (
        <div style={{ background: "#fff", border: "1px dashed var(--nex-stone-300, #d6d3d1)", borderRadius: 8, padding: 24, textAlign: "center", color: "var(--nex-stone-500, #78716c)" }}>
          Library is empty. Add your first curated image above. Resolver returns null for any category
          until at least one active row exists.
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: 4,
  fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5,
  color: "var(--nex-stone-600, #57534e)", fontWeight: 600,
};
const inputStyle: React.CSSProperties = {
  padding: "8px 10px", fontSize: 13,
  border: "1px solid var(--nex-stone-300, #d6d3d1)", borderRadius: 4,
  fontFamily: "inherit",
};
const buttonStyle: React.CSSProperties = {
  padding: "8px 16px", fontSize: 13, fontWeight: 600,
  background: "#F97316", color: "#0a0a0a",
  border: "none", borderRadius: 4, cursor: "pointer",
};
const smallButtonStyle: React.CSSProperties = {
  padding: "4px 8px", fontSize: 10, fontWeight: 600,
  background: "var(--nex-stone-100, #f5f5f4)", color: "var(--nex-ink-800, #292524)",
  border: "1px solid var(--nex-stone-300, #d6d3d1)", borderRadius: 3, cursor: "pointer",
};
