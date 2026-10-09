# MATRICULATION PHYSICS QUESTION BANK

# CURRICULUM PRESENTATION + CHAPTER-GROUPED TOPIC FILTER

**FINAL STATUS: BLOCKED ? public /api/counts exposes identifiers from the draft curriculum**

Verified locally on 9 October 2026. The public curriculum now groups Course → Curriculum Version → Semester → Chapter → Topic. Topic checkboxes now group Semester → Chapter → Topic using stored order. The initial UI implementation made no production curriculum mutation, activation, question creation, Blob operation, migration, commit, push or deployment. The separately authorized commit/Preview follow-up is recorded below.

## ROOT CAUSES

Public curriculum ambiguity: `PublicCurriculum.tsx` previously rendered every publicly eligible semester directly under its course, ignoring `curriculumVersionId`. Active and retired versions therefore produced duplicate-looking semester headings without version context. The server already excluded drafts correctly; its authorization policy needed no adjustment.

Flat Topic filter issue: `Browser.tsx` previously mapped the API's flat topic array directly into checkboxes. The API orders records by `sort_order` and name across the table; topic orders restart within each chapter. Mapping that array globally interleaved topics from different chapters.

Read and inspected the production draft import report, combined dry-run report, both hierarchy reports, admin security report, `docs/production-and-pilot.md`, taxonomy/version APIs, visibility service, public browser, admin editor and existing browser tests. Dated historical deployment guidance was interpreted alongside the completed production draft import report.

## IMPLEMENTATION

| Check | Result |
| --- | --- |
| Version-aware public hierarchy | PASS — explicit version membership, then parent relationships |
| Current curriculum section | PASS — “Current Curriculum”, stored version name and code |
| Historical curriculum separation | PASS — collapsed native “Historical curricula” disclosure, stored historical name and “Retired” |
| Draft hidden | PASS — unchanged server filtering; draft API, direct export and anonymous page tests |
| Raw internal IDs hidden | PASS — human names/code appear in rendered public content; stable IDs remain in control values and URLs |
| Proper headings and keyboard access | PASS — course h2, version h3, semester h4, chapter h5; keyboard-operable history disclosure |
| Admin editor preserved | PASS — unchanged source; isolated admin sees the draft, version status/name, hierarchy and all 82 topic options |

`inStoredOrder` sorts copies of sibling arrays using their numeric `order` field. It does not mutate shared taxonomy or parse display numbering. Existing API order is preserved for equal order values. No server response adjustment was required.

## TOPIC FILTER

| Check | Result |
| --- | --- |
| Semester grouping | PASS — “All” retains both semesters, grouped separately; selected semester narrows the existing filters |
| Chapter grouping | PASS — nested fieldsets with accessible semester/chapter legends |
| Stored chapter order | PASS — sibling chapter order, including a fixture whose order contradicts display numbering |
| Stored topic order | PASS — sibling topic order within each chapter, including the deliberately reordered fixture |
| Stored semester order | PASS — reordered fixture displays Semester 2 before Semester 1 |
| Stable topic IDs retained | PASS — original checkbox selection/update logic and ID query values |
| URL persistence | PASS — semester/topic/difficulty survive reload and browser back navigation; mobile selections survive reload |
| Server filtering semantics | PASS — isolated approved questions distinguish semester and difficulty outcomes; no client database filtering added |
| Zero-question state | PASS — full 36-topic/46-topic filters render with zero matching questions |
| Desktop/mobile layout | PASS — 1280×1000 and 390×844; no horizontal page overflow; long SP025 labels wrap; mobile filters open/close |
| Accessibility | PASS — axe scans of current/historical curriculum and desktop/mobile filters return zero violations |

When multiple versions are browsed together, semester topic-group legends include the stored version name to distinguish otherwise identical semester labels. The chapter/topic browser beside the filters also uses stored sibling order. Query parameter names, stable selections, filter resets, visibility choices and server query behavior remain unchanged.

## PERMANENT SEMESTER IDENTITY RULE

The user-approved permanent display names are **Semester 1** and **Semester 2** across syllabus revisions. **PASS**: generic UI code uses stored semester names and stable IDs; it contains no SP015/SP025 mapping or identity inference. These codes belong only to the 2022/2023 source/provenance package and explicit version-specific fixtures/documentation.

No official-course subtitle is required. Renaming semesters to Physics 1 (SP015) / Physics 2 (SP025), hard-coding those mappings or creating migration 004 for subtitles is outside the approved product design. The earlier subtitle limitation is superseded by this product decision. No taxonomy, ID, slug or schema change was made.

## SECURITY AND SCHEMA

Initial taxonomy/version/export and page checks found no draft leakage. Follow-up live verification confirms **draft identifier leakage through `/api/counts`**, documented below. Auth behavior changed: **NO**. Production database writes: **NO**. Production curriculum activation: **NO**. Blob access/writes: **NO**. Migration 004: **NO**. No authentication, sessions, CSRF, public/private visibility, storage, API or schema source changed.

The new browser fixture explicitly creates SQLite `:memory:` banks and serves the unchanged real application on ephemeral loopback ports. Fixture preparation imports the copied curriculum and simulates activation only in that isolated bank. One test leaves it draft; positive-result tests add four synthetic, approved, test-only questions locally. The existing migration runner seeds only the isolated test databases. Quality commands run with Turso/Blob credentials removed. The committed JSON fixture matches the complete approved import model; the approved artifact itself is untouched.

## DATABASE — READ-ONLY SANITY CHECK

Two SELECT-only audits of `matriculation-physics-question-bank` at **2026-10-09 11:17:09 UTC** and **11:19:48 UTC** match the completed production import audit and each other. No production authentication session was created. Credential/session values are excluded from the audit evidence.

| Production check | Result |
| --- | --- |
| LEGACY active | YES — unchanged |
| PHYSICS-2022-2023 draft | YES — unchanged, not active |
| New hierarchy | 2 semesters / 18 chapters / 82 topics / 0 subtopics |
| Total semester rows | 4 — two LEGACY plus two draft semester rows |
| Production curriculum changed | NO — domain rows, schema and migration history identical |
| Questions | 0 production questions remain |
| Assets | 0 |
| Curriculum events | 1 — unchanged from the completed draft import |
| Pre-import backup | `phys-pre-curr-20261009-c453ac` retained; no backup operation in this task |

Unchanged production domain SHA-256: `793c3d0b43fdca3f5e54a939c16736a26bc5dc09b8985db63265e36affdf0e85`.

Unchanged schema SHA-256: `c88838ecec773071996bc1a77825c0443f1a6faa2217b4f49c3fa01ce81837ae`.

Unchanged migration-history SHA-256: `ecfed613f40e9ecee5f886c04692b8500e9b5ef2db29272c9facd4b551e89db2` (existing migrations 001–003).

Approved combined artifact SHA-256 remains **`5350252cd5a76faa78437e338cf54c16a2c4e62ceb694216fb806b8f33753ace`**. The source PDF hashes also match the approved package. All 190 files in the prior preservation manifest were compared: only the three authorized existing UI files changed; the other 187 files, including backend, schema, migration, reviewed reports and combined dry-run package, are unchanged.

## QUALITY

| Command | Result |
| --- | --- |
| npm run typecheck | PASS |
| npm run lint | PASS |
| npm test | PASS — 122 unit/integration tests |
| npm run db:check | PASS |
| npm run schema:check | PASS |
| npm run api:check | PASS |
| npm run api:esm:check | PASS |
| npm run storage:check | PASS |
| npm run auth:check | PASS |
| npm run build | PASS |
| npm run test:browser | PASS — 29 browser tests (22 existing + 7 focused) |
| git diff --check | PASS |

The positive-question fixture initially failed the existing strict code/answer-scheme validator. Its synthetic data was corrected; validation was preserved and the filtering test passed. The additional closer desktop capture was also checked with typecheck, lint and its focused browser test.

## FILES CHANGED

Existing source:

- `src/PublicCurriculum.tsx` — version hierarchy and current/historical sections.
- `src/Browser.tsx` — semantic semester/chapter topic groups and stored order.
- `src/styles.css` — scoped hierarchy/group spacing and safe label wrapping.

New source/test/report files:

- `src/taxonomy-order.ts` — shared copied-array order helper.
- `tests/browser/curriculum-presentation-fixture.ts` — explicit isolated full-curriculum fixture server.
- `tests/browser/curriculum-presentation.spec.ts` — seven focused browser tests.
- `tests/fixtures/physics-curriculum.json` — standalone test copy of the approved 2/18/82/0 model.
- `CURRICULUM_PRESENTATION_TOPIC_FILTER_REPORT.md` — this report.

Existing admin/source security files, prior reports and curriculum-import artifact are unchanged. No existing test was weakened.

## BROWSER EVIDENCE

Captured and visually reviewed local fixtures, not production activation:

- [Current curriculum — desktop](data/curriculum-presentation/curriculum-desktop.png)
- [Current curriculum — mobile](data/curriculum-presentation/curriculum-mobile.png)
- [Historical curriculum — desktop](data/curriculum-presentation/curriculum-history-desktop.png)
- [Historical curriculum — mobile](data/curriculum-presentation/curriculum-history-mobile.png)
- [Zero-question browser — desktop](data/curriculum-presentation/topic-filter-desktop.png)
- [Chapter/topic groups — desktop](data/curriculum-presentation/topic-groups-desktop.png)
- [Long SP025 topic labels — mobile](data/curriculum-presentation/topic-filter-mobile.png)

Ignored local evidence directory `data/curriculum-presentation/` contains screenshots, quality logs/results, SELECT-only before/after audits and the final preservation verification. Browser tests regenerate their captures in `test-results/`; the fixture JSON is included in test source so CI does not depend on ignored import data.

## PRODUCTION ACTIONS

Curriculum data changed: **NO**. Activation: **NO**. LEGACY retired: **NO**. Questions created: **NO**. Blob write: **NO**. Migration: **NO**. Commit: **NO**. Push: **NO**. Deployment: **NO**.

**INITIAL UI IMPLEMENTATION STATUS: READY FOR REVIEW**

Recommended next step: review the UI/browser evidence. After separate approval, commit/push these UI changes and test a protected Preview against an isolated active combined-curriculum fixture or safe read-only production state. Curriculum activation remains a later, separately authorized decision.

## COMMIT / PROTECTED PREVIEW VERIFICATION

### BRANCH / COMMIT / PUSH

Branch: **`feat/admin-security`**.

SHA: **`fbaba37c5f0099c66edbce90b342fd89235f3d67`**.

Message: **Improve curriculum browsing and topic grouping**.

Push: **PASS** ? normal fast-forward push to origin; remote branch SHA independently matches. No merge, amend or force-push. Exactly the eight intended source/test/report files listed above were staged and reviewed with `git diff --cached --stat`, full staged diff and `git diff --cached --check`. No unrelated tracked changes existed. Unrelated untracked reports, credentials, environment files, screenshots, PDFs and ignored staging evidence were excluded.

The final local gate was rerun before commit: **all 12 requested checks PASS**, 122 unit/integration tests and 29 browser tests. The existing positive-result browser test was extended to verify Forward followed by Back with the same semester/topic/difficulty selection; the count remains 29. Permanent semester names were recorded before commit.

### PREVIEW

Deployment URL: **https://matriculation-physics-question-bank-flzkokglr.vercel.app**.

Deployment ID: **`dpl_5EJJyBeEAAw6triCrXUtaXzk7k5c`**.

Environment: **Preview**. State: **READY**. Branch: **feat/admin-security**.

Protection enabled: **PASS** ? existing SSO `all_except_custom_domains` remains enabled; a request without Vercel authentication receives HTTP 302. Existing Vercel automation authentication allows the protected health request and remains only in memory. No token was printed, persisted or included in screenshots. No Question Bank administrator login/session was created.

Commit match: **PASS** ? deployment API Git metadata matches the pushed SHA and feature branch. `vercel inspect --json` confirms Preview/Ready; raw deployment API metadata independently confirms commit/branch. Vercel's Production branch remains `master`; the Git push triggered this Preview. No Production deployment or promotion was requested. Production deployment IDs, environment metadata fingerprint and SSO settings match their pre-push snapshots. No Turso/Blob binding was changed.

### LIVE PREVIEW

| Check | Result |
| --- | --- |
| Health | PASS ? HTTP 200, status ok, database connected |
| Application load | PASS ? actual deployed frontend renders Current Curriculum / Existing curriculum (unversioned), Semester 1 and Semester 2 |
| Public taxonomy/version APIs | PASS ? LEGACY active only; draft version and hierarchy absent |
| Direct draft export | PASS ? HTTP 401 without Question Bank admin authentication |
| Public questions, including a draft-version filter | PASS ? zero items/results |
| Anonymous draft leakage | **CONFIRMED through `/api/counts`: 82 draft topic rows expose semester/chapter/topic IDs** |
| Console errors / uncaught JavaScript errors | NONE |
| Failed application asset/API loads in browser navigation | NONE |
| Desktop, 1280?1000 | PASS ? layout, navigation, semester switching, difficulty/reload/Back/Forward state; no horizontal overflow |
| Mobile, 390?844 | PASS ? same state/navigation checks plus Filters open/close and aria-expanded; no horizontal overflow |
| Live filter accessibility | PASS ? axe reports zero violations in both viewports |

The live Preview correctly shows the current LEGACY hierarchy and zero-question filter shell. It does not show the draft as active, has no real topic options and cannot demonstrate the future 82-topic display. Screenshots were captured and visually reviewed:

- [Live curriculum ? desktop](data/curriculum-preview-review/preview-desktop-curriculum.png)
- [Live filter shell ? desktop](data/curriculum-preview-review/preview-desktop-filters.png)
- [Live curriculum ? mobile](data/curriculum-preview-review/preview-mobile-curriculum.png)
- [Live filter shell ? mobile](data/curriculum-preview-review/preview-mobile-filters.png)

The in-app browser connection timed out. Live verification used the existing Chromium test tools against the real deployment, with existing Vercel authentication attached only to requests to this exact Preview origin. Application traffic was guarded to allow only GET/HEAD and exclude `/uploads/`; no write attempt occurred. No trace, HAR, cookie jar or persistent browser profile was retained.

### SECURITY BLOCKER ? PRE-EXISTING PUBLIC COUNTS LEAKAGE

`GET /api/counts`, with Vercel transport authentication but **without Question Bank admin authentication**, returns 84 rows: two LEGACY semester rows and **82 draft topic rows**. Draft rows contain `semester_id`, `chapter_id` and `topic_id`; all question counts remain zero. This is identifier/hierarchy leakage, without draft display names or question/asset content in that response.

Cause: unchanged `Bank.counts` left-joins every semester/chapter/topic. Its `publicOnly` condition restricts joined questions to approved snapshots but does not exclude draft curriculum versions from the taxonomy rows. The unchanged `/api/counts` route therefore exposes draft taxonomy identifiers even when the public taxonomy/version APIs correctly omit the draft.

Pre-existing behavior independently confirmed: the previous protected Preview **https://matriculation-physics-question-bank-kod3rbsf6.vercel.app**, commit `4ede3d10f786880bb6db2b7bebe9a5370225a3f4`, returns the same 84 rows, including 82 draft topic IDs. `server/database.ts`, `server/app.ts` and `server/visibility.ts` have no diff in the reviewed UI commit.

This is a failed live security requirement, not a local regression-test failure. Existing focused draft coverage tests taxonomy/version/export APIs and UI visibility; it did not assert the counts response. All requested local checks pass, but that cannot certify this additional live requirement.

No server fix, additional application commit, curriculum activation or production promotion was attempted after discovery. Required next work is a narrowly scoped public-counts visibility fix with a regression test covering draft IDs, followed by a new protected Preview verification. Preserve authenticated admin counts and published active/retired visibility. Activation review remains blocked until that security check passes.

### ISOLATED FUTURE-ACTIVE UI

| Check | Result |
| --- | --- |
| Current Curriculum grouping and stored version name | PASS |
| Semester 1 ? 9 chapters / 36 topics | PASS |
| Semester 2 ? 9 chapters / 46 topics | PASS |
| Historical LEGACY separation and keyboard disclosure | PASS |
| Chapter-grouped Topic filter | PASS |
| Stored semester/chapter/topic order | PASS, including order deliberately contradicting numeric display labels |
| Stable topic IDs / difficulty combinations | PASS |
| URL persistence / reload / Back / Forward | PASS |
| Mobile filter / long SP025 labels / overflow | PASS |

These results come from the isolated SQLite full-curriculum fixture in the 29-test browser suite. Production was never activated for a demonstration. They are separate from live Preview checks and do not certify the public counts response.

### SEMESTER IDENTITY RULE

Permanent Semester 1 / Semester 2 naming preserved: **PASS**.

SP015/SP025 hard-coded as permanent identities: **NO**. Source scan found no occurrence in generic `src`, `server`, `shared`, `api` or `scripts` logic; test wording/IDs remain explicitly 2022/2023-specific. These source/course codes remain provenance, not permanent semester names.

Migration 004 created: **NO**. No rename, subtitle inference, identity mapping, taxonomy edit or schema change occurred.

### PRODUCTION FINAL STATE

Fresh SELECT-only audits at **2026-10-09 11:42:50 UTC** and **11:53:35 UTC** match each other and the verified production draft-import audit. All domain rows, schema and migration history are identical.

LEGACY active: **PASS**.

PHYSICS-2022-2023 draft: **PASS** ? not active.

Questions: **0**. Assets: **0**. Curriculum events: **1, unchanged**.

Curriculum activation performed: **NO**. Production DB mutation from this task: **NO**. No Question Bank login/session write, taxonomy/question/asset write, migration or Blob operation occurred.

Approved artifact SHA-256 remains `5350252cd5a76faa78437e338cf54c16a2c4e62ceb694216fb806b8f33753ace`. Domain/schema/migration hashes remain the values recorded above. The retained pre-import backup was not changed.

### QUALITY

| Check | Result |
| --- | --- |
| Unit/integration | PASS ? 122 |
| Browser | PASS ? 29 |
| Typecheck | PASS |
| Lint | PASS |
| DB/schema | PASS |
| API/ESM | PASS |
| Storage | PASS |
| Auth | PASS |
| Build | PASS |
| git diff --check / staged diff --check | PASS |

### ACTIONS / FINAL HANDOFF

Commit: **YES**. Push: **YES**. Preview deployment: **YES** (Git-triggered). Production deployment: **NO**. Preview promotion: **NO**. Activation: **NO**. LEGACY retirement: **NO**. Database migration: **NO**. Blob write: **NO**.

Evidence: ignored `data/curriculum-preview-review/` contains final local logs/results, reviewed staged diff, deployment metadata, protected health results, live browser assertions/screenshots, prior-Preview counts confirmation, production before/after audits, unchanged project/binding/deployment checks and final-verification.json. No credentials are included.

After the push, tracked files were clean. This post-deployment report update is the only intentional tracked working-tree modification and remains local; the verified Preview continues to match the exact pushed UI commit above. Existing unrelated untracked reports remain untouched and excluded. No additional commit/push/deployment was made after discovering the security blocker.

**FINAL STATUS: BLOCKED ? public /api/counts exposes identifiers from the draft curriculum**

Stopped without curriculum activation, LEGACY retirement, Production deployment or Preview promotion. A public-counts visibility fix and repeat protected Preview security check are required before activation review can proceed.

## PUBLIC COUNTS DRAFT-LEAK FIX

### ROOT CAUSE / LEAK BEFORE FIX

Anonymous `/api/counts` left-joined every semester/chapter/topic and restricted only joined questions to approved snapshots. Empty draft taxonomy therefore remained in the response with zero counts. The prior protected Preview exposed **82 known draft topic IDs**, plus their draft semester/chapter IDs, in 84 total rows. No production questions or assets were present.

### FIX / SHARED VISIBILITY

Shared visibility logic reused: **YES**. New `server/public-visibility-policy.ts` defines the existing publicly published statuses **active / retired**, supplies the JavaScript predicate used by public taxonomy (and consequently public curriculum versions), and derives SQL predicates from the same status set.

Public counts join each semester to its version and exclude draft versions **before grouping**. Joined questions must have an approved current record, an approved current immutable snapshot and live classification in a published version. Stable IDs, response fields, course filtering, zero-count published placeholders and counts by semester/chapter/topic/difficulty remain unchanged. The response is calculated from eligible data rather than replaced with a static empty array.

### OTHER PUBLIC ENDPOINT AUDIT

Taxonomy and curriculum versions: **PASS** with the shared published-version predicate.

Additional equivalent omission found in public question list/search totals, direct question reads, public question sets and asset authorization: the existing predicates required approved question/snapshot status but did not check curriculum publication. An approved-status question in a draft version could pass those checks. The same shared public-question SQL predicate now closes that boundary in listing, direct reads and the asset guard; question sets reuse the corrected direct-read service. These paths remain limited to approved current snapshots in published active/retired curricula. Original source asset exclusions and private/admin routes remain intact.

No separate search-facet/statistics/summary route bypassing these paths was found. Taxonomy impact, version export and question history/revision/export endpoints retain their existing administrator guards. No production hidden question/asset content was available to expose; equivalent cases are verified with isolated synthetic fixtures.

### ADMIN BEHAVIOR / RETIRED CURRICULA

The existing route's authenticated administrator distinction is preserved. Anonymous/invalid-cookie/spoofed-role requests exclude draft taxonomy; real isolated administrator sessions retain all 82 draft topic count entries and counts for all existing question statuses. No auth/session/CSRF code or route contract changed.

Retired published curricula remain public. An isolated historical fixture verifies correct approved counts and public list/direct reads alongside the active version. Fixtures create the historical question before retirement, following the existing assignment lifecycle.

### ISOLATED FULL-PAYLOAD SECURITY CHECK

Anonymous after fix: draft curriculum ID leaked **NO**; draft semester IDs leaked **NO**; draft chapter IDs leaked **NO**; draft topic IDs leaked **NO**. Full serialized response scan: **PASS**, zero matches across **103 draft-only hierarchy IDs, including all 82 topics**.

Four new integration tests cover the complete 2/18/82/0 draft fixture, course/spoofed filters, correct public counts, approved-status questions assigned to the hidden draft, nonpublic question statuses, direct/list/print-set denial, published/hidden asset permissions, retired history and real-versus-invalid administrator sessions. Two new browser tests cover anonymous/admin full hierarchy scans and the current public zero-question desktop/mobile browser. Existing active 82-topic chapter-grouping, ordering, difficulty, URL/reload/Back/Forward and long-label coverage remains passing.

### LOCAL QUALITY / PRE-COMMIT CHECKPOINT

All requested commands: **PASS**. Unit/integration: **126** (122 + 4). Browser: **31** (29 + 2). Typecheck, lint, DB/schema, API/ESM, storage, auth, build and `git diff --check`: **PASS**. Cloud credentials are removed from the isolated quality environment.

A fresh SELECT-only audit confirms LEGACY active, PHYSICS-2022-2023 draft, questions/assets zero, one unchanged curriculum import event and unchanged domain/schema/migration hashes. The approved artifact SHA-256 remains `5350252cd5a76faa78437e338cf54c16a2c4e62ceb694216fb806b8f33753ace`. No curriculum row, question, asset, migration or production binding was modified.

Intended files for this security commit: `server/database.ts`, `server/visibility.ts`, `server/public-visibility-policy.ts`, `tests/public-counts.test.ts`, `tests/browser/public-counts.spec.ts` and this report (including the prior authorized Preview handoff). No frontend source, approved fixture/artifact, schema, migration or unrelated report is included.

Commit/push/new protected Preview verification: **pending at this pre-commit checkpoint**. A new commit will use `Fix draft taxonomy leakage in public counts` on top of `fbaba37c5f0099c66edbce90b342fd89235f3d67`; the old leaking Preview will not be used as proof of the fix. Final deployment results will be appended after the new pushed commit is verified.

Production activation, LEGACY retirement, Production deployment/promotion, real question creation and Blob write: **NO**.

Evidence for this fix is separate in ignored `data/public-counts-fix/`.
