"use client";

import { useEffect, useState } from "react";
import { BUTTON_PRIMARY, INPUT_CLASS, fetchModule, saveModule } from "./_helpers";

type Manifest = {
  slug:                 string;
  name:                 string;
  category:             "trade" | "business" | "regulatory" | "product";
  version:              string;
  status:               "draft" | "author_review" | "advisory_panel" | "published" | "retired";
  primary_author_id:    string | null;
  primary_author_name:  string | null;
  primary_author_creds: string | null;
  supported_countries:  string[];
  supported_regions:    string[] | null;
  published_at:         string | null;
  last_reviewed_at:     string | null;
  v1_modules_present:   Array<"craft" | "regulations" | "materials" | "workflow" | "defects" | "pricing_model">;
};

function scaffoldManifestClient(slug: string, authorId: string): Manifest {
  return {
    slug,
    name: `${slug.charAt(0).toUpperCase()}${slug.slice(1)} Brain`,
    category: "trade",
    version: "0.1.0",
    status: "draft",
    primary_author_id: authorId,
    primary_author_name: "",
    primary_author_creds: "",
    supported_countries: ["UK"],
    supported_regions: null,
    published_at: null,
    last_reviewed_at: null,
    v1_modules_present: []
  };
}

export function ManifestEditor({ slug, authorId }: { slug: string; authorId: string }) {
  const [m, setM]         = useState<Manifest | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "error">("loading");
  const [msg, setMsg]     = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetchModule<Manifest | null>(slug, "manifest");
      if (!res.ok) { setStatus("error"); setMsg(res.error); return; }
      setM(res.payload ?? scaffoldManifestClient(slug, authorId));
      setStatus("ready");
    })();
  }, [slug, authorId]);

  async function save() {
    if (!m) return;
    setStatus("saving");
    const res = await saveModule<Manifest>(slug, "manifest", m, m.version);
    if (!res.ok) { setStatus("error"); setMsg(res.error); return; }
    setStatus("ready"); setMsg("Saved.");
  }

  if (status === "loading") return <p className="text-sm text-[#0A0A0A]/60">Loading manifest...</p>;
  if (!m) return <p className="text-sm text-red-700">{msg ?? "Failed to load"}</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold">Manifest</h2>
      <p className="text-xs text-[#0A0A0A]/60">
        Public metadata for this Brain. Your name and credentials appear on every merchant-facing surface.
      </p>

      <label className="block">
        <span className="text-xs font-medium">Brain display name</span>
        <input className={INPUT_CLASS} value={m.name} onChange={(e) => setM({ ...m, name: e.target.value })} />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-medium">Version</span>
          <input className={INPUT_CLASS} value={m.version} onChange={(e) => setM({ ...m, version: e.target.value })} />
        </label>
        <label className="block">
          <span className="text-xs font-medium">Category</span>
          <select className={INPUT_CLASS} value={m.category} onChange={(e) => setM({ ...m, category: e.target.value as Manifest["category"] })}>
            <option value="trade">Trade</option>
            <option value="business">Business</option>
            <option value="regulatory">Regulatory</option>
            <option value="product">Product</option>
          </select>
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-medium">Author display name</span>
        <input className={INPUT_CLASS} value={m.primary_author_name ?? ""} onChange={(e) => setM({ ...m, primary_author_name: e.target.value })} placeholder="e.g. John Smith" />
      </label>

      <label className="block">
        <span className="text-xs font-medium">Author credentials (shown on Brain surface)</span>
        <input className={INPUT_CLASS} value={m.primary_author_creds ?? ""} onChange={(e) => setM({ ...m, primary_author_creds: e.target.value })} placeholder="e.g. BWF Stair Scheme member · 22 years" />
      </label>

      <label className="block">
        <span className="text-xs font-medium">Supported countries (comma-separated ISO codes)</span>
        <input className={INPUT_CLASS} value={m.supported_countries.join(", ")} onChange={(e) => setM({ ...m, supported_countries: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
      </label>

      <div className="flex items-center gap-2 pt-2">
        <button className={BUTTON_PRIMARY} onClick={save} disabled={status === "saving"}>
          {status === "saving" ? "Saving..." : "Save"}
        </button>
        {msg && <span className="text-xs text-[#0A0A0A]/70">{msg}</span>}
      </div>
    </div>
  );
}
