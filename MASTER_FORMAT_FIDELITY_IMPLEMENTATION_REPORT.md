# MATRICULATION PHYSICS QUESTION BANK

# MASTER FORMAT FIDELITY IMPLEMENTATION

Review date: 11 October 2026 (Asia/Kuala_Lumpur). Implementation, synthetic fixtures, in-memory SQLite/libSQL databases, local private storage and browser tests only. No production connection was needed.

## BASELINE

Previous status:
PARTIAL

Gaps:

- marking codes
- step-linked hints
- dynamic numbering
- polished PDF template

The previous audit and all requested authoring/schema/golden files were read. The actual Master JSON was parsed in full: all three image hashes match, its embedded PDF hash matches, and that payload is byte-identical to the standalone PDF. Both Master PDF pages were freshly rendered with workspace-local PyMuPDF and visually inspected BEFORE implementation. Poppler was unavailable. No Master content or visuals were imported.

Source re-audit confirmed the limitations independently of the previous report:

| Layer               | Marking codes / step hints at entry                                                       | Numbering / print at entry                          | Implemented path                                                                                                                               |
| ------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Portable JSON       | Strict step schema had no code/key; hints only had `partId`                               | No presentation number field                        | Optional step `id`, `markingCode`; hint `solutionStepId`; schemaVersion 1 retained                                                             |
| Runtime validator   | New properties rejected                                                                   | No shared numbering utility                         | `shared/schema.ts`, shared relationship validation reused by `shared/question-import.ts`                                                       |
| Browser preparation | Canonical schemas rejected new properties                                                 | Selected IDs retained their order                   | Existing `src/question-import-preparation.ts` preserves validated optional fields and unchanged asset preparation                              |
| Server validation   | Same missing shared contract                                                              | Approved-only selected-ID traversal preserved order | Existing signed import-plan workflow validates new fields; `server/visibility.ts` additionally excludes all hints/FBDs from question-only sets |
| Database            | Step prose/marking point existed, but no semantically appropriate code or step-hint owner | No numbering/style columns                          | Migration 005 and explicit relational writes in `server/database.ts`                                                                           |
| Admin preview       | Steps had marks; hint review was disconnected                                             | Individual descriptive preview title                | `src/Preview.tsx`, `src/QuestionJsonImporter.tsx`; codes and ordered hints inside steps                                                        |
| Question rendering  | No step metadata in the question body                                                     | Stored code/title rendered in generic preview       | Individual preview remains unnumbered; new set question renderer uses the shared ephemeral number                                              |
| Answer rendering    | Steps had no separate code or associated hint                                             | Generic heading, no paired reference                | Step code badge, adjacent hints and dynamic answer reference; teacher notes remain private                                                     |
| Customized set      | Generic `ContentPreview` per selected item                                                | Stored code, no authoritative numbering plan        | `shared/question-numbering.ts`, `src/QuestionSet.tsx`, reusable `src/MasterPrint.tsx`                                                          |
| Print / Save as PDF | Basic generic print CSS                                                                   | No A4 page template or running counters             | A4 portrait, canonical headers, named-page references, page counters, equation fitting and image/step break rules                              |

## MARKING CODES

Status:
IMPLEMENTED

Portable JSON:
`solutions[].steps[].markingCode` is optional, exactly preserved, 1–24 ASCII characters; first character must be a letter/digit, subsequent characters allow letters/digits or `+ . _ / -`. `G1`, `JU1`, `GJU1` and future families are accepted without a fixed enum. No concatenation into prose, marking points, notes, hints or marks.

Database:
Nullable `solution_steps.marking_code`, with matching length/character checks. Explicit inserts preserve the code separately. Immutable version snapshots also retain it through the existing history system.

Preview:
Separate code badge near the corresponding step marks in importer/admin preview. The editor exposes an optional marking-code field.

Answer rendering:
Separate restrained teal badge. An absent code renders no badge. Public answer access still requires an approved eligible question.

PDF:
Included only in the answer section. Tested present/absent, persistence and rendering. Numerical mark allocation is unchanged.

Backward compatibility:
Old schemaVersion-1 packages remain valid without this optional property. Old database rows receive NULL, with no snapshot changes.

## STEP-LINKED HINTS

Status:
IMPLEMENTED

Portable JSON:
Optional `solutions[].steps[].id` supplies a question-package-local key, unique across all its solutions. Optional hint `solutionStepId` references that key. Existing required hint `partId` must equal the step's solution owner, including NULL for a no-part solution. This follows existing project relationship naming instead of adding a second `target.type` dialect.

Valid scopes: QUESTION (`partId:null`, no step link), PART/subpart (existing `partId`, no step link), SOLUTION STEP (`solutionStepId`, matching solution `partId`). An omitted/null `solutionStepId` remains unlinked. Unknown target fields/types are rejected by strict validation.

Database:
Nullable `solution_steps.step_id`, unique within the owning question; nullable `hints.solution_step_id` with a composite `(question_id, solution_step_id)` foreign key. The step's existing primary key remains `(question_id, part_id, step_number)`; a portable step key is not a global database primary key.

Integrity:
Shared portable/canonical validation rejects nonexistent steps, duplicate step keys, conflicting solution ownership and duplicate order within a target, with exact JSON paths. Composite foreign keys and NULL-safe INSERT/UPDATE ownership triggers prohibit cross-question/cross-part pointers, including whole-question steps. Linked steps cannot be deleted or reassigned while hints reference them. Revisions delete hints before replacing steps in the existing transaction.

Preview:
Linked hints appear inside their matching marking step in authored order. General hint review remains available. Editor step selection uses explicit keys, and deletion guards require reassignment/removal of linked hints first.

Answer rendering:
Linked hints sit immediately after their step heading/code and before worked reasoning/equations. Multiple hints sort by `order`; order values may repeat for different targets. General/part hints render once before their relevant answer scope using actual relational ancestry, including identical authored part labels.

PDF:
Same placement when the existing Include student hints option is enabled. No disconnected step-hint appendix. Question-only export excludes ALL hints, even if an old URL retains `hints=true`.

Backward compatibility:
Existing whole-question, part and subpart hints retain their text, order and ownership. Migration 005 fabricates no relationships. Old snapshots and packages remain unchanged/valid.

## DYNAMIC NUMBERING

Status:
IMPLEMENTED

Selection-order based:
PASS

Question/answer shared mapping:
PASS

Source number discarded:
PASS

Database mutation:
NO

`numberingPlan()` produces one ephemeral plan from current selection order. Both question/answer sections, headings, running footer references and selection controls consume its `displayNumber`. One question receives 1; three receive 1/2/3; C,A,B maps to 1/2/3; removing the middle renumbers the remainder 1/2. Browser move/remove controls update the shared plan immediately. No code, creation date, topic order or database ID supplies a display number. No numbering column was added.

## PDF TEMPLATE

Status:
IMPLEMENTED

| Required property      | Result | Evidence                                                                                                                                                |
| ---------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A4                     | PASS   | All disposable PDFs have approximately 595.28 × 841.89 pt pages; CSS specifies 210 × 297 mm portrait                                                    |
| Master design language | PASS   | Navy heading hierarchy, restrained teal metadata/codes, pale step dividers, adjacent hints and original-byte visuals                                    |
| Canonical header       | PASS   | `Matriculation Physics \| Semester 1/2`; canonical taxonomy supplies topic and difficulty |
| SP015/SP025 absent     | PASS   | Generated template and every inspected export omit them                                                                                                 |
| Set/year absent        | PASS   | No source set/session fields or generated labels                                                                                                        |
| Working space absent   | PASS   | No working-space component, blank ruled lines or reserved working area                                                                                  |
| Difficulty             | PASS   | Easy / Medium / Hard render as uppercase labels                                                                                                         |
| Marks                  | PASS   | Question/part/step marks and answer `Total: N marks`                                                                                                    |
| Question diagram       | PASS   | Centered, aspect-preserving, bounded A4 size, no image fragmentation                                                                                    |
| FBD                    | PASS   | Answer-only; an image followed by math blocks pairs beside those force equations without changing authored sequence                                     |
| Marking code           | PASS   | Separate optional code badge beside step marks                                                                                                          |
| Step-linked hint       | PASS   | Explicit step relationship, immediate placement, multiple hints in authored order                                                                       |
| Math quality           | PASS   | KaTeX browser text with fractions, vectors, Greek symbols, subscripts/superscripts, negative exponents, SI units and degrees; no equation rasterization |
| Client-side            | PASS   | Canonical approved content/assets rendered in browser; Print / Save as PDF uses `window.print()`                                                        |

AI calls:
0 OpenAI calls, 0 LLM calls, 0 image-generation calls, 0 server AI tokens for normal export.

Named A4 pages repeat the canonical header and the appropriate shared-number question/answer reference; global `Page x of y` counters are printed. CSS sets 16 mm top, 19 mm side and 18 mm bottom margins. Small steps, solution introductions and image/equation pairs avoid internal breaks; unusually tall blocks may flow to avoid blank leading pages. The final question part and final answer step each stay with their total, and empty image collections produce no spacing containers. Widows/orphans and final-total break rules reduce isolated content. Images use unchanged canonical asset references and CSS scaling; no modified permanent copy is created. Math fits available width as text, including paired-image columns. Mobile screen preview stacks paired images/equations and bounds images to their container; print keeps the A4 columns.

The layout matrix covers no diagram; question diagram; question diagram plus one FBD; multiple FBDs; no-part and multipart questions; nested subparts; short and long solutions; many equations; long hints; code present/absent; answer-only FBDs; and Easy/Medium/Hard. A longer authored answer can occupy multiple A4 pages; matching the Master's exact page count or pixels is not required.

Visual review evidence is under ignored `data/master-fidelity/`: freshly rendered Master pages, admin-preview screenshot, 13 disposable PDFs, rendered PDF pages and `pdf-inspection.json`. Both reference pages and representative final question, paired-FBD, nested, no-part, long-hint, long-equation/solution and code-absent pages were inspected visually. Automated extraction checks every final page's A4 dimensions, canonical header, shared question reference, page count and forbidden generated labels. PDF font inspection confirms retained KaTeX mathematics.

Print was verified in Chromium. CSS page margin boxes/counters and user print settings can vary in other browsers. Arbitrary author-entered free text is not a semantic source-metadata filter; the authoring exclusions still apply. No custom set-title feature was introduced.

## MIGRATION

Migration 005 required:
YES

File:
`server/migrations/005-master-format-fidelity.sql`

Applied to disposable DB:
PASS

Applied to Production:
NO

Populated upgrade:
PASS — 2 tests, SQLite and file-memory libSQL adapters.

Existing content preserved:
PASS — populated migration-004 question ID, parts, solution/steps, old hint text/order, immutable snapshot, classification snapshot, search row and taxonomy records compare equal after stripping only new NULL fields. Foreign-key and integrity checks pass. Repeated migration invocation is safe through the existing version runner. A new synthetic whole-question draft then imports marking codes and multiple step hints; revisions preserve its first immutable version.

Migration 004 is unchanged. Migration 005 adds no dynamic-number, PDF-style, source-paper or curriculum columns. Startup continues to verify schema without applying DDL. This checkout expects schema 005; deploying it requires the separately authorized production rollout. The auth CLI still caps its migration operation at 003.

## JSON CONTRACT

Runtime validator:
`shared/schema.ts` defines the optional properties and shared ownership/order refinement; `shared/question-import.ts` applies it to portable packages/manifests. Browser preparation and server validation use the same canonical contract. Existing security, asset limits, strict unknown-field checks and signed-plan workflow remain intact.

Generated schema:
Regenerated through `npm run schema:generate`, including `docs/question-json-import.schema.json` and the generated canonical v1/v2 document schemas. `npm run schema:check` passes. No manually maintained divergent schema.

Golden reference:
PASS — synthetic multipart Medium question; LaTeX; question image; two answer FBDs; five ordered keyed steps/codes; six step hints, including two hints on one step. All three supplied byte counts/hashes are verified by browser preparation. The assets themselves remain unchanged.

Backward compatibility:
PASS — schemaVersion 1 retained; optional fields absent in old fixtures; existing question/part hints preserved. No real import occurred.

Updated `docs/question-json-import-format.md`, `docs/QUESTION_JSON_AUTHORING_STANDARD.md`, `docs/CHATGPT_QUESTION_JSON_CONVERSION_CHECKLIST.md`, golden reference and README runtime requirements.

## TESTS

Unit/integration:
PASS — 205 tests, 0 failures, 0 skipped.

Browser:
PASS — 65 tests, 0 failures, including 16 new Master tests.

Focused importer:
PASS — 57 tests in `question-import.test.ts` and `question-import-upgrade.test.ts`, separately run. The 21 new `master-fidelity.test.ts` tests also cover optional/valid/invalid codes, explicit hint ownership/order, browser preparation, persistence, preview, rendering, backward compatibility and relational upgrades.

Focused export:
PASS — 15 new browser export tests (12 layout cases, reorder/removal consistency, question-only/token checks and mobile diagram/equation sizing), plus the new browser admin-preview test. The shared numbering unit test and both adapter integration tests also exercise question/answer render consistency.

Migration:
PASS — 2 new populated 004→005 tests. Existing 003→004 preservation tests still run separately before applying 005 for current-runtime import verification.

| Required command        | Result / exact count where applicable                                                               |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| `npm run typecheck`     | PASS                                                                                                |
| `npm run lint`          | PASS                                                                                                |
| `npm test`              | PASS — 205                                                                                          |
| `npm run db:check`      | PASS                                                                                                |
| `npm run schema:check`  | PASS                                                                                                |
| `npm run api:check`     | PASS                                                                                                |
| `npm run api:esm:check` | PASS — NodeNext source graph: 24 files / 69 relative references; emitted graph: 23 files / 51 edges |
| `npm run storage:check` | PASS — 30                                                                                           |
| `npm run auth:check`    | PASS — 28                                                                                           |
| `npm run build`         | PASS                                                                                                |
| `npm run test:browser`  | PASS — 65                                                                                           |
| `git diff --check`      | PASS                                                                                                |

Logs are under ignored `data/master-fidelity/`. Counts overlap: focused/security checks are subsets of the full suite, not additional unique tests. Initial failures were fixed: old migration-count assertions expected 4, an old browser selector referenced the removed generic print wrapper, importer preview suppressed step hints, and the first visual pass needed tighter spacing/larger FBDs/long-step fragmentation. Sandbox browser shutdown was interrupted and rerun with Windows process cleanup available; interrupted attempts are not claimed as passes.

## SECURITY

Admin-only importer:
PASS — existing authorization/CSRF/signed-plan tests pass; importer remains Validate & Preview → Import as Draft.

Draft answers hidden:
PASS

Draft marking codes hidden:
PASS — new draft import is rejected by approved-only set access; existing HTTP/browser draft privacy tests pass.

Draft step-hints hidden:
PASS — same approved-only gate; step hints render only with answer content.

Answer FBD hidden from question-only output:
PASS — server excludes answer-owned block assets and legacy FBD kinds; browser checks no answer section/codes/hints/FBDs even with stale `hints=true`.

Teacher notes remain removed from public output. Asset mediation, private draft delivery, immutable history, idempotency receipts and atomic import/compensating storage behavior remain covered by the full security/importer/storage suite. Newly authored CSS page strings hex-escape taxonomy text.

## MASTER EXCLUSIONS

Original source question number:
NOT RETAINED

Student working space:
NOT RETAINED

Source set:
NOT RETAINED

Source year/session:
NOT RETAINED

SP015/SP025:
NOT PRESENT IN QUESTION/EXPORT FORMAT

Source PDF provenance:
NOT RETAINED

Full source PDF:
NOT REQUIRED

Semester identities remain Semester 1 / Semester 2. Real educational visuals must be exact original extraction or lossless high-resolution crops; this task neither redraws nor substitutes them. The importer preserves supplied bytes without certifying PDF origin.

Master-reference Git status at entry and completion:

| File                                | Tracked | Untracked | Ignored | Changed/staged by this task |
| ----------------------------------- | ------- | --------- | ------- | --------------------------- |
| `reference/Master JSON Format.json` | NO      | YES       | NO      | NO                          |
| `reference/Master PDF Format.pdf`   | NO      | YES       | NO      | NO                          |

Reference SHA-256: JSON `d532d32fdf30a0c4619ec78d4ff33275f0f1d82a1f6bacd160083e66a1add8bc`; PDF `b08fbf5d385f06db62c57f026c8013d9e9d138df890134853c5e502493ec5de0`. No staging operation occurred. The pre-existing untracked audit remains unchanged.

## PRODUCTION

Production migration:
NO

Production question changes:
0

Production asset changes:
0

Deployment:
NO

Commit:
NO

Push:
NO

No real question imports, production draft edits/approvals, production asset uploads, curriculum mutations or production environment changes. All publication/authoring actions inside existing/new tests use disposable synthetic fixtures only.

## FINAL VERDICT

FULL MASTER FORMAT FIDELITY READY FOR REVIEW

The implementation is local and uncommitted. Migration 005, production rollout, real-question imports, commits, pushes and deployment remain for the next separately authorized task. Work stops after local verification and this report.
