"use client";

// CostDocumentThumbs — inline horizontal list of attached documents
// with hover-delete. Sits beneath a cost row in the ledger.
//
// PDFs / spreadsheets render as an icon + filename chip.
// Images render as a small thumbnail with the icon overlaid.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Image as ImageIcon, FileSpreadsheet, Trash2, X } from "lucide-react";
import type { CostDocument, CostDocumentKind } from "@/lib/homeowners/costDocuments";

const KIND_META: Record<CostDocumentKind, { icon: typeof FileText; label: string }> = {
  quote:       { icon: FileText,        label: "Quote"       },
  invoice:     { icon: FileText,        label: "Invoice"     },
  receipt:     { icon: FileText,        label: "Receipt"     },
  spreadsheet: { icon: FileSpreadsheet, label: "Spreadsheet" },
  photo:       { icon: ImageIcon,       label: "Photo"       },
  other:       { icon: FileText,        label: "File"        }
};

function isImageMime(m: string): boolean {
  return m.startsWith("image/");
}

function formatSize(bytes: number): string {
  if (bytes < 1024)          return `${bytes}B`;
  if (bytes < 1024 * 1024)   return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function CostDocumentThumbs({
  documents,
  demoMode = false
}: {
  documents: CostDocument[];
  demoMode?: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (documents.length === 0) return null;

  async function del(id: string) {
    if (demoMode) return;
    if (!confirm("Delete this document? This can't be undone.")) return;
    setBusyId(id);
    try {
      await fetch(`/api/homeowner/costs/documents/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {documents.map((d) => {
        const meta = KIND_META[d.kind] ?? KIND_META.other;
        const Icon = meta.icon;
        const showThumb = isImageMime(d.mime_type);
        const busy = busyId === d.id;
        return (
          <li key={d.id} className="group relative">
            <a
              href={d.storage_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border bg-white py-1.5 pl-1.5 pr-3 text-[11px] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              style={{ borderColor: "rgba(0,0,0,0.08)" }}
              title={`${d.file_name} · ${formatSize(d.size_bytes)}`}
            >
              {showThumb ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={d.storage_url}
                  alt=""
                  className="h-8 w-8 rounded object-cover"
                  loading="lazy"
                />
              ) : (
                <span className="inline-flex h-8 w-8 items-center justify-center rounded bg-neutral-100 text-neutral-700">
                  <Icon size={14} strokeWidth={2.2}/>
                </span>
              )}
              <span className="flex flex-col items-start leading-tight">
                <span className="max-w-[140px] truncate font-black text-neutral-900">{d.file_name}</span>
                <span className="text-[9.5px] font-black uppercase tracking-wider text-neutral-500">
                  {meta.label} · {formatSize(d.size_bytes)}
                </span>
              </span>
            </a>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); del(d.id); }}
              disabled={busy}
              className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-full border bg-white text-neutral-500 shadow-sm hover:text-red-800 group-hover:flex disabled:opacity-50"
              style={{ borderColor: "rgba(0,0,0,0.08)" }}
              aria-label="Delete document"
            >
              {busy ? <X size={11}/> : <Trash2 size={10} strokeWidth={2.5}/>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
