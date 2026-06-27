"use client";

// FaqPageEditor — FAQ CRUD for the FAQ Page add-on.
//
// Per-FAQ form lets the tradesperson set:
//   - Category (general / pricing / process / materials / trust /
//     warranty / aftercare)
//   - Ref code (auto-generated FAQ-001 / FAQ-002 … on first save; the
//     field is editable but must match ^FAQ-[0-9]{3,4}$ and be unique
//     per listing)
//   - Question (5-200 chars, live counter)
//   - Answer  (5-2000 chars, live counter)
//   - Up to 3 images, each with a title (1-80 chars). Images upload via
//     the shared /api/trade-off/upload-photo route, then the metadata
//     row is persisted via /api/trade-off/faq-images/upsert.
//   - Privacy disclaimer ack required before save.
//
// Drag-reorder uses dnd-kit with a 250 ms touch activation delay
// matching DownloadsEditor.

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  HammerexXratedFaqItem,
  HammerexXratedFaqImage
} from "@/lib/supabase";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type FaqWithImages = HammerexXratedFaqItem & { images: HammerexXratedFaqImage[] };

const CATEGORIES: HammerexXratedFaqItem["category"][] = [
  "general",
  "pricing",
  "process",
  "materials",
  "trust",
  "warranty",
  "aftercare"
];

const CATEGORY_LABEL: Record<HammerexXratedFaqItem["category"], string> = {
  general: "General",
  pricing: "Pricing",
  process: "Process",
  materials: "Materials",
  trust: "Trust",
  warranty: "Warranty",
  aftercare: "Aftercare"
};

const REF_RE = /^FAQ-[0-9]{3,4}$/;
const MAX_LIVE = 50;
const WARN_AT = 45;
const MAX_IMAGES = 3;
const Q_MIN = 5;
const Q_MAX = 200;
const A_MIN = 5;
const A_MAX = 2000;
const TITLE_MAX = 80;

type DraftForm = {
  id: string | null;
  ref_code: string;
  question: string;
  answer: string;
  category: HammerexXratedFaqItem["category"];
  status: "live" | "archived";
};

function emptyDraft(suggestedRef: string): DraftForm {
  return {
    id: null,
    ref_code: suggestedRef,
    question: "",
    answer: "",
    category: "general",
    status: "live"
  };
}

function rowToDraft(f: HammerexXratedFaqItem): DraftForm {
  return {
    id: f.id,
    ref_code: f.ref_code,
    question: f.question,
    answer: f.answer,
    category: f.category,
    status: f.status
  };
}

function useDragSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
}

/** Find the next free FAQ-NNN slot inside the live set. */
function suggestNextRef(faqs: FaqWithImages[]): string {
  const used = new Set(faqs.map((f) => f.ref_code));
  for (let i = 1; i <= 9999; i++) {
    const candidate = `FAQ-${String(i).padStart(3, "0")}`;
    if (!used.has(candidate)) return candidate;
  }
  return "FAQ-001";
}

export function FaqPageEditor({
  slug,
  editToken,
  initialFaqs
}: {
  slug: string;
  editToken: string;
  initialFaqs: FaqWithImages[];
}) {
  const [faqs, setFaqs] = useState<FaqWithImages[]>(initialFaqs);
  const [draft, setDraft] = useState<DraftForm | null>(null);
  const [privacyAck, setPrivacyAck] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | "new" | null>(null);

  const liveCount = faqs.filter((f) => f.status === "live").length;
  const atCap = liveCount >= MAX_LIVE;
  const nearCap = liveCount >= WARN_AT && liveCount < MAX_LIVE;

  function openNew() {
    if (atCap) {
      setErr(`Cap reached — ${MAX_LIVE} live FAQs. Archive one first.`);
      return;
    }
    setErr(null);
    setMsg(null);
    setPrivacyAck(false);
    setDraft(emptyDraft(suggestNextRef(faqs)));
  }

  function openEdit(f: FaqWithImages) {
    setErr(null);
    setMsg(null);
    setPrivacyAck(true); // existing rows already passed the gate.
    setDraft(rowToDraft(f));
  }

  function closeDraft() {
    setDraft(null);
    setPrivacyAck(false);
  }

  function updateDraft(patch: Partial<DraftForm>) {
    setDraft((d) => (d ? { ...d, ...patch } : d));
  }

  async function save() {
    if (!draft) return;
    const q = draft.question.trim();
    const a = draft.answer.trim();
    if (q.length < Q_MIN || q.length > Q_MAX) {
      setErr(`Question must be ${Q_MIN}-${Q_MAX} characters.`);
      return;
    }
    if (a.length < A_MIN || a.length > A_MAX) {
      setErr(`Answer must be ${A_MIN}-${A_MAX} characters.`);
      return;
    }
    const ref = draft.ref_code.trim().toUpperCase();
    if (ref && !REF_RE.test(ref)) {
      setErr("Ref code must look like FAQ-001 (3 or 4 digits).");
      return;
    }
    if (!privacyAck) {
      setErr("Tick the privacy box to confirm no customer data is visible.");
      return;
    }
    setErr(null);
    setMsg(null);
    setSavingId(draft.id ?? "new");
    try {
      const res = await fetch("/api/trade-off/faq-items/upsert", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          edit_token: editToken,
          faq: {
            id: draft.id ?? undefined,
            ref_code: ref || undefined,
            question: q,
            answer: a,
            category: draft.category,
            status: draft.status,
            sort_order: faqs.length * 10
          }
        })
      });
      const json = await res.json();
      if (!json.ok || !json.faq) {
        setErr(json.error ?? "Save failed.");
        return;
      }
      const saved = json.faq as HammerexXratedFaqItem;
      setFaqs((prev) => {
        const existing = prev.find((f) => f.id === saved.id);
        if (existing) {
          return prev.map((f) => (f.id === saved.id ? { ...saved, images: existing.images } : f));
        }
        return [...prev, { ...saved, images: [] }];
      });
      setMsg(draft.id ? "FAQ updated." : `FAQ saved as ${saved.ref_code}.`);
      // Keep the drawer open after first save so the tradesperson can
      // immediately attach images to the row they just created.
      setDraft(rowToDraft(saved));
    } catch {
      setErr("Network error — try again.");
    } finally {
      setSavingId(null);
    }
  }

  async function archive(f: FaqWithImages) {
    if (!confirm(`Archive ${f.ref_code}? Customers won't see it any more.`)) return;
    setErr(null);
    try {
      const res = await fetch("/api/trade-off/faq-items/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, edit_token: editToken, faq_id: f.id })
      });
      const json = await res.json();
      if (!json.ok) {
        setErr(json.error ?? "Archive failed.");
        return;
      }
      setFaqs((prev) =>
        prev.map((x) => (x.id === f.id ? { ...x, status: "archived" } : x))
      );
    } catch {
      setErr("Network error — try again.");
    }
  }

  // Reorder — local-first, debounced POST.
  const reorderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (reorderTimeoutRef.current) clearTimeout(reorderTimeoutRef.current);
    };
  }, []);

  function applyReorder(next: FaqWithImages[], snapshot: FaqWithImages[]) {
    setFaqs(next);
    if (reorderTimeoutRef.current) clearTimeout(reorderTimeoutRef.current);
    reorderTimeoutRef.current = setTimeout(async () => {
      const ordering = next.map((f, idx) => ({
        id: f.id,
        sort_order: (idx + 1) * 10
      }));
      try {
        const res = await fetch("/api/trade-off/faq-items/reorder", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ slug, edit_token: editToken, ordering })
        });
        const json = await res.json();
        if (!json.ok) {
          setFaqs(snapshot);
          setErr(json.error ?? "Reorder failed — restored previous order.");
        }
      } catch {
        setFaqs(snapshot);
        setErr("Network error — restored previous order.");
      }
    }, 500);
  }

  function updateImagesForFaq(faqId: string, next: HammerexXratedFaqImage[]) {
    setFaqs((prev) => prev.map((f) => (f.id === faqId ? { ...f, images: next } : f)));
  }

  const draftFaq = draft && draft.id ? faqs.find((f) => f.id === draft.id) ?? null : null;

  return (
    <div className="space-y-4 rounded-xl border border-brand-line bg-brand-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold">Your FAQs</h2>
          <p className="mt-1 text-[13px] text-brand-muted">
            {liveCount} live &middot; {faqs.length - liveCount} archived &middot; cap {MAX_LIVE}
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          disabled={atCap}
          className="inline-flex h-11 items-center rounded-lg bg-brand-accent px-4 text-xs font-bold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          + Add FAQ
        </button>
      </div>

      {nearCap && (
        <p className="rounded-lg border border-brand-accent/40 bg-brand-accent/10 px-3 py-2 text-[13px] font-semibold text-brand-accent">
          You&rsquo;re close to the {MAX_LIVE}-FAQ cap ({liveCount}/{MAX_LIVE}).
          Archive older entries to make room.
        </p>
      )}
      {atCap && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-[13px] font-semibold text-red-300">
          Cap reached ({MAX_LIVE}/{MAX_LIVE}). Archive a FAQ before adding more.
        </p>
      )}

      {err && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300">
          {err}
        </p>
      )}
      {msg && (
        <p className="rounded-lg border border-brand-accent/40 bg-brand-accent/10 px-3 py-2 text-xs font-semibold text-brand-accent">
          {msg}
        </p>
      )}

      <FaqList
        faqs={faqs}
        onEdit={openEdit}
        onArchive={archive}
        onReorder={applyReorder}
      />

      {draft && (
        <FaqDrawer
          slug={slug}
          editToken={editToken}
          draft={draft}
          existingImages={draftFaq?.images ?? []}
          privacyAck={privacyAck}
          setPrivacyAck={setPrivacyAck}
          update={updateDraft}
          busy={savingId === (draft.id ?? "new")}
          onCancel={closeDraft}
          onSave={save}
          onImagesChange={(imgs) => {
            if (draftFaq) updateImagesForFaq(draftFaq.id, imgs);
          }}
        />
      )}
    </div>
  );
}

function FaqList({
  faqs,
  onEdit,
  onArchive,
  onReorder
}: {
  faqs: FaqWithImages[];
  onEdit: (f: FaqWithImages) => void;
  onArchive: (f: FaqWithImages) => void;
  onReorder: (next: FaqWithImages[], snapshot: FaqWithImages[]) => void;
}) {
  const sensors = useDragSensors();

  if (faqs.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-brand-line bg-brand-bg px-4 py-6 text-center text-[13px] text-brand-muted">
        No FAQs yet. Tap &ldquo;+ Add FAQ&rdquo; to write your first one.
      </p>
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = faqs.findIndex((f) => f.id === active.id);
    const newIndex = faqs.findIndex((f) => f.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(faqs, oldIndex, newIndex), faqs);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={faqs.map((f) => f.id)} strategy={verticalListSortingStrategy}>
        <ul className="space-y-2">
          {faqs.map((f) => (
            <SortableFaqRow key={f.id} faq={f} onEdit={onEdit} onArchive={onArchive} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableFaqRow({
  faq,
  onEdit,
  onArchive
}: {
  faq: FaqWithImages;
  onEdit: (f: FaqWithImages) => void;
  onArchive: (f: FaqWithImages) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: faq.id
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex flex-wrap items-center gap-3 rounded-lg border border-brand-line bg-brand-bg p-3"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="inline-flex h-11 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-md border border-brand-line bg-brand-surface text-brand-muted transition hover:border-brand-accent hover:text-brand-accent active:cursor-grabbing"
      >
        <DragHandleIcon />
      </button>
      <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-md border border-brand-line bg-brand-surface text-[10px] font-extrabold uppercase tracking-widest text-brand-accent">
        {faq.ref_code}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-bold text-brand-text">{faq.question}</p>
        <p className="text-[13px] text-brand-muted">
          {CATEGORY_LABEL[faq.category]} &middot; {faq.images.length} image
          {faq.images.length === 1 ? "" : "s"} &middot; {faq.view_count} view
          {faq.view_count === 1 ? "" : "s"}
        </p>
      </div>
      <span
        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
          faq.status === "live"
            ? "border-brand-accent/60 bg-brand-accent/10 text-brand-accent"
            : "border-brand-line bg-brand-surface text-brand-muted"
        }`}
      >
        {faq.status}
      </span>
      <div className="flex w-full gap-2 sm:w-auto">
        <button
          type="button"
          onClick={() => onEdit(faq)}
          className="inline-flex h-11 flex-1 items-center justify-center rounded-lg border border-brand-line bg-brand-surface px-3 text-xs font-bold text-brand-text transition hover:border-brand-accent hover:text-brand-accent sm:flex-none"
        >
          Edit
        </button>
        {faq.status === "live" && (
          <button
            type="button"
            onClick={() => onArchive(faq)}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-lg border border-red-500/40 bg-red-500/5 px-3 text-xs font-bold text-red-300 transition hover:bg-red-500/15 sm:flex-none"
          >
            Archive
          </button>
        )}
      </div>
    </li>
  );
}

function DragHandleIcon() {
  return (
    <svg
      width="14"
      height="20"
      viewBox="0 0 8 14"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="1.5" cy="2" r="1.2" />
      <circle cx="6.5" cy="2" r="1.2" />
      <circle cx="1.5" cy="7" r="1.2" />
      <circle cx="6.5" cy="7" r="1.2" />
      <circle cx="1.5" cy="12" r="1.2" />
      <circle cx="6.5" cy="12" r="1.2" />
    </svg>
  );
}

function FaqDrawer({
  slug,
  editToken,
  draft,
  existingImages,
  privacyAck,
  setPrivacyAck,
  update,
  busy,
  onCancel,
  onSave,
  onImagesChange
}: {
  slug: string;
  editToken: string;
  draft: DraftForm;
  existingImages: HammerexXratedFaqImage[];
  privacyAck: boolean;
  setPrivacyAck: (b: boolean) => void;
  update: (patch: Partial<DraftForm>) => void;
  busy: boolean;
  onCancel: () => void;
  onSave: () => void;
  onImagesChange: (imgs: HammerexXratedFaqImage[]) => void;
}) {
  const qLen = draft.question.length;
  const aLen = draft.answer.length;
  const qOk = qLen >= Q_MIN && qLen <= Q_MAX;
  const aOk = aLen >= A_MIN && aLen <= A_MAX;
  const refOk = !draft.ref_code || REF_RE.test(draft.ref_code.toUpperCase());

  return (
    <div className="space-y-4 rounded-lg border border-brand-line bg-brand-bg p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-extrabold uppercase tracking-widest text-brand-accent">
          {draft.id ? `Edit ${draft.ref_code}` : "New FAQ"}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-9 items-center rounded-md px-2 text-xs font-bold text-brand-muted transition hover:text-brand-text"
        >
          Close
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-brand-muted">
            Category
          </span>
          <select
            value={draft.category}
            onChange={(e) =>
              update({
                category: e.target.value as HammerexXratedFaqItem["category"]
              })
            }
            className="block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-3 text-[13px] text-brand-text outline-none focus:border-brand-accent"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-brand-muted">
            Ref code
          </span>
          <input
            type="text"
            value={draft.ref_code}
            maxLength={9}
            onChange={(e) => update({ ref_code: e.target.value.toUpperCase() })}
            placeholder="FAQ-001"
            className={`block h-11 w-full rounded-md border bg-brand-surface px-3 text-[13px] text-brand-text outline-none focus:border-brand-accent ${
              refOk ? "border-brand-line" : "border-red-500/60"
            }`}
          />
          <p className="mt-1 text-[10px] uppercase tracking-widest text-brand-muted">
            Customer-visible. Must match FAQ-NNN (3-4 digits).
          </p>
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-brand-muted">
          Question *
        </span>
        <input
          type="text"
          value={draft.question}
          maxLength={Q_MAX}
          onChange={(e) => update({ question: e.target.value })}
          placeholder="e.g. How long does a Level 5 skim take to dry?"
          className="block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-3 text-[13px] text-brand-text outline-none focus:border-brand-accent"
        />
        <p className="mt-1 text-[10px] uppercase tracking-widest text-brand-muted">
          {qLen}/{Q_MAX} {qOk ? "" : `(min ${Q_MIN})`}
        </p>
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-brand-muted">
          Answer *
        </span>
        <textarea
          value={draft.answer}
          maxLength={A_MAX}
          onChange={(e) => update({ answer: e.target.value })}
          rows={5}
          placeholder="Plain text — explain it the way you'd tell a customer on site."
          className="block w-full rounded-md border border-brand-line bg-brand-surface px-3 py-2 text-[13px] text-brand-text outline-none focus:border-brand-accent"
        />
        <p className="mt-1 text-[10px] uppercase tracking-widest text-brand-muted">
          {aLen}/{A_MAX} {aOk ? "" : `(min ${A_MIN})`}
        </p>
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-brand-muted">
          Status
        </span>
        <select
          value={draft.status}
          onChange={(e) =>
            update({
              status: e.target.value === "archived" ? "archived" : "live"
            })
          }
          className="block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-3 text-[13px] text-brand-text outline-none focus:border-brand-accent"
        >
          <option value="live">Live (visible to customers)</option>
          <option value="archived">Archived (hidden)</option>
        </select>
      </label>

      {draft.id && (
        <FaqImagesPanel
          slug={slug}
          editToken={editToken}
          faqId={draft.id}
          images={existingImages}
          onImagesChange={onImagesChange}
        />
      )}

      <label className="flex items-start gap-3 rounded-md border border-brand-line bg-brand-surface p-3">
        <input
          type="checkbox"
          checked={privacyAck}
          onChange={(e) => setPrivacyAck(e.target.checked)}
          className="mt-0.5 h-5 w-5 accent-brand-accent"
        />
        <span className="flex-1">
          <span className="block text-[13px] font-bold text-brand-text">
            Privacy check
          </span>
          <span className="mt-1 block text-[13px] text-brand-muted">
            I confirm no customer faces, addresses or identifying detail are
            visible in the answer or attached images.
          </span>
        </span>
      </label>

      <div className="flex flex-wrap gap-2 pt-2">
        <button
          type="button"
          onClick={onSave}
          disabled={busy || !qOk || !aOk || !refOk || !privacyAck}
          className="inline-flex h-11 items-center rounded-lg bg-brand-accent px-5 text-xs font-bold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Saving…" : draft.id ? "Save changes" : "Save FAQ"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-11 items-center rounded-lg border border-brand-line bg-brand-bg px-4 text-xs font-bold text-brand-text transition hover:border-brand-accent hover:text-brand-accent"
        >
          Cancel
        </button>
      </div>

      {!draft.id && (
        <p className="rounded-md border border-brand-line bg-brand-surface px-3 py-2 text-[13px] text-brand-muted">
          Save the FAQ first, then add up to {MAX_IMAGES} reference images.
        </p>
      )}
    </div>
  );
}

function FaqImagesPanel({
  slug,
  editToken,
  faqId,
  images,
  onImagesChange
}: {
  slug: string;
  editToken: string;
  faqId: string;
  images: HammerexXratedFaqImage[];
  onImagesChange: (imgs: HammerexXratedFaqImage[]) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sensors = useDragSensors();
  const atCap = images.length >= MAX_IMAGES;
  const sortedImages = useMemo(
    () => [...images].sort((a, b) => a.sort_order - b.sort_order),
    [images]
  );

  async function handleUpload(file: File) {
    setErr(null);
    if (atCap) {
      setErr(`Max ${MAX_IMAGES} images per FAQ.`);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setErr("File must be an image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErr("Image exceeds 5 MB.");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const upRes = await fetch("/api/trade-off/upload-photo", {
        method: "POST",
        body: fd
      });
      const upJson = await upRes.json();
      if (!upJson.ok || !upJson.url) {
        setErr(upJson.error ?? "Upload failed.");
        return;
      }
      const baseTitle = file.name.replace(/\.[^.]+$/, "").slice(0, TITLE_MAX) || "Reference image";
      const saveRes = await fetch("/api/trade-off/faq-images/upsert", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          edit_token: editToken,
          image: {
            faq_id: faqId,
            image_url: upJson.url,
            title: baseTitle,
            sort_order: images.length * 10
          }
        })
      });
      const saveJson = await saveRes.json();
      if (!saveJson.ok || !saveJson.image) {
        setErr(saveJson.error ?? "Save failed.");
        return;
      }
      onImagesChange([...images, saveJson.image as HammerexXratedFaqImage]);
    } catch {
      setErr("Network error during upload.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function saveTitle(img: HammerexXratedFaqImage) {
    const trimmed = titleDraft.trim().slice(0, TITLE_MAX);
    if (trimmed.length < 1) {
      setErr("Title is required.");
      return;
    }
    setErr(null);
    setSavingId(img.id);
    try {
      const res = await fetch("/api/trade-off/faq-images/upsert", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          edit_token: editToken,
          image: {
            id: img.id,
            faq_id: faqId,
            image_url: img.image_url,
            title: trimmed,
            alt_text: img.alt_text ?? undefined,
            sort_order: img.sort_order
          }
        })
      });
      const json = await res.json();
      if (!json.ok || !json.image) {
        setErr(json.error ?? "Save failed.");
        return;
      }
      onImagesChange(
        images.map((x) => (x.id === img.id ? (json.image as HammerexXratedFaqImage) : x))
      );
      setEditingId(null);
      setTitleDraft("");
    } catch {
      setErr("Network error — try again.");
    } finally {
      setSavingId(null);
    }
  }

  async function removeImage(img: HammerexXratedFaqImage) {
    if (!confirm(`Remove "${img.title}"?`)) return;
    setErr(null);
    try {
      const res = await fetch("/api/trade-off/faq-images/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, edit_token: editToken, image_id: img.id })
      });
      const json = await res.json();
      if (!json.ok) {
        setErr(json.error ?? "Delete failed.");
        return;
      }
      onImagesChange(images.filter((x) => x.id !== img.id));
    } catch {
      setErr("Network error — try again.");
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sortedImages.findIndex((i) => i.id === active.id);
    const newIndex = sortedImages.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(sortedImages, oldIndex, newIndex);
    const renumbered = reordered.map((img, idx) => ({ ...img, sort_order: (idx + 1) * 10 }));
    const snapshot = images;
    onImagesChange(renumbered);
    void (async () => {
      try {
        const res = await fetch("/api/trade-off/faq-images/reorder", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            slug,
            edit_token: editToken,
            faq_id: faqId,
            ordering: renumbered.map((img) => ({ id: img.id, sort_order: img.sort_order }))
          })
        });
        const json = await res.json();
        if (!json.ok) {
          onImagesChange(snapshot);
          setErr(json.error ?? "Reorder failed — restored previous order.");
        }
      } catch {
        onImagesChange(snapshot);
        setErr("Network error — restored previous order.");
      }
    })();
  }

  return (
    <div className="space-y-3 rounded-md border border-brand-line bg-brand-surface p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-muted">
          Reference images &middot; {images.length}/{MAX_IMAGES}
        </p>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || atCap}
          className="inline-flex h-11 items-center rounded-lg bg-brand-accent px-3 text-xs font-bold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "+ Add image"}
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleUpload(f);
        }}
      />

      {err && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300">
          {err}
        </p>
      )}

      {images.length === 0 ? (
        <p className="rounded-md border border-dashed border-brand-line bg-brand-bg px-3 py-4 text-center text-[13px] text-brand-muted">
          No images yet. Customers love a visual answer — drop one in.
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={sortedImages.map((i) => i.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="space-y-2">
              {sortedImages.map((img) => (
                <SortableImageRow
                  key={img.id}
                  img={img}
                  isEditing={editingId === img.id}
                  titleDraft={titleDraft}
                  setTitleDraft={setTitleDraft}
                  busy={savingId === img.id}
                  onStartEdit={() => {
                    setEditingId(img.id);
                    setTitleDraft(img.title);
                  }}
                  onCancelEdit={() => {
                    setEditingId(null);
                    setTitleDraft("");
                  }}
                  onSaveTitle={() => void saveTitle(img)}
                  onRemove={() => void removeImage(img)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function SortableImageRow({
  img,
  isEditing,
  titleDraft,
  setTitleDraft,
  busy,
  onStartEdit,
  onCancelEdit,
  onSaveTitle,
  onRemove
}: {
  img: HammerexXratedFaqImage;
  isEditing: boolean;
  titleDraft: string;
  setTitleDraft: (s: string) => void;
  busy: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveTitle: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: img.id
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-md border border-brand-line bg-brand-bg p-2"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="inline-flex h-11 w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-brand-muted transition hover:text-brand-accent active:cursor-grabbing"
      >
        <DragHandleIcon />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={img.image_url}
        alt={img.alt_text ?? img.title}
        className="h-14 w-14 shrink-0 rounded-md border border-brand-line bg-brand-surface object-cover"
      />
      <div className="min-w-0 flex-1">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={titleDraft}
              maxLength={TITLE_MAX}
              onChange={(e) => setTitleDraft(e.target.value)}
              className="block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-2 text-[13px] text-brand-text outline-none focus:border-brand-accent"
              placeholder="Image title (1-80 chars)"
            />
            <button
              type="button"
              onClick={onSaveTitle}
              disabled={busy}
              className="inline-flex h-11 items-center rounded-md bg-brand-accent px-3 text-xs font-bold text-black transition disabled:opacity-60"
            >
              {busy ? "…" : "Save"}
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              className="inline-flex h-11 items-center rounded-md border border-brand-line bg-brand-bg px-2 text-xs font-bold text-brand-muted transition hover:text-brand-text"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <p className="truncate text-[13px] font-bold text-brand-text">{img.title}</p>
            <p className="text-[10px] uppercase tracking-widest text-brand-muted">
              {img.title.length}/{TITLE_MAX}
            </p>
          </>
        )}
      </div>
      {!isEditing && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onStartEdit}
            className="inline-flex h-11 items-center rounded-md border border-brand-line bg-brand-surface px-3 text-xs font-bold text-brand-text transition hover:border-brand-accent hover:text-brand-accent"
          >
            Title
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex h-11 items-center rounded-md border border-red-500/40 bg-red-500/5 px-3 text-xs font-bold text-red-300 transition hover:bg-red-500/15"
          >
            Remove
          </button>
        </div>
      )}
    </li>
  );
}
