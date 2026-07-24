// POST /api/nex/chat
// Body: { message: string }
//
// The merchant talks to Nex in natural language. This endpoint:
//   1. Records the merchant's last-seen so greetings can say "welcome back"
//   2. Detects intent deterministically
//   3. Executes the intent
//   4. Returns a structured response the /nex UI renders as chat
//
// Nex never generates unstructured advice from thin air. Every reply
// carries evidence (Studio slug, brand field, page URL, knowledge
// entry ID, or research report ID). Aligned with evidence-or-silence.

import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadStudioSession } from "@/lib/studio/session";
import { detectIntent, type NexIntent } from "@/lib/nex/intent";
import { capabilityRegistry, ensureAppsLoaded } from "@/lib/design/trade-os/manifest";
import { retrieveKnowledge } from "@/lib/nex/knowledge";
import { runResearch, submitCreate, listReviews, approveReview } from "@/lib/nex/intelligence";
import { generateAndDraft, listAccounts, type SocialPlatform } from "@/lib/nex/social";
import { assessAnswerPrompt, assessResearchPrompt, assessUnknownPrompt } from "@/lib/nex/clarify";
import { assessBehaviour } from "@/lib/nex/behaviour";
import { answerBIQuestion, buildBusinessSnapshot, classifyBIQuestion } from "@/lib/nex/bi";
import { answerProjectQuestion, buildProjectSnapshot, classifyProjectQuestion } from "@/lib/nex/pi";
import { answerEstimate, classifyEstimateQuestion, type Estimate } from "@/lib/nex/est";
import {
  buildCustomerSnapshot,
  classifyCustomerQuestion,
  findBestReviewers,
  findCustomersByTag,
  findCustomersOwingMoney,
  findCustomersToContact,
  findRepeatCustomers,
  formatCustomerList,
  formatCustomerOverview
} from "@/lib/nex/cx";
import { answerMD, buildMDBriefing, classifyMDQuestion } from "@/lib/nex/md";
import { answerFinancial, buildFinancialSnapshot, classifyFinancialQuestion } from "@/lib/nex/fi";
import { answerSC, buildSCSnapshot, classifySCQuestion } from "@/lib/nex/sc";
import {
  buildCommandCentre,
  buildProjectsOverview,
  classifyPMQuestion,
  detectDelayedProjects,
  forecastCompletion,
  formatCommandCentre,
  formatDelayed,
  formatForecast,
  formatPortfolioOverview,
  formatWorstProject
} from "@/lib/nex/pm";
import { answerVision, classifyVisionQuestion } from "@/lib/nex/cv";
import { answerNetwork, buildNetworkSnapshot, classifyNetworkQuestion } from "@/lib/nex/net";
import { answerAB, classifyABQuestion } from "@/lib/nex/ab";
import {
  buildPropertySnapshot,
  classifyCCQuestion,
  formatAssetForecast,
  formatPassport,
  formatPropertyOverview,
  formatSearch,
  searchProperties
} from "@/lib/nex/cc";
import { answerMP, classifyMPQuestion } from "@/lib/nex/mp";
import { answerXP, classifyXPQuestion } from "@/lib/nex/xp";
import { answerMesh, asksForExplanation, formatOrchestration, orchestrate } from "@/lib/nex/orch";
import { answerWorld, classifyWorldQuestion } from "@/lib/nex/world";
import { answerGlobal, classifyGlobalQuestion } from "@/lib/nex/global";
import { answerOps, classifyOpsQuestion } from "@/lib/nex/ops";
import { answerTwin, classifyTwinQuestion } from "@/lib/nex/twin";
import { answerBOS, classifyBOSQuestion } from "@/lib/nex/bos";
import { answerMemory, classifyMemoryQuestion } from "@/lib/nex/memory/answer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type NexReply = {
  intent:      NexIntent["kind"];
  speak:       string;
  result?:     Record<string, unknown>;
  suggestions?: string[];
};

/** Per-process cache — remembers the last estimate the merchant built
 *  so follow-up "why 18 boards?" questions can look it up. In-memory
 *  is fine: estimates are cheap to rebuild and this only holds
 *  conversational context. Cleared on server restart, which is safe. */
const lastEstimateByMerchant: Map<string, Estimate> = new Map();

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await loadStudioSession();
  if (!session) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null) as {
    message?:    string;
    projectId?:  string;
    imageUrl?:   string;
    imageUrls?:  string[];
  } | null;
  const message   = body?.message?.trim();
  const projectId = body?.projectId?.trim();
  const imageUrl  = body?.imageUrl?.trim() || undefined;
  const imageUrls = Array.isArray(body?.imageUrls) ? body!.imageUrls.filter((u): u is string => typeof u === "string" && u.length > 0) : undefined;
  if (!message) return NextResponse.json({ ok: false, error: "empty_message" }, { status: 400 });

  // Continuity signal: bump last-seen for the greeting logic.
  supabaseAdmin
    .from("hammerex_trade_off_listings")
    .update({ nex_last_seen_at: new Date().toISOString() })
    .eq("slug", session.merchant.slug)
    .then(() => undefined);

  // Behaviour classifier fires before intent — handles character
  // questions, casual swearing, frustration, abuse, hate speech.
  const behaviour = assessBehaviour(message, { merchantSlug: session.merchant.slug });
  if (behaviour?.kind === "full") {
    return NextResponse.json({
      ok:      true,
      intent:  "unknown",
      speak:   behaviour.speak,
      suggestions: behaviour.suggestions
    });
  }

  const intent = detectIntent(message);
  const reply = await execute(intent, session.merchant.slug, session.merchant.display_name, { projectId, imageUrl, imageUrls });

  // Preface (frustration) prepends an acknowledgment to the normal reply.
  if (behaviour?.kind === "preface") {
    reply.speak = `${behaviour.speak}\n\n${reply.speak}`;
  }
  return NextResponse.json({ ok: true, ...reply });
}

async function execute(
  intent: NexIntent,
  merchantSlug: string,
  merchantName: string,
  ctx: { projectId?: string; imageUrl?: string; imageUrls?: string[] } = {}
): Promise<NexReply> {
  switch (intent.kind) {

    case "invoke_studio": {
      const { data: identity } = await supabaseAdmin
        .from("hammerex_brand_identity")
        .select("id, brand_json")
        .eq("merchant_slug", merchantSlug)
        .maybeSingle();
      if (!identity) {
        return {
          intent: intent.kind,
          speak:  "You'll need to answer the 7 questions first. Takes about 2 minutes.",
          result: { path: "/studio/discovery" },
          suggestions: ["Take me to Discovery"]
        };
      }
      await ensureAppsLoaded();
      const result = await capabilityRegistry.execute(intent.capability_id, {
        correlation_id:    randomUUID(),
        brand_snapshot:    identity.brand_json as Record<string, unknown>,
        brand_identity_id: identity.id,
        merchant_slug:     merchantSlug,
        user_prompt:       intent.user_prompt
      });
      if (result.ok) {
        return {
          intent: intent.kind,
          speak:  `Done. ${cap(intent.capability_id)} took ${Math.round((result.latency_ms ?? 0) / 1000)}s and cost £${((result.cost_pence ?? 0) / 100).toFixed(2)}. Want business cards to match?`,
          result: { asset_urls: result.asset_urls, cost_pence: result.cost_pence, prompt_used: result.prompt_used },
          suggestions: ["Match business cards", "Try again with tweaks", "Export the pack"]
        };
      }
      return {
        intent: intent.kind,
        speak:  `That didn't finish (${result.error}). Your brief is saved. Try again in a minute.`,
        result: { error: result.error }
      };
    }

    case "edit_brand": {
      return {
        intent: intent.kind,
        speak:  `To change your ${intent.field}, open the Brand Vault. Every design that uses your brand will update with it.`,
        result: { path: "/studio/vault", field: intent.field },
        suggestions: ["Open Brand Vault"]
      };
    }

    case "open_page": {
      return {
        intent: intent.kind,
        speak:  `Taking you to ${intent.label}.`,
        result: { path: intent.path }
      };
    }

    case "answer": {
      // Prompt too vague to answer accurately → ask for more.
      const clarify = assessAnswerPrompt(intent.topic);
      if (clarify) return { intent: intent.kind, ...clarify };

      const hits = await retrieveKnowledge(intent.topic, 3);
      if (hits.length === 0) {
        return {
          intent: intent.kind,
          speak:  "I don't have that in my knowledge base yet. Want me to research it from trusted sources?",
          suggestions: [`Research ${intent.topic}`]
        };
      }
      return {
        intent: intent.kind,
        speak:  hits.map((h) => `${h.title}. ${h.summary}`).join("\n\n"),
        result: { sources: hits.map((h) => ({ id: h.id, title: h.title })) }
      };
    }

    case "research": {
      // Prompt too vague to research accurately → ask for more.
      const clarify = assessResearchPrompt(intent.topic);
      if (clarify) return { intent: intent.kind, ...clarify };

      // Kicks off a research pass. Returns the report id so the UI can
      // deep-link to /admin/nex/research/<id>. Merchants also see their
      // own reports via RLS.
      const requesterKind = merchantSlug === "admin" ? "staff" : "merchant";
      try {
        const report = await runResearch({
          topic:           intent.topic,
          tradeHint:       intent.trade,
          requestedBy:     merchantSlug,
          requestedByKind: requesterKind as "staff" | "merchant" | "builder"
        });
        // Trust-language reply per Verified Knowledge policy.
        const lines: string[] = ["I searched official government and recognised industry sources before answering."];
        lines.push("");
        if (report.found_official) {
          lines.push(`Official guidance was found. ${report.tier_counts.official} draft${report.tier_counts.official === 1 ? "" : "s"} cite regulation-tier sources.`);
        } else {
          lines.push(`No official guidance was found for "${report.topic}". Any drafts below come from industry / community sources and are not legislation.`);
        }
        if (report.tier_counts.industry    > 0) lines.push(`Industry sources: ${report.tier_counts.industry}`);
        if (report.tier_counts.educational > 0) lines.push(`Educational sources: ${report.tier_counts.educational}`);
        if (report.tier_counts.community   > 0) lines.push(`Community guidance: ${report.tier_counts.community} (labelled)`);
        lines.push("");
        lines.push(`${report.proposed_count} item${report.proposed_count === 1 ? "" : "s"} waiting for your approval. Nothing is live yet.`);
        return {
          intent: intent.kind,
          speak:  lines.join("\n"),
          result: {
            path:                     `/admin/nex/research/${report.id}`,
            report_id:                report.id,
            proposed_count:           report.proposed_count,
            changed_count:            report.changed_count,
            conflict_count:           report.conflict_count,
            confidence:               report.confidence,
            found_official:           report.found_official,
            tier_counts:              report.tier_counts,
            estimated_review_minutes: report.estimated_review_minutes,
            sources_checked:          report.sources_checked
          },
          suggestions: report.proposed_count > 0
            ? ["Review the drafts", "Approve everything", "What changed?"]
            : ["Try a more specific topic"]
        };
      } catch (e) {
        return {
          intent: intent.kind,
          speak:  `I couldn't complete that research (${e instanceof Error ? e.message : "unknown"}). Try a narrower topic.`
        };
      }
    }

    case "teach": {
      // Merchant asserts a fact. File as a create review (staff turns it
      // into a proper entry or rejects). Never enters knowledge silently.
      try {
        const r = await submitCreate({
          draft: {
            trade:      "any",
            topic:      "merchant-suggested",
            title:      intent.content.slice(0, 120),
            summary:    intent.content,
            difficulty: "basic",
            keywords:   [],
            sources:    [{ title: `Merchant note from ${merchantName}`, kind: "expert-quote" }],
            evidence:   [],
            confidence: 60
          },
          submittedBy:      merchantSlug,
          submittedByKind:  merchantSlug === "admin" ? "staff" : "merchant"
        });
        return {
          intent: intent.kind,
          speak:  "Got it. Sent to Review. Nothing's live until a human confirms it.",
          result: { review_id: r.id, path: "/admin/nex/review" }
        };
      } catch (e) {
        return {
          intent: intent.kind,
          speak:  `Couldn't save that (${e instanceof Error ? e.message : "unknown"}). Try rewording it as a fact plus a source.`
        };
      }
    }

    case "approve_all": {
      // Guardrail: chat "approve everything" NEVER auto-fires. Nex
      // returns the count + confirmation prompt + deep link. Only the
      // second turn with "confirm" actually approves.
      const pending = await listReviews({ status: "pending", limit: 50 });
      if (pending.length === 0) {
        return { intent: intent.kind, speak: "Nothing pending. All caught up." };
      }
      if (!intent.confirm) {
        return {
          intent: intent.kind,
          speak:  `${pending.length} item${pending.length === 1 ? "" : "s"} pending. Say "approve everything, confirm" to publish them all, or open the Review page to check one by one.`,
          result: { path: "/admin/nex/review", pending_count: pending.length },
          suggestions: ["Approve everything, confirm", "Open Review", "What changed?"]
        };
      }
      // Only staff can bulk-approve. Merchant confirm is rejected.
      if (merchantSlug !== "admin") {
        return { intent: intent.kind, speak: "Only staff can approve knowledge. I've flagged it for review instead." };
      }
      let approved = 0;
      for (const item of pending) {
        try {
          await approveReview({ reviewId: item.id, reviewerId: "chat:approve_all", notes: "Bulk-approved via chat" });
          approved++;
        } catch { /* skip failures */ }
      }
      return {
        intent: intent.kind,
        speak:  `Approved ${approved} of ${pending.length}. Version history recorded.`,
        result: { path: "/admin/nex/review?status=approved", approved_count: approved }
      };
    }

    case "what_changed": {
      const since = new Date();
      since.setDate(since.getDate() - (intent.scope === "this_week" ? 7 : 3));
      const { data: versions } = await supabaseAdmin
        .from("hammerex_nex_knowledge_versions")
        .select("version, title, trade, change_kind, change_summary, approved_at")
        .gte("approved_at", since.toISOString())
        .order("approved_at", { ascending: false })
        .limit(20);
      const rows = versions ?? [];
      if (rows.length === 0) {
        return { intent: intent.kind, speak: `Nothing published in the last ${intent.scope === "this_week" ? "7" : "3"} days.` };
      }
      const speak = [
        `Here's what changed in the last ${intent.scope === "this_week" ? "week" : "few days"}:`,
        "",
        ...rows.slice(0, 8).map((r) => `- ${r.trade} · ${r.title} (v${r.version}, ${r.change_kind}) — ${r.change_summary ?? ""}`)
      ].join("\n");
      return {
        intent: intent.kind,
        speak,
        result: { count: rows.length, path: "/admin/nex/review?status=approved" }
      };
    }

    case "social_post": {
      // Merchant asked Nex to create a social post. Draft it in
      // 'awaiting_approval' state so the approval gate holds. Never
      // publish here — merchant approves via /studio/social.
      const platform: SocialPlatform = intent.platform === "any" ? "facebook" : intent.platform;
      const accounts = await listAccounts(merchantSlug);
      const account  = accounts.find((a) => a.platform === platform && a.status === "connected");

      try {
        const post = await generateAndDraft({
          merchantSlug,
          platform,
          brief:     intent.brief,
          createdBy: `merchant:${merchantSlug}`
        });
        const speakLines = [
          `Drafted a ${platform} post. ${post.caption.length} characters, ${post.hashtags.length} hashtags.`,
          `Open the Social page to review. I never publish without your approval.`
        ];
        if (!account) speakLines.push(`One thing: no ${platform} account connected yet. Connect one to publish. The draft is saved either way.`);
        return {
          intent: intent.kind,
          speak:  speakLines.join("\n\n"),
          result: { path: `/studio/social/posts/${post.id}`, post_id: post.id, platform, connected: !!account },
          suggestions: account
            ? ["Approve and publish", "Schedule Friday 5pm", "Edit the caption"]
            : ["Connect Facebook", "Just save the draft"]
        };
      } catch (e) {
        return {
          intent: intent.kind,
          speak:  `Couldn't draft that (${e instanceof Error ? e.message : "unknown"}). Try again with a clearer brief.`
        };
      }
    }

    case "digital_twin": {
      const q = classifyTwinQuestion(intent.question);
      const speak = await answerTwin({ question: q, merchantSlug });
      return {
        intent: intent.kind,
        speak:  speak || "Try 'if fuel goes up 20%', 'if I raise prices by 5%', 'if I hire another carpenter', 'if I buy a van for £25,000', or 'if I spend £500/mo on ads'.",
        suggestions: ["List scenarios", "If I raise prices by 5%", "If I hire another carpenter"]
      };
    }

    case "business_ops": {
      const q = classifyOpsQuestion(intent.question);
      const speak = await answerOps({ question: q, merchantSlug });
      return {
        intent: intent.kind,
        speak:  speak || "Try 'morning nex, what's today looking like?' or 'morning briefing'.",
        suggestions: ["Show me what needs my approval", "Show today's plan"]
      };
    }

    case "memory": {
      // Phase 26 V0 — memory recall (owner-only reads).
      const q = classifyMemoryQuestion(intent.question);
      const res = await answerMemory({ question: q, merchant_slug: merchantSlug });
      return {
        intent: intent.kind,
        speak:  res.speak || "Try 'how did I price a kitchen last time?', 'which customers pay late?', or 'how's cash been?'.",
        result: { rows_returned: res.rows?.length ?? 0 },
        suggestions: ["How did I price a kitchen last time?", "Which customers pay late?", "How's cash been?"]
      };
    }

    case "bos": {
      // Phase 25 — Business Operating System.
      // The chat route delegates classification but only supplies live
      // inputs when the caller has already staged them. Without live
      // finance/predict/growth data plugged in, we return the shape
      // Nex knows honestly (no fabricated stats).
      const q = classifyBOSQuestion(intent.question);
      const merchantName = merchantSlug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      const res = await answerBOS({
        question:      q,
        merchant_slug: merchantSlug,
        merchant_name: merchantName
      });
      return {
        intent: intent.kind,
        speak:  res.speak || "Try 'morning intelligence report', 'predict risks on my projects', 'growth opportunities', or 'can I afford a van?'.",
        suggestions: ["Morning intelligence report", "Predict risks on my projects", "Can I afford a van?"]
      };
    }

    case "global": {
      const q = classifyGlobalQuestion(intent.question);
      const speak = await answerGlobal({ question: q, merchantSlug });
      return {
        intent: intent.kind,
        speak:  speak || "Try 'stair regulation in Ireland', 'building code in Australia', or 'tell me about construction in Canada'.",
        suggestions: ["Stair regulation in Ireland", "Building code in Australia", "Tell me about construction in Canada"]
      };
    }

    case "world": {
      const q = classifyWorldQuestion(intent.question);
      const speak = await answerWorld({ question: q, merchantSlug });
      return {
        intent: intent.kind,
        speak:  speak || "Try 'where am I?', 'what's the minimum stair width?', 'search for solar', or 'what if I delay the Smith kitchen?'.",
        suggestions: ["Where am I?", "What's the minimum stair width?", "Search for solar"]
      };
    }

    case "orchestrate": {
      // Phase 24 — route to the mesh (single Nex voice, ~40 specialists).
      // The old `orchestrate()` runner is still exported for direct callers.
      const reveal = asksForExplanation(intent.question);
      const res = await answerMesh({
        merchant_slug: merchantSlug,
        ask:           intent.question,
        reveal_trace:  reveal
      });
      const speak = reveal && res.reveal
        ? `${res.speak}\n\n---\n${res.reveal}`
        : res.speak;
      // Fall back to the baseline runner's format only if the mesh saw
      // nothing (empty plan).
      const fallback = res.data.plan.steps.length === 0
        ? formatOrchestration(await orchestrate({ merchant_slug: merchantSlug, ask: intent.question }))
        : "";
      return {
        intent: intent.kind,
        speak:  fallback || speak || "I couldn't pick specialists for that ask. Try 'quote this extension', 'organise my next project', or 'plan my week'.",
        result: {
          agents_used:        res.data.contributions.map((c) => c.agent_id),
          agent_errors:       res.data.errors.length,
          overall_confidence: res.data.overall_confidence,
          official_cited:     res.data.official_cited,
          conflicts:          res.data.conflicts.length
        },
        suggestions: ["Quote this extension", "Plan my week", "Loft conversion in Dublin"]
      };
    }

    case "experience": {
      const q = classifyXPQuestion(intent.question);
      const res = await answerXP({ question: q });
      return {
        intent: intent.kind,
        speak:  res.speak || "Try 'how long does a loft conversion take?', 'show projects similar to a kitchen refit', or 'how many contributing projects?'.",
        result: res.data ? { claims: res.data.claims.length } : undefined,
        suggestions: ["How long does a loft conversion take?", "Show similar projects", "How many contributing projects?"]
      };
    }

    case "marketplace": {
      // Resolve merchant listing so we can use their lat/lng as origin
      // for distance sort in the ranker.
      const listing = await supabaseAdmin
        .from("hammerex_trade_off_listings")
        .select("lat, lng")
        .eq("slug", merchantSlug)
        .maybeSingle();
      const origin = listing.data && listing.data.lat !== null && listing.data.lng !== null
        ? { lat: Number(listing.data.lat), lng: Number(listing.data.lng) }
        : undefined;
      const q = classifyMPQuestion(intent.question);
      const res = await answerMP({ question: q, merchantSlug, origin });
      return {
        intent: intent.kind,
        speak:  res.speak || "Try 'I need 120 concrete blocks', 'compare timber prices', 'find cheaper insulation' or 'who sells plasterboard?'.",
        result: res.data
          ? { keyword: res.data.request.keyword, matches: res.data.results.length, unavailable: res.data.unavailable }
          : undefined,
        suggestions: ["I need 120 concrete blocks", "Compare timber prices", "Find cheaper insulation"]
      };
    }

    case "construction_cloud": {
      // Property-scoped. Merchant viewer — resolve listing_id + require
      // membership on at least one project at the property.
      const listing = await supabaseAdmin
        .from("hammerex_trade_off_listings")
        .select("id")
        .eq("slug", merchantSlug)
        .maybeSingle();
      if (!listing.data) return { intent: intent.kind, speak: "Your listing isn't set up yet — I can't reach the property records." };
      const merchantListingId = String(listing.data.id);
      const viewer = "merchant" as const;

      const q = classifyCCQuestion(intent.question);
      switch (q.kind) {
        case "property_overview": {
          const res = await buildPropertySnapshot({
            hint:     { kind: "address", query: q.hint },
            viewer,
            viewerId: merchantListingId
          });
          return { intent: intent.kind, speak: formatPropertyOverview(res) };
        }
        case "asset_forecast": {
          // Need a property to run this on. Without a hint we can't know
          // which one — surface honestly.
          return { intent: intent.kind, speak: "Which property? Say 'tell me everything about <address>' first, then ask about the boiler / roof." };
        }
        case "search": {
          const results = await searchProperties({ query: q.query, viewer, viewerId: merchantListingId });
          return { intent: intent.kind, speak: formatSearch(results, q.query), result: { count: results.length } };
        }
        case "passport": {
          if (!q.hint) {
            return { intent: intent.kind, speak: "Which property? Say 'build the passport for <address>'." };
          }
          const res = await buildPropertySnapshot({
            hint:     { kind: "address", query: q.hint },
            viewer,
            viewerId: merchantListingId
          });
          return { intent: intent.kind, speak: formatPassport(res) };
        }
        case "none":
          return {
            intent: intent.kind,
            speak: "Try 'tell me everything about 14 High Street', 'find every property with solar panels', or 'build the Building Passport'.",
            suggestions: ["Tell me everything about 14 High Street", "Find every property with solar panels"]
          };
      }
      return { intent: intent.kind, speak: "" };
    }

    case "autonomy": {
      const q = classifyABQuestion(intent.question);
      const speak = await answerAB({ question: q, merchantSlug });
      return {
        intent: intent.kind,
        speak:  speak || "Try 'what needs my approval?', 'what did you do overnight?', 'what mode am I on?' or address a specific agent like 'marketing nex, how are my posts?'.",
        suggestions: ["What needs my approval?", "What did you do overnight?", "What mode am I on?"]
      };
    }

    case "network": {
      const q = classifyNetworkQuestion(intent.question);
      let snapshot: import("@/lib/nex/net").NetworkSnapshot | undefined;
      if (q.kind !== "find") {
        const res = await buildNetworkSnapshot({ merchantSlug });
        if (res.ok) snapshot = res.snapshot;
      }
      const speak = await answerNetwork({ question: q, snapshot, excludeSlugs: [merchantSlug] });
      return {
        intent: intent.kind,
        speak:  speak || "Try 'find me a bricklayer near M25', 'my trust profile', 'my collaborators' or 'referrals'.",
        suggestions: ["Find me a bricklayer", "My trust profile", "Referral opportunities"]
      };
    }

    case "vision": {
      const q = classifyVisionQuestion(intent.question);
      const res = await answerVision({
        question:  q,
        imageUrl:  ctx.imageUrl,
        imageUrls: ctx.imageUrls,
        context:   { merchantSlug }
      });
      return {
        intent: intent.kind,
        speak:  res.speak || "Try 'analyse this image', 'what's wrong with this?', 'is this safe?', 'read this receipt' or 'compare these images'.",
        result: res.data ? { kind: res.data.kind } : undefined,
        suggestions: q.kind === "compare" ? [] : ["Any defects?", "Is this safe?", "Read this receipt"]
      };
    }

    case "project_manager": {
      // Multi-project + command centre. Resolve merchant listing id
      // for the enumeration path.
      const listing = await supabaseAdmin
        .from("hammerex_trade_off_listings")
        .select("id")
        .eq("slug", merchantSlug)
        .maybeSingle();
      if (!listing.data) {
        return { intent: intent.kind, speak: "Your listing isn't set up yet — I can't run the project manager." };
      }
      const merchantListingId = String(listing.data.id);
      const merchantId = merchantListingId;

      const q = classifyPMQuestion(intent.question);
      switch (q.kind) {
        case "command_centre": {
          const res = await buildCommandCentre({ merchantSlug });
          return { intent: intent.kind, speak: formatCommandCentre(res), result: res.ok ? { sections_count: res.briefing.sections.length, unavailable: res.briefing.unavailable } : undefined };
        }
        case "portfolio_overview": {
          const o = await buildProjectsOverview({ merchantSlug, merchantId, merchantListingId });
          return { intent: intent.kind, speak: formatPortfolioOverview(o), result: { count: o.projects.length, errors: o.errors.length } };
        }
        case "worst_project": {
          const o = await buildProjectsOverview({ merchantSlug, merchantId, merchantListingId });
          return { intent: intent.kind, speak: formatWorstProject(o) };
        }
        case "delayed": {
          const d = await detectDelayedProjects({ merchantId, merchantListingId });
          return { intent: intent.kind, speak: formatDelayed(d), result: { count: d.length } };
        }
        case "forecast": {
          // Find a project matching the hint by title (fuzzy).
          const projects = await supabaseAdmin
            .from("hammerex_sitebook_projects")
            .select("id, title")
            .ilike("title", `%${q.hint}%`)
            .limit(3);
          const rows = projects.data ?? [];
          if (rows.length === 0) return { intent: intent.kind, speak: `No project matches "${q.hint}".` };
          if (rows.length > 1) {
            const lines = [`I found ${rows.length} projects matching "${q.hint}":`, ...rows.map((r) => `- ${r.title}`)];
            lines.push("Say the full name of the one you want.");
            return { intent: intent.kind, speak: lines.join("\n") };
          }
          const f = await forecastCompletion({ projectId: String(rows[0].id), merchantId });
          return { intent: intent.kind, speak: formatForecast(f) };
        }
        case "none":
          return {
            intent: intent.kind,
            speak: "Try 'run today's business', 'how are my projects?', 'which project worries you?', 'what's falling behind?' or 'when will [project name] finish?'.",
            suggestions: ["Run today's business", "Which project worries you?", "What's falling behind?"]
          };
      }
      return { intent: intent.kind, speak: "" };
    }

    case "supply_chain": {
      const res = await buildSCSnapshot({ merchantSlug });
      if (!res.ok) return { intent: intent.kind, speak: "Your listing isn't set up yet — I can't build a supply-chain snapshot." };
      const q = classifySCQuestion(intent.question);
      const speak = await answerSC(q, res.snapshot);
      return {
        intent: intent.kind,
        speak:  speak || "Try 'what materials do I need next week?', 'compare suppliers', 'where am I wasting materials?' or 'alternatives for plasterboard'.",
        result: {
          shopping_lines_count: res.snapshot.shopping_list.lines.length,
          shopping_total_pence: res.snapshot.shopping_list.total_pence,
          worst_variance:       res.snapshot.waste.projects[0] ?? null,
          top_supplier:         res.snapshot.suppliers.suppliers[0] ?? null,
          unavailable:          res.snapshot.unavailable
        },
        suggestions: ["Compare suppliers", "Where am I wasting materials?", "Alternatives for plasterboard"]
      };
    }

    case "financial_intel": {
      const res = await buildFinancialSnapshot({ merchantSlug });
      if (!res.ok) return { intent: intent.kind, speak: "Your listing isn't set up yet — I can't build a finance snapshot." };
      const q = classifyFinancialQuestion(intent.question);
      // Rebuild cash flow from MD for "afford" precision (optional).
      const md = await buildMDBriefing({ merchantSlug }).catch(() => null);
      const speak = answerFinancial(q, res.snapshot, md && md.ok ? md.briefing.cashflow : null);
      return {
        intent: intent.kind,
        speak:  speak || "Try 'how are my finances?', 'can I afford £X?', 'what's my tax position?', 'where am I spending too much?' or 'who's my best customer?'.",
        result: {
          financial_health:  res.snapshot.health.score,
          band:              res.snapshot.health.band,
          revenue_pence:     res.snapshot.revenue.total_pence,
          expenses_pence:    res.snapshot.expenses.total_pence,
          vat_net_pence:     res.snapshot.vat.vat_net_pence,
          outstanding_pence: res.snapshot.cashflow_ref.outstanding_now_pence
        },
        suggestions: ["Where am I spending?", "Who's my best customer?", "What's my VAT position?"]
      };
    }

    case "md_intel": {
      const res = await buildMDBriefing({ merchantSlug });
      if (!res.ok) return { intent: intent.kind, speak: "Your listing isn't set up yet — I can't build a business briefing." };
      const q = classifyMDQuestion(intent.question);
      const speak = answerMD(q, res.briefing);
      return {
        intent: intent.kind,
        speak:  speak || "Try 'how's my business?', 'what worries you?', 'what should I do first?', 'where am I losing money?', 'what's my biggest opportunity?' or 'how's cash flow?'.",
        result: {
          health_score:   res.briefing.health.score,
          band:           res.briefing.health.band,
          priorities:     res.briefing.priorities.slice(0, 5),
          recommendations: res.briefing.recommendations,
          cashflow_horizon_pence: res.briefing.cashflow.horizon_pence
        },
        suggestions: ["What worries you?", "What should I do first?", "How's cash flow?"]
      };
    }

    case "customer_intel": {
      // Merchant asked about a customer or a list of customers.
      // Resolve the merchant's listing id — used for warranty +
      // payments enrichers and cross-customer search.
      const listing = await supabaseAdmin
        .from("hammerex_trade_off_listings")
        .select("id")
        .eq("slug", merchantSlug)
        .maybeSingle();
      if (!listing.data) {
        return { intent: intent.kind, speak: "Your listing isn't set up yet — I can't look up customer data." };
      }
      const merchantListingId = String(listing.data.id);
      // In this codebase the CRM merchant_id === the listing id — every
      // app_crm_contacts row is keyed on it.
      const merchantId = merchantListingId;

      const q = classifyCustomerQuestion(intent.question);
      switch (q.kind) {
        case "customer_overview":
        case "customer_search": {
          const name = q.kind === "customer_overview" ? q.name : q.name;
          if (!name || name.length < 2) {
            return { intent: intent.kind, speak: "Who? Give me a customer name and I'll pull the file." };
          }
          const res = await buildCustomerSnapshot({
            merchantId,
            merchantListingId,
            ref: { kind: "search", query: name }
          });
          if (!res.ok) {
            if (res.reason === "not_found") return { intent: intent.kind, speak: `No customer matches "${name}" on your CRM.` };
            if (res.reason === "ambiguous") {
              const lines = [`I found a few matches for "${name}":`];
              for (const m of res.matches ?? []) lines.push(`- ${m.displayName} (${m.lifecycleStage})`);
              lines.push("Say the full name of the one you want.");
              return { intent: intent.kind, speak: lines.join("\n") };
            }
            return { intent: intent.kind, speak: "I can't access that customer." };
          }
          return {
            intent: intent.kind,
            speak: formatCustomerOverview(res.snapshot),
            result: {
              contact_id:   res.snapshot.contactId,
              health_score: res.snapshot.health.score,
              opportunities: res.snapshot.opportunities.slice(0, 3),
              warranties:    res.snapshot.warranties.slice(0, 3)
            },
            suggestions: ["What preferences?", "Any opportunities?", "Show outstanding payments"]
          };
        }
        case "who_owes":         { const list = await findCustomersOwingMoney(merchantListingId, merchantId); return { intent: intent.kind, speak: formatCustomerList("who_owes", list),         result: { count: list.length } }; }
        case "who_to_contact":   { const list = await findCustomersToContact(merchantId);                     return { intent: intent.kind, speak: formatCustomerList("who_to_contact", list),   result: { count: list.length } }; }
        case "repeat_customers": { const list = await findRepeatCustomers(merchantId);                       return { intent: intent.kind, speak: formatCustomerList("repeat_customers", list), result: { count: list.length } }; }
        case "best_reviewers":   { const list = await findBestReviewers(merchantId);                         return { intent: intent.kind, speak: formatCustomerList("best_reviewers", list),   result: { count: list.length } }; }
        case "by_tag":           { const list = await findCustomersByTag(merchantId, q.tag);                 return { intent: intent.kind, speak: formatCustomerList(`by_tag:${q.tag}`, list),  result: { count: list.length, tag: q.tag } }; }
        case "none":
          return {
            intent: intent.kind,
            speak: "I can pull any customer by name, or answer 'who owes me money', 'who should I contact today', 'who leaves the best reviews', 'repeat customers', or 'show <tag> customers'.",
            suggestions: ["Who owes me money?", "Who should I contact today?", "Repeat customers"]
          };
      }
      // Should be unreachable — TS exhaustive check.
      return { intent: intent.kind, speak: "" };
    }

    case "estimate": {
      const q = classifyEstimateQuestion(intent.question);
      // Explain-follow-ups reference the last estimate for this merchant.
      const last = lastEstimateByMerchant.get(merchantSlug) ?? undefined;
      const res  = await answerEstimate({
        question:      q,
        lastEstimate:  last,
        context:       { merchantSlug }
      });
      if (res.estimate) lastEstimateByMerchant.set(merchantSlug, res.estimate);
      return {
        intent: intent.kind,
        speak:  res.speak || "Try \"estimate 42 m² of plastering\" or ask me why any number came out that way.",
        result: res.estimate
          ? { trade: res.estimate.trade, scope: res.estimate.scope, total_pence: res.estimate.total_pence, defaults: res.estimate.defaults }
          : undefined,
        suggestions: res.suggestions
      };
    }

    case "project_intel": {
      // Merchant asked about a specific project. We need the project id
      // (from the UI context) AND the merchant's listing id to check
      // membership. Without a projectId in the request we can only
      // hint at how to scope the question.
      if (!ctx.projectId) {
        return {
          intent: intent.kind,
          speak:  "Which project? Open a project page and ask again, or tell me the project title.",
          suggestions: ["Show my projects"]
        };
      }
      const listing = await supabaseAdmin
        .from("hammerex_trade_off_listings")
        .select("id")
        .eq("slug", merchantSlug)
        .maybeSingle();
      if (!listing.data) {
        return { intent: intent.kind, speak: "Your listing isn't set up yet — I can't check project access." };
      }
      const res = await buildProjectSnapshot({
        projectId: ctx.projectId,
        viewer:    "merchant",
        viewerId:  String(listing.data.id)
      });
      if (!res.ok) {
        return {
          intent: intent.kind,
          speak:  res.reason === "not_member"
            ? "You're not on that project's team, so I can't share its details."
            : res.reason === "project_missing"
              ? "I can't find that project."
              : "I can't access that project."
        };
      }
      const pq = classifyProjectQuestion(intent.question);
      const speak = answerProjectQuestion(pq, res.snapshot);
      if (!speak) {
        return {
          intent: intent.kind,
          speak:  "I can pull photos, timeline, costs, snags, team, variations and risks for a project. What would you like?",
          suggestions: ["Show today's activity", "What's left to do?", "Show recent photos"]
        };
      }
      return {
        intent: intent.kind,
        speak,
        result: {
          project_id:   res.snapshot.project.id,
          health_score: res.snapshot.health.score,
          observations: res.snapshot.observations.slice(0, 5)
        }
      };
    }

    case "business_intel": {
      // Business Intelligence — Nex answers directly from the BI engine
      // snapshot. Every reply carries evidence via the snapshot's per-
      // metric evidence chain (source table + timestamp).
      const snapshot = await buildBusinessSnapshot({ merchantSlug });
      const q = classifyBIQuestion(intent.question);
      const speak = answerBIQuestion(q, snapshot);
      if (!speak) {
        return {
          intent: intent.kind,
          speak:  "I can pull revenue, quotes, leads, reviews, social and overall health. Try \"how's business?\" or \"who owes me money?\"",
          suggestions: ["How's business?", "How much did I make this month?", "What should I improve?"]
        };
      }
      return {
        intent: intent.kind,
        speak,
        result: {
          health_score:  snapshot.score,
          band:          snapshot.band,
          computed_at:   snapshot.computed_at,
          observations:  snapshot.observations.slice(0, 5)
        },
        suggestions: ["What should I improve?", "Show my leads", "Show my reviews"]
      };
    }

    case "unknown":
    default: {
      const original = intent.kind === "unknown" ? intent.original : "";
      return { intent: "unknown", ...assessUnknownPrompt(original) };
    }
  }
}

function cap(id: string): string {
  return id.split(".")[1]?.split("-").map((s) => s[0].toUpperCase() + s.slice(1)).join(" ") ?? id;
}
