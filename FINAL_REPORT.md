# MATRICULATION PHYSICS QUESTION BANK

## SEMESTER / TOPIC / DIFFICULTY ARCHITECTURE

Completed 7 October 2026. The supplied workspace was empty; a local application and database foundation were created. The real bank contains **zero questions**, one course, two semesters, and three controlled difficulty levels. Official chapters/topics have not been invented. All question and curriculum fixtures used for verification are clearly labelled TEST ONLY and isolated from the real database.

## DATABASE

| Requirement            | Result |
| ---------------------- | ------ |
| Course hierarchy       | PASS   |
| Semester table         | PASS   |
| Chapter hierarchy      | PASS   |
| Topic hierarchy        | PASS   |
| Subtopic support       | PASS   |
| Question relationships | PASS   |
| Difficulty model       | PASS   |

Semester/course/chapter classification is inherited through topic ancestry. Composite foreign keys constrain subtopics to their topics. Difficulty records are extensible; tests cover an additional course, semester and difficulty level.

## QUESTION BANK

| Requirement          | Result |
| -------------------- | ------ |
| Semester 1 browsing  | PASS   |
| Semester 2 browsing  | PASS   |
| Topic browsing       | PASS   |
| Difficulty filtering | PASS   |
| Combined filtering   | PASS   |
| Keyword search       | PASS   |
| Marks filtering      | PASS   |
| Question cards       | PASS   |

Counts, filters, full-text search and pagination run on the server/database. Multiple topics can be selected. Filters are reflected in the URL, and reload preserves selections. The initial status filter is Approved. Additional filters cover chapter, subtopic, type, status, diagram/graph/FBD flags and tags.

## CONTENT

| Requirement               | Result |
| ------------------------- | ------ |
| Structured question parts | PASS   |
| Structured answer scheme  | PASS   |
| Student hints             | PASS   |
| LaTeX mathematics         | PASS   |
| Visual assets             | PASS   |
| Approved PDF support      | PASS   |

Parts support nesting, authored marks and order. Solutions store equations, steps, marking points, working and teacher notes. Marks mismatches warn without changing values. SVG upload/render tests include internal arrow markers; original PDFs and structured exports remain independent assets. Student preview responses exclude solutions, teacher notes, marking points, answer diagrams, answer PDFs and original master PDFs.

## REVISION

| Requirement                              | Result |
| ---------------------------------------- | ------ |
| Question versioning                      | PASS   |
| Historical versions                      | PASS   |
| Revision notes                           | PASS   |
| Future revised-PDF workflow prepared     | PASS   |
| Unsafe automatic PDF overwrite prevented | PASS   |

Explicit saves preserve immutable snapshots, notes, author and date. Approved-question changes are staged as candidates and do not replace active content until a named teacher explicitly approves. Stale replacements fail. Rejected candidates leave the active version unchanged. The future PDF service accepts an extractor adapter and always stages candidates; no automatic parser/approval is implemented.

## ADMIN

| Requirement             | Result |
| ----------------------- | ------ |
| Semester/topic selector | PASS   |
| Difficulty selector     | PASS   |
| Question editor         | PASS   |
| Solution editor         | PASS   |
| Hints editor            | PASS   |
| Asset management        | PASS   |
| Student preview         | PASS   |
| Teacher preview         | PASS   |

Curriculum selections cascade through the actual hierarchy. The editor supports explicit revision saves, preview, part/step/hint creation and asset uploads. Structured JSON imports validate and preview before saving. Duplicate new-question codes fail; existing-question imports use the reviewed revision workflow.

## QUALITY

| Requirement                       | Result                                         |
| --------------------------------- | ---------------------------------------------- |
| Database indexes                  | PASS                                           |
| Responsive UI                     | PASS                                           |
| Accessibility                     | PASS — automated axe checks on tested pages    |
| Typecheck                         | PASS                                           |
| Lint                              | PASS                                           |
| Tests                             | PASS — 30 unit/HTTP tests and 12 browser tests |
| Production build                  | PASS                                           |
| Database migration checks         | PASS                                           |
| Versioned JSON schema consistency | PASS                                           |
| Dependency audit                  | PASS — zero reported vulnerabilities           |
| git diff --check                  | PASS                                           |

Browser verification covers 1440 px desktop, 768 px tablet and 390 px mobile layouts; tested pages have no horizontal page overflow. The browser suite exercises both semesters, combined filters, URL reload, marks filtering, student hints/math, approved revision review/history, editor classification, authoring, PDF/SVG uploads, export and JSON import. Accessibility checks cover browsing, editor, curriculum, import and student preview. Automated checks do not constitute a complete assistive-technology audit.

Initial browser runs exposed label/test-selection issues and a test navigation timing issue; these were corrected, and the final complete browser run passed. Lint was adjusted to exclude disposable browser output after a concurrent run exposed an artifact-directory race. The initial KaTeX advisory was resolved by upgrading to the patched version.

**Commit performed: NO**

**Push performed: NO**

A local Git repository was initialized because none existed. Files use intent-to-add entries so working-tree diffs are reviewable; no file contents are staged for a commit and no commit exists.

## Database tables added

- `courses`, `semesters`, `chapters`, `topics`, `subtopics`, `difficulty_levels`
- `questions`, `question_parts`, `solutions`, `solution_steps`
- `hints`, `assets`, `tags`, `question_tags`
- `question_versions`, `revision_candidates`
- `question_search` (FTS5, including its SQLite-managed backing tables)
- `schema_migrations`

## Major files added

- `server/migrations/001-foundation.sql` — relational schema, indexes, constraints, immutable version triggers and minimal seed.
- `server/database.ts` — migrations, transactional saves, search/filter queries, classification resolution and revision promotion.
- `server/app.ts`, `server/index.ts` — local HTTP API, uploads and application runtime.
- `server/revisions.ts` — structured comparison and future PDF ingestion boundary.
- `shared/schema.ts`, `shared/model.ts` — strict versioned validation, asset types and marks warnings.
- `src/Browser.tsx` — semester/topic/difficulty browsing and filter panel.
- `src/Editor.tsx` — structured authoring, solutions, hints and asset management.
- `src/Preview.tsx`, `src/MathText.tsx` — student/teacher previews, mathematics, history and review.
- `src/Curriculum.tsx`, `src/Importer.tsx` — taxonomy records and validated JSON ingestion.
- `src/main.tsx`, `src/components.tsx`, `src/api.ts`, `src/styles.css` — application shell, accessible fields, API client and responsive presentation.
- `docs/question-v1.schema.json`, `docs/import-format.md`, `docs/architecture.md`, `README.md` — import contract, design and usage.
- `package.json`, `package-lock.json`, `tsconfig.json`, `eslint.config.js`, `vite.config.ts`, `playwright.config.ts` — reproducible dependencies and checks.

## Tests added

- `tests/bank.test.ts` — 23 database/domain tests: filtering, search, taxonomy, extensibility, validation, transactions, snapshots, review conflicts and PDF boundary.
- `tests/api.test.ts` — 7 HTTP integration tests: paginated filtering, student response separation, import/review, failures, file validation, source restrictions, exports and PDF unavailability.
- `tests/browser/bank.spec.ts` — 12 end-to-end tests, including responsive and automated accessibility verification.
- `tests/fixtures.ts` — isolated TEST ONLY content.
- `scripts/check-db.ts`, `scripts/export-schema.ts`, `scripts/browser-server.ts` — migration/schema checks and isolated browser test server.

## Manual configuration required

- Add the authoritative Semester 1 and Semester 2 chapter/topic/subtopic structure in Curriculum.
- Import your first authored, reviewed Physics questions with their structured schemes, hints, assets and approved PDFs.
- No credentials or external services are required for the local application. Node.js 24 or newer is required; dependencies are installed in this workspace.
- Optional `BANK_DATA_DIR` and `PORT` environment variables change local storage or port. The default bank opens at `http://127.0.0.1:3000`.

## Known limitations

- This is a local, trusted teacher workspace. Student View is a preview mode, not authenticated student access. Server-enforced identities and roles would be needed before providing separate student accounts or network hosting.
- PDF extraction is intentionally unavailable; only its service/candidate/review boundary is prepared.
- Curriculum management currently adds records. A future rename/reorganization workflow should define how changes relate to preserved question snapshots.
- Collection differences are shown as readable before/after JSON blocks rather than fine-grained word-level or per-item highlights.
- Remote HTTPS assets are accepted without server fetching; availability remains the author's responsibility. Local uploads receive signature/MIME/reference checks. SVGs containing active content or external references are rejected rather than altered.
- JSON export contains asset links, not embedded file bytes. Back up the complete data directory while the server is stopped.
- No examination generator, randomization, variants or AI-authored Physics content were created.

## Recommended next step

Import the first real approved Physics questions into the Question Bank, after adding their authoritative taxonomy.
