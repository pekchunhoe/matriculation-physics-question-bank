# MATRICULATION PHYSICS QUESTION BANK
# USER PDF / WORD EXPORT IMPLEMENTATION

Final local verification resumed on 11 October 2026 from the existing modified working tree. No implementation source or repository test changes were necessary. The separately authorized release-preparation run refreshed all local gates before committing; its starting HEAD was `650af057613449cff1cceb4ca3a94fd9f142adf6`. Administrator-selected difficulty was already committed and pushed at that SHA.

## EXPORT UI

Format dropdown: **PASS**. Native labelled select; options **PDF** (default) and **Word (.docx)**.

Document dropdown: **PASS**. Native labelled select; options **Question** (default) and **Answer Scheme with Student's Hints**.

PDF option: **PASS**. Word (.docx) option: **PASS**. Question option: **PASS**. Answer Scheme with Student's Hints option: **PASS**.

One Export button uses both choices on the existing question-set page. Empty selection disables export; removing the final item creates no file. Export status uses `role="status"`; errors use `role="alert"`.

Mobile: **PASS**, 390 × 844. Desktop: **PASS**, 1280 × 1000. Accessibility: **PASS**, keyboard selection, labelled controls, zero automated axe violations at both target sizes, no horizontal overflow.

## ORDERING

Uses curriculum hierarchy: **PASS**. Semester: **PASS**. Chapter: **PASS**. Topic: **PASS**. Subtopic: **PASS**.

Click order ignored: **PASS**.

The canonical taxonomy API exposes `Taxon.order` from existing SQL `sort_order`. `shared/export-plan.ts` sorts semester → chapter → topic → subtopic. Canonical labels appear only when entering a new group. Tests deliberately make alphabetical names disagree with curriculum positions.

Questions without a subtopic come first within their topic, followed by subtopics in canonical order; no artificial subtopic is created. Equal sibling curriculum positions use stable taxonomy IDs to keep groups together.

Same-classification tie-breaker: ordinal comparison of stable canonical question ID, **only after the complete hierarchy**. The model has no explicit pedagogical question-order column. No migration was introduced. Missing/inconsistent classification blocks export.

## NUMBERING

Renumber after curriculum sorting: **PASS**. Starts at 1: **PASS**. Consecutive: **PASS**.

Question/answer shared numbering: **PASS**. PDF/Word shared numbering: **PASS**.

One export plan includes ID, display number, canonical hierarchy records and their positions. All four combinations consume it. Reversing clicks preserves the plan; removing an item renumbers remaining items consecutively. Tests cover one item and five items.

Database mutation: **NO**. Numbering is presentation only.

## QUESTION EXPORT

PDF: **PASS**. Word: **PASS**.

Solutions excluded: **PASS**. Hints excluded: **PASS**. Marking codes excluded: **PASS**. Answer FBDs excluded: **PASS**.

Question mode contains only stems, original question visuals, parts, canonical administrator-selected difficulty and exact marks. Final answers and teacher notes are excluded. Public API projection and shared content ownership checks enforce this isolation.

## ANSWER-SCHEME EXPORT

PDF: **PASS**. Word: **PASS**.

Solutions: **PASS**. Student hints: **PASS**. Marking codes: **PASS**. Answer diagrams/FBDs: **PASS**.

The separate answer document preserves corresponding question numbers, part paths including nested parts, solution introductions, steps, equations, exact awards, general/part/step hints and totals. Question stems and teacher notes are excluded. No-part answers and multiple FBDs are covered.

## PDF

Valid PDF: **PASS**. A4: **PASS**, portrait. Accurate math: **PASS**, existing KaTeX pipeline. Original visuals: **PASS**. Question answer-isolation: **PASS**.

Compact question flow: **PASS**. No large unnecessary empty spaces: **PASS**. No student working space: **PASS**. Client-side: **PASS**, browser Print / Save as PDF.

Per-question minimum page height and forced page breaks were removed. Questions/answers have one normal section margin. Headings stay with opening content; small steps and visual/equation pairs stay together where practical. Long steps can split. Visual QA caught a long-hint keep-together gap; the correction makes the hint start on page 1 and reduces the example from four pages to three.

Five short questions fit on one A4 page. Four short mixed chapter/topic questions also fit on one page. Five short answer schemes flow across two pages, with multiple items sharing each page. Long solutions continue naturally. Page counters, original figures, margins and math were inspected. Remaining space after the final item is ordinary end-of-document space.

PDF filenames use a neutral print document title; the user's browser/print settings control the final saved filename.

## WORD

Valid DOCX: **PASS**. Office Open XML: **PASS**. A4: **PASS**. Client-side: **PASS**. Private Blob URL leakage: **NONE**.

Native/editable math: **PARTIAL — a validated, explicit subset of KaTeX**, with supported equations emitted as native OMML. Fractions, superscripts, subscripts, combined scripts, square/indexed roots, Greek letters, vectors, brackets, degrees, SI units, negative exponents, equation arrays, matrices and boxed-result structures have focused checks. Prose is editable Word text. No equation, prose or whole page is rasterized.

Unsupported constructs fail clearly before downloading a partial file; the user can select PDF. Examples include cancellation, phantom/padded notation, custom color/style, negative spacing, unsupported accents/enclosures and unsupported alignment shapes. This is not universal LaTeX support.

Independent validation used **python-docx and lxml** to read every generated test package and XML relationship, plus **LibreOffice 26.8.1** rendering through the packaged `render_docx.py` workflow with PyMuPDF rasterization. The renderer was extracted into ignored local QA storage; the app does not depend on it.

Rendered physics references preserve fractions, scripts, roots, Greek, vectors, degrees, units and aligned equation values. **Observed rendering limit:** LibreOffice omits native boxed-result border decoration; the DOCX retains its OMML border-box structure. Microsoft Word desktop rendering was not independently verified because its local automation did not complete. This does not justify claiming pixel-perfect parity across Office engines.

Original visuals embedded: **PASS**. PNG/JPEG originals are embedded unchanged. Unit tests also check retained SVG/WebP originals with export-only PNG compatibility representations; those representations do not modify permanent assets. Real browser downloads confirm original question PNG bytes and answer/FBD ownership. Images preserve aspect ratio and captions; repeated images reuse bytes with unique DrawingML IDs.

Compact flow: **PASS**. No large unnecessary empty spaces: **PASS**. No per-question page breaks or working-space blocks. Five short questions fit on one page; answer documents and long content flow naturally. Small heading/image/caption groups use keep-with-next; ordinary long paragraphs can continue.

## PDF / WORD PARITY

Question: **PASS**. Answer: **PASS**. Ordering: **PASS**. Numbering: **PASS**.

A supplemental disposable browser check passed **1/1** using one identical five-question selection for PDF Question, Word Question, PDF Answer and Word Answer. It selected D, a diagram question, B, A, C out of order, then confirmed the exact same canonical IDs and display numbers in every combination. The stable final order was A → diagram question → B → C → D, numbered 1–5. This supplemental count is separate from the full repository suite's 96 tests.

The same selected documents supplied both formats. Independent PDF text/Word XML comparison verified all **16 question** and **44 answer** prose/hint/caption/total fields, consecutive numbering and original visual ownership. Browser downloads matched original PNG bytes: **1 question visual**, **2 answer FBDs**. Answer prose, worked solutions, marking codes and hints match; Question excludes the answer side. Mathematical nodes use the shared content model and validated KaTeX/OMML paths. Natural pagination differs: this mixed selection uses **2 PDF Question / 2 rendered Word Question pages**, and **4 PDF Answer / 3 rendered Word Answer pages**.

## ACCESSIBILITY

Desktop: **PASS**, 1280 × 1000. Mobile: **PASS**, 390 × 844. Keyboard: **PASS**. Labels: **PASS**. Native selects, keyboard focus/selection and announced export status/errors remain usable. Both viewport tests report zero automated axe violations and no horizontal overflow.

## MASTER EXCLUSIONS

SP015/SP025: **ABSENT**. Source set: **ABSENT**. Source year/session: **ABSENT**. Original source question number: **ABSENT**. Student working space: **ABSENT**.

Source PDF filename/provenance and source question identity are not emitted. Document identities and filenames use Matriculation Physics, canonical semester scope and export mode.

## TOKEN USAGE

PDF OpenAI calls: **0**. Word OpenAI calls: **0**. LLM calls: **0**. Image-generation calls: **0**. Server AI tokens: **0**.

Both paths consume existing canonical data and assets. Browser request checks confirm export requests remain on the local application origin. Word's generator and ZIP dependency load only when Word is selected.

## SECURITY

Only approved public questions: **PASS**. Question mode answer isolation: **PASS**. Answer visibility policy: **PASS**, unchanged existing public policy.

Both export actions re-fetch selected public documents and current taxonomy immediately before generation. A browser test retires a selected question after preview and confirms export fails. Draft/reviewing/retired and ineligible curriculum records retain existing public restrictions, including for administrator sessions.

Private Blob URL leakage: **NONE**. Images use mediated asset references and authorized retrieved bytes; DOCX media relationships are internal, with no private Blob URL, remote image target or upload URL. Image MIME, dimensions and resource limits are checked. No server generation endpoint or authorization bypass was added.

## QUALITY

Unit/integration: **PASS — 268/268**, **0 failed, 0 skipped, 0 cancelled**, up from 232 (**36 added**). Fresh `npm test` run completed successfully in this resumed verification.

Focused export: **PASS — 36/36**, **0 failed, 0 skipped, 0 cancelled**, from a fresh independent run of `tests/user-export.test.ts`.

Full browser: **PASS — 96/96**, **0 failed, 0 skipped**, exit code **0**, up from 77 (**19 added**). Fresh `npm run test:browser` completed in **3.3 minutes** in this resumed verification. Existing importer, administrator-selected difficulty, curriculum, authentication, storage and public browsing regressions remain covered.

PDF export: **PASS — 20 generated PDFs independently inspected**: seven export PDFs (including two identical-selection parity PDFs) and 13 Master regression PDFs. All are valid A4 portrait and pass independent text/page checks. Word export: **PASS — 12 actual browser-downloaded DOCX files**, independently parsed/rendered, plus the retained native-math reference document (**13 QA DOCX packages total**). Every XML/rels part reparses with lxml; every package opens with python-docx, validates ZIP integrity, internal relationship targets, required OOXML parts, and consecutive numbering. All 13 were freshly rendered through the packaged DOCX renderer using the existing disposable LibreOffice QA installation. These artifact counts are distinct from test counts.

Sorting: **PASS**. Numbering: **PASS**. PDF/Word parity: **PASS**, shared plan/content model and four-combination order/mode assertions; independent PDF text and Word XML checks confirm the matrix order A → B → C → D and matching educational content.

| Quality gate | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm test` | PASS, 268 tests |
| `npm run db:check` | PASS |
| `npm run schema:check` | PASS |
| `npm run api:check` | PASS |
| `npm run api:esm:check` | PASS |
| `npm run storage:check` | PASS, 30 tests |
| `npm run auth:check` | PASS, 28 tests |
| `npm run build` | PASS |
| `npm run test:browser` | PASS, 96 tests |
| `git diff --check` | PASS |

Fresh visual review inspected **42 pages**: all **15 pages** of the seven export PDFs and all **27 rendered pages** of the 13 DOCX packages. Review covers several short questions, mixed hierarchy selection, question diagram, multiple answer FBDs, long solution and hint, no-part answer, and nested answer. Original figures remain legible, equations stay within content width, and page continuations avoid clipping/overlap. Word pagination may differ from PDF.

Fresh resumed-run evidence is in ignored `data/user-export/resumed-verification/`: quality-gate logs, `artifact-inspection.json`, `extended-inspection.json`, identical-selection browser/independent parity records, and full-resolution paired page images. Current generated files are in `data/user-export/artifacts/`, with renders in `word-rendered/` and `pages/`; viewport screenshots are in `data/user-export/`. Earlier root-level QA logs are historical and are not the basis for these final test results. Master PDFs are in `data/master-fidelity/pdf/`. Reusable behavior and supported boundaries are documented in `docs/USER_PDF_WORD_EXPORT.md`; relevant authoring docs and README link to it.

## DATABASE

Migration required: **NO**. New DB columns: **NO**. Production DB changes: **0**. Export preferences and dynamic numbering remain ephemeral.

No database column, canonical identity, source content or permanent asset bytes changed. Tests use disposable synthetic banks. No production import, asset upload, draft edit or curriculum change was performed.

## PRODUCTION

Writes: **0**. Production questions changed: **0**. Production assets changed: **0**. Curriculum changed: **0**. Migration: **NO**. Commit: **NO**. Push: **NO**. Deployment: **NO**. No hosted write tests or real-question imports were performed.

## RESUMED QA PROCESS NOTES

Before browser downloads, no Word/LibreOffice/Python renderer process was found and all 11 existing QA DOCX files were writable. Render inspection ran only after browser downloads completed. The full suite's 96 cases succeeded; Windows Playwright teardown left its disposable localhost:3100 server running. Closing only that known QA server (PID 20032, created by the release-preparation run) allowed Playwright to return its final **96 passed** summary and exit **0**. No unrelated application was terminated.

Disposable supplementary inspection initially overconstrained compact Answer output to one page. Inspection confirmed natural two-page capacity with multiple answers on each page, as required; the QA assertion was corrected. A supplementary parser also needed explicit UTF-8 decoding of its JSON evidence. Both corrected inspections passed. Neither issue required application or repository test changes. Two obsolete QA page PNGs beyond current PDF page counts were removed so visual review used only current pages.

## FINAL STATUS

**PDF + WORD USER EXPORT READY FOR REVIEW**

The native math scope and observed LibreOffice border-rendering limit are documented above. At completion of the implementation phase, changes were local and uncommitted and Production writes were zero. The subsequent release-preparation task is explicitly authorized to commit, push and deploy after its gates pass. Final source-control and deployment facts belong in `USER_EXPORT_PDF_WORD_PRODUCTION_ROLLOUT_REPORT.md`.

## FINAL RELEASE-PREPARATION RECHECK

On 11 October 2026, all required commands passed again: 268 unit/integration tests, 96 browser tests (exit 0), 36 focused export tests, typecheck, lint, DB/schema, API/ESM, storage (30), auth (28), build and whitespace checks. All 13 DOCX packages were freshly rendered after downloads; python-docx/lxml independently parsed required OOXML parts, all XML/relationships, embedded media, A4 settings, numbering and privacy boundaries. All 20 application PDFs passed independent A4/text/page checks. Identical-selection parity retained 16 question and 44 answer prose fields. Representative fresh compact PDF and Word FBD pages were visually rechecked. Microsoft Word desktop rendering remains **UNVERIFIED**; the LibreOffice boxed-border difference remains cosmetic with native border-box OOXML intact. No migration, Production DB write, content edit, asset upload or curriculum change occurred during implementation and local verification. Disposable evidence is ignored under `data/user-export-rollout/`.
