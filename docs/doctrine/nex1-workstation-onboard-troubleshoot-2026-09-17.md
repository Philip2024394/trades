# NEX1 Workstation Onboard · Troubleshoot Closure

**Date:** 2026-09-17
**Author:** master_ai_engineer (Claude Opus 4.7)
**Founder-reported failures (verbatim):**
> "i asked that preview would displaying with progject file - trouble shoot that our work station has the files and software to displaying images gifs icons video etc . we have started this . and also the chat is not actively producing reply trouble shoot - can i see preview
> NEX1 · state=refused
> I couldn't classify your request (refused_no_verb_recognised)."

**Discipline:** Completion Contract · smallest general fix · no test-fitting.

---

## 1 · Root causes

**Bug 1 · Preview panel shows metadata for binary files, never renders them.**
`repo-file/route.ts` returned `{ kind: "binary", download_hint: "content not returned by this endpoint." }` for every non-text file. Images, gifs, icons, videos, audio, and pdf all fell into this branch, so `OnboardClient.tsx` had no bytes to render.

**Bug 2 · "can i see preview" refused with `refused_no_verb_recognised`.**
The workstation chat panel routed to `/api/nex1/chat/turn`, which is the **code-goal** classifier. That classifier's verb gate (Session-3 documented failure pattern) refuses any message lacking a coding verb — "see" is a navigation verb, not a coding verb, so the message was dropped before any downstream extractor could run.

---

## 2 · Fixes shipped

### Fix 1 — Raw bytes for binary preview

`src/app/api/nex1/workstation/repo-file/route.ts`:
- Added `?raw=1` query parameter → streams file bytes with correct
  `Content-Type` (image/png · image/svg+xml · image/x-icon · image/gif ·
  video/mp4 · audio/mpeg · application/pdf · …).
- All existing sandbox checks (path traversal · symlink · corpus containment ·
  repo_id slug) run **before** raw streaming. Sandbox is unchanged.
- Added `RAW_MAX_BYTES = 25 MB` cap and `X-Content-Type-Options: nosniff`.
- Binary metadata JSON now includes `preview_kind` (`image` / `video` /
  `audio` / `pdf` / `binary_other`) and `raw_url` so the client knows which
  element to render.

`src/app/nex1/workstation-live/onboard/OnboardClient.tsx`:
- Renders `<img src=raw_url>` for images (PNG · JPG · GIF · SVG · ICO · WEBP).
- Renders `<video src=raw_url controls>` for videos.
- Renders `<audio src=raw_url controls>` for audio.
- Renders `<embed src=raw_url type="application/pdf">` for PDFs.
- Fallback link `open raw` for other binary types.
- Empty-state text lists all supported preview kinds so the user knows what
  the workstation can display.

### Fix 2 — Workstation-scoped chat responder

**New file · `src/app/api/nex1/workstation/chat/route.ts`.** Deterministic
pattern-matching responder for workstation-context intents:

| Intent | Pattern | Response |
|--------|---------|----------|
| `PREVIEW` | see · show · preview · open · view · display · render · look at | Instructions on how to preview via the file tree |
| `LIST` | list · tree · what files · files in · contents · browse | Points to the file tree in the LEFT panel |
| `SIZE` | size · how big · file count · bytes · kb · mb | Real repo file count + total bytes from context |
| `FRAMEWORK` | framework · built with · stack · tech · library | Detected frameworks from context |
| `SUGGESTIONS` | suggestion · improvement · advice · issues · restructure (in question form) | Real suggestion count + explanation |
| `SCAN` | scan · malware · virus · safe · threat | Real scan-error count from context |
| `REPOS` | which repos · available repos | Points to top LEFT panel |
| `GREET` | hi · hello · hey · yo · hola · gm | Context-aware greeting |
| `CODE_GOAL` | build · fix · refactor · add · remove · change · replace · rewrite · … (command form) | Delegates to `/api/nex1/chat/turn` |
| `UNKNOWN` | (none of the above) | **Clarification with actionable examples · NOT "refused"** |

**General shape of the fix (per Continuous Learning Program):**
1. **Question-form detection runs FIRST.** Messages starting with an
   interrogative (`why · what · how · where · when · which · who · can ·
   could · would · should · do · does · did · is · are · will · may · might`)
   or ending in `?` are treated as questions. Navigation patterns are checked
   *before* coding-verb detection. This means "why the restructure suggestion"
   correctly maps to `SUGGESTIONS`, not to `CODE_GOAL` — even though
   "restructure" is a coding verb, its role here is nominal, not imperative.
2. **Command-form messages** (imperative · no leading interrogative · no `?`)
   still delegate to the code-goal classifier when they contain a coding verb.
   "Refactor the pricing function" → CODE_GOAL as expected.
3. **UNKNOWN never returns "refused."** It offers actionable examples.

`OnboardClient.tsx`:
- Chat now routes to `/api/nex1/workstation/chat` with `repo_id` + full
  `context` (file_count · total_bytes · frameworks · suggestions_count ·
  scan_errors_count · ready_for_prompt · selected_file_path).
- Chat input **unlocks on repo select**, not only after `ready_for_prompt`,
  so the user can ask navigation questions during onboarding.
- The reply from the workstation responder is displayed with a state chip
  showing `answered · clarification_offered · forwarded → /api/nex1/chat/turn
  · needs_repo`.
- When a coding goal is forwarded, the upstream text is unwrapped and shown
  in the chat feed with the upstream state visible.

---

## 3 · Runtime verification · 2026-09-17

All 11 cases executed against the running dev server.

### Chat responder (8 intents)

| # | Message | Intent | State |
|---|---------|--------|-------|
| 1 | "can i see preview" *(founder's exact failed message)* | PREVIEW | answered |
| 2 | "show me the file tree" | LIST | answered |
| 3 | "how big is this repo" | SIZE | answered (returns `750 files · 8.00 MB`) |
| 4 | "what framework is it" | FRAMEWORK | answered (returns `Next.js + React`) |
| 5 | "why the restructure suggestion" | SUGGESTIONS | answered |
| 6 | "refactor the pricing function to use Math.max" | CODE_GOAL | forwarded → `/api/nex1/chat/turn` (200) |
| 7 | "zqxwv qzp abc" | UNKNOWN | clarification_offered *(NOT refused)* |
| 8 | "show me a file" *(no repo selected)* | PREVIEW | needs_repo |

### Binary preview (3 cases)

| # | File | Content-Type | Result |
|---|------|--------------|--------|
| 9  | `corpus-cityapp/android/.../splash.png` | `image/png` · 172,271 bytes | First 8 bytes = `89 50 4e 47 0d 0a 1a 0a` (PNG magic) — real image bytes served ✓ |
| 10 | *(some SVG in corpus)* | `image/svg+xml` | Content-type correct ✓ |
| 11 | *(some ICO in corpus)* | `image/x-icon` | Content-type correct ✓ |

### Sandbox regression

- `/api/nex1/workstation/repo-file?path=../../../etc/passwd&raw=1` → **400
  path_traversal_rejected** — sandbox holds through raw mode.

### Page + regression

- `GET /nex1/workstation-live/onboard` → 200 · 29,816 bytes ·
  `OnboardClient` present in RSC payload.
- Existing text/HTML preview paths untouched · verified with
  `public/offline.html` in `corpus-website` → still `kind=file · lang=html ·
  has_content=true`.

---

## 4 · What was NOT touched

- `/api/nex1/chat/turn` — untouched. Workstation chat delegates to it for
  code goals unchanged.
- Code-goal classifier verb gate — untouched. Session-3 failure pattern
  is unresolved in the coding channel; the general fix here is that
  workstation-navigation questions no longer flow through the code-goal
  classifier at all.
- Batch 1 · Batch 2A streaming · Batch 2B safety gate — untouched.
- ConversationHead · Q7/Q8 policy · nex-debugger — untouched.
- Native onboarding capability itself — untouched (event stream is unchanged).
- Corpus data — untouched (all reads are read-only).
- Pricing.ts SHA `150158baa3b0274a` — unchanged.
- 0 commits · 0 pushes · 0 external model.

---

## 5 · Honest known limitations

Per Continuous Learning Program · disclose rather than test-fit:

- **Definitional questions ("what does refactor mean?")** currently delegate
  to `/api/nex1/chat/turn` because they contain a coding verb and no navigation
  pattern matches. That's a new capability (HELP / DEFINE) which would need
  founder authorization. Not fixed here.
- **Image thumbnails in the file tree** are not shown — files still display
  as `📄 name.png`. Adding thumbnails would require reading the file to
  determine kind before click. Not fixed here.
- **Video / audio autoplay** intentionally NOT enabled — user must click
  play. That is the correct security posture.
- **PDF embed** relies on browser PDF support. Chrome / Edge / Firefox handle
  it; some minimal browsers fall back to download.

---

## 6 · Where to view it

**URL:** `http://localhost:3008/nex1/workstation-live/onboard`

Flow:
1. Open the URL — 3 corpus repos appear as buttons after client hydration.
2. Click a repo → SSE feed streams onboarding events into the RIGHT panel;
   file tree populates in the LEFT panel when onboarding completes.
3. Click any file:
   - Code file → syntax-hinted read-only panel
   - HTML file → sandboxed iframe (scripts disabled)
   - **Image / GIF / SVG / ICO / WEBP → renders inline via `<img>`**
   - **Video → renders with controls**
   - **Audio → renders with controls**
   - **PDF → renders in embedded viewer**
4. Chat panel unlocks the moment a repo is selected. Ask navigation
   questions ("can i see preview" · "how big is this repo" · "what
   framework" · "why the restructure suggestion" · "any scan errors")
   and receive real deterministic answers with source `NEX1_NATIVE ·
   zero_llm: true`.
5. State a coding goal ("refactor …", "fix …", "change …") → delegated
   to the code-goal channel.

Files changed in this troubleshoot:
- `src/app/api/nex1/workstation/repo-file/route.ts` — raw mode + preview_kind
- `src/app/api/nex1/workstation/chat/route.ts` — NEW file
- `src/app/nex1/workstation-live/onboard/OnboardClient.tsx` — media rendering + workstation chat + unlock-on-select
