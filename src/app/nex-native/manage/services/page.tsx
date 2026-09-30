// src/app/nex-native/manage/services/page.tsx
//
// Bridge Services-C · sealed 2026-09-30 · seller editor for the
// nex_service table. Powers the ServiceList block on cover Templates
// 04 Tradesperson · 05 Salon · 09 Premium Business.

import type * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import {
  listServices,
  NEX_SERVICE_DESCRIPTION_MAX,
  NEX_SERVICE_FROM_PRICE_MAX,
  NEX_SERVICE_NAME_MAX,
  type NexServiceRow,
} from "@/lib/nex-native/service-list-service";
import {
  createServiceAction,
  deleteServiceAction,
  moveServiceAction,
  updateServiceAction,
} from "./_actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "#020914",
  panel: "#050f1e",
  border: "rgba(139, 169, 209, 0.18)",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0,175,255,0.5)",
  green: "#16D66B",
  red: "#FF3355",
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export default async function ManageServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; m?: string; ok?: string }>;
}) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const sp = await searchParams;
  const banner = sp.e && sp.m ? { code: sp.e, message: sp.m } : null;
  const okBanner = sp.ok === "1";

  const businesses = await businessService.listBusinessesByOwner(
    session.account.id,
  );
  if (businesses.length === 0) {
    redirect("/nex-native/onboarding?commerce=1");
  }
  const business = businesses[0];
  const services = await listServices(business.id);

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily: SANS,
        padding: "22px 18px 60px",
      }}
    >
      <div style={{ maxWidth: 780, margin: "0 auto" }}>
        <header style={{ marginBottom: 18 }}>
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: NEX.cyan,
              fontWeight: 700,
              marginBottom: 4,
            }}
          >
            Bridge Services-C · Founder-sealed 2026-09-30
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: "-0.01em",
            }}
          >
            Services
          </h1>
          <p
            style={{
              marginTop: 8,
              color: NEX.textDim,
              fontSize: 13,
              lineHeight: 1.55,
              maxWidth: 620,
            }}
          >
            Add the services you offer. Each row shows on your cover under a
            Services heading with the name, one-line description, and
            starting price. Sort order, edits, and deletes are live the
            moment you save.
          </p>
          <div style={{ marginTop: 10 }}>
            <Link
              href="/nex-native/manage/shop"
              style={{
                fontSize: 12,
                color: NEX.cyan,
                textDecoration: "none",
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              ‹ Back to /manage/shop
            </Link>
          </div>
        </header>

        {banner && (
          <div
            role="alert"
            style={{
              marginBottom: 14,
              padding: "10px 14px",
              borderRadius: 10,
              background: "rgba(255, 51, 85, 0.14)",
              border: `1px solid ${NEX.red}`,
              color: "#FFB4C0",
              fontSize: 13,
            }}
          >
            <strong style={{ textTransform: "uppercase", letterSpacing: "0.08em", fontSize: 10 }}>
              {banner.code}
            </strong>{" "}
            {banner.message}
          </div>
        )}
        {okBanner && (
          <div
            role="status"
            style={{
              marginBottom: 14,
              padding: "10px 14px",
              borderRadius: 10,
              background: "rgba(22, 214, 107, 0.12)",
              border: `1px solid ${NEX.green}`,
              color: "#8FF3C1",
              fontSize: 13,
            }}
          >
            Saved · your cover Services block has been updated.
          </div>
        )}

        {/* Add form */}
        <section
          style={{
            padding: "16px 18px",
            borderRadius: 14,
            border: `1px solid ${NEX.border}`,
            background: NEX.panel,
            marginBottom: 22,
          }}
        >
          <h2 style={h2Style()}>Add a service</h2>
          <form
            action={createServiceAction.bind(null, business.id)}
            style={{ display: "grid", gap: 12 }}
          >
            <label style={{ display: "grid", gap: 5 }}>
              <span style={eyebrowStyle()}>
                Name · required · max {NEX_SERVICE_NAME_MAX} chars
              </span>
              <input
                type="text"
                name="name"
                required
                maxLength={NEX_SERVICE_NAME_MAX}
                placeholder="e.g. Private catering"
                style={textInputStyle()}
              />
            </label>
            <label style={{ display: "grid", gap: 5 }}>
              <span style={eyebrowStyle()}>
                Description · max {NEX_SERVICE_DESCRIPTION_MAX} chars
              </span>
              <textarea
                name="description"
                maxLength={NEX_SERVICE_DESCRIPTION_MAX}
                rows={2}
                placeholder="One or two lines the buyer reads before enquiring."
                style={textAreaStyle()}
              />
            </label>
            <label style={{ display: "grid", gap: 5 }}>
              <span style={eyebrowStyle()}>
                From price · max {NEX_SERVICE_FROM_PRICE_MAX} chars · your own phrasing
              </span>
              <input
                type="text"
                name="from_price"
                maxLength={NEX_SERVICE_FROM_PRICE_MAX}
                placeholder="e.g. from Rp 1.2jt · £45 · on request"
                style={textInputStyle()}
              />
            </label>
            <button type="submit" style={primaryButtonStyle()}>
              Add service
            </button>
          </form>
        </section>

        {/* List */}
        <section>
          <h2 style={h2Style()}>
            Your services · {services.length}{" "}
            {services.length === 1 ? "row" : "rows"}
          </h2>
          {services.length === 0 && (
            <div
              style={{
                padding: "24px 16px",
                textAlign: "center",
                border: `1px dashed ${NEX.border}`,
                borderRadius: 12,
                color: NEX.textDim,
                fontSize: 13,
                lineHeight: 1.55,
              }}
            >
              No services yet. Add your first one above · the cover
              Services block hides itself until you have at least one.
            </div>
          )}
          <div style={{ display: "grid", gap: 14 }}>
            {services.map((s, idx) => (
              <ServiceCard
                key={s.id}
                businessId={business.id}
                service={s}
                isFirst={idx === 0}
                isLast={idx === services.length - 1}
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function ServiceCard({
  businessId,
  service,
  isFirst,
  isLast,
}: {
  businessId: string;
  service: NexServiceRow;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <article
      style={{
        padding: 14,
        borderRadius: 12,
        border: `1px solid ${NEX.border}`,
        background: NEX.panel,
        display: "grid",
        gap: 10,
      }}
    >
      <form
        action={updateServiceAction.bind(null, businessId, service.id)}
        style={{ display: "grid", gap: 10 }}
      >
        <label style={{ display: "grid", gap: 5 }}>
          <span style={eyebrowStyle()}>Name</span>
          <input
            type="text"
            name="name"
            required
            defaultValue={service.name}
            maxLength={NEX_SERVICE_NAME_MAX}
            style={textInputStyle()}
          />
        </label>
        <label style={{ display: "grid", gap: 5 }}>
          <span style={eyebrowStyle()}>Description</span>
          <textarea
            name="description"
            defaultValue={service.description}
            maxLength={NEX_SERVICE_DESCRIPTION_MAX}
            rows={2}
            style={textAreaStyle()}
          />
        </label>
        <label style={{ display: "grid", gap: 5 }}>
          <span style={eyebrowStyle()}>From price</span>
          <input
            type="text"
            name="from_price"
            defaultValue={service.from_price}
            maxLength={NEX_SERVICE_FROM_PRICE_MAX}
            style={textInputStyle()}
          />
        </label>
        <div>
          <button type="submit" style={primaryButtonStyle()}>
            Save
          </button>
        </div>
      </form>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {!isFirst && (
          <form
            action={moveServiceAction.bind(null, businessId, service.id, "up")}
          >
            <button type="submit" style={secondaryButtonStyle()}>
              ↑ Move up
            </button>
          </form>
        )}
        {!isLast && (
          <form
            action={moveServiceAction.bind(null, businessId, service.id, "down")}
          >
            <button type="submit" style={secondaryButtonStyle()}>
              ↓ Move down
            </button>
          </form>
        )}
        <form action={deleteServiceAction.bind(null, businessId, service.id)}>
          <button type="submit" style={dangerButtonStyle()}>
            Delete
          </button>
        </form>
      </div>
    </article>
  );
}

// ─── Style helpers ──────────────────────────────────────────────────

function h2Style(): React.CSSProperties {
  return {
    margin: 0,
    fontSize: 14,
    fontWeight: 800,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: NEX.cyan,
    marginBottom: 12,
  };
}

function eyebrowStyle(): React.CSSProperties {
  return {
    fontSize: 10,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: NEX.textDim,
    fontWeight: 700,
  };
}

function textInputStyle(): React.CSSProperties {
  return {
    appearance: "none",
    padding: "9px 12px",
    borderRadius: 8,
    border: `1px solid ${NEX.border}`,
    background: NEX.bg,
    color: NEX.text,
    fontFamily: SANS,
    fontSize: 13,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  };
}

function textAreaStyle(): React.CSSProperties {
  return {
    ...textInputStyle(),
    fontFamily: SANS,
    resize: "vertical",
    minHeight: 56,
  };
}

function primaryButtonStyle(): React.CSSProperties {
  return {
    appearance: "none",
    padding: "8px 14px",
    borderRadius: 8,
    border: "none",
    background: NEX.cyan,
    color: "#03101D",
    fontFamily: SANS,
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    cursor: "pointer",
  };
}

function secondaryButtonStyle(): React.CSSProperties {
  return {
    appearance: "none",
    padding: "8px 12px",
    borderRadius: 8,
    border: `1px solid ${NEX.cyanSoft}`,
    background: "transparent",
    color: NEX.cyan,
    fontFamily: SANS,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  };
}

function dangerButtonStyle(): React.CSSProperties {
  return {
    appearance: "none",
    padding: "8px 12px",
    borderRadius: 8,
    border: `1px solid ${NEX.red}`,
    background: "transparent",
    color: NEX.red,
    fontFamily: SANS,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  };
}
