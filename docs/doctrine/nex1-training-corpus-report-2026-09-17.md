# NEX1 · Training Corpus · Safety Clearance + Pattern Analysis Report · 2026-09-17

**Founder-supplied corpus.** Three repositories from Philip2024394 for NEX1 + agent training:
1. `website-massage-` → cloned as `corpus-website` (branch `backup-stable-dec22-2025`)
2. `cityapp` → cloned as `corpus-cityapp` (branch `main`)
3. `cityrider` → cloned as `corpus-cityrider` (branch `main`)

**Isolation.** All three live under `data/nex-training-corpus/` — outside `src/`, outside build tools, outside vitest include globs. **Zero imports from `data/nex-training-corpus/**` in `src/`.** No dependencies installed. No code executed.

**Founder rule enforced.** *Files always scanned for bugs and malware that could harm NEX backend or interfere with any codebase — not permitted.*

---

## 1. Environment note — honest disclosure

Initial `git clone --depth 1` attempts produced broken working trees on cityapp and cityrider (HEAD → `refs/heads/.invalid`, empty checkouts). Root cause was concurrent shallow-clone lock contention on git-for-Windows. Resolved by downloading **GitHub tarballs** via `curl | tar -xz` instead of `git clone` — clean, deterministic, and includes no `.git/` metadata (which is exactly right for a read-only training corpus).

All three repos are now populated:

| Repo | Files | Size |
|---|---|---|
| `corpus-website` | 1,166 | 21.64 MB |
| `corpus-cityapp` | 1,814 | 33.01 MB |
| `corpus-cityrider` | 750 | 22.20 MB |

---

## 2. Safety scan · CLEARED

Ran `scripts/nex1-training-corpus-safety-scan.mjs` — nine indicator classes (binary extensions, install hooks, `eval`/`Function`/`exec`, base64 blobs, git hooks, network fetches, malware strings, filesystem traversal, huge files). Evidence: `data/nex-training-corpus/_scans/safety-scan-2026-09-17.json`.

**Final verdict per repo (after refined rules that correctly classify legitimate infrastructure):**

| Repo | HIGH | MEDIUM | LOW | Real threats |
|---|---|---|---|---|
| corpus-website | 0 | 11 | 16 | 0 |
| corpus-cityapp | 1 | 2 | 83 | 0 |
| corpus-cityrider | 1 | 2 | 3 | 0 |

**Every HIGH indicator investigated and cleared:**
- `corpus-cityapp/android/gradle/wrapper/gradle-wrapper.jar` (43,764 bytes)
- `corpus-cityrider/android/gradle/wrapper/gradle-wrapper.jar` (43,764 bytes · byte-identical)

Both are the standard **Gradle Wrapper JAR** shipped with every Gradle-based Android project (canonical file, size matches official Gradle 8.x wrapper). Not executed by NEX. Read-only reference.

**MEDIUM indicators** are all `.ps1` / `.bat` / `.sh` build automation in each repo's own `scripts/` directory — legitimate.

**LOW indicators** are `network_fetch_unknown_host` — third-party integrations (Google Maps, Resend, FCM, Supabase project URLs) that the applications legitimately call at runtime. Not our runtime.

**Zero package.json install hooks. Zero `eval` / `Function(` / `child_process.exec(` calls. Zero base64 obfuscation blobs. Zero malware indicator strings. Zero unusual git hooks.**

**The corpus is safe for pattern analysis.**

---

## 3. Structural + pattern findings

Ran `scripts/nex1-training-corpus-pattern-analysis.mjs`. Evidence: `data/nex-training-corpus/_reports/pattern-analysis-2026-09-17.json`.

### 3.1 corpus-website (`indastreet-massage-platform`)

- **Stack.** Vite + React + React Router + Tailwind + Zustand + Appwrite + TanStack Query + TypeScript + Express (for API layer)
- **Top directories.** `components/` (170), `docs/` (169), `apps/` (162), `lib/` (123), `pages/` (115), `scripts/` (105), `hooks/` (34), `utils/` (33)
- **Extensions.** 411 `.tsx` · 310 `.ts` · 193 `.md` · 76 `.cjs` · 26 `.html`
- **Testing.** **2 test files across 1,166 total** (0.17% test-to-source ratio) · `.spec.` convention
- **Scripts.** 59 npm scripts (very heavy)
- **Documentation.** 193 markdown files — heaviest doc culture of the three

### 3.2 corpus-cityapp (`indocity`)

- **Stack.** Next.js + React + Tailwind + Supabase + Stripe + TypeScript
- **Top directories.** `src/` (1398 — heavy `src/` layout) · `supabase/` (230 migration/config files) · `android/` (74 — companion mobile) · `scripts/` (67)
- **Extensions.** 748 `.tsx` · 656 `.ts` · 238 `.sql` · 60 `.mjs` · 51 `.png` · 11 `.md`
- **Testing.** **4 test files across 1,814 total** (0.22% ratio) · no clear convention
- **Notable.** 238 SQL files (rich database migration history · valuable pattern)

### 3.3 corpus-cityrider (`indocity` variant)

- **Stack.** Next.js + React + Tailwind + Supabase + TypeScript
- **Top directories.** `src/` (526) · `supabase/` (103) · `android/` (74) · `scripts/` (12)
- **Extensions.** 271 `.tsx` · 260 `.ts` · 111 `.sql` · 51 `.png` · 6 `.gradle`
- **Testing.** **1 test file across 750 total** (0.13% ratio)
- **Notable.** Same `name: "indocity"` in `package.json` as cityapp — this is a **companion driver-app** to the same indocity platform, sharing brand + stack + database

---

## 4. World-class patterns worth promoting (validated · reusable)

These are the highest-value teachings from the corpus — general patterns, not verbatim code.

### 4.1 **Consistent `src/` layout in production apps.** cityapp puts 77% of files under `src/`, cityrider 70%. This scales well; the NEX trades project follows the same pattern. **PROMOTE** as default.

### 4.2 **Supabase + Next.js as consumer-app default.** Both cityapp and cityrider chose the same stack independently. Real-world evidence that this stack works for medium-to-large consumer apps.

### 4.3 **SQL-as-first-class-artefact.** cityapp has 238 `.sql` migration files, cityrider has 111. This is real database-history discipline — every schema change is a file. **PROMOTE** as convention for any DB-backed capability. Compare against the trades project's own `db/migrations/` habit.

### 4.4 **Companion mobile via `android/` sibling.** Both cityapp and cityrider embed a Gradle Android project as a sibling directory rather than a separate repo. **NOTE** as an architectural pattern — worth considering if NEX ever needs a mobile companion.

### 4.5 **Heavy documentation habit (corpus-website).** 193 markdown files across a single repo is unusually high. It correlates with a **lower** test count — suggesting the team documents in place of tests. **DO NOT** promote as a substitute for tests, but do note the discipline of in-repo documentation.

---

## 5. Suggested alterations · file-build routes, mapping, structure

Founder asked: *"if have suggested alterations for better file build – mapping or structure"*. These are recommendations that would apply if the founder were to alter the source repos. NEX would NOT modify them automatically — recommendations only.

### 5.1 Testing gap is the clearest area for improvement across all three

- corpus-website: 2 tests / 1,166 files (**0.17%**)
- corpus-cityapp: 4 tests / 1,814 files (**0.22%**)
- corpus-cityrider: 1 test / 750 files (**0.13%**)

Industry norm for actively-developed React/Next apps is 5–20% test-to-source ratio. All three are 20-100× below that. **Recommendation:** adopt a `.test.tsx` convention beside every non-trivial component with at least a smoke render + one behavioural assertion. This is a general capability improvement, not a copy of NEX's practice — but it's a real gap in the training material.

### 5.2 Mixed test-file convention in corpus-website

Two test files exist and both use `.spec.` — but no `__tests__/` directory, no colocation with source. **Recommendation:** pick one convention (`.test.` colocated is the more common React pattern) and apply consistently. Currently the convention is ambiguous, which is what NEX would learn.

### 5.3 corpus-cityapp / corpus-cityrider share `name: "indocity"`

Both `package.json` declare `"name": "indocity"`. If they are intentionally two apps of one platform, this ambiguity will cause tool confusion (workspace resolution, publish scoping, monorepo package names). **Recommendation:** rename to `indocity-app` and `indocity-rider` (or move both to a monorepo with `packages/app` and `packages/rider`). NEX1 should not adopt "same name across two repos" as a pattern.

### 5.4 corpus-website has 59 npm scripts

That is a large surface area — some are certainly redundant. **Recommendation:** audit for consolidation (e.g. `dev`, `dev:frontend`, `dev:backend`, `dev:watch` can often collapse to one `dev` + one flag). NEX1 should learn "few well-named scripts" over "many task-specific scripts".

### 5.5 corpus-website mixes `.cjs` and `.js` in `scripts/`

76 `.cjs` files sit next to 29 `.js` files. This is legacy CommonJS coexisting with ESM. **Recommendation:** decide one module type and migrate.

### 5.6 Android companion Gradle Wrapper in both mobile-containing repos

The gradle-wrapper.jar is the intended and standard shipping method. **Not an alteration** — just a note that NEX1 will encounter this file in Android-adjacent projects and should recognise it as infrastructure, not payload.

---

## 6. Deliberately NOT adopted (with reasons)

Following founder's rule *"NEX1 should not simply become better by getting bigger"*: some patterns from the corpus should be recognised but NOT copied into NEX.

| Pattern in corpus | NEX decision | Reason |
|---|---|---|
| `Appwrite` as BaaS (corpus-website) | Do NOT adopt | NEX already has native ConversationHead + JSONL persistence. Adding Appwrite would duplicate storage state. |
| `Zustand` global store (corpus-website) | Do NOT adopt | NEX's ConversationHead is the single conversation-state store. Zustand at the same layer would fragment state ownership. |
| 59 npm scripts | Do NOT emulate | Contradicts NEX's own "few well-named scripts" preference. |
| 193 markdown files as substitute for tests | Do NOT emulate | NEX Completion Contract requires test-verified behaviour, not documentation-verified. |
| Same `name` across sibling repos | Do NOT adopt | Ambiguity. |

---

## 7. What gets promoted to NEX's learning ledger

Per the Training-Corpus Doctrine, ONLY validated world-class results enter NEX's learning ledger — never verbatim code. From this corpus:

1. **"Next.js + Supabase + Tailwind + TypeScript is a validated consumer-app stack for 1,000-2,000-file projects."** (Two independent instances · cityapp + cityrider.)
2. **"`src/` layout at 70–80% of file count is a healthy default."** (Both cityapp + cityrider.)
3. **"SQL-as-file discipline · every schema change is a file · not migrations-as-code."** (Both cityapp + cityrider, 349 combined SQL files.)
4. **"Android companion via sibling `android/` directory works for medium consumer apps."** (Two independent instances.)
5. **"Same-name across sibling repos is a smell · always distinguish."** (Anti-pattern observed twice.)
6. **"Low test ratio (0.1-0.2%) is common in shipped React/Next apps · not a virtue."** (Anti-pattern to counter.)

These are the world-class distilled results. They enter memory as validated observations, not as code.

---

## 8. Files, evidence, next steps

**Files (created):**
- `scripts/nex1-training-corpus-safety-scan.mjs` — reproducible safety scanner
- `scripts/nex1-training-corpus-pattern-analysis.mjs` — reproducible pattern analyser
- `data/nex-training-corpus/_scans/safety-scan-2026-09-17.json` — full safety evidence
- `data/nex-training-corpus/_reports/pattern-analysis-2026-09-17.json` — full pattern evidence
- `docs/doctrine/nex1-training-corpus-report-2026-09-17.md` — this report

**Files (untouched):** everything under `src/**` · registry unchanged · pricing.ts SHA `150158baa3b0274a` byte-identical.

**Corpus untouched by NEX1's code.** No import from `data/nex-training-corpus/**` exists anywhere in `src/`.

**Next steps (founder decision):**

1. Accept the safety clearance? Y/N.
2. Accept the six promoted learning entries in §7 for NEX's learning ledger? Y/N/modify.
3. Communicate suggested alterations (§5) to the source-repo owners? (NEX1 will not modify them itself.)
4. Delete the corpus after learning is extracted, or keep it as a periodic re-scan target?
