"use client";

// App Studio — visual customisation only. Owns its own form state and
// posts a partial /api/trade-off/update payload limited to the visual
// fields. Split out of PremiumCustomisationPanel so the tradesperson
// can focus on "how my app looks" without scrolling past 1000 lines
// of operational settings.
//
// Brand section (theme colour, body text colour, font family, font
// scale) is shared across both trade-service templates and product-
// template apps — the studio is one place, the choices apply to
// every vertical via CSS variables on the public profile root.

import { useEffect, useRef, useState } from "react";
import {
  FONT_FAMILY_OPTIONS,
  FONT_SCALE_OPTIONS,
  fontStackFor
} from "@/lib/tradeBrandTheme";
import {
  AvatarFramePicker,
  CtaEffectPicker,
  HeroEffectPicker
} from "@/components/trade-off/EffectTilePickers";
import { HelpInfoButton } from "@/components/trade-off/HelpInfoButton";

type Patch = {
  // Brand
  theme_color: string;
  body_text_color: string;
  font_family: string;
  font_scale: string;
  // Buttons / animation
  button_text_color: string;
  cta_button_effect: "none" | "pulse" | "glow" | "shake";
  // Hero
  hero_text_line1: string;
  hero_text_line2: string;
  hero_text_line2_color: string;
  hero_text_tagline: string;
  hero_text_effect: "none" | "shimmer" | "dance" | "underline";
  // Profile photo
  avatar_frame_style: "none" | "ring" | "pulse" | "dance";
  profile_placement: "center" | "top-left" | "bottom-left";
  // Tickers
  running_marquee: string;
  promo_text: string;
};

export function AppStudioPanel({
  slug,
  editToken,
  initial,
  liveHref
}: {
  slug: string;
  editToken: string;
  initial: Patch;
  /** Link to the public profile so the tradesperson can preview the
   *  change live in a new tab. */
  liveHref: string;
}) {
  const [state, setState] = useState<Patch>(initial);
  // Auto-save state. We track three phases so the sticky bar can show
  // honest status: idle (last save successful, time visible), saving
  // (in-flight), or error (last save failed — manual retry available).
  //   savedAt: epoch ms of the last successful save (null on mount)
  //   saving:  fetch in progress
  //   err:     last error message (cleared on the next successful save)
  // dirty: have we received a user edit since the last successful save?
  //        Drives the "Unsaved changes" status during the debounce gap.
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  // Tick every 20s so "Saved X seconds ago" stays current without re-
  // rendering the form on every keystroke.
  const [, setNow] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setNow((n) => n + 1), 20_000);
    return () => window.clearInterval(id);
  }, []);

  function set<K extends keyof Patch>(key: K, value: Patch[K]) {
    setDirty(true);
    setState((s) => ({ ...s, [key]: value }));
  }

  // Auto-save with a 1500ms debounce — a tradesperson typing a hex into
  // the colour echo field gets one save when they stop, not one per
  // keystroke. The ref-stored timer is cancelled on every new edit so
  // we never queue overlapping fetches.
  const debounceRef = useRef<number | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(() => {
    if (!dirty) return;
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      void save();
    }, 1500);
    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [state, dirty]);

  // Cmd/Ctrl+S manual flush — power-user habit, but also covers users
  // closing the tab before the debounce fires. Bypasses the timer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (debounceRef.current !== null) {
          window.clearTimeout(debounceRef.current);
          debounceRef.current = null;
        }
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Warn before leaving with unsaved + uncommitted edits. The browser
  // dialog text isn't customisable in modern browsers; the presence of
  // a returnValue is what shows the prompt.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty || saving) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty, saving]);

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/trade-off/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          edit_token: editToken,
          fields: stateRef.current
        })
      });
      if (res.ok) {
        setSavedAt(Date.now());
        setDirty(false);
        // Tell any LivePreviewIframe on the same page to refresh.
        // Decoupled via CustomEvent so the panel doesn't need to know
        // whether the preview is mounted (mobile hides it).
        window.dispatchEvent(new CustomEvent("appstudio:saved"));
      } else {
        const j = await res.json().catch(() => ({}));
        setErr(j?.error ?? "Save failed — we'll try again on your next edit.");
      }
    } catch {
      setErr("Offline — we'll save once you're back online.");
    } finally {
      setSaving(false);
    }
  }

  // Live preview of the picked font family — applied to the Brand
  // section's swatch only, so the user sees the change before saving.
  const fontPreviewStack = fontStackFor(state.font_family);

  return (
    <div className="space-y-6">
      <Section
        eyebrow="Brand"
        title="Colours, font, and density"
        help="A consistent look across every page builds the brand recognition that turns one-time buyers into repeat ones. Pick once here and the whole profile follows."
      >
        <Field
          label="Theme colour"
          help="The colour buyers will associate with you. Used on every Contact button, badge, and accent. Distinct colours measurably lift recall when a customer comes back to message you days later."
        >
          <ColorRow
            value={state.theme_color || "#FFB300"}
            onChange={(v) => set("theme_color", v)}
          />
        </Field>
        <Field
          label="Body text colour"
          help="The colour of the copy buyers actually read. Near-black is easiest on the eye and keeps long descriptions legible — light or low-contrast colours cost you reading time and conversions."
        >
          <ColorRow
            value={state.body_text_color || "#0A0A0A"}
            onChange={(v) => set("body_text_color", v)}
          />
        </Field>
        <Field
          label="Font family"
          help="A consistent typeface makes a profile feel built, not cobbled together — buyers stay longer on pages that look intentional. System loads fastest; Lora / Playfair lend a premium feel for higher-ticket work."
          full
        >
          <select
            value={state.font_family || "system"}
            onChange={(e) => set("font_family", e.target.value)}
            className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-[13px] text-neutral-900 focus:border-[color:#FFB300] focus:outline-none"
            style={{ fontFamily: fontPreviewStack }}
          >
            {FONT_FAMILY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} style={{ fontFamily: o.stack }}>
                {o.label}
              </option>
            ))}
          </select>
          <p
            className="mt-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-[13px] text-neutral-700"
            style={{ fontFamily: fontPreviewStack }}
          >
            The quick brown fox jumps over the lazy dog 1234567890
          </p>
        </Field>
        <Field
          label="Font size"
          help="Compact fits more above the fold (good when buyers need to scan products fast). Roomy gives long copy room to breathe — better for service trades where the bio is the sales pitch."
          full
        >
          <select
            value={state.font_scale || "normal"}
            onChange={(e) => set("font_scale", e.target.value)}
            className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-[13px] text-neutral-900 focus:border-[color:#FFB300] focus:outline-none"
          >
            {FONT_SCALE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      <Section
        eyebrow="Hero text"
        title="What your headline says"
        help="The first words a customer reads above the fold. A clear, specific headline answers 'are they for me?' before the buyer scrolls — listings with sharp hero lines get more Contact taps than generic ones."
      >
        <Field label="Hero line 1">
          <Text
            value={state.hero_text_line1}
            onChange={(v) => set("hero_text_line1", v)}
            placeholder="e.g. Drywall done right."
          />
        </Field>
        <Field label="Hero line 2">
          <Text
            value={state.hero_text_line2}
            onChange={(v) => set("hero_text_line2", v)}
            placeholder="e.g. Manchester · since 2014"
          />
        </Field>
        <Field
          label="Hero line 2 colour"
          help="Tinting your supporting line makes the city + since-year pop visually. Use your brand colour to reinforce identity, or a contrasting accent to draw eyes lower into the page."
        >
          <input
            type="color"
            value={state.hero_text_line2_color || "#FFB300"}
            onChange={(e) => set("hero_text_line2_color", e.target.value)}
            className="h-11 w-full cursor-pointer rounded-xl border border-neutral-200 bg-white p-1"
          />
        </Field>
        <Field label="Hero tagline">
          <Text
            value={state.hero_text_tagline}
            onChange={(v) => set("hero_text_tagline", v)}
            placeholder="One short pitch line"
          />
        </Field>
      </Section>

      <Section
        eyebrow="Animation"
        title="How the page comes alive"
        help="Subtle motion catches a scrolling buyer's eye. Animated CTAs get noticed when a customer is comparing 10 profiles fast — keep it tasteful so the page reads as professional, not gimmicky."
      >
        <Field
          label="Button text colour"
          help="High-contrast button text gets clicked more — buyers don't tap what they can't read. White on yellow is the safest; only use black when your theme colour is light."
        >
          <input
            type="color"
            value={state.button_text_color || "#FFFFFF"}
            onChange={(e) => set("button_text_color", e.target.value)}
            className="h-11 w-full cursor-pointer rounded-xl border border-neutral-200 bg-white p-1"
          />
        </Field>
        <Field
          label="CTA button effect"
          full
          help="A button that moves draws the eye in the half-second a buyer is deciding whether to tap. Pulse = subtle, best for premium trades. Glow = inviting. Shake = urgent. None = matches a quiet brand."
        >
          <CtaEffectPicker
            value={state.cta_button_effect}
            onChange={(v) => set("cta_button_effect", v)}
          />
        </Field>
        <Field
          label="Hero text effect"
          full
          help="A small accent on your headline helps the eye land. Shimmer + Underline read as polished — great for retail-style product profiles. Dance is louder — better for one-off promotions than evergreen identity."
        >
          <HeroEffectPicker
            value={state.hero_text_effect}
            onChange={(v) => set("hero_text_effect", v)}
          />
        </Field>
      </Section>

      <Section
        eyebrow="Profile photo"
        title="How your avatar sits on the hero"
        help="A real face is the single strongest trust signal on the page — it's what makes a stranger comfortable enough to message. How the photo is framed and placed controls how fast buyers register it."
      >
        <Field
          label="Avatar frame style"
          full
          help="A ring around your face draws the eye there first. Solid Ring reads professional; Pulse hints you're active. Use None only if your photo is already designed with a strong background."
        >
          <AvatarFramePicker
            value={state.avatar_frame_style}
            onChange={(v) => set("avatar_frame_style", v)}
          />
        </Field>
        <Field
          label="Profile placement"
          help="Centre balances the hero and works for most trades. Top-left pushes your name above the fold on mobile — best when you want brand recall to land before the buyer reads anything else."
        >
          <Select
            value={state.profile_placement}
            onChange={(v) => set("profile_placement", v as Patch["profile_placement"])}
            options={["center", "top-left", "bottom-left"]}
          />
        </Field>
      </Section>

      <Section
        eyebrow="Tickers"
        title="Scrolling text strips"
        help="The two highest-conversion strips on the page. Tickers move, so a buyer can't help but read them — perfect for time-sensitive offers or evergreen sales pitches."
      >
        <Field
          label="Running marquee (under hero)"
          full
          help="The single best place for today-only offers — postcodes you're in, this week's discount, a limited slot. Turns undecided browsers into same-day enquiries."
        >
          <Text
            value={state.running_marquee}
            onChange={(v) => set("running_marquee", v)}
            placeholder="e.g. Booking July · Manchester · 07xxx xxx xxx"
          />
        </Field>
        <Field
          label="Promo text (footer scroll)"
          full
          help="Scrolls on every page. Use an evergreen sales line — your strongest standing offer or USP — so buyers see it no matter where they land. Don't change it weekly; consistency wins."
        >
          <Text
            value={state.promo_text}
            onChange={(v) => set("promo_text", v)}
            placeholder="e.g. Free same-week site visits across Greater Manchester"
          />
        </Field>
      </Section>

      <div className="sticky bottom-3 z-10 mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white p-3 shadow-lg sm:p-4">
        <SaveStatus saving={saving} dirty={dirty} savedAt={savedAt} err={err} />
        <div className="flex items-center gap-2">
          <a
            href={liveHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-4 text-[13px] font-bold text-neutral-900 transition hover:border-neutral-400"
          >
            View live
          </a>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || (!dirty && !err)}
            className="inline-flex h-11 items-center gap-1.5 rounded-xl px-5 text-[13px] font-extrabold text-neutral-900 shadow-lg transition active:scale-[0.97] disabled:opacity-40"
            style={{ background: "#FFB300" }}
          >
            {saving ? "Saving…" : err ? "Retry save" : dirty ? "Save now" : "Saved"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({
  eyebrow,
  title,
  help,
  children
}: {
  eyebrow: string;
  title: string;
  help: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
      <header>
        <p
          className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
          style={{ color: "#FFB300" }}
        >
          {eyebrow}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
            {title}
          </h2>
          <HelpInfoButton title={title} body={help} />
        </div>
      </header>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  full,
  help,
  children
}: {
  label: string;
  full?: boolean;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-neutral-500">
        {label}
        {help && <HelpInfoButton title={label} body={help} />}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function Text({
  value,
  onChange,
  placeholder
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-[13px] text-neutral-900 placeholder:text-neutral-400 focus:border-[color:#FFB300] focus:outline-none"
    />
  );
}

function Select({
  value,
  onChange,
  options
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-[13px] text-neutral-900 focus:border-[color:#FFB300] focus:outline-none"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

// Auto-save status pill. Four states:
//   error  — last save failed; CTA flips to "Retry save".
//   saving — fetch in flight.
//   dirty  — debounce gap (changes queued, will save shortly).
//   idle   — last save successful; show relative time so the user
//            trusts the system is actually persisting.
function SaveStatus({
  saving,
  dirty,
  savedAt,
  err
}: {
  saving: boolean;
  dirty: boolean;
  savedAt: number | null;
  err: string | null;
}) {
  if (err) {
    return (
      <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-red-700">
        <Dot color="#dc2626" />
        {err}
      </span>
    );
  }
  if (saving) {
    return (
      <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-neutral-700">
        <Spinner />
        Saving…
      </span>
    );
  }
  if (dirty) {
    return (
      <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-amber-700">
        <Dot color="#FFB300" />
        Unsaved — auto-saving in a moment
      </span>
    );
  }
  if (savedAt !== null) {
    return (
      <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-emerald-700">
        <Dot color="#0F7A3F" />
        Saved · {relativeTime(savedAt)}
      </span>
    );
  }
  return (
    <span className="text-[13px] text-neutral-500">
      Auto-save is on. Every change saves itself a moment after you stop.
    </span>
  );
}

function Dot({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-2 w-2 rounded-full"
      style={{ background: color }}
    />
  );
}

function Spinner() {
  return (
    <>
      <span
        aria-hidden="true"
        className="inline-block h-3 w-3 rounded-full border-2 border-neutral-300 border-t-neutral-700"
        style={{ animation: "as-spin 0.8s linear infinite" }}
      />
      <style>{`@keyframes as-spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

function relativeTime(savedAt: number): string {
  const sec = Math.max(0, Math.floor((Date.now() - savedAt) / 1000));
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ago`;
}

// Colour picker + hex echo. The native `input type=color` is a fast
// path; the text echo lets a tradesperson paste a brand hex they
// already know without re-tapping the wheel.
function ColorRow({
  value,
  onChange
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-14 shrink-0 cursor-pointer rounded-xl border border-neutral-200 bg-white p-1"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-[13px] uppercase tracking-wider text-neutral-900 focus:border-[color:#FFB300] focus:outline-none"
        placeholder="#FFB300"
      />
    </div>
  );
}
