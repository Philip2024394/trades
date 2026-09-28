// src/app/nex-native/manage/venue/page.tsx
//
// Bridge 23b · Restaurant / cafe / bar events profile + venue gallery
// editor. Owner-facing surface.
//
// This is where a venue owner declares WHAT their space can host
// (parties · outside catering · live music/DJ · private bookings · PA
// system · seating capacity) and uploads up to 6 photos of the venue
// itself. Buyers see these on the shop's About Us surface when they
// think about booking an event.
//
// URL: /nex-native/manage/venue
// Access: owner-only · redirects to /sign-in when signed-out and to
// /manage when the owner has no business yet.

import type * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import {
  updateBusinessEventsProfileAction,
  updateBusinessVenueGalleryAction,
  uploadVenuePhotoAction,
} from "../../_actions";
import {
  NEX_BUSINESS_EVENTS_EMPTY,
  isVenueCategory,
  type NexBusinessEventsProfile,
} from "@/lib/nex-native/types";
import { VenueGalleryEditor } from "./_venue-gallery-editor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NEX = {
  bg: "#020914",
  panel: "#050f1e",
  panelSoft: "rgba(6, 15, 28, 0.72)",
  border: "rgba(139, 169, 209, 0.14)",
  borderStrong: "rgba(139, 169, 209, 0.24)",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0,175,255,0.5)",
  orange: "#FF7200",
  orangeSoft: "rgba(255,114,0,0.6)",
  green: "#16D66B",
  amber: "#F59E0B",
};

const SERIF =
  "'Cormorant Garamond', 'EB Garamond', 'Playfair Display', Georgia, serif";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export const metadata = { title: "NEX · Venue profile" };

export default async function ManageVenuePage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; m?: string }>;
}) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in?next=/nex-native/manage/venue");
  const sp = await searchParams;
  const banner = sp.e && sp.m ? { code: sp.e, message: sp.m } : null;

  const businesses = await businessService.listBusinessesByOwner(
    session.account.id,
  );
  const business = businesses[0] ?? null;
  if (!business) {
    redirect("/nex-native/manage");
  }

  const events: NexBusinessEventsProfile = {
    ...NEX_BUSINESS_EVENTS_EMPTY,
    ...(business.events_profile ?? {}),
  };
  const gallery = business.venue_gallery ?? [];
  const isVenue = isVenueCategory(business.business_category);

  const eventsAction = updateBusinessEventsProfileAction.bind(null, business.id);
  const galleryAction = updateBusinessVenueGalleryAction.bind(
    null,
    business.id,
  );
  const uploadAction = uploadVenuePhotoAction.bind(null, business.id);

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily: SANS,
        paddingBottom: 80,
      }}
    >
      <header
        style={{
          padding: "calc(env(safe-area-inset-top, 0) + 14px) 16px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${NEX.border}`,
        }}
      >
        <Link
          href="/nex-native/manage"
          style={{
            fontSize: 11,
            color: NEX.textDim,
            textDecoration: "none",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          ← Back to manage
        </Link>
        <Link
          href={`/nex-native/${business.slug}`}
          style={{
            fontSize: 11,
            color: NEX.cyan,
            textDecoration: "none",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          Preview →
        </Link>
      </header>

      <main
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "28px 16px 40px",
          display: "flex",
          flexDirection: "column",
          gap: 26,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.32em",
              textTransform: "uppercase",
              color: NEX.orange,
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            🎉 Venue &amp; events
          </div>
          <h1
            style={{
              margin: 0,
              fontFamily: SERIF,
              fontSize: 34,
              lineHeight: 1.08,
              letterSpacing: "-0.015em",
              fontWeight: 500,
              marginBottom: 8,
            }}
          >
            Tell buyers what your space can host
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              lineHeight: 1.6,
              color: NEX.textDim,
            }}
          >
            When someone is thinking about a birthday · a corporate dinner
            · a wedding tasting · a Friday-night DJ set, these details
            are the first thing they check. Fill them in once and every
            visitor sees them.
          </p>
          {!isVenue && (
            <div
              style={{
                marginTop: 12,
                padding: "10px 14px",
                borderRadius: 10,
                background: "rgba(245,158,11,0.10)",
                border: "1px solid rgba(245,158,11,0.30)",
                color: "#FCD9A8",
                fontSize: 12,
                lineHeight: 1.5,
              }}
            >
              Your shop category isn&apos;t a venue category (restaurant ·
              cafe · bar · event space etc). You can still fill in these
              fields · your About page will show them only if at least
              one is set.
            </div>
          )}
        </div>

        {banner && (
          <div
            role="status"
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              background: banner.code.endsWith("_ok")
                ? "rgba(22,214,107,0.10)"
                : "rgba(255,51,85,0.10)",
              border: `1px solid ${
                banner.code.endsWith("_ok")
                  ? "rgba(22,214,107,0.35)"
                  : "rgba(255,51,85,0.35)"
              }`,
              color: banner.code.endsWith("_ok") ? "#B8F1CC" : "#FFB4C0",
              fontSize: 13,
            }}
          >
            {banner.message}
          </div>
        )}

        {/* --- Events profile form ------------------------------------- */}
        <form
          action={eventsAction}
          style={{
            padding: "20px 20px",
            borderRadius: 18,
            background: NEX.panelSoft,
            border: `1px solid ${NEX.borderStrong}`,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <SectionEyebrow>Event hosting</SectionEyebrow>
          <YesNoRow
            name="hosts_parties"
            label="Do you host parties?"
            defaultChecked={events.hosts_parties ?? false}
            hint="Birthdays · anniversaries · celebrations of any kind."
          />
          <NumberRow
            name="seat_capacity"
            label="How many people can you seat?"
            defaultValue={events.seat_capacity ?? null}
            hint="Total number of covers · leave blank if you don't want to share."
          />
          <YesNoRow
            name="outside_catering"
            label="Do you cater outside events?"
            defaultChecked={events.outside_catering ?? false}
            hint="Off-premises catering for weddings, offices, film sets."
          />
          <YesNoRow
            name="has_live_music_or_dj"
            label="Do you have live music or a DJ?"
            defaultChecked={events.has_live_music_or_dj ?? false}
            hint="Regular acts or DJ nights on your calendar."
          />
          <YesNoRow
            name="can_book_private_party"
            label="Can guests book a private party?"
            defaultChecked={events.can_book_private_party ?? false}
            hint="A private room or full buy-out for exclusive events."
          />
          <YesNoRow
            name="has_sound_system_pa"
            label="Do you have a sound system / PA?"
            defaultChecked={events.has_sound_system_pa ?? false}
            hint="Microphones, speakers, event lighting available."
          />
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <span
              style={{
                fontSize: 10,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: NEX.cyan,
                fontWeight: 700,
              }}
            >
              Anything else worth knowing
            </span>
            <textarea
              name="other_event_info"
              rows={4}
              maxLength={1000}
              defaultValue={events.other_event_info ?? ""}
              placeholder="Minimum spend for private hire · parking · dietary accommodation · noise curfew · anything a party planner would ask about."
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                background: "rgba(0,0,0,0.35)",
                border: `1px solid ${NEX.border}`,
                color: NEX.text,
                fontSize: 13,
                lineHeight: 1.55,
                fontFamily: SANS,
                resize: "vertical",
                outline: "none",
              }}
            />
          </label>
          <button
            type="submit"
            style={{
              alignSelf: "flex-start",
              padding: "10px 18px",
              borderRadius: 12,
              background: "linear-gradient(180deg, #FF9033 0%, #FF7200 100%)",
              border: `1px solid ${NEX.orangeSoft}`,
              color: "#0B0F1A",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: "pointer",
              fontFamily: SANS,
              boxShadow:
                "0 10px 24px rgba(255,114,0,0.35), inset 0 1px 0 rgba(255,255,255,0.28)",
            }}
          >
            Save event profile
          </button>
        </form>

        {/* --- Venue gallery form ------------------------------------- */}
        <form
          action={galleryAction}
          style={{
            padding: "20px 20px",
            borderRadius: 18,
            background: NEX.panelSoft,
            border: `1px solid ${NEX.borderStrong}`,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <SectionEyebrow>Venue photos (up to 6)</SectionEyebrow>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              lineHeight: 1.55,
              color: NEX.textDim,
            }}
          >
            Add up to 6 photos of your venue · dining room, private space,
            the sound stage, the outside catering setup. Upload from your
            phone or computer, or paste a URL. The first slot is your
            cover.
          </p>
          <VenueGalleryEditor
            initialUrls={gallery}
            uploadAction={uploadAction}
          />
          <button
            type="submit"
            style={{
              alignSelf: "flex-start",
              padding: "10px 18px",
              borderRadius: 12,
              background: "linear-gradient(180deg, #FF9033 0%, #FF7200 100%)",
              border: `1px solid ${NEX.orangeSoft}`,
              color: "#0B0F1A",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: "pointer",
              fontFamily: SANS,
              boxShadow:
                "0 10px 24px rgba(255,114,0,0.35), inset 0 1px 0 rgba(255,255,255,0.28)",
            }}
          >
            Save gallery
          </button>
        </form>
      </main>
    </div>
  );
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        letterSpacing: "0.32em",
        textTransform: "uppercase",
        color: NEX.cyan,
        fontWeight: 700,
      }}
    >
      {children}
    </div>
  );
}

function YesNoRow({
  name,
  label,
  hint,
  defaultChecked,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultChecked: boolean;
}) {
  // Native <select> with two options so we get a proper dropdown UX
  // per Founder direction ("options should be drop down"). The form
  // action reads the value === "yes".
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "10px 12px",
        borderRadius: 12,
        background: "rgba(0,0,0,0.28)",
        border: `1px solid ${NEX.border}`,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: NEX.text,
          }}
        >
          {label}
        </div>
        {hint && (
          <div
            style={{
              fontSize: 11,
              color: NEX.textMute,
              lineHeight: 1.5,
              marginTop: 2,
            }}
          >
            {hint}
          </div>
        )}
      </div>
      <YesNoSelect name={name} defaultChecked={defaultChecked} />
    </div>
  );
}

function YesNoSelect({
  name,
  defaultChecked,
}: {
  name: string;
  defaultChecked: boolean;
}) {
  // We name the checkbox-equivalent input `${name}` and check "on" on
  // the server so a standard HTML checkbox behaviour applies · but
  // present it visually as a dropdown by using a hidden checkbox +
  // pair of radios. Simpler: use a real <input type="checkbox">
  // styled as a compact toggle · form action still reads "on".
  // Founder said "drop down" · a select with Yes/No fits that ask
  // better than a checkbox visually. We use a hidden checkbox that
  // mirrors the select's value so the existing action stays as-is.
  return (
    <div
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
      }}
    >
      <select
        name={`${name}_select`}
        defaultValue={defaultChecked ? "yes" : "no"}
        style={{
          padding: "8px 26px 8px 12px",
          borderRadius: 999,
          background: "rgba(0,0,0,0.35)",
          border: `1px solid ${NEX.borderStrong}`,
          color: NEX.text,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          fontFamily: SANS,
          outline: "none",
          appearance: "none",
          WebkitAppearance: "none",
          MozAppearance: "none",
          cursor: "pointer",
          minWidth: 90,
        }}
        // Native onChange is not allowed on server-rendered <select>
        // in a Server Component form, but the checkbox trick below
        // handles submission. The select is a UX helper · the hidden
        // checkbox stays in sync via a tiny client shim (below).
      >
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
      {/* Hidden checkbox with the actual name the server action
          reads · a small script keeps its checked state matched to
          the select. If JS is disabled, the checkbox default holds. */}
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        style={{ display: "none" }}
        data-nex-events-checkbox={name}
      />
      <span
        aria-hidden
        style={{
          position: "absolute",
          right: 10,
          top: "50%",
          transform: "translateY(-50%)",
          fontSize: 10,
          color: NEX.textDim,
          pointerEvents: "none",
        }}
      >
        ▾
      </span>
      <YesNoSyncScript />
    </div>
  );
}

/** Tiny inline client-side listener that mirrors the <select> value
 *  into the sibling hidden checkbox so the server action reads a
 *  standard "on" / absent field. Runs once per YesNoSelect · idempotent. */
function YesNoSyncScript() {
  const js = `
    (function(){
      var selects = document.querySelectorAll('select[name$="_select"]');
      selects.forEach(function(s){
        if (s.dataset.nexBound === '1') return;
        s.dataset.nexBound = '1';
        var name = s.name.replace(/_select$/, '');
        var box = s.parentElement && s.parentElement.querySelector('[data-nex-events-checkbox="' + name + '"]');
        if (!box) return;
        function sync(){ box.checked = s.value === 'yes'; }
        sync();
        s.addEventListener('change', sync);
      });
    })();
  `;
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}

function NumberRow({
  name,
  label,
  hint,
  defaultValue,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultValue: number | null;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        borderRadius: 12,
        background: "rgba(0,0,0,0.28)",
        border: `1px solid ${NEX.border}`,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: NEX.text }}>
          {label}
        </div>
        {hint && (
          <div
            style={{
              fontSize: 11,
              color: NEX.textMute,
              lineHeight: 1.5,
              marginTop: 2,
            }}
          >
            {hint}
          </div>
        )}
      </div>
      <input
        type="number"
        name={name}
        min={0}
        max={5000}
        defaultValue={defaultValue ?? ""}
        inputMode="numeric"
        placeholder="—"
        style={{
          width: 90,
          padding: "8px 12px",
          borderRadius: 999,
          background: "rgba(0,0,0,0.35)",
          border: `1px solid ${NEX.borderStrong}`,
          color: NEX.text,
          fontSize: 13,
          fontWeight: 700,
          textAlign: "center",
          fontFamily: SANS,
          outline: "none",
        }}
      />
    </div>
  );
}

