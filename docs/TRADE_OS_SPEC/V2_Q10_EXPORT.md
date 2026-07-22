# Trade Operating System · Volume 2 · Question 10
## Export Architecture — Anti-Lock-In System

**Audience:** Senior Platform Engineers, Print Workflow Engineers, Product Architects
**Source:** ChatGPT design-brief architecture series, V2 Q10.

---

## Philosophy

Most SaaS platforms trap customers. **Trade OS does the opposite.**

The biggest competitive advantage is not keeping files. **It is making merchants trust you.**

The promise:

> *"Everything you create belongs to you. If you ever leave, you take your complete business identity with you."*

Companies that make leaving easy often create the strongest long-term loyalty.

---

## The Export Principle

One click. Everything.

```
Merchant → Export Brand → Brand Package.zip → Ready for:
  Printer · Sign Writer · Designer · Embroiderer · Developer · Marketing Agency
```

**No proprietary formats.**

---

## ZIP Structure

```
BrandOS-Export/
│
├── README.pdf
├── Brand-Guide/
├── Logos/
├── Colours/
├── Fonts/
├── Vehicles/
├── Print/
├── Workwear/
├── Website/
├── Social/
├── Photography/
├── Documents/
├── Signage/
├── Marketing/
├── Tokens/
├── Assets/
├── AI/
└── Licences/
```

Everything organised exactly once.

---

## README (first thing every printer opens)

`README.pdf` contains:
Company · Trade · Export Date · Brand Version · Designer · Contact · Contents · File Structure · Recommended Print Settings · Recommended Vinyl · Recommended Embroidery · Pantone References · Support Contact.

---

## Folder Contents

### Logos
Primary · Secondary · Monochrome · White · Black · Icon · Horizontal · Vertical · Favicons · Social.
Formats: SVG · PDF · PNG · JPG · EPS · AI (optional).

### Brand Guide
Auto-generated PDF: Mission · Positioning · Personality · Logo Rules · Spacing · Typography · Colour Usage · Photography · Iconography · Tone · Do/Don't Examples.

### Colours
`palette.json · palette.csv · ASE · ACO · Pantone.pdf · HEX.txt · RGB.csv · CMYK.csv · RAL.csv`

### Fonts
Licensed Fonts · Open Source Fonts · Licences · Fallback Fonts · Font Pairings.pdf.
**Never export commercial fonts unless licensing allows. Otherwise provide references.**

### Vehicles
Per-model folders (Transit / Vivaro / Trafic / Lorry / Fleet). Each: Preview · Printer PDF · Layer Guide · Panel Layout · Colour Notes · Installation Notes.

### Print
Business Cards · Letterhead · Invoice · Quote · Compliment Slip · Presentation · Envelope · Folders.
Formats: PDF · SVG · AI · Print Notes.

### Workwear
Polo · T-shirt · Hi-Vis · Hoodie · Helmet · Cap · Beanie. Each: Front · Rear · Embroidery · Print Version · Vector Artwork.

### Website
Hero Images · Icons · Illustrations · Logos · Favicons · Open Graph · App Icons · Colour Tokens · Typography Tokens.

### Social
Instagram · Facebook · LinkedIn · TikTok · YouTube · Pinterest · X · Threads. Correctly sized exports per platform.

### Photography
Approved Hero Images · Backgrounds · Portfolio Images · AI Generated Assets · Retouched Images · Stock Licences.

### Documents
Invoice · Quote · Receipt · Purchase Order · Email Signature · Presentation. **Editable versions included.**

### Marketing
Flyers · Leaflets · Posters · Ads · Google Ads · Facebook Ads · Instagram Stories · Referral Cards.

### Tokens ⭐ (most valuable)
`tokens.json · tailwind.config.js · figma.variables.json · swift.json · android.json · css-variables.css · scss.scss`

**Developers use the brand immediately.**

### Assets
Icons · Patterns · Textures · Illustrations · Backgrounds · Mockups.

### AI ⭐ (unique feature)
`brand-dna.json · merchant-memory.json · design-tokens.json · prompt-recipes.json · capability-manifest.json · generation-history.json`

**If the merchant leaves, another AI system can understand the brand. Major differentiator.**

### Licences
Fonts · Photography · Stock Images · Icons · Third Party Assets · Commercial Licences. Everything documented.

---

## Format Matrix

| Asset | Formats |
|-|-|
| Logo | SVG, PDF, PNG, EPS |
| Vehicle | PDF, PNG, AI, SVG |
| Print | PDF/X-4, SVG |
| Website | PNG, WebP, SVG |
| App | PNG, SVG, PDF |
| Social | PNG, JPG |
| Documents | DOCX, PDF |
| Tokens | JSON, CSS, TS |

---

## Print Production Package

Every printable asset includes:
300 DPI · CMYK · 3mm Bleed · Safe Area · Crop Marks · Fonts Outlined · Embedded Images.

**Ready for production.**

---

## Share Links (instead of ZIP files)

```
Merchant → Share → Printer Link · Designer Link · Developer Link · Embroidery Link
```

Each recipient sees only relevant assets.

### Permission Levels

| Role | Access |
|-|-|
| Printer | Read Only · Print Assets |
| Designer | Everything |
| Developer | Tokens · Logos · Icons |
| Marketing | Social · Photography · Brand Guide |

Granular access.

---

## Versioned Exports

Merchant exports: Current Version · Previous Version · Version 8 · Version 3 · Original Brand. **Nothing lost.**

---

## Export Manifest

```json
{
  "brandVersion":    "8.2",
  "generatedAt":     "2026-07-22",
  "tokenVersion":    "5.1",
  "compilerVersion": "7.4",
  "criticVersion":   "3.2",
  "assets":          184,
  "checksum":        "SHA256..."
}
```

Verification-friendly.

---

## Integrity

Every exported asset gets: SHA256 Hash · Version ID · Creation Date · Asset ID.

Useful for audits and enterprise customers.

---

## Print Notes (per printable asset)

Recommended Material · Vinyl Type · Lamination · Pantone · CMYK · Minimum Size · Viewing Distance · Installation Notes.

**Very useful for UK sign writers.**

---

## Backup Strategy

Every export also creates a **Cloud Snapshot** — immutable, restorable years later.

---

## White Label Export

Agencies can export: Agency Branding · No Trade OS Branding · Client Ready.

---

## Export API

```ts
interface ExportService {
  exportBrand(brandId: string, options: ExportOptions): Promise<BrandPackage>;
  createShareLink(assetIds: string[], role: ShareRole, expiresAt?: Date): Promise<ShareLink>;
  restoreSnapshot(snapshotId: string): Promise<void>;
}
```

---

## Export Health Score

Before export:
```
Logo         ✓
Fonts        ✓
Vehicle      ✓
Print        ✓
Workwear     ✓
Website      ✓
Social       ✓
Licences     ✓

Overall     100%
```

**No missing assets.**

---

## Future Export Targets

Extensible interface for new destinations without core changes:

Canva Brand Kit · Adobe Express Brand Library · Figma Team Library · Shopify Theme Assets · WordPress Theme Package · Google Drive · Microsoft 365 Brand Assets · Apple Wallet Brand Passes · Digital Signage Systems · BIM / CAD branding packs.

```ts
interface ExportProvider {
  id:        string;
  supports:  ExportFormat[];
  generate(brand: BrandDNA, assets: AssetCollection): Promise<ExportPackage>;
  validate(): ValidationResult;
}
```

---

## The "Leave With Everything" Promise (marketing)

> Your business owns every file.
> No subscriptions required to access your branding.
> No proprietary formats.
> No lock-in.
>
> If you ever leave Trade OS, you leave with a complete professional brand package that any printer, sign writer, designer, developer, or agency can use immediately.

---

## Strategic Insight

Most design platforms treat export as the last step.

**Trade OS treats export as a first-class capability.**

The export package isn't simply a ZIP — it's **the merchant's complete Brand Operating System in portable form.**

That philosophy builds trust, differentiates the platform, and turns "anti-lock-in" into one of the strongest competitive advantages.

---

## Networkers-specific implementation notes

- **Location:** `src/lib/design/export/` — one file per exporter: `zip-full.ts · printer-pack.ts · designer-pack.ts · developer-tokens.ts · figma-variables.ts · agency-white-label.ts`.
- **ZIP generation** = server-side using `archiver` or `jszip` on Node. Streamed straight to Supabase Storage, then a signed download URL delivered to the merchant.
- **README PDF auto-generation** = Puppeteer + a React template rendering `<BrandGuidePDF brand={...} />`.
- **Share links** = new table `hammerex_brand_share_links` with `role`, `expires_at`, `download_count`, `asset_scope[]`. Powers the Printer/Designer/Developer/Embroidery differentiation.
- **Export health check** = deterministic function scanning `hammerex_brand_identity` + `hammerex_asset_versions` for completeness. Runs before offering the export button.
- **AI folder** is the killer differentiator noted in the doc — write `brand-dna.json + merchant-memory.json + design-tokens.json + prompt-recipes.json + capability-manifest.json + generation-history.json` per merchant. Any competitor AI system can reconstruct the brand. Aligns with the Master Rule (save the recipe, not the image).
- **Cloud snapshot backup** = daily cron writes an immutable export to a separate Supabase Storage bucket with 7-year retention.
- **Route:** `/studio/vault/export` — the merchant-facing export UI. Merchant picks: current vs specific version, full ZIP vs share link, permission level.
- **Enterprise API** = `POST /api/enterprise/brands/:id/export` — authenticated by `enterprise_api_key`, returns a signed download URL. Rate-limited, audit-logged.
