// src/components/nex-app/detail/EntityDetailView.tsx
//
// NEX Universal Discovery Slice · EntityDetailView + InterestedFlow
// Philip 2026-09-06 · CEREMONIAL AUTHORIZE
//
// PURPOSE (§8 · §11 · §12 · §14 · §15 · §16)
//   Universal entity detail experience · gallery + adaptive sections
//   + Interested button + edit-before-send draft flow. Vertical-
//   agnostic shell; sections adapt via the EntityDetail contract.
//
// TRUTH RULE (§4 · §6 · §14 · §23)
//   Only KNOWN_YES / UNVERIFIED / CONFLICTING / STALE rows render.
//   Interested draft never invents an attribute. No user contact info
//   surfaces to the owner beyond the message body.

"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MapPin, Phone, MessageCircle, Globe, MailPlus, Star, Check, AlertTriangle,
  ChevronLeft, Send, Pencil, X, Home,
} from "lucide-react";
import type { EntityDetail, DetailSection, DetailRow } from "@/lib/nex/brain/universal-discovery/entity-detail-contract";
import { buildInterestedPrefill } from "@/lib/nex/brain/universal-discovery/interested-message";
import {
  addOutboxItem, loadOutbox, saveOutbox, newItemId, itemsForEntity,
  type InterestOutboxItem,
} from "@/lib/nex/brain/universal-discovery/interest-outbox";
// NEX Phase 3 · mount Entity Live on the real entity detail page
import { EntityLiveCarousel, type EntityLiveCard } from "@/components/nex-app/live/EntityLiveCarousel";

// ─── Public component ─────────────────────────────────────────

export function EntityDetailView({
  detail,
  liveCards,
}: {
  detail: EntityDetail;
  /** NEX Phase 3 · optional Live carousel data supplied by the server
   *  page. `null` = no query ran (renderer suppresses the section).
   *  Empty array = query ran and honestly found nothing (renderer
   *  surfaces the honest empty state so the entity page proves the
   *  Live surface exists even when the entity has no Live sessions).
   */
  liveCards?: readonly EntityLiveCard[] | null;
}) {
  // World-Class Result Card Interaction & Entity Detail Slice
  // (Philip 2026-09-06 · CEREMONIAL AUTHORIZE §9 · §11)
  //
  // Fire a beacon telling the server "the user opened this entity's
  // detail page in the active conversation." The server records this on
  // session.viewedEntity so subsequent chat turns can resolve "does it
  // have a pool?" / "what about parking?" against the entity the user
  // was just viewing.
  //
  // Fire-and-forget · never blocks render · silently skips when no
  // active conversation_id exists in localStorage (fresh browser · no
  // prior chat turn). Never fabricates state.
  useEffect(() => {
    let cancelled = false;
    try {
      const conversationId = window.localStorage.getItem("nex.universal-discovery.active-conversation-id");
      if (!conversationId) return;
      const payload = {
        conversation_id: conversationId,
        ref_id: detail.ref_id,
        vertical: detail.vertical,
        name: detail.name,
      };
      fetch("/api/nex-conv/session/view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => { /* silent · beacon is best-effort */ });
    } catch { /* localStorage blocked · silent */ }
    return () => { cancelled = true; };
  }, [detail.ref_id, detail.vertical, detail.name]);

  return (
    <div
      className="relative mx-auto flex min-h-screen max-w-md flex-col bg-[var(--nex-cream,#FDFCF9)] pb-24"
      data-testid="nex-entity-detail-root"
      data-scope="phone-frame"
    >
      <DetailHeader name={detail.name} />
      <ImageGallery images={detail.images} entityName={detail.name} />
      <NameBlock detail={detail} />
      {detail.summary && <SummaryBlock summary={detail.summary} />}
      {liveCards !== null && liveCards !== undefined && (
        <EntityLiveSection entityName={detail.name} cards={liveCards} />
      )}
      {detail.sections.map((s) => (
        <SectionBlock key={s.id} section={s} />
      ))}
      <ContactBlock detail={detail} />
      <TrustBlock trust={detail.trust} />
      <InterestedFlow detail={detail} />
    </div>
  );
}

// ─── Entity Live section (Phase 3) ────────────────────────────
//
// The carousel component owns its own empty state · we wrap it in a
// dark surface so the tall 9:16 cards read against the cream page.
// When the fixture roster returns zero, we still surface the honest
// empty state so the Live axis is discoverable from every entity.

function EntityLiveSection({
  entityName,
  cards,
}: {
  entityName: string;
  cards: readonly EntityLiveCard[];
}) {
  return (
    <div className="bg-neutral-950 text-white">
      <EntityLiveCarousel
        entity_name={entityName}
        cards={cards}
        emptyLabel="No Live from this place right now."
      />
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────

function DetailHeader({ name }: { name: string }) {
  const router = useRouter();
  return (
    <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-black/5 bg-[var(--nex-cream,#FDFCF9)]/95 px-3 py-2 backdrop-blur">
      <button
        type="button"
        onClick={() => router.back()}
        className="grid h-9 w-9 place-items-center rounded-full text-[var(--nex-neutral-700,#444)] transition hover:bg-black/[0.06]"
        aria-label="Back"
      >
        <ChevronLeft size={20} strokeWidth={2.2} />
      </button>
      <div className="min-w-0 flex-1 truncate text-[14px] font-semibold text-[var(--nex-neutral-900,#111)]">
        {name}
      </div>
      <Link
        href="/nex-appchat"
        className="grid h-9 w-9 place-items-center rounded-full text-[var(--nex-neutral-700,#444)] transition hover:bg-black/[0.06]"
        aria-label="Home"
      >
        <Home size={18} strokeWidth={2.2} />
      </Link>
    </div>
  );
}

// ─── Image gallery ─────────────────────────────────────────────

function ImageGallery({ images, entityName }: { images: EntityDetail["images"]; entityName: string }) {
  const [active, setActive] = useState(0);
  if (images.length === 0) {
    return (
      <div
        className="aspect-[16/10] w-full"
        style={{ background: "linear-gradient(135deg, rgba(249,115,22,0.10) 0%, rgba(249,115,22,0.02) 100%)" }}
        aria-hidden
      />
    );
  }
  const shown = images[Math.min(active, images.length - 1)];
  return (
    <div className="w-full">
      <div
        className="aspect-[16/10] w-full bg-cover bg-center"
        style={{ backgroundImage: `url(${JSON.stringify(shown.url)})` }}
        role="img"
        aria-label={shown.alt || entityName}
        data-testid="entity-detail-hero-image"
      />
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto px-3 py-2" data-testid="entity-detail-gallery">
          {images.map((img, i) => (
            <button
              key={img.url + i}
              type="button"
              onClick={() => setActive(i)}
              className={`h-14 w-20 flex-shrink-0 overflow-hidden rounded-lg border ${i === active ? "border-orange-500" : "border-black/10"}`}
              aria-label={`Image ${i + 1} of ${images.length}`}
            >
              <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${JSON.stringify(img.url)})` }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Name / location / trust badge ─────────────────────────────

function NameBlock({ detail }: { detail: EntityDetail }) {
  return (
    <div className="border-b border-black/5 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[20px] font-semibold leading-tight text-[var(--nex-neutral-900,#111)]" data-testid="entity-detail-name">
            {detail.name}
          </div>
          {detail.category && (
            <div className="mt-0.5 text-[12px] uppercase tracking-wide text-[var(--nex-neutral-500,#666)]">
              {detail.category}
            </div>
          )}
          {detail.location && (
            <div className="mt-1 flex items-center gap-1 text-[13px] text-[var(--nex-neutral-700,#444)]">
              <MapPin size={13} strokeWidth={2.2} aria-hidden />
              <span>{detail.location}</span>
            </div>
          )}
        </div>
        {detail.card?.rating !== undefined && (
          <div className="flex items-baseline gap-0.5 text-[14px] text-[var(--nex-neutral-900,#111)]">
            <Star size={13} strokeWidth={2.4} fill="currentColor" aria-hidden />
            <span className="font-semibold">{detail.card.rating.toFixed(1)}</span>
          </div>
        )}
      </div>
      {detail.trust.owner_verified && (
        <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-800">
          <Check size={11} strokeWidth={2.6} aria-hidden />
          Owner-verified
        </div>
      )}
    </div>
  );
}

// ─── Summary ───────────────────────────────────────────────────

function SummaryBlock({ summary }: { summary: string }) {
  return (
    <div className="border-b border-black/5 px-4 py-3 text-[14px] leading-relaxed text-[var(--nex-neutral-800,#333)]">
      {summary}
    </div>
  );
}

// ─── Detail section (adaptive per vertical) ────────────────────

function SectionBlock({ section }: { section: DetailSection }) {
  return (
    <div className="border-b border-black/5 px-4 py-3" data-testid={`entity-detail-section-${section.id}`}>
      <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--nex-neutral-500,#666)]">
        {section.title}
      </div>
      <div className="space-y-1.5">
        {section.rows.map((row) => (
          <DetailRowLine key={row.key} row={row} />
        ))}
      </div>
    </div>
  );
}

function DetailRowLine({ row }: { row: DetailRow }) {
  const stateColor = row.state === "KNOWN_YES" ? "text-[var(--nex-neutral-900,#111)]"
                   : row.state === "STALE"       ? "text-amber-800"
                   : row.state === "CONFLICTING" ? "text-orange-800"
                   : "text-[var(--nex-neutral-700,#444)]";
  return (
    <div className="flex items-baseline justify-between gap-2 text-[13px]">
      <span className={stateColor}>{row.label}</span>
      <span className={`font-medium ${stateColor}`}>
        {row.value}
        {row.state !== "KNOWN_YES" && row.source_hint && (
          <span className="ml-1 text-[10px] uppercase tracking-wide text-[var(--nex-neutral-500,#666)]">
            · {row.source_hint}
          </span>
        )}
      </span>
    </div>
  );
}

// ─── Contact block ─────────────────────────────────────────────

function ContactBlock({ detail }: { detail: EntityDetail }) {
  const { contact } = detail;
  const anyContact = !!(contact.phone || contact.whatsapp || contact.website);
  if (!anyContact) return null;
  return (
    <div className="border-b border-black/5 px-4 py-3">
      <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--nex-neutral-500,#666)]">
        Contact
      </div>
      <div className="flex flex-wrap gap-2">
        {contact.phone && (
          <a
            href={`tel:${contact.phone.value}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1.5 text-[12px] font-medium text-[var(--nex-neutral-900,#111)] hover:border-orange-300"
          >
            <Phone size={13} strokeWidth={2.2} />
            Call
          </a>
        )}
        {contact.whatsapp && (
          <a
            href={`https://wa.me/${contact.whatsapp.value.replace(/\D/g, "")}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1.5 text-[12px] font-medium text-[var(--nex-neutral-900,#111)] hover:border-orange-300"
          >
            <MessageCircle size={13} strokeWidth={2.2} />
            WhatsApp
          </a>
        )}
        {contact.website && (
          <a
            href={contact.website.value}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1.5 text-[12px] font-medium text-[var(--nex-neutral-900,#111)] hover:border-orange-300"
          >
            <Globe size={13} strokeWidth={2.2} />
            Website
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Trust block ───────────────────────────────────────────────

function TrustBlock({ trust }: { trust: EntityDetail["trust"] }) {
  return (
    <div className="border-b border-black/5 px-4 py-2 text-[11px] text-[var(--nex-neutral-500,#666)]">
      Source: {trust.primary_source}
      {trust.is_stale && (
        <span className="ml-1.5 inline-flex items-center gap-0.5 text-amber-700">
          <AlertTriangle size={10} strokeWidth={2.4} /> some info may be out of date
        </span>
      )}
    </div>
  );
}

// ─── Interested flow ──────────────────────────────────────────

export function InterestedFlow({ detail }: { detail: EntityDetail }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [sent, setSent] = useState<null | { at: string; id: string }>(null);
  const [priorSentCount, setPriorSentCount] = useState(0);

  const prefill = useMemo(() => buildInterestedPrefill({ detail, lang: "EN" }), [detail]);

  // On open · pre-fill the message from the deterministic composer
  useEffect(() => {
    if (open && message.length === 0) setMessage(prefill.message);
  }, [open, message.length, prefill.message]);

  // On mount · count any prior outbox items for this entity
  useEffect(() => {
    setPriorSentCount(itemsForEntity(loadOutbox(), detail.ref_id).length);
  }, [detail.ref_id]);

  if (!detail.interested_enabled) {
    return (
      <div className="mt-6 px-4 text-center text-[12px] text-[var(--nex-neutral-500,#666)]">
        No verified contact yet — check back soon.
      </div>
    );
  }

  const send = () => {
    if (message.trim().length === 0) return;
    const item: InterestOutboxItem = {
      id: newItemId(),
      entity_ref_id: detail.ref_id,
      entity_name: detail.name,
      vertical: detail.vertical,
      message: message.trim(),
      created_at: new Date().toISOString(),
      status: "PENDING_LOCAL",
      language: prefill.language,
      entity_snapshot: {
        name: detail.name,
        location: detail.location ?? null,
        category: detail.category ?? null,
        primary_source: detail.trust.primary_source,
      },
    };
    const prior = loadOutbox();
    const next = addOutboxItem(prior, item);
    saveOutbox(next);
    setSent({ at: item.created_at, id: item.id });
    setOpen(false);
    setPriorSentCount((c) => c + 1);
  };

  return (
    <div className="mt-4 px-4">
      {sent && (
        <div className="mb-3 rounded-xl border border-green-200 bg-green-50 p-3 text-[13px] text-green-800" data-testid="interested-sent-toast">
          <div className="flex items-start gap-2">
            <Check size={16} strokeWidth={2.4} className="mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold">Message queued for the owner</div>
              <div className="mt-0.5 text-[12px]">Saved on this device.</div>
            </div>
          </div>
        </div>
      )}
      {priorSentCount > 0 && !sent && (
        <div className="mb-3 rounded-xl border border-black/10 bg-white p-3 text-[12px] text-[var(--nex-neutral-700,#444)]" data-testid="interested-prior-toast">
          You already messaged this owner {priorSentCount} time{priorSentCount === 1 ? "" : "s"} from this device.
        </div>
      )}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 py-3 text-[15px] font-semibold text-white shadow-sm transition hover:bg-orange-600 active:bg-orange-700"
          data-testid="interested-button"
        >
          <MailPlus size={16} strokeWidth={2.4} />
          I&apos;m interested
        </button>
      )}
      {open && (
        <div className="rounded-2xl border border-black/10 bg-white p-3" data-testid="interested-draft">
          <div className="mb-1 flex items-center justify-between">
            <div className="text-[12px] font-semibold uppercase tracking-wide text-[var(--nex-neutral-500,#666)]">Message to owner</div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="grid h-7 w-7 place-items-center rounded-full text-[var(--nex-neutral-500,#666)] hover:bg-black/[0.06]"
              aria-label="Cancel"
            >
              <X size={14} strokeWidth={2.4} />
            </button>
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="w-full resize-none rounded-xl border border-black/10 bg-white p-2 text-[14px] leading-relaxed text-[var(--nex-neutral-900,#111)] outline-none focus:border-orange-400"
            aria-label="Message to owner (editable)"
            data-testid="interested-textarea"
          />
          <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--nex-neutral-500,#666)]">
            <span className="inline-flex items-center gap-1">
              <Pencil size={11} strokeWidth={2.2} />
              You can edit before sending
            </span>
            <button
              type="button"
              onClick={send}
              disabled={message.trim().length === 0}
              className="inline-flex items-center gap-1.5 rounded-full bg-orange-500 px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:opacity-50"
              data-testid="interested-send"
            >
              <Send size={13} strokeWidth={2.4} />
              Send
            </button>
          </div>
          <div className="mt-1 text-[10px] text-[var(--nex-neutral-500,#666)]">
            The owner receives your message and the listing you were viewing. Your personal contact details are not shared.
          </div>
        </div>
      )}
    </div>
  );
}
