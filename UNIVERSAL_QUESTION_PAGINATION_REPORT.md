# Universal question pagination implementation

Date: 30 October 2026

Implemented locally. Every full question listing renders at most 10 question entries per page. No commit, push, deployment, production database operation, or production image change was performed.

## Final release audit — 2 November 2026 (Malaysia)

**Overall Production release readiness: FAIL. Pagination correctness and independent buildability: PASS.** The pagination candidate passes the checks below, but a fresh production-dependency audit reports seven high and one moderate affected-package findings in the unchanged baseline dependency tree. Resolve or separately review these findings before treating a commit-and-push as safe for Production. Dependency remediation was kept outside this pagination-only staging scope.

Local `master`, local HEAD, `origin/master`, and the live GitHub `master` reference all equal `78a71ec6257510945cce47e4eddb6f1d2692a42a`. The clean candidate was reconstructed from that commit plus exactly the 17 pagination files listed below. It excludes all unrelated working-tree changes and installed 264 packages successfully with `npm ci --offline --no-audit --no-fund` using the existing lockfile. No new dependency is needed for pagination.

The clean candidate passed 111 unit/integration tests and all 31 Chromium browser tests. The original working tree also passed 112 tests; its extra student role-separation regression remains unrelated and unstaged. The standard `npm run test:browser` completed normally, including teardown, in 1.6 minutes. No managed-server workaround or skipped test was needed for this audit. Representative desktop, iPad, and iPhone pagination controls were visually inspected.

The Production build and API bundle checks initially hit a Windows sandbox restriction while esbuild inspected ancestors of the temporary candidate directory. Both unchanged checks passed when rerun outside that sandbox. TypeScript, ESLint, schema verification, native Node ESM imports, and the hosted API import graph passed. Tests used in-memory/disposable local databases and synthetic image assets; no Production database or Blob operation was performed.

### Dependency findings retained for separate review

`npm audit --omit=dev --json` returned exit code 1, with zero critical, seven high, and one moderate affected-package findings. These are present in the unchanged `package-lock.json`, rather than introduced by pagination. Affected-package counts include transitive advisory propagation and are not counts of distinct exploits.

| Locked package | Version | Audit severity / reason |
| --- | --- | --- |
| `body-parser` | 2.3.0 | High: compressed request-body denial of service; patched in 2.4.0 |
| `multer` | 2.4.0 | High: asynchronous file-filter/request-teardown denial of service; patched in 2.5.0 |
| `undici` | 6.29.0 | High: transport/TLS and resource-consumption advisories; patched in 6.29.1 |
| `zod` | 4.6.5, plus a nested copy | High: oversized-collection resource consumption; patched in 4.6.6 |
| `qs` | 6.16.0 | Moderate: `stringify` comma-array denial of service |
| `@vercel/blob` | 2.8.1 | High propagated through `@vercel/oidc` |
| `@vercel/oidc` | 3.8.10 | High propagated through `@vercel/cli-config` |
| `@vercel/cli-config` | 0.3.1 | High propagated through `zod` |

The app uses `express.json()` on authentication routes with default compressed-body inflation, making the body-parser finding relevant to the exposed request path. No exploit was sent to Production, and per-advisory exploitability of every other dependency was not established. See the upstream [body-parser advisory](https://github.com/advisories/GHSA-27r3-jxmh-p828), [multer advisory](https://github.com/advisories/GHSA-q7qp-rjg7-q26m), [Undici advisories](https://github.com/nodejs/undici/security/advisories), [Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), and [qs advisory](https://github.com/advisories/GHSA-6pq8-jhm2-2vcw). Do not apply the audit's suggested Blob downgrade without reviewing private-storage and OIDC compatibility.

### Repository configuration, staging scope, and preservation

`vercel.json` still specifies `npm run build`, `dist`, and the existing API/migration-file routing. There is no `ignoreCommand`, `git.deploymentEnabled`, `github.enabled`, `github.autoAlias`, alternate `vercel.ts`/`vercel.js`, `.vercelignore`, custom installation command, or GitHub workflow overriding the intended build. Package manifests, lockfile, migrations, runtime initialization, authentication code, and deployment configuration have no release diff. No database migration is required or run at application startup.

The owner's current verified state supplies the reconnected Vercel integration, Production branch `master`, and saved Automatic Ignored Build Step; those hosted settings were not independently queried or changed in this audit. The old SHA guard and disconnected-project statements in local historical documents have no executable repository effect and were preserved. Vercel documents the [repository ignore override](https://vercel.com/docs/project-configuration/vercel-json#ignorecommand) and [Git deployment controls](https://vercel.com/docs/project-configuration/git-configuration). With the owner's reported settings, a new commit pushed to `master` is expected to trigger Production; safe release endorsement remains withheld because of the dependency findings above. A hosted build and post-deployment verification have not been performed.

All source hunks in the 17-file pagination inventory were reviewed as pagination-related; none of those files contains an unrelated hunk requiring partial staging. The four unrelated modified files (`.gitignore`, `README.md`, `docs/STUDENT_ACCESS.md`, `tests/student-access.test.ts`) and eight unrelated untracked reports/workflow documents remain outside the candidate. Original contents were backed up and hashed before testing. A full-file credential-pattern scan of all 29 originally modified/untracked files found no matches; the reviewed pagination diff adds no credentials, environment values, database files, or academic image assets.

Audit evidence, dependency-audit JSON, preservation hashes, the HTML browser report, and screenshots are retained under the ignored `data/pagination-release-audit-20261102/` directory. Its `validation-summary.json` records the temporary clean candidate's location. No commit, push, Git-history rewrite, Vercel setting change, domain change, or environment-variable change was performed.

## Covered interfaces

| Interface | Pagination behavior |
| --- | --- |
| Student question bank (`/`) | Database pagination; 10 questions per page |
| Administrator question management (`/`) | The same database pagination, including approved, draft, reviewing and retired status filters |
| Search and syllabus/semester/chapter/topic/subtopic/difficulty results | Filters apply before the database count and page query |
| Administrator legacy archive (`/admin/legacy`) | Database pagination; 10 unconverted records per page |
| Selected-question review (`/question-set`) | 10 entries per page from the existing bounded selection; PDF export uses the complete selection |

The bank's selection bar is a short preview of the first three selected questions plus the complete selected count and PDF action. Its full review is available in the paginated question set. Curriculum trees, individual question previews, revision histories, and student-account listings are separate interfaces and were not unnecessarily paginated.

## Implementation and behavior

- Shared pagination types, page calculations, input validation and compact page-number generation live in `shared/pagination.ts`. `src/Pagination.tsx` supplies reusable controls, URL state, cancellable requests and list-start focus/scroll handling.
- Controls show accurate ranges and total counts, the current page, numbered buttons, Previous/Next and ellipses for large page counts. The current button has `aria-current="page"`. Navigation is hidden for 10 or fewer results; empty states remain visible for zero results.
- Browser and archive queries use parameterized SQL `LIMIT`/`OFFSET` with a filtered `COUNT(*)`. Ordinary browsing retrieves at most 10 records, without fetching full-size source images. Existing lazy thumbnails and private image-delivery protections remain in place.
- Existing curriculum ordering is retained, ending with the unique question ID as a deterministic tie-breaker. Legacy records retain creation-date/ID ordering.
- Invalid pagination values are rejected. Valid pages beyond the current result count are clamped to the last available page. Empty results use page 1. The old `limit` parameter still accepts smaller sizes, but requests above 10 are capped at 10.
- The questions API retains its existing result fields and adds `pageSize`. The legacy API retains its default array response, now bounded to 10, and supports `paginated=true` for the metadata envelope used by the UI. Repository callers that previously fetched 50 questions for PDF testing now traverse the pages.
- Filter/search changes reset to page 1. Page changes preserve all URL filters. Browser Back/Forward and reload restore the URL's page and filters without requiring full reloads for page-button navigation.
- Obsolete requests are aborted and their responses cannot replace the current page. A clamped response is reused instead of fetched again under the corrected URL. Errors are distinct from empty results.
- Page navigation moves focus and the viewport to the question-list start. Changes to the database are reflected on the next request or refresh; shrinking result sets recover to a valid page.

## Selection and PDF preservation

- Selection remains independent of the fetched page and uses unique question IDs. Moving between pages preserves checked states, total count and total marks; deselection works after returning to an earlier page.
- Existing syllabus/semester selection behavior and the one-syllabus/one-semester export constraint remain in place. There is no existing Select All action whose scope needs changing.
- The question-set review retrieves the existing bounded selection, at most 50 records, because validation and export require the complete set. Only its visible list is sliced into 10-entry pages. Page navigation does not refetch this selection.
- The export action continues to validate and export the entire selection into one PDF, independently of the current review page. Question/answer pairing, curriculum order, sequential numbering, original image bytes and PDF-only export code are preserved.
- Removing the only entry on the last review page clamps the page correctly. Back navigation waits for the restored selection's own count before clamping. Export errors leave the review list editable so students can remove questions and retry.

## Validation results

| Check | Result |
| --- | --- |
| `npm test` (clean pagination candidate) | **111 passed, 0 failed** |
| `npm test` (original working tree, including unrelated test) | **112 passed, 0 failed** |
| Complete Playwright browser suite | **31 passed, 0 failed** |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `npm run build` | Passed |
| `npm run schema:check` | Passed |
| `npm run api:check` | Passed |
| `npm run api:esm:check` | Passed |
| `npm ci --offline --no-audit --no-fund` (clean candidate) | Passed; unchanged lockfile |
| `npm audit --omit=dev --json` | **Failed: 7 high, 1 moderate affected-package findings in baseline dependencies** |

Database tests cover 0, 1, 9, 10, 11, 20, 21, 100, 101 and 1,000 questions using isolated SQLite and the real libSQL/Turso adapter backed by an in-memory database. Traversing all 100 pages of 1,000 questions verifies no omitted or repeated IDs. Tests also cover malformed query parameters, capped limits, combined filters, distinct syllabus/semester/topic/difficulty data, public visibility, archive conversion and shrinking results.

Browser tests cover first/intermediate/last pages, numbered and adjacent navigation, URL reload, Back/Forward, rapid navigation with delayed responses, filter resets, empty/loading/error states, and clamping after administrator changes. Student tests select nine questions across three pages, verify persisted checkboxes and deselection, compare every answer pair with its original record, and download one combined PDF using exactly the expected source images. Existing 1-, 5-, 20- and 50-question browser PDF exports also pass, including tall images and global numbering across review pages. Upload, edit, archive, authentication, authorization and refusal of permanent deletion continue to pass.

Responsive checks passed at desktop 1440×900, iPad portrait 768×1024, iPad landscape 1024×768, Android tablet 800×1280, iPhone-sized 390×844 and Android-phone-sized 360×800 viewports. Checks verify no horizontal overflow, pagination buttons at least 44×44 pixels, keyboard operation and correct current-page labels. Accessibility scans reported no serious or critical violations. Desktop/tablet/mobile screenshots were generated, and representative desktop and mobile pagination controls were visually inspected.

Evidence is under the ignored `data/pagination/` directory, including viewport screenshots, `*-controls.png` captures and `browser-results.json`.

## Files changed for this task

| File | Purpose |
| --- | --- |
| `shared/pagination.ts` (new) | Shared 10-question limit, result types, page calculation/validation and compact page numbers |
| `shared/image-question.ts` | Reuse the shared paginated result type |
| `server/image-questions.ts` | Cap database queries at 10, validate input, return metadata and clamp pages |
| `server/database.ts` | Count and paginate legacy question records |
| `server/app.ts` | Validate malformed query shapes and expose backward-compatible legacy pagination metadata |
| `src/Pagination.tsx` (new) | Accessible reusable controls, URL/history state, request cancellation and list focus |
| `src/Browser.tsx` | Shared student/admin/search/filter pagination; preserve page-independent selection |
| `src/LegacyArchive.tsx` | Shared archive pagination and cancellable detail reads |
| `src/QuestionSet.tsx` | Paginate review while exporting the complete selection; safe history/clamping and error recovery |
| `src/styles.css` | Responsive pagination styling and 44-pixel touch targets |
| `scripts/browser-server.ts` | Add disposable pagination fixtures to the existing local test server |
| `tests/pagination-fixture.ts` (new) | Synthetic record/history and legacy fixtures for isolated tests |
| `tests/pagination.test.ts` (new) | SQL, adapter, boundary, filtering, validation and access-control regressions |
| `tests/browser/pagination.spec.ts` (new) | Student navigation, selection/export, race, responsive and accessibility regressions |
| `tests/browser/pagination-admin.spec.ts` (new) | Administrator queues, edits, conversion and invalid-page recovery |
| `tests/browser/image-bank.spec.ts` | Update existing assertions and traverse bounded pages for large export tests |
| `UNIVERSAL_QUESTION_PAGINATION_REPORT.md` (new) | This implementation and validation report |

Pre-existing changes in `.gitignore`, `README.md`, `docs/STUDENT_ACCESS.md`, `tests/student-access.test.ts` and pre-existing untracked reports were left intact.

## Remaining limits and verification environment

- Browser validation used Chromium with representative viewport sizes. Physical devices and Safari/WebKit were not tested.
- Production Turso and Vercel were not contacted or changed. SQL compatibility was exercised through the real libSQL adapter locally; no remote load test was performed.
- The existing 50-question PDF limit, single-syllabus/semester constraint and image budget remain unchanged. Selection persists across in-app pagination; this change does not add persistent selection storage across a full reload of the bank.
- Updates are reflected on navigation or refresh; no live subscription or fixed snapshot of a changing bank was introduced.
- The 30 October run needed a separately managed disposable server after a Windows teardown stall. The 2 November final audit supersedes that limitation: the standard `npm run test:browser` completed all 31 tests and teardown successfully against the clean pagination candidate.
