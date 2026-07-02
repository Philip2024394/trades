"use client";

// Editor blocks for the 6 new plant hire showcase sections:
//   VideoCenterEditor, TradeAccountsEditor, DriverRecruitmentEditor,
//   TeamEditor, PartsCounterEditor, ComplianceInfoEditor.
//
// Kept in a separate file to keep PlantHireEditor.tsx from ballooning.
// Each editor mirrors the shape of the corresponding public component.

import { useState } from "react";
import { ImageUploadField, PdfUploadField } from "./PlantFileUploadFields";
import {
  ACCREDITATION_ALL,
  DRIVER_POSITION_PRESETS,
  MATERIAL_CATEGORY_PRESETS,
  PAYMENT_GATEWAY_META,
  PLANT_CATEGORIES,
  densityForCategory,
  type ClosureDate,
  type PartsCategory,
  type PartsItem,
  type PaymentGatewaySlug,
  type PlantAccreditation,
  type PlantAward,
  type PlantBulkQuote,
  type PlantCdmPack,
  type PlantClosureCalendar,
  type PlantComplianceInfo,
  type PlantDriverRecruitment,
  type PlantMachineFinder,
  type PlantNotifyWhenFree,
  type PlantPartsCounter,
  type PlantPaymentGateways,
  type PlantRepeatLadder,
  type PlantSiteCalculator,
  type PlantSubHire,
  type PlantTeamMember,
  type PlantTeamSection,
  type PlantTradeAccounts,
  type PlantTrustSignals,
  type PlantVideo,
  type PlantVideoCenter,
  type RepeatTier,
  type SiteCalculatorMaterial,
  type SubHirePartner
} from "@/lib/plantHire";

// ─── Video Centre Editor ───────────────────────────────────────────

export function VideoCenterEditor({
  value,
  onChange
}: {
  value: PlantVideoCenter;
  onChange: (next: PlantVideoCenter) => void;
}) {
  function patch(p: Partial<PlantVideoCenter>) {
    onChange({ ...value, ...p });
  }
  function patchVideo(idx: number, p: Partial<PlantVideo>) {
    onChange({
      ...value,
      videos: value.videos.map((v, i) => (i === idx ? { ...v, ...p } : v))
    });
  }
  function addVideo() {
    onChange({
      ...value,
      videos: [
        ...value.videos,
        {
          youtube_url: "",
          title: "",
          description: "",
          location: "",
          linked_machine_slug: "",
          thumbnail_url: "",
          duration_label: "",
          date_uploaded: ""
        }
      ]
    });
  }
  function removeVideo(idx: number) {
    onChange({ ...value, videos: value.videos.filter((_, i) => i !== idx) });
  }
  return (
    <div className="mt-3 space-y-3">
      <Toggle label="Enable video centre" value={value.enabled} onChange={(v) => patch({ enabled: v })} />
      <TextInput label="Heading" value={value.heading} onChange={(v) => patch({ heading: v })} maxLength={80} />
      <TextInput
        label="Sub-heading"
        value={value.subheading}
        onChange={(v) => patch({ subheading: v })}
        maxLength={160}
      />
      <div className="space-y-2">
        {value.videos.map((v, i) => (
          <div key={i} className="rounded-md border border-brand-line bg-brand-bg p-2">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-muted">
                Video #{i + 1}
              </span>
              <button
                type="button"
                onClick={() => removeVideo(i)}
                className="text-[10px] font-extrabold uppercase tracking-widest text-red-500 hover:text-red-300"
              >
                Del
              </button>
            </div>
            <TextInput
              label="YouTube URL"
              value={v.youtube_url}
              onChange={(x) => patchVideo(i, { youtube_url: x })}
              placeholder="https://youtube.com/watch?v=..."
            />
            <TextInput
              label="Title"
              value={v.title}
              onChange={(x) => patchVideo(i, { title: x })}
              maxLength={120}
            />
            <TextArea
              label="Description"
              value={v.description}
              onChange={(x) => patchVideo(i, { description: x })}
              maxLength={300}
              rows={2}
            />
            <div className="grid grid-cols-2 gap-2">
              <TextInput
                label="Location"
                value={v.location}
                onChange={(x) => patchVideo(i, { location: x })}
                maxLength={80}
              />
              <TextInput
                label="Duration (2:34)"
                value={v.duration_label}
                onChange={(x) => patchVideo(i, { duration_label: x })}
                maxLength={12}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <SelectInput
                label="Linked machine"
                value={v.linked_machine_slug}
                options={[
                  { value: "", label: "— None —" },
                  ...PLANT_CATEGORIES.map((m) => ({ value: m.slug, label: m.label }))
                ]}
                onChange={(x) => patchVideo(i, { linked_machine_slug: x })}
              />
              <TextInput
                label="Upload date (YYYY-MM-DD)"
                value={v.date_uploaded}
                onChange={(x) => patchVideo(i, { date_uploaded: x })}
                maxLength={10}
              />
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addVideo}
          className="inline-flex h-9 items-center rounded-md border-2 border-dashed border-brand-line px-3 text-[11px] font-extrabold uppercase tracking-widest text-brand-muted hover:border-brand-accent hover:text-brand-text"
        >
          + Add video
        </button>
      </div>
    </div>
  );
}

// ─── Trade Accounts Editor ─────────────────────────────────────────

export function TradeAccountsEditor({
  value,
  onChange
}: {
  value: PlantTradeAccounts;
  onChange: (next: PlantTradeAccounts) => void;
}) {
  function patch(p: Partial<PlantTradeAccounts>) {
    onChange({ ...value, ...p });
  }
  return (
    <div className="mt-3 space-y-3">
      <Toggle label="Enable trade accounts" value={value.enabled} onChange={(v) => patch({ enabled: v })} />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Toggle
          label="Online (WhatsApp) application"
          value={value.online_application_enabled}
          onChange={(v) => patch({ online_application_enabled: v })}
        />
        <Toggle
          label="PDF form download"
          value={value.pdf_download_enabled}
          onChange={(v) => patch({ pdf_download_enabled: v })}
        />
      </div>
      <TextInput label="Heading" value={value.heading} onChange={(v) => patch({ heading: v })} maxLength={80} />
      <TextArea
        label="Sub-heading"
        value={value.subheading}
        onChange={(v) => patch({ subheading: v })}
        maxLength={200}
        rows={2}
      />
      <PdfUploadField
        label="Trade account application form"
        value={value.pdf_url}
        onChange={(url) => patch({ pdf_url: url })}
      />
      <StringArrayEditor label="Benefits (max 10)" values={value.benefits} onChange={(a) => patch({ benefits: a })} max={10} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <NumInput
          label="Min credit £ (pence)"
          value={value.credit_limit_min_pence}
          onChange={(v) => patch({ credit_limit_min_pence: v })}
        />
        <NumInput
          label="Max credit £ (pence)"
          value={value.credit_limit_max_pence}
          onChange={(v) => patch({ credit_limit_max_pence: v })}
        />
        <NumInput
          label="Min years trading"
          value={value.min_years_trading}
          onChange={(v) => patch({ min_years_trading: v })}
        />
        <NumInput
          label="Turnaround days"
          value={value.turnaround_days}
          onChange={(v) => patch({ turnaround_days: v })}
        />
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Toggle
          label="Require bank details"
          value={value.require_bank_details}
          onChange={(v) => patch({ require_bank_details: v })}
        />
        <NumInput
          label="Trade refs required"
          value={value.require_trade_references}
          onChange={(v) => patch({ require_trade_references: v ?? 2 })}
        />
        <Toggle
          label="Require insurance cert"
          value={value.require_insurance_cert}
          onChange={(v) => patch({ require_insurance_cert: v })}
        />
      </div>
      <TextArea
        label="Terms of service (max 2500 chars)"
        value={value.terms_of_service}
        onChange={(v) => patch({ terms_of_service: v })}
        maxLength={2500}
        rows={5}
      />
    </div>
  );
}

// ─── Driver Recruitment Editor ─────────────────────────────────────

export function DriverRecruitmentEditor({
  value,
  onChange
}: {
  value: PlantDriverRecruitment;
  onChange: (next: PlantDriverRecruitment) => void;
}) {
  function patch(p: Partial<PlantDriverRecruitment>) {
    onChange({ ...value, ...p });
  }
  function togglePosition(slug: string) {
    const has = value.positions_available.includes(slug);
    onChange({
      ...value,
      positions_available: has
        ? value.positions_available.filter((p) => p !== slug)
        : [...value.positions_available, slug]
    });
  }
  return (
    <div className="mt-3 space-y-3">
      <Toggle label="Enable drivers wanted" value={value.enabled} onChange={(v) => patch({ enabled: v })} />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Toggle
          label="Online (WhatsApp) application"
          value={value.online_application_enabled}
          onChange={(v) => patch({ online_application_enabled: v })}
        />
        <Toggle
          label="PDF form download"
          value={value.pdf_download_enabled}
          onChange={(v) => patch({ pdf_download_enabled: v })}
        />
      </div>
      <TextInput label="Heading" value={value.heading} onChange={(v) => patch({ heading: v })} maxLength={80} />
      <TextArea
        label="Sub-heading"
        value={value.subheading}
        onChange={(v) => patch({ subheading: v })}
        maxLength={300}
        rows={2}
      />
      <PdfUploadField
        label="Driver application form"
        value={value.pdf_url}
        onChange={(url) => patch({ pdf_url: url })}
      />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <TextInput
          label="Base location"
          value={value.base_location}
          onChange={(v) => patch({ base_location: v })}
          maxLength={80}
        />
        <TextInput
          label="Salary range display"
          value={value.salary_range_display}
          onChange={(v) => patch({ salary_range_display: v })}
          maxLength={60}
        />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
          Positions available
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {DRIVER_POSITION_PRESETS.map((p) => {
            const on = value.positions_available.includes(p.slug);
            return (
              <button
                key={p.slug}
                type="button"
                onClick={() => togglePosition(p.slug)}
                className={`inline-flex h-8 items-center rounded-full px-3 text-[11px] font-bold transition ${
                  on
                    ? "bg-brand-accent text-black"
                    : "border border-brand-line bg-brand-bg text-brand-muted hover:text-brand-text"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>
      <StringArrayEditor label="Benefits (max 12)" values={value.benefits} onChange={(a) => patch({ benefits: a })} max={12} />
      <NumInput
        label="Min years experience"
        value={value.min_years_experience}
        onChange={(v) => patch({ min_years_experience: v })}
      />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Toggle label="Require CPC card" value={value.require_cpc_card} onChange={(v) => patch({ require_cpc_card: v })} />
        <Toggle
          label="Require digitacho"
          value={value.require_digitacho}
          onChange={(v) => patch({ require_digitacho: v })}
        />
        <Toggle
          label="Require STGO experience"
          value={value.require_stgo_experience}
          onChange={(v) => patch({ require_stgo_experience: v })}
        />
        <Toggle
          label="Require plant experience"
          value={value.require_plant_experience}
          onChange={(v) => patch({ require_plant_experience: v })}
        />
        <Toggle label="Full-time available" value={value.full_time_available} onChange={(v) => patch({ full_time_available: v })} />
        <Toggle label="Part-time available" value={value.part_time_available} onChange={(v) => patch({ part_time_available: v })} />
        <Toggle
          label="Owner-driver available"
          value={value.owner_driver_available}
          onChange={(v) => patch({ owner_driver_available: v })}
        />
      </div>
      <TextArea
        label="Terms of service"
        value={value.terms_of_service}
        onChange={(v) => patch({ terms_of_service: v })}
        maxLength={2500}
        rows={4}
      />
    </div>
  );
}

// ─── Team Editor ───────────────────────────────────────────────────

export function TeamEditor({
  value,
  onChange
}: {
  value: PlantTeamSection;
  onChange: (next: PlantTeamSection) => void;
}) {
  function patch(p: Partial<PlantTeamSection>) {
    onChange({ ...value, ...p });
  }
  function patchMember(idx: number, p: Partial<PlantTeamMember>) {
    onChange({
      ...value,
      members: value.members.map((m, i) => (i === idx ? { ...m, ...p } : m))
    });
  }
  function addMember() {
    onChange({
      ...value,
      members: [
        ...value.members,
        {
          name: "",
          role: "",
          photo_url: "",
          phone: "",
          extension: "",
          whatsapp: "",
          email: "",
          hours: "",
          specialities: []
        }
      ]
    });
  }
  function removeMember(idx: number) {
    onChange({ ...value, members: value.members.filter((_, i) => i !== idx) });
  }
  return (
    <div className="mt-3 space-y-3">
      <Toggle label="Enable team section" value={value.enabled} onChange={(v) => patch({ enabled: v })} />
      <TextInput label="Heading" value={value.heading} onChange={(v) => patch({ heading: v })} maxLength={80} />
      <TextArea
        label="Sub-heading"
        value={value.subheading}
        onChange={(v) => patch({ subheading: v })}
        maxLength={200}
        rows={2}
      />
      <div className="space-y-2">
        {value.members.map((m, i) => (
          <div key={i} className="rounded-md border border-brand-line bg-brand-bg p-2">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-muted">
                Member #{i + 1}
              </span>
              <button
                type="button"
                onClick={() => removeMember(i)}
                className="text-[10px] font-extrabold uppercase tracking-widest text-red-500 hover:text-red-300"
              >
                Del
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <TextInput label="Name" value={m.name} onChange={(v) => patchMember(i, { name: v })} maxLength={60} />
              <TextInput label="Role" value={m.role} onChange={(v) => patchMember(i, { role: v })} maxLength={60} />
            </div>
            <ImageUploadField
              label="Team photo"
              value={m.photo_url}
              onChange={(url) => patchMember(i, { photo_url: url })}
              hint="Head-and-shoulders, square works best. Empty = branded initials avatar."
            />
            <div className="grid grid-cols-2 gap-2">
              <TextInput label="Phone" value={m.phone} onChange={(v) => patchMember(i, { phone: v })} maxLength={30} />
              <TextInput
                label="Extension"
                value={m.extension}
                onChange={(v) => patchMember(i, { extension: v })}
                maxLength={10}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <TextInput
                label="WhatsApp"
                value={m.whatsapp}
                onChange={(v) => patchMember(i, { whatsapp: v })}
                maxLength={30}
              />
              <TextInput label="Email" value={m.email} onChange={(v) => patchMember(i, { email: v })} maxLength={120} />
            </div>
            <TextInput label="Hours" value={m.hours} onChange={(v) => patchMember(i, { hours: v })} maxLength={60} />
            <StringArrayEditor
              label="Specialities (max 6)"
              values={m.specialities}
              onChange={(a) => patchMember(i, { specialities: a })}
              max={6}
            />
          </div>
        ))}
        <button
          type="button"
          onClick={addMember}
          className="inline-flex h-9 items-center rounded-md border-2 border-dashed border-brand-line px-3 text-[11px] font-extrabold uppercase tracking-widest text-brand-muted hover:border-brand-accent hover:text-brand-text"
        >
          + Add team member
        </button>
      </div>
    </div>
  );
}

// ─── Parts Counter Editor ──────────────────────────────────────────

export function PartsCounterEditor({
  value,
  onChange
}: {
  value: PlantPartsCounter;
  onChange: (next: PlantPartsCounter) => void;
}) {
  function patch(p: Partial<PlantPartsCounter>) {
    onChange({ ...value, ...p });
  }
  function patchCat(idx: number, p: Partial<PartsCategory>) {
    onChange({
      ...value,
      categories: value.categories.map((c, i) => (i === idx ? { ...c, ...p } : c))
    });
  }
  function addCat() {
    onChange({
      ...value,
      categories: [
        ...value.categories,
        { name: "", description: "", manual_url: "", in_stock: true, lead_time: "" }
      ]
    });
  }
  function removeCat(idx: number) {
    onChange({ ...value, categories: value.categories.filter((_, i) => i !== idx) });
  }
  return (
    <div className="mt-3 space-y-3">
      <Toggle label="Enable parts counter" value={value.enabled} onChange={(v) => patch({ enabled: v })} />
      <TextInput label="Heading" value={value.heading} onChange={(v) => patch({ heading: v })} maxLength={80} />
      <TextArea
        label="Sub-heading"
        value={value.subheading}
        onChange={(v) => patch({ subheading: v })}
        maxLength={200}
        rows={2}
      />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <TextInput label="Phone" value={value.phone} onChange={(v) => patch({ phone: v })} maxLength={30} />
        <TextInput label="WhatsApp" value={value.whatsapp} onChange={(v) => patch({ whatsapp: v })} maxLength={30} />
        <TextInput label="Email" value={value.email} onChange={(v) => patch({ email: v })} maxLength={120} />
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <TextInput
          label="Hours summary"
          value={value.hours_summary}
          onChange={(v) => patch({ hours_summary: v })}
          maxLength={120}
        />
        <TextInput
          label="Same-day cutoff line"
          value={value.same_day_cutoff}
          onChange={(v) => patch({ same_day_cutoff: v })}
          maxLength={120}
        />
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <NumInput
          label="Min order (pence)"
          value={value.minimum_order_pence}
          onChange={(v) => patch({ minimum_order_pence: v })}
        />
        <Toggle
          label="Delivery available"
          value={value.delivery_available}
          onChange={(v) => patch({ delivery_available: v })}
        />
      </div>
      <TextInput
        label="Full manual library URL"
        value={value.manual_library_url}
        onChange={(v) => patch({ manual_library_url: v })}
        maxLength={800}
      />
      <TextInput label="Address (counter location)" value={value.address} onChange={(v) => patch({ address: v })} maxLength={200} />
      <ImageUploadField
        label="Trade counter hero image"
        value={value.hero_image_url}
        onChange={(url) => patch({ hero_image_url: url })}
        hint="Shown top-right of the /plant-hire/parts page."
      />

      <PartsItemsEditor
        items={value.items}
        categories={value.categories}
        onChange={(next) => patch({ items: next })}
      />
      <div className="space-y-2">
        {value.categories.map((c, i) => (
          <div key={i} className="rounded-md border border-brand-line bg-brand-bg p-2">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-muted">
                Parts category #{i + 1}
              </span>
              <button
                type="button"
                onClick={() => removeCat(i)}
                className="text-[10px] font-extrabold uppercase tracking-widest text-red-500 hover:text-red-300"
              >
                Del
              </button>
            </div>
            <TextInput label="Name" value={c.name} onChange={(v) => patchCat(i, { name: v })} maxLength={60} />
            <TextArea
              label="Description"
              value={c.description}
              onChange={(v) => patchCat(i, { description: v })}
              maxLength={200}
              rows={2}
            />
            <PdfUploadField
              label="Category manual PDF"
              value={c.manual_url}
              onChange={(url) => patchCat(i, { manual_url: url })}
            />
            <div className="grid grid-cols-2 gap-2">
              <Toggle label="In stock" value={c.in_stock} onChange={(v) => patchCat(i, { in_stock: v })} />
              <TextInput
                label="Lead time"
                value={c.lead_time}
                onChange={(v) => patchCat(i, { lead_time: v })}
                maxLength={40}
              />
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addCat}
          className="inline-flex h-9 items-center rounded-md border-2 border-dashed border-brand-line px-3 text-[11px] font-extrabold uppercase tracking-widest text-brand-muted hover:border-brand-accent hover:text-brand-text"
        >
          + Add parts category
        </button>
      </div>
      <TextArea
        label="Terms of service"
        value={value.terms_of_service}
        onChange={(v) => patch({ terms_of_service: v })}
        maxLength={2500}
        rows={4}
      />
    </div>
  );
}

function PartsItemsEditor({
  items,
  categories,
  onChange
}: {
  items: PartsItem[];
  categories: PartsCategory[];
  onChange: (next: PartsItem[]) => void;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [quickName, setQuickName] = useState("");
  const [quickPriceGbp, setQuickPriceGbp] = useState("");
  const [quickCategory, setQuickCategory] = useState(
    categories[0]?.slug || categories[0]?.name || ""
  );

  const catOpts = categories.map((c) => ({
    value: c.slug || c.name.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
    label: c.name
  }));

  const quickAdd = () => {
    if (quickName.trim().length < 2) return;
    const price = Number(quickPriceGbp);
    onChange([
      ...items,
      {
        sku: "",
        name: quickName.trim(),
        brand: "",
        fits: "",
        category_slug: quickCategory,
        price_pence: Number.isFinite(price) && price > 0 ? Math.round(price * 100) : null,
        image_url: "",
        in_stock: true,
        stock_count: null,
        lead_time: "Same day",
        short_desc: "",
        featured: false,
        manual_url: ""
      }
    ]);
    setQuickName("");
    setQuickPriceGbp("");
  };

  const patch = (idx: number, p: Partial<PartsItem>) => {
    onChange(items.map((it, i) => (i === idx ? { ...it, ...p } : it)));
  };
  const remove = (idx: number) => {
    onChange(items.filter((_, i) => i !== idx));
    if (expanded === idx) setExpanded(null);
  };

  return (
    <div className="rounded-md border border-brand-line bg-brand-bg p-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-brand-muted">
          Trade counter items · {items.length} SKU{items.length === 1 ? "" : "s"}
        </p>
        <span className="text-[9px] text-brand-muted">
          Shows on /plant-hire/parts with search + filter
        </span>
      </div>

      {catOpts.length > 0 && (
        <div className="mt-2 rounded-md border-2 border-dashed border-brand-line bg-brand-surface p-2">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-brand-accent">
            Quick add
          </p>
          <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_150px_120px_auto]">
            <TextInput
              label="Item name"
              value={quickName}
              onChange={setQuickName}
              maxLength={120}
              placeholder="e.g. Kubota KX57 hydraulic filter"
            />
            <SelectInput
              label="Category"
              value={quickCategory}
              options={[{ value: "", label: "— none —" }, ...catOpts]}
              onChange={setQuickCategory}
            />
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                Price (£)
              </span>
              <input
                type="number"
                step="0.01"
                min={0}
                value={quickPriceGbp}
                onChange={(e) => setQuickPriceGbp(e.target.value)}
                placeholder="12.50"
                className="mt-1 h-9 w-full rounded-md border border-brand-line bg-brand-bg px-2 font-mono text-[12px] text-brand-text outline-none focus:border-brand-accent"
              />
            </label>
            <button
              type="button"
              onClick={quickAdd}
              disabled={quickName.trim().length < 2}
              className={`mt-4 inline-flex h-9 items-center rounded-md px-3 text-[10px] font-extrabold uppercase tracking-widest transition ${
                quickName.trim().length < 2
                  ? "cursor-not-allowed bg-brand-line text-brand-muted"
                  : "bg-brand-accent text-black hover:brightness-95"
              }`}
            >
              + Add
            </button>
          </div>
        </div>
      )}

      <ul className="mt-2 space-y-1">
        {items.map((it, i) => (
          <li key={i} className="rounded-md border border-brand-line bg-brand-surface p-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setExpanded(expanded === i ? null : i)}
                className="text-[10px] font-extrabold uppercase tracking-widest text-brand-muted hover:text-brand-text"
              >
                {expanded === i ? "▾" : "▸"}
              </button>
              <span className="flex-1 truncate text-[11px] font-bold text-brand-text">
                {it.name || "(untitled)"}
              </span>
              {it.price_pence !== null && (
                <span className="font-mono text-[11px] font-bold text-brand-text">
                  £{(it.price_pence / 100).toFixed(2)}
                </span>
              )}
              <span
                className={`inline-flex items-center rounded-full px-2 text-[9px] font-extrabold uppercase tracking-widest ${
                  it.in_stock ? "bg-emerald-900/40 text-emerald-300" : "bg-neutral-700 text-neutral-300"
                }`}
              >
                {it.in_stock ? "In" : "To order"}
              </span>
              {it.featured && (
                <span
                  className="inline-flex items-center rounded-full px-2 text-[9px] font-extrabold uppercase tracking-widest text-black"
                  style={{ background: "#FFB300" }}
                >
                  ★ Featured
                </span>
              )}
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-[10px] font-extrabold uppercase tracking-widest text-red-500 hover:text-red-300"
              >
                Del
              </button>
            </div>
            {expanded === i && (
              <div className="mt-2 space-y-2">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <TextInput label="Name" value={it.name} onChange={(v) => patch(i, { name: v })} maxLength={120} />
                  <TextInput label="SKU" value={it.sku} onChange={(v) => patch(i, { sku: v })} maxLength={40} />
                  <TextInput label="Brand" value={it.brand} onChange={(v) => patch(i, { brand: v })} maxLength={40} />
                  <SelectInput
                    label="Category"
                    value={it.category_slug}
                    options={[{ value: "", label: "— none —" }, ...catOpts]}
                    onChange={(v) => patch(i, { category_slug: v })}
                  />
                </div>
                <TextInput
                  label="Fits (models — comma separated)"
                  value={it.fits}
                  onChange={(v) => patch(i, { fits: v })}
                  maxLength={300}
                  placeholder="JCB 8018 CTS, JCB 8020, Kubota U17-3"
                />
                <TextArea
                  label="Short description"
                  value={it.short_desc}
                  onChange={(v) => patch(i, { short_desc: v })}
                  maxLength={300}
                  rows={2}
                />
                <ImageUploadField
                  label="Product photo"
                  value={it.image_url}
                  onChange={(url) => patch(i, { image_url: url })}
                />
                <PdfUploadField
                  label="Product manual (optional)"
                  value={it.manual_url}
                  onChange={(url) => patch(i, { manual_url: url })}
                />
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <PriceInPoundsField
                    label="Price (£)"
                    valuePence={it.price_pence}
                    onChange={(pence) => patch(i, { price_pence: pence })}
                  />
                  <NumInput
                    label="Stock qty"
                    value={it.stock_count}
                    onChange={(v) => patch(i, { stock_count: v })}
                  />
                  <TextInput
                    label="Lead time"
                    value={it.lead_time}
                    onChange={(v) => patch(i, { lead_time: v })}
                    maxLength={40}
                  />
                  <div className="flex flex-col justify-end gap-1 pb-1">
                    <Toggle label="In stock" value={it.in_stock} onChange={(v) => patch(i, { in_stock: v })} />
                    <Toggle label="Featured" value={it.featured} onChange={(v) => patch(i, { featured: v })} />
                  </div>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      {items.length === 0 && (
        <p className="mt-2 text-[11px] text-brand-muted">
          No items yet — add categories first, then quick-add items above.
        </p>
      )}
    </div>
  );
}

// ─── Compliance Info Editor ────────────────────────────────────────

export function ComplianceInfoEditor({
  value,
  onChange
}: {
  value: PlantComplianceInfo;
  onChange: (next: PlantComplianceInfo) => void;
}) {
  function patch(p: Partial<PlantComplianceInfo>) {
    onChange({ ...value, ...p });
  }
  return (
    <div className="mt-3 space-y-3">
      <Toggle label="Enable compliance section" value={value.enabled} onChange={(v) => patch({ enabled: v })} />
      <TextInput label="Heading" value={value.heading} onChange={(v) => patch({ heading: v })} maxLength={80} />
      <TextArea
        label="Sub-heading"
        value={value.subheading}
        onChange={(v) => patch({ subheading: v })}
        maxLength={400}
        rows={3}
      />
      <TextArea
        label="Wide-load process (up to 1200 chars)"
        value={value.wide_load_note}
        onChange={(v) => patch({ wide_load_note: v })}
        maxLength={1200}
        rows={5}
      />
      <TextArea
        label="Nationwide note (up to 800 chars)"
        value={value.nationwide_note}
        onChange={(v) => patch({ nationwide_note: v })}
        maxLength={800}
        rows={4}
      />
      <TextArea
        label="Route survey note"
        value={value.route_survey_note}
        onChange={(v) => patch({ route_survey_note: v })}
        maxLength={400}
        rows={3}
      />
      <TextArea
        label="Emergency line note"
        value={value.emergency_line_note}
        onChange={(v) => patch({ emergency_line_note: v })}
        maxLength={300}
        rows={2}
      />
      <StringArrayEditor
        label="Compliance credentials (bullets)"
        values={value.extra_regs}
        onChange={(a) => patch({ extra_regs: a })}
        max={12}
      />
    </div>
  );
}

// ─── Trust Signals Editor ─────────────────────────────────────────

export function TrustSignalsEditor({
  value,
  onChange
}: {
  value: PlantTrustSignals;
  onChange: (next: PlantTrustSignals) => void;
}) {
  function patch(p: Partial<PlantTrustSignals>) {
    onChange({ ...value, ...p });
  }
  function addAccreditation(preset?: PlantAccreditation) {
    onChange({
      ...value,
      accreditations: [
        ...value.accreditations,
        preset ?? { slug: "", label: "", logo_url: "", cert_number: "" }
      ]
    });
  }
  function patchAccred(idx: number, p: Partial<PlantAccreditation>) {
    onChange({
      ...value,
      accreditations: value.accreditations.map((a, i) => (i === idx ? { ...a, ...p } : a))
    });
  }
  function removeAccred(idx: number) {
    onChange({ ...value, accreditations: value.accreditations.filter((_, i) => i !== idx) });
  }
  function patchAward(idx: number, p: Partial<PlantAward>) {
    onChange({
      ...value,
      awards: value.awards.map((a, i) => (i === idx ? { ...a, ...p } : a))
    });
  }
  return (
    <div className="mt-3 space-y-3">
      <Toggle label="Enable trust signals" value={value.enabled} onChange={(v) => patch({ enabled: v })} />
      <TextInput label="Heading" value={value.heading} onChange={(v) => patch({ heading: v })} maxLength={100} />
      <TextArea
        label="Sub-heading"
        value={value.subheading}
        onChange={(v) => patch({ subheading: v })}
        maxLength={300}
        rows={2}
      />
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
          Accreditations (max 20)
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          {ACCREDITATION_ALL.map((a) => (
            <button
              key={a.slug}
              type="button"
              onClick={() => addAccreditation(a)}
              className="inline-flex h-7 items-center rounded-full border border-brand-line bg-brand-bg px-2 text-[10px] font-bold text-brand-muted hover:bg-brand-accent hover:text-black"
            >
              + {a.label}
            </button>
          ))}
        </div>
        <ul className="mt-2 space-y-2">
          {value.accreditations.map((a, i) => (
            <li key={i} className="rounded-md border border-brand-line bg-brand-bg p-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-brand-text">{a.label || "(unnamed)"}</span>
                <button
                  type="button"
                  onClick={() => removeAccred(i)}
                  className="text-[10px] font-extrabold uppercase tracking-widest text-red-500 hover:text-red-300"
                >
                  Del
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <TextInput label="Label" value={a.label} onChange={(v) => patchAccred(i, { label: v })} maxLength={60} />
                <TextInput
                  label="Cert number"
                  value={a.cert_number}
                  onChange={(v) => patchAccred(i, { cert_number: v })}
                  maxLength={40}
                />
              </div>
              <ImageUploadField
                label="Accreditation logo"
                value={a.logo_url}
                onChange={(url) => patchAccred(i, { logo_url: url })}
              />
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => addAccreditation()}
          className="mt-2 inline-flex h-8 items-center rounded-md border-2 border-dashed border-brand-line px-2 text-[10px] font-extrabold uppercase tracking-widest text-brand-muted hover:border-brand-accent hover:text-brand-text"
        >
          + Custom accreditation
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <TextInput
          label="Google Reviews embed URL"
          value={value.google_reviews_embed_url}
          onChange={(v) => patch({ google_reviews_embed_url: v })}
          placeholder="https://widgets.sociablekit.com/..."
          maxLength={800}
        />
        <TextInput
          label="Google Place ID"
          value={value.google_place_id}
          onChange={(v) => patch({ google_place_id: v })}
          maxLength={120}
        />
        <TextInput
          label="TrustPilot embed URL"
          value={value.trustpilot_embed_url}
          onChange={(v) => patch({ trustpilot_embed_url: v })}
          placeholder="https://widget.trustpilot.com/..."
          maxLength={800}
        />
        <TextInput
          label="TrustPilot business ID"
          value={value.trustpilot_business_id}
          onChange={(v) => patch({ trustpilot_business_id: v })}
          maxLength={120}
        />
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <PdfUploadField
          label="Insurance certificate"
          value={value.insurance_cert_url}
          onChange={(url) => patch({ insurance_cert_url: url })}
          hint="Public + Employer's liability. Customers download this from your Vetted page."
        />
        <NumInput
          label="Insurance cover (pence)"
          value={value.insurance_cover_pence}
          onChange={(v) => patch({ insurance_cover_pence: v })}
        />
      </div>
      <NumInput
        label="Net Promoter Score (-100 to 100)"
        value={value.net_promoter_score}
        onChange={(v) => patch({ net_promoter_score: v })}
      />
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">Awards</p>
        <ul className="mt-1 space-y-2">
          {value.awards.map((a, i) => (
            <li key={i} className="rounded-md border border-brand-line bg-brand-bg p-2">
              <TextInput label="Title" value={a.title} onChange={(v) => patchAward(i, { title: v })} maxLength={80} />
              <div className="grid grid-cols-2 gap-2">
                <TextInput label="Year" value={a.year} onChange={(v) => patchAward(i, { year: v })} maxLength={10} />
                <TextInput label="Issuer" value={a.issuer} onChange={(v) => patchAward(i, { issuer: v })} maxLength={80} />
              </div>
              <button
                type="button"
                onClick={() => onChange({ ...value, awards: value.awards.filter((_, j) => j !== i) })}
                className="mt-1 text-[10px] font-extrabold uppercase tracking-widest text-red-500 hover:text-red-300"
              >
                Del
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => onChange({ ...value, awards: [...value.awards, { title: "", year: "", issuer: "" }] })}
          className="mt-2 inline-flex h-8 items-center rounded-md border-2 border-dashed border-brand-line px-2 text-[10px] font-extrabold uppercase tracking-widest text-brand-muted hover:border-brand-accent hover:text-brand-text"
        >
          + Award
        </button>
      </div>
    </div>
  );
}

// ─── CDM Pack Editor ──────────────────────────────────────────────

export function CdmPackEditor({
  value,
  onChange
}: {
  value: PlantCdmPack;
  onChange: (next: PlantCdmPack) => void;
}) {
  function patch(p: Partial<PlantCdmPack>) {
    onChange({ ...value, ...p });
  }
  return (
    <div className="mt-3 space-y-3">
      <Toggle label="Enable CDM 2015 pack" value={value.enabled} onChange={(v) => patch({ enabled: v })} />
      <TextInput label="Heading" value={value.heading} onChange={(v) => patch({ heading: v })} maxLength={80} />
      <TextArea
        label="Sub-heading"
        value={value.subheading}
        onChange={(v) => patch({ subheading: v })}
        maxLength={300}
        rows={2}
      />
      <PdfUploadField
        label="Sample CDM pack PDF"
        value={value.pdf_url}
        onChange={(url) => patch({ pdf_url: url })}
        hint="One sample the customer downloads to see what's in the pack."
      />
      <div className="grid grid-cols-2 gap-2">
        <NumInput label="Price (pence)" value={value.price_pence} onChange={(v) => patch({ price_pence: v })} />
        <NumInput
          label="Auto-included on hires over (pence)"
          value={value.auto_included_on_hires_over_pence}
          onChange={(v) => patch({ auto_included_on_hires_over_pence: v })}
        />
      </div>
      <StringArrayEditor
        label="Pack contents (bullets)"
        values={value.bullets}
        onChange={(a) => patch({ bullets: a })}
        max={10}
      />
    </div>
  );
}

// ─── Machine Finder Editor ────────────────────────────────────────

export function MachineFinderEditor({
  value,
  onChange
}: {
  value: PlantMachineFinder;
  onChange: (next: PlantMachineFinder) => void;
}) {
  function patch(p: Partial<PlantMachineFinder>) {
    onChange({ ...value, ...p });
  }
  return (
    <div className="mt-3 space-y-3">
      <Toggle label="Enable machine finder" value={value.enabled} onChange={(v) => patch({ enabled: v })} />
      <TextInput label="Heading" value={value.heading} onChange={(v) => patch({ heading: v })} maxLength={100} />
      <TextArea
        label="Sub-heading"
        value={value.subheading}
        onChange={(v) => patch({ subheading: v })}
        maxLength={240}
        rows={2}
      />
      <div className="rounded-md border border-brand-line bg-brand-bg p-2 text-[11px] text-brand-muted">
        {value.questions.length} question{value.questions.length === 1 ? "" : "s"} configured. Uses
        the platform preset — advanced question editing coming soon.
      </div>
    </div>
  );
}

// ─── Site Calculator Editor ───────────────────────────────────────

export function SiteCalculatorEditor({
  value,
  onChange
}: {
  value: PlantSiteCalculator;
  onChange: (next: PlantSiteCalculator) => void;
}) {
  function patch(p: Partial<PlantSiteCalculator>) {
    onChange({ ...value, ...p });
  }
  function patchMat(idx: number, p: Partial<SiteCalculatorMaterial>) {
    onChange({
      ...value,
      materials: value.materials.map((m, i) => (i === idx ? { ...m, ...p } : m))
    });
  }
  function removeMat(idx: number) {
    onChange({ ...value, materials: value.materials.filter((_, i) => i !== idx) });
  }
  function addMaterial(mat: SiteCalculatorMaterial) {
    onChange({ ...value, materials: [...value.materials, mat] });
  }
  return (
    <div className="mt-3 space-y-3">
      <Toggle label="Enable calculator" value={value.enabled} onChange={(v) => patch({ enabled: v })} />
      <TextInput label="Heading" value={value.heading} onChange={(v) => patch({ heading: v })} maxLength={100} />
      <TextArea
        label="Sub-heading"
        value={value.subheading}
        onChange={(v) => patch({ subheading: v })}
        maxLength={300}
        rows={2}
      />
      <NumInput
        label="Waste factor %"
        value={value.waste_factor_percent}
        onChange={(v) => patch({ waste_factor_percent: v })}
      />

      <SiteCalculatorQuickAdd onAdd={addMaterial} />

      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
          Materials on your calculator
        </p>
        <ul className="mt-1 space-y-2">
          {value.materials.map((m, i) => (
            <li key={i} className="rounded-md border border-brand-line bg-brand-bg p-2">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-muted">
                  #{i + 1}
                  {m.category
                    ? ` · ${MATERIAL_CATEGORY_PRESETS.find((c) => c.slug === m.category)?.label ?? m.category}`
                    : ""}
                </span>
                <button
                  type="button"
                  onClick={() => removeMat(i)}
                  className="text-[10px] font-extrabold uppercase tracking-widest text-red-500 hover:text-red-300"
                >
                  Del
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <TextInput
                  label="Label (customer-facing)"
                  value={m.label}
                  onChange={(v) => patchMat(i, { label: v })}
                  maxLength={80}
                />
                <PriceInPoundsField
                  label="Price / tonne (£)"
                  valuePence={m.unit_price_per_tonne_pence}
                  onChange={(pence) => patchMat(i, { unit_price_per_tonne_pence: pence })}
                />
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer text-[10px] font-extrabold uppercase tracking-widest text-brand-muted">
                  Advanced (slug + density + note)
                </summary>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <TextInput
                    label="Slug"
                    value={m.slug}
                    onChange={(v) => patchMat(i, { slug: v })}
                    maxLength={40}
                  />
                  <NumInput
                    label="Density (kg/m³)"
                    value={m.density_kg_per_m3}
                    onChange={(v) => patchMat(i, { density_kg_per_m3: v ?? 2000 })}
                  />
                </div>
                <TextArea
                  label="Note"
                  value={m.note}
                  onChange={(v) => patchMat(i, { note: v })}
                  maxLength={200}
                  rows={2}
                />
              </details>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function SiteCalculatorQuickAdd({ onAdd }: { onAdd: (m: SiteCalculatorMaterial) => void }) {
  const [category, setCategory] = useState(MATERIAL_CATEGORY_PRESETS[0].slug);
  const [label, setLabel] = useState("");
  const [priceGbp, setPriceGbp] = useState("");

  const meta = MATERIAL_CATEGORY_PRESETS.find((c) => c.slug === category);
  const canAdd = label.trim().length > 1 && Number(priceGbp) > 0;

  const add = () => {
    if (!canAdd || !meta) return;
    const pounds = Number(priceGbp);
    const pence = Math.round(pounds * 100);
    const slug = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40);
    onAdd({
      slug: slug || `mat_${Date.now()}`,
      label: label.trim(),
      density_kg_per_m3: densityForCategory(category),
      unit_price_per_tonne_pence: pence,
      note: "",
      category
    });
    setLabel("");
    setPriceGbp("");
  };

  return (
    <div className="rounded-md border-2 border-dashed border-brand-line bg-brand-bg p-3">
      <p className="text-[10px] font-extrabold uppercase tracking-widest text-brand-accent">
        Quick add · Pick category, type name + £/tonne
      </p>
      <p className="mt-0.5 text-[10px] text-brand-muted">
        Density auto-fills from the category. Override in Advanced if a specific supplier has a
        different density. All prices in pounds — we convert to pence on save.
      </p>
      <div className="mt-2">
        <SelectInput
          label="Category"
          value={category}
          options={MATERIAL_CATEGORY_PRESETS.map((c) => ({
            value: c.slug,
            label: `${c.label} · ~${c.density_kg_per_m3.toLocaleString()} kg/m³`
          }))}
          onChange={setCategory}
        />
      </div>
      {meta && (
        <p className="mt-1 text-[9px] text-brand-muted">Common examples: {meta.hint}</p>
      )}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <TextInput
          label="Material name (customer-facing)"
          value={label}
          onChange={setLabel}
          maxLength={80}
          placeholder="e.g. 20mm decorative chip"
        />
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
            Price per tonne (£)
          </span>
          <input
            type="number"
            step="0.01"
            min={0}
            value={priceGbp}
            onChange={(e) => setPriceGbp(e.target.value)}
            placeholder="e.g. 76"
            className="mt-1 h-9 w-full rounded-md border border-brand-line bg-brand-bg px-2 font-mono text-[13px] text-brand-text outline-none focus:border-brand-accent"
          />
        </label>
      </div>
      <button
        type="button"
        onClick={add}
        disabled={!canAdd}
        className={`mt-2 inline-flex h-9 items-center rounded-md px-3 text-[10px] font-extrabold uppercase tracking-widest transition ${
          canAdd
            ? "bg-brand-accent text-black hover:brightness-95"
            : "cursor-not-allowed bg-brand-line text-brand-muted"
        }`}
      >
        + Add material
      </button>
    </div>
  );
}

function PriceInPoundsField({
  label,
  valuePence,
  onChange
}: {
  label: string;
  valuePence: number | null;
  onChange: (pence: number | null) => void;
}) {
  const [text, setText] = useState<string>(
    valuePence !== null && valuePence !== undefined ? (valuePence / 100).toString() : ""
  );
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
        {label}
      </span>
      <input
        type="number"
        step="0.01"
        min={0}
        value={text}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          if (v === "") onChange(null);
          else {
            const p = Number(v);
            if (Number.isFinite(p) && p >= 0) onChange(Math.round(p * 100));
          }
        }}
        className="mt-1 h-9 w-full rounded-md border border-brand-line bg-brand-bg px-2 font-mono text-[13px] text-brand-text outline-none focus:border-brand-accent"
      />
    </label>
  );
}

// ─── Repeat Ladder Editor ─────────────────────────────────────────

export function RepeatLadderEditor({
  value,
  onChange
}: {
  value: PlantRepeatLadder;
  onChange: (next: PlantRepeatLadder) => void;
}) {
  function patch(p: Partial<PlantRepeatLadder>) {
    onChange({ ...value, ...p });
  }
  function patchTier(idx: number, p: Partial<RepeatTier>) {
    onChange({
      ...value,
      tiers: value.tiers.map((t, i) => (i === idx ? { ...t, ...p } : t))
    });
  }
  return (
    <div className="mt-3 space-y-3">
      <Toggle label="Enable repeat ladder" value={value.enabled} onChange={(v) => patch({ enabled: v })} />
      <TextInput label="Heading" value={value.heading} onChange={(v) => patch({ heading: v })} maxLength={100} />
      <TextArea
        label="Sub-heading"
        value={value.subheading}
        onChange={(v) => patch({ subheading: v })}
        maxLength={300}
        rows={2}
      />
      <NumInput
        label="Reset after (months)"
        value={value.reset_after_months}
        onChange={(v) => patch({ reset_after_months: v })}
      />
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">Tiers</p>
        <ul className="mt-1 space-y-2">
          {value.tiers.map((t, i) => (
            <li key={i} className="rounded-md border border-brand-line bg-brand-bg p-2">
              <div className="grid grid-cols-3 gap-2">
                <NumInput
                  label="Hires required"
                  value={t.hires_required}
                  onChange={(v) => patchTier(i, { hires_required: v ?? 1 })}
                />
                <NumInput
                  label="Discount %"
                  value={t.discount_percent}
                  onChange={(v) => patchTier(i, { discount_percent: v ?? 0 })}
                />
                <TextInput label="Label" value={t.label} onChange={(v) => patchTier(i, { label: v })} maxLength={60} />
              </div>
              <button
                type="button"
                onClick={() => onChange({ ...value, tiers: value.tiers.filter((_, j) => j !== i) })}
                className="mt-1 text-[10px] font-extrabold uppercase tracking-widest text-red-500 hover:text-red-300"
              >
                Del
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() =>
            onChange({
              ...value,
              tiers: [...value.tiers, { hires_required: 1, discount_percent: 0, label: "" }]
            })
          }
          className="mt-2 inline-flex h-8 items-center rounded-md border-2 border-dashed border-brand-line px-2 text-[10px] font-extrabold uppercase tracking-widest text-brand-muted hover:border-brand-accent hover:text-brand-text"
        >
          + Tier
        </button>
      </div>
    </div>
  );
}

// ─── Notify + Bulk Editors ────────────────────────────────────────

export function NotifyWhenFreeEditor({
  value,
  onChange
}: {
  value: PlantNotifyWhenFree;
  onChange: (next: PlantNotifyWhenFree) => void;
}) {
  function patch(p: Partial<PlantNotifyWhenFree>) {
    onChange({ ...value, ...p });
  }
  return (
    <div className="mt-3 space-y-3">
      <Toggle label="Enable notify-when-free" value={value.enabled} onChange={(v) => patch({ enabled: v })} />
      <TextInput label="Heading" value={value.heading} onChange={(v) => patch({ heading: v })} maxLength={100} />
      <TextArea
        label="Sub-heading"
        value={value.subheading}
        onChange={(v) => patch({ subheading: v })}
        maxLength={240}
        rows={2}
      />
    </div>
  );
}

export function BulkQuoteEditor({
  value,
  onChange
}: {
  value: PlantBulkQuote;
  onChange: (next: PlantBulkQuote) => void;
}) {
  function patch(p: Partial<PlantBulkQuote>) {
    onChange({ ...value, ...p });
  }
  return (
    <div className="mt-3 space-y-3">
      <Toggle label="Enable bulk quote" value={value.enabled} onChange={(v) => patch({ enabled: v })} />
      <TextInput label="Heading" value={value.heading} onChange={(v) => patch({ heading: v })} maxLength={100} />
      <TextArea
        label="Sub-heading"
        value={value.subheading}
        onChange={(v) => patch({ subheading: v })}
        maxLength={300}
        rows={2}
      />
      <div className="grid grid-cols-3 gap-2">
        <NumInput label="Min machines" value={value.min_machines} onChange={(v) => patch({ min_machines: v })} />
        <NumInput
          label="Min duration (weeks)"
          value={value.min_duration_weeks}
          onChange={(v) => patch({ min_duration_weeks: v })}
        />
        <NumInput
          label="Discount hint %"
          value={value.discount_hint_percent}
          onChange={(v) => patch({ discount_hint_percent: v })}
        />
      </div>
    </div>
  );
}

// ─── Closure Calendar Editor ──────────────────────────────────────

export function ClosureCalendarEditor({
  value,
  onChange
}: {
  value: PlantClosureCalendar;
  onChange: (next: PlantClosureCalendar) => void;
}) {
  function patch(p: Partial<PlantClosureCalendar>) {
    onChange({ ...value, ...p });
  }
  function patchClosure(idx: number, p: Partial<ClosureDate>) {
    onChange({
      ...value,
      closures: value.closures.map((c, i) => (i === idx ? { ...c, ...p } : c))
    });
  }
  return (
    <div className="mt-3 space-y-3">
      <Toggle label="Enable closure calendar" value={value.enabled} onChange={(v) => patch({ enabled: v })} />
      <TextInput label="Heading" value={value.heading} onChange={(v) => patch({ heading: v })} maxLength={100} />
      <TextArea
        label="Sub-heading"
        value={value.subheading}
        onChange={(v) => patch({ subheading: v })}
        maxLength={240}
        rows={2}
      />
      <TextInput
        label="Weekend note"
        value={value.weekend_note}
        onChange={(v) => patch({ weekend_note: v })}
        maxLength={120}
      />
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
          Closures (YYYY-MM-DD)
        </p>
        <ul className="mt-1 space-y-2">
          {value.closures.map((c, i) => (
            <li key={i} className="rounded-md border border-brand-line bg-brand-bg p-2">
              <div className="grid grid-cols-3 gap-2">
                <TextInput
                  label="Date"
                  value={c.date}
                  onChange={(v) => patchClosure(i, { date: v })}
                  maxLength={10}
                  placeholder="2026-12-25"
                />
                <TextInput
                  label="Label"
                  value={c.label}
                  onChange={(v) => patchClosure(i, { label: v })}
                  maxLength={60}
                />
                <Toggle
                  label="Half day"
                  value={c.half_day}
                  onChange={(v) => patchClosure(i, { half_day: v })}
                />
              </div>
              <button
                type="button"
                onClick={() =>
                  onChange({ ...value, closures: value.closures.filter((_, j) => j !== i) })
                }
                className="mt-1 text-[10px] font-extrabold uppercase tracking-widest text-red-500 hover:text-red-300"
              >
                Del
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() =>
            onChange({
              ...value,
              closures: [...value.closures, { date: "", label: "", half_day: false }]
            })
          }
          className="mt-2 inline-flex h-8 items-center rounded-md border-2 border-dashed border-brand-line px-2 text-[10px] font-extrabold uppercase tracking-widest text-brand-muted hover:border-brand-accent hover:text-brand-text"
        >
          + Closure
        </button>
      </div>
    </div>
  );
}

// ─── Sub-Hire Editor ──────────────────────────────────────────────

export function SubHireEditor({
  value,
  onChange
}: {
  value: PlantSubHire;
  onChange: (next: PlantSubHire) => void;
}) {
  function patch(p: Partial<PlantSubHire>) {
    onChange({ ...value, ...p });
  }
  function patchPartner(idx: number, p: Partial<SubHirePartner>) {
    onChange({
      ...value,
      partners: value.partners.map((x, i) => (i === idx ? { ...x, ...p } : x))
    });
  }
  return (
    <div className="mt-3 space-y-3">
      <Toggle label="Enable sub-hire section" value={value.enabled} onChange={(v) => patch({ enabled: v })} />
      <TextInput label="Heading" value={value.heading} onChange={(v) => patch({ heading: v })} maxLength={120} />
      <TextArea
        label="Sub-heading"
        value={value.subheading}
        onChange={(v) => patch({ subheading: v })}
        maxLength={300}
        rows={2}
      />
      <NumInput
        label="Markup %"
        value={value.markup_percent}
        onChange={(v) => patch({ markup_percent: v })}
      />
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">Partners</p>
        <ul className="mt-1 space-y-2">
          {value.partners.map((p, i) => (
            <li key={i} className="rounded-md border border-brand-line bg-brand-bg p-2">
              <TextInput label="Name" value={p.name} onChange={(v) => patchPartner(i, { name: v })} maxLength={60} />
              <ImageUploadField
                label="Partner logo"
                value={p.logo_url}
                onChange={(url) => patchPartner(i, { logo_url: url })}
              />
              <TextInput label="Note" value={p.note} onChange={(v) => patchPartner(i, { note: v })} maxLength={200} />
              <button
                type="button"
                onClick={() =>
                  onChange({ ...value, partners: value.partners.filter((_, j) => j !== i) })
                }
                className="mt-1 text-[10px] font-extrabold uppercase tracking-widest text-red-500 hover:text-red-300"
              >
                Del
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() =>
            onChange({
              ...value,
              partners: [...value.partners, { name: "", logo_url: "", note: "" }]
            })
          }
          className="mt-2 inline-flex h-8 items-center rounded-md border-2 border-dashed border-brand-line px-2 text-[10px] font-extrabold uppercase tracking-widest text-brand-muted hover:border-brand-accent hover:text-brand-text"
        >
          + Partner
        </button>
      </div>
    </div>
  );
}

// ─── Payment Gateways Editor ──────────────────────────────────────

export function PaymentGatewaysEditor({
  value,
  onChange
}: {
  value: PlantPaymentGateways;
  onChange: (next: PlantPaymentGateways) => void;
}) {
  function patch(p: Partial<PlantPaymentGateways>) {
    onChange({ ...value, ...p });
  }
  function patchGw(slug: PaymentGatewaySlug, p: Partial<PlantPaymentGateways["gateways"][PaymentGatewaySlug]>) {
    onChange({
      ...value,
      gateways: {
        ...value.gateways,
        [slug]: { ...value.gateways[slug], ...p }
      }
    });
  }
  return (
    <div className="mt-3 space-y-3">
      <Toggle
        label="Enable payment methods add-on"
        value={value.enabled}
        onChange={(v) => patch({ enabled: v })}
      />
      <TextInput label="Heading" value={value.heading} onChange={(v) => patch({ heading: v })} maxLength={100} />
      <TextArea
        label="Sub-heading"
        value={value.subheading}
        onChange={(v) => patch({ subheading: v })}
        maxLength={300}
        rows={2}
      />
      <div className="grid grid-cols-2 gap-2">
        <NumInput
          label="Deposit %"
          value={value.deposit_percent}
          onChange={(v) => patch({ deposit_percent: v })}
        />
        <TextInput
          label="Balance due (free text)"
          value={value.balance_when}
          onChange={(v) => patch({ balance_when: v })}
          maxLength={60}
          placeholder="on delivery"
        />
      </div>
      <div className="space-y-2">
        {PAYMENT_GATEWAY_META.map((meta) => {
          const g = value.gateways[meta.slug];
          return (
            <div key={meta.slug} className="rounded-md border border-brand-line bg-brand-bg p-2">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-brand-text">
                  {meta.icon} {meta.label}
                </span>
                <Toggle
                  label="Accept"
                  value={g.enabled}
                  onChange={(v) => patchGw(meta.slug, { enabled: v })}
                />
              </div>
              <p className="text-[10px] text-brand-muted">{meta.description}</p>
              {g.enabled && (
                <div className="mt-2 space-y-1">
                  <TextInput
                    label="Display name (optional override)"
                    value={g.display_name}
                    onChange={(v) => patchGw(meta.slug, { display_name: v })}
                    maxLength={60}
                    placeholder={meta.label}
                  />
                  <TextInput
                    label="Payment link URL (Stripe / PayPal.me / GoCardless / Klarna)"
                    value={g.payment_url}
                    onChange={(v) => patchGw(meta.slug, { payment_url: v })}
                    maxLength={800}
                    placeholder="https://buy.stripe.com/…"
                  />
                  <TextArea
                    label="Instructions (BACS details / phone details)"
                    value={g.instructions}
                    onChange={(v) => patchGw(meta.slug, { instructions: v })}
                    maxLength={400}
                    rows={3}
                    placeholder="Sort code · Account no. · Reference to use"
                  />
                  <TextInput
                    label="Fee note (optional display)"
                    value={g.fee_note}
                    onChange={(v) => patchGw(meta.slug, { fee_note: v })}
                    maxLength={60}
                    placeholder="e.g. 1.5% + 20p"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Shared field helpers ─────────────────────────────────────────

function Toggle({
  label,
  value,
  onChange
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-brand-line accent-brand-accent"
      />
      <span className="text-[11px] font-bold text-brand-text">{label}</span>
    </label>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  maxLength
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="mt-1 h-9 w-full rounded-md border border-brand-line bg-brand-bg px-2 text-[12px] text-brand-text outline-none focus:border-brand-accent"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  rows = 3
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={rows}
        className="mt-1 w-full rounded-md border border-brand-line bg-brand-bg px-2 py-1 text-[12px] text-brand-text outline-none focus:border-brand-accent"
      />
    </label>
  );
}

function NumInput({
  label,
  value,
  onChange
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">{label}</span>
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value.trim();
          onChange(raw === "" ? null : Number(raw));
        }}
        className="mt-1 h-9 w-full rounded-md border border-brand-line bg-brand-bg px-2 font-mono text-[12px] text-brand-text outline-none focus:border-brand-accent"
      />
    </label>
  );
}

function SelectInput({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-9 w-full rounded-md border border-brand-line bg-brand-bg px-2 text-[12px] text-brand-text outline-none focus:border-brand-accent"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function StringArrayEditor({
  label,
  values,
  onChange,
  max
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  max: number;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">{label}</p>
      <ul className="mt-1 space-y-1">
        {values.map((v, i) => (
          <li key={i} className="flex items-center gap-2">
            <input
              type="text"
              value={v}
              onChange={(e) => onChange(values.map((x, j) => (i === j ? e.target.value : x)))}
              className="h-8 flex-1 rounded-md border border-brand-line bg-brand-bg px-2 text-[11px] text-brand-text outline-none focus:border-brand-accent"
            />
            <button
              type="button"
              onClick={() => onChange(values.filter((_, j) => j !== i))}
              className="text-[10px] font-extrabold uppercase tracking-widest text-red-500 hover:text-red-300"
            >
              Del
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={values.length >= max}
        onClick={() => onChange([...values, ""])}
        className="mt-2 inline-flex h-8 items-center rounded-md border-2 border-dashed border-brand-line px-2 text-[10px] font-extrabold uppercase tracking-widest text-brand-muted hover:border-brand-accent hover:text-brand-text disabled:opacity-40"
      >
        + Add
      </button>
    </div>
  );
}
