// src/app/nex-native/manage/menu/page.tsx
//
// Bridge 15b · Menu editor for restaurant + cafe sellers.
// -------------------------------------------------------
// Reads the current owner's first business + menu bundle, renders
// section CRUD + item CRUD forms. Server Component with all mutations
// via bound Server Actions.
//
// Doctrine kept:
//   · Chat is still the order path · this surface just curates what
//     visitors see and taps into /nex-native/[slug]/menu.
//   · Availability toggle is not delete · sold-out today just carries
//     a red pill on the public page.
//   · Featured is chef's-choice · surfaces as star pill + gets picked
//     for the landing MenuPreviewCard.

import type * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import * as menuService from "@/lib/nex-native/menu-service";
import {
  NEX_MENU_DIETARY_TAGS,
  NEX_MENU_ALLERGENS,
} from "@/lib/nex-native/menu-service";
import {
  createMenuSectionAction,
  updateMenuSectionAction,
  deleteMenuSectionAction,
  createMenuItemAction,
  toggleMenuItemAvailableAction,
  toggleMenuItemFeaturedAction,
  deleteMenuItemAction,
} from "../../_actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  red: "#FF3355",
};

const SPICE_LABEL: Record<number, string> = {
  0: "None",
  1: "Mild",
  2: "Medium",
  3: "Hot",
};

export default async function ManageMenuPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; m?: string; add_to?: string }>;
}) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const sp = await searchParams;
  const banner = sp.e && sp.m ? { code: sp.e, message: sp.m } : null;
  const addToSectionId = sp.add_to ?? null;

  const businesses = await businessService.listBusinessesByOwner(
    session.account.id,
  );
  const business = businesses[0] ?? null;

  if (!business) {
    return (
      <NoShopEmptyState />
    );
  }

  const [sections, allItems] = await Promise.all([
    menuService.listSectionsByBusiness(business.id),
    menuService.listMenuItemsByBusiness(business.id),
  ]);
  const itemsBySection = new Map<string, typeof allItems>();
  const uncategorised: typeof allItems = [];
  for (const it of allItems) {
    if (it.section_id) {
      const arr = itemsBySection.get(it.section_id) ?? [];
      arr.push(it);
      itemsBySection.set(it.section_id, arr);
    } else {
      uncategorised.push(it);
    }
  }

  const createSectionBound = createMenuSectionAction.bind(null, business.id);
  const createItemBound = createMenuItemAction.bind(null, business.id);

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: 60,
      }}
    >
      {/* --- Top bar ---------------------------------------------------- */}
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
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: NEX.textDim,
            textDecoration: "none",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.04em",
          }}
        >
          ← Manage
        </Link>
        <Link
          href={`/nex-native/${business.slug}/menu`}
          style={{
            fontSize: 11,
            color: NEX.cyan,
            textDecoration: "none",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          View menu ↗
        </Link>
      </header>

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px" }}>
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: NEX.orange,
            fontWeight: 700,
            marginBottom: 6,
          }}
        >
          Menu editor
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            marginBottom: 6,
          }}
        >
          {business.display_name}
        </h1>
        <p
          style={{
            margin: "0 0 24px",
            fontSize: 13,
            color: NEX.textDim,
            lineHeight: 1.55,
          }}
        >
          Sections group your menu · Starters, Mains, Drinks. Dishes live
          inside sections. Toggle a dish to <b>sold out</b> for the day
          without deleting it · star the ones you want on the shop
          landing preview.
        </p>

        {banner && <Banner code={banner.code} message={banner.message} />}

        {/* --- New section form ---------------------------------------- */}
        <SectionCard>
          <SectionEyebrow color={NEX.cyan}>New section</SectionEyebrow>
          <h2 style={h2Style}>Add a menu section</h2>
          <form
            action={createSectionBound}
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            <FormRow label="Name">
              <input
                type="text"
                name="name"
                required
                maxLength={80}
                placeholder="Starters · Mains · Drinks · Sweets"
                style={inputStyle}
              />
            </FormRow>
            <FormRow label="Description (optional)">
              <input
                type="text"
                name="description"
                maxLength={280}
                placeholder="What's this section about?"
                style={inputStyle}
              />
            </FormRow>
            <FormRow label="Sort order">
              <input
                type="number"
                name="sort_order"
                defaultValue={sections.length * 10}
                min={0}
                max={9999}
                style={{ ...inputStyle, maxWidth: 120 }}
              />
            </FormRow>
            <SubmitButton label="Add section" tone="primary" />
          </form>
        </SectionCard>

        {/* --- Sections list ------------------------------------------- */}
        {sections.length === 0 && uncategorised.length === 0 ? (
          <EmptyMenuState />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {sections.map((section) => (
              <MenuSectionBlock
                key={section.id}
                section={section}
                items={itemsBySection.get(section.id) ?? []}
                isAddOpen={addToSectionId === section.id}
                createItemAction={createItemBound}
              />
            ))}

            {uncategorised.length > 0 && (
              <MenuSectionBlock
                key="_uncategorised"
                section={null}
                items={uncategorised}
                isAddOpen={addToSectionId === "_uncategorised"}
                createItemAction={createItemBound}
              />
            )}
          </div>
        )}

        {/* --- Global add item (no section) ---------------------------- */}
        <SectionCard>
          <SectionEyebrow color={NEX.orange}>New dish · no section</SectionEyebrow>
          <h2 style={h2Style}>Add a dish without a section</h2>
          <p style={pDimStyle}>
            Useful for single-item drinks lists or before you&apos;ve set up
            sections. You can always move it into a section later.
          </p>
          <ItemForm
            sectionId={null}
            action={createItemBound}
          />
        </SectionCard>
      </main>
    </div>
  );
}

/* --------------------------------------------------------------------- *
 * Section block · header + items list + inline add-item form            *
 * --------------------------------------------------------------------- */

function MenuSectionBlock({
  section,
  items,
  isAddOpen,
  createItemAction,
}: {
  section: import("@/lib/nex-native/menu-service").NexMenuSectionRow | null;
  items: import("@/lib/nex-native/menu-service").NexMenuItemRow[];
  isAddOpen: boolean;
  createItemAction: (formData: FormData) => Promise<never>;
}) {
  const sectionName = section?.name ?? "Uncategorised";
  const sectionId = section?.id ?? "_uncategorised";
  const isReal = section !== null;

  return (
    <section
      style={{
        padding: "18px 20px",
        borderRadius: 18,
        background: NEX.panelSoft,
        border: `1px solid ${isReal ? NEX.borderStrong : NEX.border}`,
        boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
      }}
    >
      {/* Section header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: isReal ? 14 : 4,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: isReal ? NEX.cyan : NEX.textMute,
              fontWeight: 700,
              marginBottom: 4,
            }}
          >
            Section {isReal ? "" : "· uncategorised"}
          </div>
          <h3
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "-0.005em",
            }}
          >
            {sectionName}
          </h3>
          {section?.description && (
            <p
              style={{
                margin: "4px 0 0",
                fontSize: 12,
                color: NEX.textDim,
                lineHeight: 1.55,
              }}
            >
              {section.description}
            </p>
          )}
        </div>

        {isReal && (
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <details>
              <summary
                style={{
                  ...pillButtonStyle,
                  listStyle: "none",
                  cursor: "pointer",
                }}
              >
                Edit
              </summary>
              <div
                style={{
                  position: "absolute",
                  marginTop: 8,
                  right: 20,
                  padding: 14,
                  minWidth: 260,
                  background: NEX.panel,
                  border: `1px solid ${NEX.borderStrong}`,
                  borderRadius: 12,
                  boxShadow: "0 20px 40px rgba(0,0,0,0.55)",
                  zIndex: 10,
                }}
              >
                <form
                  action={updateMenuSectionAction.bind(null, section.id)}
                  style={{ display: "flex", flexDirection: "column", gap: 10 }}
                >
                  <FormRow label="Name">
                    <input
                      type="text"
                      name="name"
                      defaultValue={section.name}
                      maxLength={80}
                      required
                      style={inputStyle}
                    />
                  </FormRow>
                  <FormRow label="Description">
                    <input
                      type="text"
                      name="description"
                      defaultValue={section.description ?? ""}
                      maxLength={280}
                      style={inputStyle}
                    />
                  </FormRow>
                  <SubmitButton label="Save" tone="primary" />
                </form>
              </div>
            </details>
            <form action={deleteMenuSectionAction.bind(null, section.id)}>
              <button
                type="submit"
                style={{
                  ...pillButtonStyle,
                  color: NEX.red,
                  borderColor: "rgba(255,51,85,0.35)",
                }}
              >
                Delete
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Items list */}
      {items.length === 0 ? (
        <div
          style={{
            padding: "16px 12px",
            textAlign: "center",
            color: NEX.textMute,
            fontSize: 12,
            border: `1px dashed ${NEX.border}`,
            borderRadius: 10,
            marginBottom: 12,
          }}
        >
          No dishes in this section yet.
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginBottom: 12,
          }}
        >
          {items.map((item) => (
            <ItemRow key={item.id} item={item} />
          ))}
        </div>
      )}

      {/* Add item · collapsed toggle + open form */}
      {isAddOpen ? (
        <div
          style={{
            marginTop: 6,
            padding: 14,
            borderRadius: 12,
            background: "rgba(255,114,0,0.06)",
            border: `1px solid ${NEX.orangeSoft}`,
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: NEX.orange,
              fontWeight: 700,
              marginBottom: 10,
            }}
          >
            New dish in {sectionName}
          </div>
          <ItemForm sectionId={section?.id ?? null} action={createItemAction} />
        </div>
      ) : (
        <Link
          href={`/nex-native/manage/menu?add_to=${sectionId}#add-${sectionId}`}
          id={`add-${sectionId}`}
          style={{
            display: "block",
            padding: "10px 12px",
            borderRadius: 10,
            background: "rgba(255,114,0,0.08)",
            border: `1px dashed ${NEX.orangeSoft}`,
            color: NEX.orange,
            textDecoration: "none",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            textAlign: "center",
          }}
        >
          + Add dish{isReal ? ` to ${sectionName}` : ""}
        </Link>
      )}
    </section>
  );
}

/* --------------------------------------------------------------------- *
 * Item row · thumb + name + price + toggles + delete                    *
 * --------------------------------------------------------------------- */

function ItemRow({
  item,
}: {
  item: import("@/lib/nex-native/menu-service").NexMenuItemRow;
}) {
  const toggleAvailBound = toggleMenuItemAvailableAction.bind(null, item.id);
  const toggleFeatBound = toggleMenuItemFeaturedAction.bind(null, item.id);
  const deleteBound = deleteMenuItemAction.bind(null, item.id);
  const priceIdr = Math.round(item.price_pence / 100);
  const price = new Intl.NumberFormat("id-ID").format(priceIdr);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "56px 1fr auto",
        gap: 12,
        alignItems: "flex-start",
        padding: 12,
        borderRadius: 12,
        background: "rgba(0,0,0,0.32)",
        border: `1px solid ${NEX.border}`,
        opacity: item.is_available ? 1 : 0.75,
      }}
    >
      {/* thumb */}
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 8,
          background: item.image_url
            ? `url(${item.image_url}) center/cover`
            : "rgba(139,169,209,0.08)",
          border: `1px solid ${NEX.border}`,
          flexShrink: 0,
        }}
      />

      {/* meta */}
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 4,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "-0.005em",
            }}
          >
            {item.name}
          </div>
          <div
            style={{
              fontSize: 12,
              color: NEX.orange,
              fontWeight: 700,
            }}
          >
            Rp {price}
          </div>
          {item.is_featured && (
            <span style={featuredPillStyle}>★ House special</span>
          )}
          {!item.is_available && (
            <span style={soldOutPillStyle}>Sold out today</span>
          )}
        </div>
        {item.description && (
          <div
            style={{
              fontSize: 12,
              color: NEX.textDim,
              lineHeight: 1.5,
              marginBottom: 6,
            }}
          >
            {item.description}
          </div>
        )}
        <div
          style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}
        >
          {item.spice_level > 0 && (
            <span style={metaChip}>
              {"🌶".repeat(item.spice_level)} {SPICE_LABEL[item.spice_level]}
            </span>
          )}
          {item.dietary_tags.map((tag) => (
            <span key={tag} style={{ ...metaChip, color: NEX.green }}>
              {tag}
            </span>
          ))}
          {item.allergens.map((a) => (
            <span key={a} style={{ ...metaChip, color: NEX.amber }}>
              contains · {a}
            </span>
          ))}
          {item.portion_note && (
            <span style={metaChip}>🍽 {item.portion_note}</span>
          )}
          {item.preparation_time && (
            <span style={metaChip}>⏱ {item.preparation_time}</span>
          )}
        </div>

        {/* action row · toggles + delete */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <form action={toggleAvailBound}>
            <input
              type="hidden"
              name="is_available"
              value={item.is_available ? "false" : "true"}
            />
            <button
              type="submit"
              style={{
                ...pillButtonStyle,
                color: item.is_available ? NEX.textDim : NEX.green,
                borderColor: item.is_available
                  ? NEX.borderStrong
                  : "rgba(22,214,107,0.35)",
                background: item.is_available
                  ? "rgba(0,0,0,0.28)"
                  : "rgba(22,214,107,0.10)",
              }}
            >
              {item.is_available ? "Mark sold out" : "Mark available"}
            </button>
          </form>
          <form action={toggleFeatBound}>
            <input
              type="hidden"
              name="is_featured"
              value={item.is_featured ? "false" : "true"}
            />
            <button
              type="submit"
              style={{
                ...pillButtonStyle,
                color: item.is_featured ? NEX.orange : NEX.textDim,
                borderColor: item.is_featured
                  ? NEX.orangeSoft
                  : NEX.borderStrong,
                background: item.is_featured
                  ? "rgba(255,114,0,0.10)"
                  : "rgba(0,0,0,0.28)",
              }}
            >
              {item.is_featured ? "★ Featured" : "☆ Feature"}
            </button>
          </form>
          <form action={deleteBound}>
            <button
              type="submit"
              style={{
                ...pillButtonStyle,
                color: NEX.red,
                borderColor: "rgba(255,51,85,0.30)",
                background: "rgba(255,51,85,0.06)",
              }}
            >
              Delete
            </button>
          </form>
        </div>
      </div>

      {/* right column reserved for future drag-handle · empty for now */}
      <div />
    </div>
  );
}

/* --------------------------------------------------------------------- *
 * Item create form (used for both in-section + no-section adds)         *
 * --------------------------------------------------------------------- */

function ItemForm({
  sectionId,
  action,
}: {
  sectionId: string | null;
  action: (formData: FormData) => Promise<never>;
}) {
  return (
    <form
      action={action}
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      {sectionId && (
        <input type="hidden" name="section_id" value={sectionId} />
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 140px",
          gap: 10,
        }}
      >
        <FormRow label="Dish name">
          <input
            type="text"
            name="name"
            required
            maxLength={120}
            placeholder="Masala Dosa"
            style={inputStyle}
          />
        </FormRow>
        <FormRow label="Price (IDR)">
          <input
            type="number"
            name="price_idr"
            required
            min={0}
            max={99999999}
            placeholder="18000"
            style={inputStyle}
          />
        </FormRow>
      </div>
      <FormRow label="Description (optional)">
        <textarea
          name="description"
          rows={2}
          maxLength={400}
          placeholder="Crisp golden crepe · spiced potato · sambar + coconut chutney"
          style={{
            ...inputStyle,
            resize: "vertical",
            fontFamily: "inherit",
            lineHeight: 1.5,
          }}
        />
      </FormRow>
      <FormRow label="Image URL (optional)">
        <input
          type="url"
          name="image_url"
          maxLength={600}
          placeholder="https://…"
          style={inputStyle}
        />
      </FormRow>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        <FormRow label="Portion (optional)">
          <input
            type="text"
            name="portion_note"
            maxLength={80}
            placeholder="1 dosa · serves 1"
            style={inputStyle}
          />
        </FormRow>
        <FormRow label="Prep time (optional)">
          <input
            type="text"
            name="preparation_time"
            maxLength={80}
            placeholder="10 min · made to order"
            style={inputStyle}
          />
        </FormRow>
      </div>

      <FormRow label="Spice level">
        <div style={{ display: "flex", gap: 6 }}>
          {[0, 1, 2, 3].map((lvl) => (
            <label
              key={lvl}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 10px",
                borderRadius: 999,
                border: `1px solid ${NEX.borderStrong}`,
                background: "rgba(0,0,0,0.28)",
                color: NEX.textDim,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              <input
                type="radio"
                name="spice_level"
                value={lvl}
                defaultChecked={lvl === 0}
                style={{ accentColor: NEX.orange }}
              />
              {lvl > 0 ? "🌶".repeat(lvl) : "None"}
              {lvl > 0 && (
                <span style={{ color: NEX.textMute }}>
                  {SPICE_LABEL[lvl]}
                </span>
              )}
            </label>
          ))}
        </div>
      </FormRow>

      <FormRow label="Dietary tags">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {NEX_MENU_DIETARY_TAGS.map((tag) => (
            <label
              key={tag}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 10px",
                borderRadius: 999,
                border: `1px solid ${NEX.borderStrong}`,
                background: "rgba(0,0,0,0.28)",
                color: NEX.textDim,
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                name="dietary_tags"
                value={tag}
                style={{ accentColor: NEX.green }}
              />
              {tag}
            </label>
          ))}
        </div>
      </FormRow>

      <FormRow label="Allergens">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {NEX_MENU_ALLERGENS.map((a) => (
            <label
              key={a}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 10px",
                borderRadius: 999,
                border: `1px solid ${NEX.borderStrong}`,
                background: "rgba(0,0,0,0.28)",
                color: NEX.textDim,
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                name="allergens"
                value={a}
                style={{ accentColor: NEX.amber }}
              />
              {a}
            </label>
          ))}
        </div>
      </FormRow>

      <label
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          fontSize: 12,
          color: NEX.textDim,
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          name="is_featured"
          style={{ accentColor: NEX.orange }}
        />
        Feature this dish · shows on the shop landing preview card
      </label>

      <SubmitButton label="Add dish" tone="primary" />
    </form>
  );
}

/* --------------------------------------------------------------------- *
 * Empty states                                                          *
 * --------------------------------------------------------------------- */

function NoShopEmptyState() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        display: "grid",
        placeItems: "center",
        padding: 20,
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 340 }}>
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            color: NEX.orange,
            fontWeight: 700,
            marginBottom: 8,
          }}
        >
          Menu editor
        </div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
          You don&apos;t have a shop yet
        </h1>
        <p
          style={{
            margin: "12px 0 20px",
            fontSize: 14,
            color: NEX.textDim,
            lineHeight: 1.55,
          }}
        >
          Create your first business on NEX to build a menu.
        </p>
        <Link
          href="/nex-native/manage/site/new"
          style={{
            display: "inline-block",
            padding: "12px 20px",
            borderRadius: 12,
            background: NEX.orange,
            color: "#0B0F1A",
            fontSize: 13,
            fontWeight: 700,
            textDecoration: "none",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            boxShadow: "0 8px 22px rgba(255,114,0,0.35)",
          }}
        >
          Start your NEX
        </Link>
      </div>
    </div>
  );
}

function EmptyMenuState() {
  return (
    <div
      style={{
        padding: "28px 20px",
        textAlign: "center",
        color: NEX.textMute,
        fontSize: 13,
        lineHeight: 1.55,
        border: `1px dashed ${NEX.borderStrong}`,
        borderRadius: 14,
        marginBottom: 20,
      }}
    >
      No menu sections yet. Start with a section like{" "}
      <b style={{ color: NEX.textDim }}>Starters</b> or{" "}
      <b style={{ color: NEX.textDim }}>Drinks</b>, then add dishes underneath.
    </div>
  );
}

/* --------------------------------------------------------------------- *
 * Shared primitives                                                     *
 * --------------------------------------------------------------------- */

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <section
      style={{
        padding: "20px 22px",
        borderRadius: 18,
        background: NEX.panelSoft,
        border: `1px solid ${NEX.border}`,
        boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
        marginBottom: 18,
      }}
    >
      {children}
    </section>
  );
}

function SectionEyebrow({
  color,
  children,
}: {
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        fontSize: 10,
        letterSpacing: "0.24em",
        textTransform: "uppercase",
        color,
        fontWeight: 700,
      }}
    >
      {children}
    </div>
  );
}

function FormRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        style={{
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: NEX.textMute,
          fontWeight: 600,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function SubmitButton({
  label,
  tone,
}: {
  label: string;
  tone: "primary" | "ghost";
}) {
  const primary = tone === "primary";
  return (
    <button
      type="submit"
      style={{
        padding: "12px 16px",
        borderRadius: 12,
        background: primary
          ? "linear-gradient(180deg, #FF9033 0%, #FF7200 100%)"
          : "rgba(0,0,0,0.35)",
        border: primary
          ? `1px solid ${NEX.orangeSoft}`
          : `1px solid ${NEX.borderStrong}`,
        color: primary ? "#0B0F1A" : NEX.text,
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        cursor: "pointer",
        fontFamily: "inherit",
        boxShadow: primary
          ? "0 8px 22px rgba(255,114,0,0.35), inset 0 1px 0 rgba(255,255,255,0.28)"
          : "none",
      }}
    >
      {label}
    </button>
  );
}

function Banner({ code, message }: { code: string; message: string }) {
  const isError = code.endsWith("_failed") || code.endsWith("_forbidden");
  return (
    <div
      role="status"
      style={{
        padding: "12px 14px",
        borderRadius: 12,
        background: isError
          ? "rgba(255,51,85,0.10)"
          : "rgba(22,214,107,0.10)",
        border: `1px solid ${
          isError ? "rgba(255,51,85,0.4)" : "rgba(22,214,107,0.4)"
        }`,
        color: isError ? "#FFB4C0" : "#B8F1CC",
        fontSize: 13,
        marginBottom: 18,
      }}
    >
      {message}
    </div>
  );
}

/* --------------------------------------------------------------------- *
 * Shared styles                                                         *
 * --------------------------------------------------------------------- */

const h2Style: React.CSSProperties = {
  margin: "6px 0 6px",
  fontSize: 18,
  fontWeight: 700,
  letterSpacing: "-0.005em",
};

const pDimStyle: React.CSSProperties = {
  margin: "0 0 16px",
  fontSize: 13,
  lineHeight: 1.55,
  color: NEX.textDim,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  background: "rgba(0,0,0,0.35)",
  border: `1px solid ${NEX.borderStrong}`,
  color: NEX.text,
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
};

const pillButtonStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  border: `1px solid ${NEX.borderStrong}`,
  background: "rgba(0,0,0,0.32)",
  color: NEX.text,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  cursor: "pointer",
  fontFamily: "inherit",
};

const featuredPillStyle: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: NEX.orange,
  fontWeight: 700,
  padding: "3px 8px",
  borderRadius: 999,
  border: `1px solid ${NEX.orangeSoft}`,
  background: "rgba(255,114,0,0.10)",
};

const soldOutPillStyle: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: NEX.red,
  fontWeight: 700,
  padding: "3px 8px",
  borderRadius: 999,
  border: `1px solid rgba(255,51,85,0.35)`,
  background: "rgba(255,51,85,0.10)",
};

const metaChip: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: "0.05em",
  color: NEX.textDim,
  padding: "3px 8px",
  borderRadius: 999,
  border: `1px solid ${NEX.border}`,
  background: "rgba(139,169,209,0.06)",
};
