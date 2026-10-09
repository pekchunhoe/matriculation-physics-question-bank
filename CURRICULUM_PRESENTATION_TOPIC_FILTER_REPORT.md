# MATRICULATION PHYSICS QUESTION BANK

# CURRICULUM PRESENTATION + CHAPTER-GROUPED TOPIC FILTER

**FINAL STATUS: READY FOR REVIEW**

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

Public draft leakage: **NONE observed**. Auth behavior changed: **NO**. Production database writes: **NO**. Production curriculum activation: **NO**. Blob access/writes: **NO**. Migration 004: **NO**. No authentication, sessions, CSRF, public/private visibility, storage, API or schema source changed.

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

**FINAL STATUS: READY FOR REVIEW**

Recommended next step: review the UI/browser evidence. After separate approval, commit/push these UI changes and test a protected Preview against an isolated active combined-curriculum fixture or safe read-only production state. Curriculum activation remains a later, separately authorized decision.

## COMMIT / PROTECTED PREVIEW VERIFICATION

Review and final local gate: **PASS** (122 unit/integration tests, 29 browser tests and every required check). The existing browser test now also verifies Forward followed by Back, retaining semester/topic/difficulty selections.

Branch: `feat/admin-security`. Commit, push and protected Preview verification are pending at this pre-commit checkpoint. The remote branch matches the original HEAD `4ede3d10f786880bb6db2b7bebe9a5370225a3f4`. Vercel project `matriculation-physics-question-bank` uses `master` for Production; SSO protection is enabled (`all_except_custom_domains`). No binding or protection setting was changed.

Permanent Semester 1 / Semester 2 naming preserved: **PASS**. SP015/SP025 hard-coded as permanent identities: **NO**. Migration 004 created: **NO**. Generic source search has no SP015/SP025 occurrence; fixture identities remain explicitly version-specific.

Fresh SELECT-only production baseline: **PASS** ? LEGACY active, PHYSICS-2022-2023 draft, questions/assets zero, one unchanged curriculum import event. Domain/schema/migration fingerprints match the completed production draft import.

Evidence for this follow-up is stored separately in ignored `data/curriculum-preview-review/`. Existing unrelated untracked reports and all ignored artifacts remain outside the staged change. Post-deployment results will be appended to this section after the exact commit has been deployed and checked.
