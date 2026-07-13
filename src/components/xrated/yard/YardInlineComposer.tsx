"use client";

// Facebook-style inline composer pinned to the top of the Yard feed.
//
// Collapsed state = one-tap surface: chat avatar + "What's happening?"
// input. Focus/expand reveals a full composer: textarea, up to 3
// images, one video (paid-tier only), post button.
//
// Auth: URL magic-link params (?slug=&token=). Un-authed viewers see
// a nudge with a route into their dashboard. Video uploads that fail
// with `video_requires_paid` surface an inline upgrade card.
//
// Posts as kind='chat' via the existing /api/trade-off/yard/compose
// endpoint — same rate-limit + queue rules as full-page composer.
// Auto-derives a title from the first line so the user doesn't have
// to think about title vs body (chats have neither on Facebook).

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Video,
  Send,
  X,
  Loader2,
  Rocket,
  Info,
  Smile,
  Sparkles
} from "lucide-react";
import {
  MOOD_LIBRARY,
  MOOD_ORDER,
  suggestMood,
  type MoodSlug
} from "@/lib/yardMoods";
import { BottomSheet } from "@/platform/ui/sheets/BottomSheet";

const BRAND_YELLOW = "#FFB300";
const CHAT_AVATAR_IMAGE =
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%208,%202026,%2002_57_40%20PM.png";

type Auth = { slug: string; token: string };

function deriveTitleFrom(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return "";
  const firstBreak = trimmed.indexOf("\n");
  const first = firstBreak > -1 ? trimmed.slice(0, firstBreak) : trimmed;
  if (first.length <= 90) return first;
  // Long single line → hard-cut at 90 chars for a readable title.
  return first.slice(0, 87).trim() + "…";
}

export function YardInlineComposer() {
  const router = useRouter();
  const [auth, setAuth] = useState<Auth | null>(null);
  const [checkedAuth, setCheckedAuth] = useState(false);
  // Always-open composer per product spec — the collapsed pill was
  // removed. Kept the setter for legacy callsites (Cancel button) but
  // it's a no-op on initial render.
  const [expanded, setExpanded] = useState(true);
  const [body, setBody] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoBlocked, setVideoBlocked] = useState(false);
  const [mood, setMood] = useState<MoodSlug | null>(null);
  const [moodPickerOpen, setMoodPickerOpen] = useState(false);
  // Sign-in prompt fires whenever an unauthed viewer tries to post or
  // attach media. Viewing + typing stays open to anyone so the composer
  // never feels gated.
  const [signInPromptOpen, setSignInPromptOpen] = useState(false);
  // Live auto-suggestion. Runs the keyword scanner on every keystroke —
  // sub-1ms cost, no API calls. User can accept the suggestion with
  // one tap or ignore it.
  const suggested = useMemo(() => suggestMood(body), [body]);
  // Only show the suggestion when the user hasn't picked one AND the
  // suggestion is stronger than the "thinking" default (so the chip
  // doesn't scream "we picked one!" for every neutral draft).
  const showSuggestion =
    !mood && suggested !== "thinking" && body.trim().length >= 12;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const slug = sp.get("slug");
    const token = sp.get("token");
    if (slug && token) setAuth({ slug, token });
    setCheckedAuth(true);
  }, []);

  async function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    e.currentTarget.value = "";
    if (!files || files.length === 0) return;
    if (!auth) {
      setSignInPromptOpen(true);
      return;
    }
    setUploadingImage(true);
    setError(null);
    try {
      for (let i = 0; i < Math.min(files.length, 3 - images.length); i++) {
        const fd = new FormData();
        fd.append("file", files[i]);
        fd.append("slug", auth.slug);
        fd.append("edit_token", auth.token);
        const res = await fetch("/api/trade-off/upload-photo", {
          method: "POST",
          body: fd
        });
        if (res.ok) {
          const data = (await res.json()) as { url?: string };
          if (data.url) setImages((prev) => [...prev, data.url!]);
        }
      }
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleVideoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.currentTarget.value = "";
    if (!file) return;
    if (!auth) {
      setSignInPromptOpen(true);
      return;
    }
    setUploadingVideo(true);
    setError(null);
    setVideoBlocked(false);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("slug", auth.slug);
      fd.append("edit_token", auth.token);
      const res = await fetch("/api/trade-off/upload-video", {
        method: "POST",
        body: fd
      });
      const data = (await res.json()) as {
        ok?: boolean;
        url?: string;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.url) {
        if (data.error === "video_requires_paid") setVideoBlocked(true);
        else setError("Video upload failed. Try a smaller MP4.");
        return;
      }
      setVideoUrl(data.url);
    } finally {
      setUploadingVideo(false);
    }
  }

  async function submit() {
    if (posting) return;
    const trimmed = body.trim();
    if (!trimmed) return;
    if (!auth) {
      setSignInPromptOpen(true);
      return;
    }
    setPosting(true);
    setError(null);
    try {
      const res = await fetch("/api/trade-off/yard/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: auth.slug,
          edit_token: auth.token,
          kind: "chat",
          title: deriveTitleFrom(trimmed) || "Chat",
          body: trimmed,
          image_urls: images,
          video_urls: videoUrl ? [videoUrl] : [],
          mood: mood ?? undefined
        })
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(
          data.error === "video_requires_paid"
            ? "Video is a paid-tier feature. Upgrade to include a clip."
            : data.error === "unauthorised"
              ? "Your sign-in expired. Grab a fresh magic link from your dashboard."
              : "Could not post — try again."
        );
        return;
      }
      // Reset state + refresh feed
      setBody("");
      setImages([]);
      setVideoUrl("");
      setMood(null);
      // Composer stays expanded after posting so the trade can keep
      // going without a second tap.
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPosting(false);
    }
  }

  if (!checkedAuth) return null;

  // Signed-out viewers see the full composer too and can draft freely.
  // The sign-in prompt fires only when they try to attach media or post.

  return (
    <div className="mx-auto mb-3 w-full max-w-2xl overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      {/* Composer — always expanded per product spec. */}
      {expanded && (
        <div className="p-3 sm:p-4">
          <div className="flex items-start gap-2.5">
            <span
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-2 ring-amber-400 shadow-sm"
              aria-hidden
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={CHAT_AVATAR_IMAGE}
                alt=""
                className="h-full w-full object-cover"
              />
            </span>
            <div className="min-w-0 flex-1">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="What's happening in your trade?"
                autoFocus
                rows={2}
                maxLength={2000}
                className="w-full resize-none rounded-xl border border-neutral-200 bg-white p-3 text-[13.5px] leading-[1.5] text-neutral-900 placeholder:text-neutral-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
                }}
              />

              {/* Attachment previews */}
              {(images.length > 0 || videoUrl) && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {images.map((url, i) => (
                    <div
                      key={`${url}-${i}`}
                      className="relative h-14 w-14 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setImages((prev) =>
                            prev.filter((_, idx) => idx !== i)
                          )
                        }
                        aria-label="Remove image"
                        className="absolute right-0.5 top-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-white shadow"
                      >
                        <X className="h-2.5 w-2.5" aria-hidden />
                      </button>
                    </div>
                  ))}
                  {videoUrl && (
                    <div className="relative h-14 w-14 overflow-hidden rounded-lg border border-neutral-200 bg-black">
                      <video
                        src={videoUrl}
                        muted
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      <span
                        aria-hidden
                        className="absolute bottom-0.5 left-0.5 rounded bg-black/70 px-1 py-0.5 text-[8px] font-black uppercase tracking-wider text-white"
                      >
                        Video
                      </span>
                      <button
                        type="button"
                        onClick={() => setVideoUrl("")}
                        aria-label="Remove video"
                        className="absolute right-0.5 top-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-white shadow"
                      >
                        <X className="h-2.5 w-2.5" aria-hidden />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Video-blocked upsell card — inline, non-modal, so
                  free-tier trades see the reason and the path forward. */}
              {videoBlocked && (
                <div className="mt-2 flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-50 px-3 py-2">
                  <Rocket
                    className="h-4 w-4 shrink-0 text-amber-700"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-black text-[#1B1A17]">
                      Video is a Pro-tier feature.
                    </p>
                    <p className="text-[11px] text-[#1B1A17]/60">
                      Upgrade to include walkarounds in your posts.
                    </p>
                  </div>
                  <a
                    href={`/trade-off/edit/${auth.slug}/upgrade?token=${encodeURIComponent(auth.token)}`}
                    className="shrink-0 rounded-full px-3 py-1.5 text-[11px] font-black text-neutral-900"
                    style={{ background: BRAND_YELLOW }}
                  >
                    Upgrade
                  </a>
                </div>
              )}

              {error && (
                <p className="mt-2 text-[12px] font-semibold text-red-700">
                  {error}
                </p>
              )}

              {/* Action row */}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <label className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full border border-neutral-200 bg-white px-2.5 text-[11px] font-bold text-neutral-700 hover:border-amber-400 hover:text-amber-700">
                  {uploadingImage ? (
                    <Loader2 className="h-3 w-3 animate-spin" style={{ color: "#FFB300" }} aria-hidden />
                  ) : (
                    <Camera className="h-3 w-3" style={{ color: "#FFB300" }} aria-hidden />
                  )}
                  Photo
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleImagePick}
                    disabled={uploadingImage || images.length >= 3}
                  />
                </label>
                <label
                  className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full border border-neutral-200 bg-white px-2.5 text-[11px] font-bold text-neutral-700 hover:border-amber-400 hover:text-amber-700"
                  title="Video (Pro tier — free tier trades see an upgrade prompt)"
                >
                  {uploadingVideo ? (
                    <Loader2 className="h-3 w-3 animate-spin" style={{ color: "#FFB300" }} aria-hidden />
                  ) : (
                    <Video className="h-3 w-3" style={{ color: "#FFB300" }} aria-hidden />
                  )}
                  Video
                  <input
                    type="file"
                    accept="video/mp4,video/quicktime,video/webm"
                    className="hidden"
                    onChange={handleVideoPick}
                    disabled={uploadingVideo || !!videoUrl}
                  />
                </label>

                {/* MOOD button — picks the construction-worker character
                    that renders next to the post. Live keyword scanner
                    on the body offers a one-tap suggestion. */}
                <button
                  type="button"
                  onClick={() => setMoodPickerOpen(true)}
                  className="inline-flex h-8 items-center gap-1 rounded-full border border-neutral-200 bg-white px-2.5 text-[11px] font-bold text-neutral-700 hover:border-amber-400 hover:text-amber-700"
                  style={
                    mood
                      ? { borderColor: BRAND_YELLOW, color: "#7A5300" }
                      : undefined
                  }
                >
                  <Smile className="h-3 w-3" style={{ color: "#FFB300" }} aria-hidden />
                  {mood ? MOOD_LIBRARY[mood].label : "Mood"}
                </button>

                {/* Live suggestion chip — appears when the body has
                    enough content to fingerprint. Tap = accept. Only
                    shows when no mood is picked yet. */}
                {showSuggestion && (
                  <button
                    type="button"
                    onClick={() => setMood(suggested)}
                    className="inline-flex h-8 items-center gap-1 rounded-full border border-amber-400/60 bg-amber-50 px-2.5 text-[11px] font-bold text-amber-800 hover:bg-amber-100"
                    title="One-tap accept — reads your draft"
                  >
                    <Sparkles className="h-3 w-3" aria-hidden />
                    Feeling: {MOOD_LIBRARY[suggested].label}?
                  </button>
                )}
                <span className="ml-auto flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      // Clear the draft without collapsing — the
                      // composer stays open per always-open spec.
                      setBody("");
                      setImages([]);
                      setVideoUrl("");
                      setError(null);
                      setVideoBlocked(false);
                    }}
                    className="rounded-full px-3 py-1.5 text-[11px] font-bold text-neutral-500 hover:text-neutral-700"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={posting || !body.trim()}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full px-4 text-[12px] font-black shadow-sm transition active:scale-[0.97] disabled:opacity-50"
                    style={{ background: BRAND_YELLOW, color: "#0A0A0A" }}
                  >
                    {posting ? (
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                    ) : (
                      <Send className="h-3 w-3" aria-hidden />
                    )}
                    Post
                  </button>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mood picker sheet — bottom sheet on mobile, centred modal
          on desktop. Character tiles + one-tap select. */}
      <BottomSheet
        open={moodPickerOpen}
        onClose={() => setMoodPickerOpen(false)}
        title="Pick your mood"
        variant="prominent"
      >
        <div className="px-4 py-3">
          <p className="text-[12px] text-neutral-500">
            The character shows next to your post so readers know the tone
            before they read a word. Tap again to clear.
          </p>
        </div>
        <ul className="grid grid-cols-3 gap-2 p-3 sm:grid-cols-4">
          {MOOD_ORDER.map((slug) => {
            const m = MOOD_LIBRARY[slug];
            const active = mood === slug;
            return (
              <li key={slug}>
                <button
                  type="button"
                  onClick={() => {
                    setMood(active ? null : slug);
                    setMoodPickerOpen(false);
                  }}
                  className={
                    "flex w-full flex-col items-center gap-1 rounded-xl border p-2 text-center transition " +
                    (active
                      ? "border-amber-400 bg-amber-50"
                      : "border-neutral-200 bg-white hover:border-amber-300")
                  }
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.url}
                    alt=""
                    className="h-16 w-full object-contain object-center"
                  />
                  <span className="text-[12px] font-extrabold text-neutral-800">
                    {m.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {mood && (
          <div className="border-t border-neutral-200 px-3 py-2">
            <button
              type="button"
              onClick={() => {
                setMood(null);
                setMoodPickerOpen(false);
              }}
              className="w-full rounded-full border border-neutral-200 bg-white py-2 text-[12px] font-bold text-neutral-700 hover:bg-neutral-50"
            >
              Clear mood
            </button>
          </div>
        )}
      </BottomSheet>

      {/* Sign-in prompt — fires when an unauthed viewer tries to
          attach media or hit Post. */}
      {signInPromptOpen && (
        <YardSignInPromptModal onClose={() => setSignInPromptOpen(false)}/>
      )}
    </div>
  );
}

function YardSignInPromptModal({ onClose }: { onClose: () => void }) {
  const next = typeof window !== "undefined"
    ? encodeURIComponent(window.location.pathname + window.location.search)
    : encodeURIComponent("/trade-off/yard");
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Sign in to post"
    >
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div
          className="flex flex-col items-center px-6 pb-5 pt-8"
          style={{ background: "linear-gradient(180deg, #FFB300 0%, #FFD46B 40%, #FFFFFF 100%)" }}
        >
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-800/80">
            The Yard
          </div>
          <h2 className="mt-2 text-center text-[22px] font-black leading-tight text-neutral-900 md:text-[24px]">
            Sign in to post to The Yard
          </h2>
          <p className="mt-2 max-w-sm text-center text-[12.5px] leading-relaxed text-neutral-800/80">
            Anyone can read The Yard. Only signed-in trades can post — one identity,
            no passwords, works across every Network app.
          </p>
        </div>
        <div className="flex flex-col gap-2.5 p-5">
          <a
            href={`/tc/sign-in?next=${next}`}
            className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full px-6 text-[13px] font-black uppercase tracking-wider shadow-sm transition hover:brightness-105"
            style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
          >
            Sign in
          </a>
          <a
            href={`/tc/sign-in?next=${next}`}
            className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full border bg-white px-6 text-[13px] font-black uppercase tracking-wider text-neutral-900 shadow-sm hover:bg-neutral-50"
            style={{ borderColor: "rgba(139,69,19,0.18)" }}
          >
            Create account
          </a>
          <button
            type="button"
            onClick={onClose}
            className="mt-1 text-[10.5px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900"
          >
            Keep reading The Yard
          </button>
        </div>
      </div>
    </div>
  );
}
