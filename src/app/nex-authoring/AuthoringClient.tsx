"use client";

// Client-side authoring surface · paste · parse · publish · edit inline.
// Uses native browser spellcheck (spellCheck attr) plus API-side auto-checks.

import { useCallback, useEffect, useRef, useState } from "react";

type Issue = { code: string; severity: string; message: string; hint?: string };
type ParsedSection = {
  id: string;
  order: number;
  heading: string;
  body: string;
  char_count: number;
  word_count: number;
  sentence_count: number;
  issues: Issue[];
  status: "unreviewed" | "blocked";
  auto_fix_available: boolean;
};
type ParseResult = {
  ok: boolean;
  file_slug: string;
  file_title: string;
  sections: ParsedSection[];
  summary: { total: number; live: number; blocked: number; warnings: number; clean: number };
};
type PublishResult = {
  ok: boolean;
  file_slug: string;
  file_title: string;
  written_sections: number;
  blocked_sections: number;
  summary: ParseResult["summary"];
};

// Custom event dispatched by gap-row buttons · pre-fills the paste form.
type SeedEventDetail = { topic: string; seedHeading?: string };
declare global {
  interface WindowEventMap {
    "nex-authoring-seed": CustomEvent<SeedEventDetail>;
  }
}

type TopicType = "customer_facing" | "business" | "apprentice" | "internal_notes";

export function AuthoringClient() {
  const [topic, setTopic] = useState("");
  const [topicType, setTopicType] = useState<TopicType>("customer_facing");
  const [raw, setRaw] = useState("");
  const [parsing, setParsing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [published, setPublished] = useState<PublishResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editHeadingRef = useRef<HTMLInputElement>(null);
  const editBodyRef = useRef<HTMLTextAreaElement>(null);
  const importSectionRef = useRef<HTMLDivElement>(null);

  // Listen for "Author from gap" clicks in the gap section · pre-fill form
  // and scroll to the import area · lets Philip go from customer question
  // to authoring in one click.
  useEffect(() => {
    const handler = (ev: CustomEvent<SeedEventDetail>) => {
      const { topic: seedTopic, seedHeading } = ev.detail;
      setTopic(seedTopic);
      const draft = seedHeading
        ? `# ${seedTopic}\n\n## ${seedHeading}\n[Write your answer here]\n`
        : `# ${seedTopic}\n\n## \n[Write your answer here]\n`;
      setRaw(draft);
      importSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    window.addEventListener("nex-authoring-seed", handler);
    return () => window.removeEventListener("nex-authoring-seed", handler);
  }, []);

  const parse = useCallback(async () => {
    setError(null);
    setPublished(null);
    setParsing(true);
    try {
      const res = await fetch("/api/admin/nex/authoring/parse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic, raw }),
      });
      const j = (await res.json()) as ParseResult & { error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error || "parse failed");
      setParsed(j);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "parse failed");
    } finally {
      setParsing(false);
    }
  }, [topic, raw]);

  const publish = useCallback(async () => {
    setError(null);
    setPublishing(true);
    try {
      const res = await fetch("/api/admin/nex/authoring/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic, raw, topic_type: topicType }),
      });
      const j = (await res.json()) as PublishResult & { error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error || "publish failed");
      setPublished(j);
      setRaw("");
      setTopic("");
      setParsed(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "publish failed");
    } finally {
      setPublishing(false);
    }
  }, [topic, raw]);

  const sectionAction = useCallback(async (action: string, fileSlug: string, sectionId: string, newHeading?: string, newBody?: string) => {
    setError(null);
    try {
      const res = await fetch("/api/admin/nex/authoring/section", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, file_slug: fileSlug, section_id: sectionId, new_heading: newHeading, new_body: newBody }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || "action failed");
      setEditingId(null);
      // On approve/reject/edit · reload to refresh dashboard counts
      if (typeof window !== "undefined") window.location.reload();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "action failed");
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* ═══ IMPORT AREA ═══ */}
      <section ref={importSectionRef} className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[11px] font-black uppercase tracking-[0.14em] text-neutral-500">
            Import new content
          </h2>
          <p className="text-[10.5px] text-neutral-500">
            Accepts anything staircase-related · advice, business ops, apprentice training, materials, carpet, doors, flooring. You judge · we flag.
          </p>
        </div>

        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
            <div>
              <label className="mb-1 block text-[11px] font-black uppercase tracking-wider text-neutral-600">
                Topic name
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Oak Staircase · Walnut · Loft Conversion Staircase"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-[13px] text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none"
                disabled={parsing || publishing}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-black uppercase tracking-wider text-neutral-600">
                Topic type
              </label>
              <select
                value={topicType}
                onChange={(e) => setTopicType(e.target.value as TopicType)}
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-[13px] text-neutral-900 focus:border-neutral-900 focus:outline-none"
                disabled={parsing || publishing}
              >
                <option value="customer_facing">Customer-facing advice · shown in chat</option>
                <option value="business">Business · quotes · delivery · warranty · shown in chat</option>
                <option value="apprentice">Apprentice training · NOT shown to customers</option>
                <option value="internal_notes">Internal notes · NOT shown to customers</option>
              </select>
              <p className="mt-1 text-[10px] text-neutral-500">
                {topicType === "customer_facing" || topicType === "business"
                  ? "Nex will use this to answer customer questions."
                  : "Stored for your reference · Nex will not use this in customer chat."}
              </p>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-black uppercase tracking-wider text-neutral-600">
              Paste content from ChatGPT / your notes / anywhere
            </label>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder={"# Topic Title\n\n## First question or topic\nAnswer paragraph...\n\n## Second topic\nAnother answer..."}
              rows={16}
              spellCheck={true}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-[12px] text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none"
              disabled={parsing || publishing}
            />
            <p className="mt-1 text-[10.5px] text-neutral-500">
              Browser spellcheck active · red underlines on typos as you type.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={parse}
              disabled={parsing || publishing || !topic || raw.length < 40}
              className="rounded-full border border-neutral-300 px-4 py-2 text-[12px] font-black text-neutral-900 hover:bg-neutral-50 disabled:opacity-40"
            >
              {parsing ? "Parsing…" : "Parse & preview"}
            </button>
            <button
              type="button"
              onClick={publish}
              disabled={parsing || publishing || !topic || raw.length < 40}
              className="rounded-full bg-neutral-900 px-4 py-2 text-[12px] font-black text-white hover:bg-neutral-800 disabled:opacity-40"
            >
              {publishing ? "Publishing…" : "Parse & auto-publish"}
            </button>
            {error && (
              <span className="rounded-full bg-red-100 px-3 py-1 text-[11px] font-black text-red-800">
                {error}
              </span>
            )}
          </div>

          {published && (
            <div className="rounded-xl border border-green-300 bg-green-50 p-3">
              <p className="text-[11px] font-black uppercase tracking-wider text-green-800">
                ✅ Published · {published.file_title}
              </p>
              <p className="mt-1 text-[12px] text-neutral-700">
                {published.written_sections} sections live · {published.blocked_sections} blocked (need edit before live)
              </p>
              <p className="mt-1 text-[11px] text-neutral-500">
                Nex will index this on next customer request.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ═══ PREVIEW (parse without publish) ═══ */}
      {parsed && (
        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[11px] font-black uppercase tracking-[0.14em] text-neutral-500">
              Preview · {parsed.file_title}
            </h2>
            <span className="text-[11px] font-black text-neutral-600">
              {parsed.summary.live} live · {parsed.summary.blocked} blocked · {parsed.summary.warnings} warnings
            </span>
          </div>

          <ul className="space-y-3">
            {parsed.sections.map((s) => {
              const isEditing = editingId === s.id;
              return (
                <li
                  key={s.id}
                  className={
                    s.status === "blocked"
                      ? "rounded-xl border border-red-300 bg-red-50/40 p-3"
                      : "rounded-xl border border-neutral-200 p-3"
                  }
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {s.status === "blocked" ? (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black uppercase text-red-800">Blocked</span>
                        ) : s.issues.length === 0 ? (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-black uppercase text-green-800">Clean · live</span>
                        ) : (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase text-amber-900">Live · flagged</span>
                        )}
                        <span className="text-[11px] text-neutral-500">
                          {s.char_count} chars · {s.sentence_count} sentences
                        </span>
                      </div>
                      {isEditing ? (
                        <>
                          <input
                            ref={editHeadingRef}
                            defaultValue={s.heading}
                            spellCheck={true}
                            className="mt-2 w-full rounded-lg border border-neutral-300 px-3 py-2 text-[13px] font-black text-neutral-900 focus:border-neutral-900 focus:outline-none"
                          />
                          <textarea
                            ref={editBodyRef}
                            defaultValue={s.body}
                            spellCheck={true}
                            rows={6}
                            className="mt-2 w-full rounded-lg border border-neutral-300 px-3 py-2 text-[12px] text-neutral-900 focus:border-neutral-900 focus:outline-none"
                          />
                        </>
                      ) : (
                        <>
                          <p className="mt-1 text-[13px] font-black text-neutral-900">{s.heading}</p>
                          <p className="mt-1 whitespace-pre-line text-[12px] text-neutral-600">{s.body.slice(0, 280)}{s.body.length > 280 ? "…" : ""}</p>
                        </>
                      )}
                      {s.issues.length > 0 && !isEditing && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {s.issues.map((i, ix) => (
                            <span
                              key={ix}
                              className={
                                i.severity === "block"
                                  ? "rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-800"
                                  : i.severity === "warn"
                                    ? "rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-900"
                                    : "rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-black text-neutral-700"
                              }
                              title={i.hint}
                            >
                              {i.message}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              sectionAction(
                                "edit",
                                parsed.file_slug,
                                s.id,
                                editHeadingRef.current?.value ?? s.heading,
                                editBodyRef.current?.value ?? s.body,
                              )
                            }
                            className="rounded-full bg-neutral-900 px-3 py-1.5 text-[11px] font-black text-white"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="rounded-full border border-neutral-300 px-3 py-1.5 text-[11px] font-black text-neutral-700"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditingId(s.id)}
                          className="rounded-full border border-neutral-300 px-3 py-1.5 text-[11px] font-black text-neutral-700 hover:bg-neutral-50"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
