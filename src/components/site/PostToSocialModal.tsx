"use client";

// PostToSocialModal — the "social editor" the tier catalog and the
// BuyImageModal promise. Opens when an entitled merchant clicks
// Share on a Site card. One-shot:
//   1. Pick a post kind (Showcase / Question / Chat)
//   2. Write a short caption (optional — image can carry itself)
//   3. Post → hits /api/site/share which inserts a canteen post
//      with the image URL. Yard aggregates from canteens, so the
//      post appears on Yard automatically — hence the "on your Yard
//      too" footnote.
//
// The entitlement gate is enforced server-side; this modal only
// renders when the caller already has hasClean access. If the server
// still rejects (subscription lapsed mid-session), we surface the
// buy hint inline rather than reopening BuyImageModal — quicker for
// the user, and Phase 4 will hand this to the manage-portal instead.

import { useEffect, useState } from "react";
import { Loader2, Send, X, Check, MessageSquare, Image as ImageIcon, HelpCircle } from "lucide-react";

const BRAND_BLACK  = "#0A0A0A";
const BRAND_YELLOW = "#FFB300";
const CREAM        = "#FBF6EC";
const MAX_CAPTION  = 4000;

export type PostToSocialContext = {
  imageId:  string;
  imageUrl: string;
  subject:  string;
};

type Kind = "showcase" | "question" | "chat";

const KIND_OPTIONS: Array<{
  slug:  Kind;
  label: string;
  hint:  string;
  Icon:  typeof ImageIcon;
}> = [
  { slug: "showcase", label: "Showcase", hint: "A project photo",     Icon: ImageIcon    },
  { slug: "question", label: "Question", hint: "Ask the trade",       Icon: HelpCircle   },
  { slug: "chat",     label: "Chat",     hint: "Just sharing",        Icon: MessageSquare }
];

export function PostToSocialModal({
  context,
  onClose,
  onPosted
}: {
  context:  PostToSocialContext;
  onClose:  () => void;
  /** Called with the canteen slug + post id after a successful post
   *  so the shell can toast + optionally deep-link the user to their
   *  new post. */
  onPosted?: (result: { canteenSlug: string; postId: string }) => void;
}) {
  const [kind,    setKind]    = useState<Kind>("showcase");
  const [caption, setCaption] = useState("");
  const [busy,    setBusy]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [done,    setDone]    = useState<{ canteenSlug: string; postId: string } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/site/share", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_id: context.imageId,
          caption,
          kind
        })
      });
      const data = await res.json().catch(() => ({} as {
        ok?: boolean; canteen_slug?: string; post_id?: string; error?: string; hint?: string;
      }));
      if (!res.ok || data.ok !== true || !data.canteen_slug || !data.post_id) {
        setError(data.hint ?? data.error ?? "Post failed — try again.");
        setBusy(false);
        return;
      }
      const result = { canteenSlug: data.canteen_slug, postId: data.post_id };
      setDone(result);
      setBusy(false);
      onPosted?.(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
      setBusy(false);
    }
  }

  const canPost = !busy && caption.length <= MAX_CAPTION;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center overflow-y-auto p-0 sm:items-center sm:p-6"
      style={{ backgroundColor: "rgba(10,10,10,0.75)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-2.5 sm:px-6"
          style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
        >
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="flex h-6 w-6 items-center justify-center rounded-full"
              style={{ backgroundColor: BRAND_BLACK, color: BRAND_YELLOW }}
            >
              <Send size={12} strokeWidth={2.6}/>
            </span>
            <span className="text-[11px] font-black uppercase tracking-[0.18em]">
              Share to your Canteen
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-black/10"
          >
            <X size={15} strokeWidth={2.6}/>
          </button>
        </div>

        {done ? (
          <div className="p-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: BRAND_BLACK }}>
              <Check size={22} strokeWidth={3} color={BRAND_YELLOW}/>
            </div>
            <h3 className="mt-3 text-[14px] font-black uppercase tracking-wide text-neutral-900">
              Posted
            </h3>
            <p className="mt-1 text-[12px] text-neutral-600">
              Your post is live in your Canteen and on the Yard.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <a
                href={`/trade-off/yard/canteens/${encodeURIComponent(done.canteenSlug)}`}
                className="inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[11px] font-black uppercase tracking-wider text-white"
                style={{ backgroundColor: BRAND_BLACK }}
              >
                View post
              </a>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[11px] font-black uppercase tracking-wider text-neutral-900"
                style={{ backgroundColor: BRAND_YELLOW }}
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5 sm:p-6">
            {/* Image preview strip */}
            <div
              className="mb-4 flex items-center gap-3 rounded-xl border p-2"
              style={{ borderColor: "rgba(139,69,19,0.12)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={context.imageUrl} alt="" className="h-14 w-14 flex-shrink-0 rounded-md object-cover"/>
              <p className="line-clamp-2 text-[12px] leading-snug text-neutral-700">{context.subject}</p>
            </div>

            {/* Kind picker */}
            <div className="mb-3">
              <label className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">
                Post kind
              </label>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                {KIND_OPTIONS.map(({ slug, label, hint, Icon }) => {
                  const active = slug === kind;
                  return (
                    <button
                      key={slug}
                      type="button"
                      onClick={() => setKind(slug)}
                      className="flex flex-col items-center gap-0.5 rounded-xl border px-2 py-2 text-center transition"
                      style={{
                        borderColor:     active ? BRAND_BLACK : "rgba(139,69,19,0.15)",
                        backgroundColor: active ? BRAND_BLACK : CREAM,
                        color:           active ? "white"     : BRAND_BLACK
                      }}
                      aria-pressed={active}
                    >
                      <Icon size={14} strokeWidth={2.4}/>
                      <span className="text-[10.5px] font-black uppercase tracking-wider">{label}</span>
                      <span className="text-[9px] opacity-70">{hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Caption */}
            <div className="mb-3">
              <label
                htmlFor="site-share-caption"
                className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500"
              >
                Caption <span className="text-neutral-400">(optional)</span>
              </label>
              <textarea
                id="site-share-caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value.slice(0, MAX_CAPTION))}
                placeholder={kind === "question"
                  ? "Ask something specific about this — trades will reply."
                  : kind === "showcase"
                    ? "What is this? What went into it? Skip if the photo speaks for itself."
                    : "Say something."
                }
                rows={4}
                className="mt-1 w-full resize-none rounded-lg border bg-white px-3 py-2 text-[13px] text-neutral-900 focus:outline-none focus:ring-2"
                style={{ borderColor: "rgba(139,69,19,0.15)" }}
              />
              <div className="mt-1 text-right text-[10px] text-neutral-400">
                {caption.length} / {MAX_CAPTION}
              </div>
            </div>

            {/* Post */}
            <button
              type="button"
              disabled={!canPost}
              onClick={submit}
              className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-full text-[12px] font-black uppercase tracking-wider shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
              style={{ backgroundColor: BRAND_BLACK, color: "white" }}
            >
              {busy ? <Loader2 size={14} className="animate-spin"/> : <Send size={13} strokeWidth={2.6}/>}
              {busy ? "Posting…" : "Post to my Canteen"}
            </button>

            {error && (
              <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[11.5px] font-black text-red-700">
                {error}
              </div>
            )}

            <p className="mt-4 text-[10px] text-neutral-500">
              Canteen posts appear on the Yard too — one post, both surfaces.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
