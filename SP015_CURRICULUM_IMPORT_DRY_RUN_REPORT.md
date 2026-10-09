# MATRICULATION PHYSICS QUESTION BANK
# SP015 AUTHORITATIVE CURRICULUM IMPORT - DRY RUN

**FINAL STATUS: READY FOR HUMAN REVIEW**

Prepared 9 October 2026. Scope is **Semester 1 only**, following the user's latest instruction. Semester 2 is deferred. This report prepares a reviewed draft artifact; it does not authorize or perform a production import or activation.

## AUTHORITATIVE SOURCE

| Field | Finding |
| --- | --- |
| Found | PASS: the exact user-supplied local PDF |
| Filename | Curriculum Specifications (CS) Physics SP015.pdf |
| Local source | `C:\Users\User\Downloads\Telegram Desktop\Curriculum Specifications (CS) Physics SP015.pdf` |
| Document title | CURRICULUM SPECIFICATIONS / PHYSICS 1 (SP015), repeated on every page |
| Course name/code | Physics 1 (SP015), page 1 section 1 |
| Issuing authority | No explicit issuer statement. Page 12 lists panel affiliations including **Bahagian Matrikulasi KPM** and **Bahagian Pembangunan Kurikulum KPM**. These establish stated affiliations, not independent issuer/signature verification. |
| Edition/revision | No separately numbered edition or revision stated. The effective academic session is explicitly 2022/2023. |
| Effective period | `Berkuat kuasa mulai Sesi 2022/2023`, footer on all 12 pages |
| Exact effective/publication date | Not stated; no ISO day is inferred from the academic session |
| PDF metadata | Title `CS SP015 2022`; author `Aifaa Awang Kechik`; creation/modification `20220422015513Z00'00'`. File metadata dates are not an official effective/publication date. |
| Semester coverage | `Semester I`, page 1 section 4; no Semester 2 content |
| Pages / size | 12 / 322,853 bytes; printed and PDF page numbers agree |
| SHA-256 | `e20f256f685e57f1267096a1b51ff79faf164fadd929975d38c95ddf074fea74` |
| Source verification | All 12 rendered pages visually inspected; PyMuPDF text extraction cross-checked against pdfplumber outline-column extraction |

Only this source supplied curriculum content. No memory, websites, textbooks, or placeholder taxonomy supplied chapter/topic names. References listed in the PDF were retained as metadata and were not consulted as alternate syllabi. Document statements are syllabus data; they do not override the user's instructions.

Reviewed prerequisites: `DISPOSABLE_LIVE_STACK_SMOKE_REPORT.md`, `ADMIN_DATABASE_SECURITY_REPORT.md`, `TURSO_RUNTIME_MIGRATION_REPORT.md`, `VERCEL_BLOB_STORAGE_REPORT.md`, `docs/import-format.md`, and `docs/production-and-pilot.md`, plus the current curriculum schema/service, migrations and curriculum documentation. The latest live report supersedes older infrastructure limitations. The older recommendation to combine both semesters does not override the user's Semester 1-only scope.

## CURRENT PRODUCTION

Target: `matriculation-physics-question-bank`. **Production writes performed: NO. LEGACY preserved: PASS.** Before and after audits used only fixed SELECT statements through the existing Turso CLI. No login, admin session creation, migration, event, or curriculum write occurred in this target.

| Table | Before | After |
| --- | ---: | ---: |
| courses | 1 | 1 |
| curriculum_versions | 1 | 1 |
| semesters | 2 | 2 |
| chapters | 0 | 0 |
| topics | 0 | 0 |
| subtopics | 0 | 0 |
| questions | 0 | 0 |
| assets | 0 | 0 |
| curriculum_events | 0 | 0 |
| difficulty_levels | 3 | 3 |

Question parts, solutions, solution steps, hints, tags, question tags, question versions, revision candidates, historical classifications and FTS/search records also remain zero. Migrations 001/002/003 are current; applied timestamps are respectively `2026-10-07T11:40:17.807Z`, `2026-10-08T12:15:25.239Z`, and `2026-10-09T01:10:57.658Z`.

The existing course is `matriculation-physics` / Matriculation Physics. The existing version is `legacy-matriculation-physics` / `LEGACY` / Existing curriculum (unversioned), active, revision 1, null effective dates. Existing `semester-1` and `semester-2` remain unchanged in LEGACY, with no children.

**Before/after fingerprints: MATCH**, including counts, taxonomy, deterministic domain rows, schema and migration rows. Security credential/session row values are deliberately excluded; this is a domain/schema fingerprint, not a secret-bearing database dump.

| Fingerprint | Identical before/after SHA-256 |
| --- | --- |
| Logical domain rows | `979b7d48786d795a65896448c32043d0008297be19a64390aff08c49cf92e545` |
| Schema | `d800f97ee713207bde80559633b571e0960fb589e26196b916f737fd3f09e434` |
| Migration tracking | `f6fb46c62c17e5b0026e2693825afe424dfd2d09f1bc66d29c988302153189b3` |

Evidence: [before](data/curriculum-import/sp015-dry-run/production-before.json), [after](data/curriculum-import/sp015-dry-run/production-after.json). Raw domain rows were processed in memory; only safe taxonomy metadata, counts and fingerprints were saved.

## PROPOSED CURRICULUM VERSION

| Field | Proposed value |
| --- | --- |
| Existing course | `matriculation-physics` |
| Version ID | `curriculum-sp015-2022-2023` |
| Code | `SP015-2022-2023` |
| Name | `CURRICULUM SPECIFICATIONS PHYSICS 1 (SP015)` |
| effectiveFrom / effectiveTo | `null` / `null` |
| Status | `draft` |
| Order / initial revision | 1 / 1 |
| Semester ID | `semester-sp015-2022-2023-1` |
| Semester name / slug | Semester 1 / `sp015-2022-2023-semester-1` |
| All hierarchy node statuses / isTest | `active` / `false`; a draft version still hides the entire branch from anonymous readers |

The application code combines the actual SP015 code and stated effective session; it is a **proposed application identifier**, not a claim that the PDF publishes that full version code. The source supplies sufficient evidence for the proposal, subject to human review. Order 1 is an application display order after LEGACY's order 0, not an official revision number. Do not substitute the PDF creation day for an effective date.

`Semester I` maps to the established display convention `Semester 1`. A new version must have its own semester row: existing `semester-1` cannot be reused without changing LEGACY membership, which the current constraints prohibit. New IDs and the version-specific semester slug preserve the existing model without modifying existing rows.

## STRUCTURE AND SOURCE MAPPING

**Semesters: 1. Chapters: 9. Topics: 36. Subtopics: 0.**

| Semester 1 chapter, in source order | Topics | Subtopics | Outline page |
| --- | ---: | ---: | ---: |
| 1.0 Physical Quantities and Measurements | 3 | 0 | 3 |
| 2.0 Kinematics of Linear Motion | 3 | 0 | 3 |
| 3.0 Dynamics of Linear Motion | 4 | 0 | 3 |
| 4.0 Work, Energy and Power | 3 | 0 | 3 |
| 5.0 Circular Motion | 3 | 0 | 3 |
| 6.0 Rotation of Rigid Body | 4 | 0 | 4 |
| 7.0 Simple Harmonic Motion and Waves | 7 | 0 | 4 |
| 8.0 Physics of Matters | 4 | 0 | 4 |
| 9.0 Kinetic Theory of Gases and Thermodynamics | 5 | 0 | 4 |
| **Semester 1 total** | **36** | **0** | |

**Semester 2: OUT OF SCOPE**, absent from the supplied PDF and excluded from the proposed import. No chapter/topic/subtopic count is claimed for an unseen Semester 2 syllabus. The two existing LEGACY semester placeholders remain historical rows.

The source calls its nine major units `Topic 1` through `Topic 9` in the detailed outcomes section and numbers them 1.0 through 9.0 in the Course Content Outline. These map to the database's **Chapter** level. The 36 items numbered 1.1 through 9.5 map to database **Topic**. There is no explicit third structural level. Lettered outcomes, roman lists, named processes, forces, graph types and experiments are metadata, not inferred subtopics. Display names include the official numeric prefix and exact outline wording; layout-only line breaks become spaces as required by the existing importer.

Independent recounts agree: pdfplumber outline-column extraction finds 9 + 36 headings, PyMuPDF detailed pages find 9 + 36 headings, the visually checked transcription matches every outline number/title, and artifact traversal finds 1/9/36/0. There are 111 lettered outcomes across the 36 detailed specification blocks, preserved only as source metadata.

All structural items traceable to source: **PASS**. Unmapped structural items: **0**. No numbering gaps/duplicates, normalized sibling-name duplicates, or repeated topic names across chapters were found. The [hierarchy and comprehensive mapping](SP015_CURRICULUM_HIERARCHY_DRY_RUN.md) lists every proposed node's page, source number/text, level, ID, parent, order, status and notes, plus every source section's disposition.

Five source variants require human review. Proposed text retains the outline, with detailed variants preserved separately:

| Number | Outline wording (proposed) | Detailed wording | Pages |
| --- | --- | --- | --- |
| 1.3 | Significant figures and uncertainties analysis | Significant figures and uncertainties analysis (Laboratory works) | 3; 5 |
| 2.0 | Kinematics of Linear Motion | Kinematics of linear motion | 3; 5 |
| 7.0 | Simple Harmonic Motion and Waves | Simple Harmonic motion and waves | 4; 9 |
| 9.4 | Thermodynamic Processes | Thermodynamic processes | 4; 11 |
| 9.5 | Thermodynamic Work | Thermodynamics work | 4; 11 |

Apparent source wording `Basic of forces and free body diagram` and `Physics of Matters` remains unchanged. No editorial correction was made. The 9.5 wording difference is preserved, not silently reconciled. This is a reviewable proposal, not final approval of those choices.

## IDS / SLUGS

Deterministic IDs: **PASS**. ID collisions: **0**. Sibling slug collisions: **0**, including no collision with existing course-scoped semester slugs. Repeat preparation hash and repeat application preview stability: **PASS**.

The existing schema accepts explicit stable string IDs (up to 120 characters); missing IDs normally become random UUIDs. This artifact supplies all IDs using the repository's readable seeded-ID pattern with an SP015/session namespace and official item number:

```text
curriculum-sp015-2022-2023
semester-sp015-2022-2023-1
chapter-sp015-2022-2023-1 ... chapter-sp015-2022-2023-9
topic-sp015-2022-2023-1-1 ... topic-sp015-2022-2023-9-5
```

Names and display order do not generate identity. Numbers are official identity keys within this proposed version; changing display order/names must retain the recorded ID. Renumbering or another official revision needs a reviewed identity crosswalk or a different version, not automatic ID regeneration. A changed PDF with the same effective session must be compared with this pinned source, not treated as a new import under this code.

Slugs reproduce the current `server/curriculum.ts` rules: trim/collapse whitespace, lowercase, replace non-ASCII alphanumeric runs with `-`, trim outer hyphens, maximum 200 characters; semesters additionally prefix the lowercase version code. Examples: `1-0-physical-quantities-and-measurements`, `3-4-newton-s-laws-of-motion`, `8-2-young-s-modulus`. Sibling uniqueness and normalized name uniqueness are checked by the real importer; slugs are scoped by parent, semesters by course. Existing rename semantics keep IDs/slugs stable even if labels change.

Question classification will use the exact version-specific topic IDs to derive Course/Version/Semester/Chapter. Subtopic is null when absent. Semester + Topic + Difficulty are supported without name-based ancestry ambiguity. Difficulty rows `easy`/Easy, `medium`/Medium and `hard`/Hard remain untouched.

## IMPORT ARTIFACT

Generated: **PASS**. Schema validation: **PASS**, using the actual strict `curriculumImportSchema` in `shared/curriculum.ts`, followed by the real curriculum planner/importer and exact export comparison.

Path: [sp015-curriculum.proposed.json](data/curriculum-import/sp015-dry-run/sp015-curriculum.proposed.json).

Artifact SHA-256: `11c115c37ebebb89a3bcd3ce41eb2fb26e3d2b22e39c132c790dc517de1f5ea5`.

The UTF-8 JSON file is 14,698 bytes and uses existing `schemaVersion:1`. It contains only the existing course reference, new draft version and 1/9/36/0 hierarchy; no unsupported provenance/outcome fields are injected. The directory is ignored by existing `data/` rules; retain these files locally with this review package. The human-readable reports are separate untracked root files. No package/schema/runtime/application source file changed.

Related local artifacts:

- [Source metadata](data/curriculum-import/sp015-dry-run/source-metadata.json): every page's extracted text/image reference, all 36 detailed specification blocks, all heading variants and provenance.
- [Source mapping](data/curriculum-import/sp015-dry-run/source-mapping.json) and [independent outline extraction](data/curriculum-import/sp015-dry-run/source-structure.independent.json).
- [Preparation checks](data/curriculum-import/sp015-dry-run/preparation-checks.json), [isolated simulation](data/curriculum-import/sp015-dry-run/simulation.json), and [quality checks](data/curriculum-import/sp015-dry-run/quality.json).
- `pages/page-1.png` through `pages/page-12.png`, full-page admin/public desktop/mobile screenshots, and individual quality logs in the same directory. These are local reference images, not uploaded Question Bank assets.

Reproduce locally from the repository root, with the installed isolated PDF dependencies retained:

```powershell
python -X utf8 data/curriculum-import/sp015-dry-run/prepare.py
node --import tsx data/curriculum-import/sp015-dry-run/simulate.ts
```

The preparation script verifies the pinned source hash before extraction. The simulation explicitly uses SQLite `:memory:` with migrations 001/002/003 and does not import the production runtime or read connection credentials. It closes both disposable banks, browser and server; no cloud scratch resource or persistent question database was created.

## ISOLATED IMPORT SIMULATION

| Check | Result |
| --- | --- |
| Fresh current schema / LEGACY baseline | PASS, migrations 001/002/003 |
| First import | PASS, real authenticated application API returns 201, draft 1/9/36/0 |
| Repeated preview | PASS, identical normalized document/counts/token with zero writes |
| Identical import repeat | PASS, intended safe rejection 409: code already exists; no overwrite/merge |
| Stable IDs / no duplicate structure | PASS, exact export and unchanged taxonomy after repeat |
| Foreign keys / integrity | PASS, no violations / `ok` |
| Import history | PASS, one event with null before and exact imported document after |
| Forced late failure | PASS, failure inserting the final event rolls back all hierarchy/version inserts |
| LEGACY preserved / version separation | PASS, exact original export and semester rows unchanged after draft import |
| Activation without confirmation | PASS, rejected 409 |
| Activation with reviewed impact | PASS, SP015 active and LEGACY retired within one transaction |
| One-active database constraint | PASS, direct attempted second active version rejected |
| Reactivation / switching | PASS, LEGACY then SP015 reactivated without changing either hierarchy |
| Activation events | PASS, 1 import + 2 initial switch + 2 return to LEGACY + 2 return to SP015 = 7 |
| Historical classification preservation | Empty history remains empty; populated preservation passes existing regression suite, not this curriculum-only fixture |
| All question/content/tag/asset/search tables | PASS, zero throughout the custom fixture |

Immediately after draft import: course 1, versions 2, semesters 3, chapters 9, topics 36, subtopics 0, events 1. The three semesters comprise **two unchanged LEGACY placeholders plus one new SP015 Semester 1**, not a Semester 2 syllabus import. The final rehearsal has 7 events because it additionally exercises reversible switching. A real draft-only import should have exactly one new import event, not seven.

Activation changes the default curriculum for the **entire course** and retires the previous version; it does not merge semesters or transfer existing classification IDs/questions. Default active browsing would then offer only new Semester 1. LEGACY remains accessible as a retired published version. It cannot be changed back to draft. No real activation has been authorized or executed.

## API / UI

| Check | Result / practical limit |
| --- | --- |
| Public taxonomy | PASS, draft branch hidden; 9 chapters/36 topics published after isolated activation |
| Curriculum versions | PASS, draft excluded publicly, admin sees it; retired/active published versions retained |
| Semester filtering | PASS, all 36 topic queries carry the exact new semester/version IDs |
| Topic + Difficulty filtering | PASS, all 36 topic IDs accepted with difficulty; zero-result curriculum-only fixture |
| Positive classified-question filtering | Not exercised with this fixture; existing SQLite/libSQL filter regressions passed |
| Admin curriculum rendering | PASS, draft status and all 36 topic choices; longest label selected/editable; order/status shown |
| Public curriculum rendering | PASS for all 9 ordered headings/36 ordered topics; version-label limitation below |
| Default question browser | PASS, one active semester card; Semester/Topic/Difficulty URL state survives reload |
| Desktop/mobile layout | PASS at 1280x1000 and 390x844, no horizontal page overflow or JavaScript page errors |
| Semester 2 frontend syllabus | N/A, excluded; existing empty LEGACY Semester 2 remains visible as historical taxonomy |

Visual evidence: [admin desktop](data/curriculum-import/sp015-dry-run/admin-draft-desktop.png), [admin mobile](data/curriculum-import/sp015-dry-run/admin-draft-mobile.png), [public desktop](data/curriculum-import/sp015-dry-run/public-active-desktop.png), [public mobile](data/curriculum-import/sp015-dry-run/public-active-mobile.png).

**Existing UI limitation:** `/curriculum` for anonymous visitors groups all published versions under the course without version labels. After isolated activation, the empty LEGACY Semester 1 and new SP015 Semester 1 appear with identical headings, and empty LEGACY Semester 2 remains. The admin tree has explicit version codes; the question browser defaults correctly to the active version and uses distinct IDs. This is a presentation ambiguity to review before activation/public use; no UI redesign was made during this report-only task. Long native select/input labels truncate visually in narrow controls but retain their full values and do not overflow the page.

Initial browser harness attempts missed opening the mobile Filters panel before selection and again after reload. Correcting the harness to use that existing control produced the final full PASS run; no application fix was needed. The required browser regression suite was not rerun because application/runtime/frontend source did not change; the custom artifact-specific Chromium review was performed.

## SCHEMA LIMITATIONS

Migration 004 required for the proposed hierarchy: **NO**. A future schema extension is **possibly** needed if curriculum outcomes are to be queried or displayed in the application.

Source metadata not represented by the strict curriculum import schema:

- CLOs, MQF clusters, PEO/PLO statements and mapping matrices.
- All 111 lettered learning outcomes, nested roman lists and 36 detailed specifications.
- Formula requirements, teaching remarks, exclusions and inclusions, experiments/activities.
- Credit, prerequisites, academic staff, teaching/assessment methods, SLT and assessment weights.
- References, panel/authority affiliations, effective academic-session text and source page provenance.

Recommendation **A: retain as import-reference metadata** in the sidecar and original local PDF. Existing question tags/teacher notes are question-scoped and cannot faithfully store curriculum-wide specifications without creating prohibited content; option B is unsuitable. A separately reviewed schema extension (option C) would be needed for structured application support later. Nothing was converted into tags, notes on synthetic questions, or invented subtopics.

All PDF pages and 36 outcome blocks remain in local reference metadata. Extracted mathematical fractions, radicals and superscripts can be mangled by text extraction; the original PDF and rendered page images remain authoritative for formulas. No formula was interpreted, repaired, or written into the database. Some apparent formula/grammar issues (including the printed rotational-motion expression in 6.1) remain untouched in those references. The mapping report classifies every source section as structure/metadata/not applicable; nothing structural was omitted.

## FUTURE PRODUCTION IMPORT PLAN - NOT EXECUTED

Backup procedure: **PASS (prepared, not executed)**. Transactional import plan: **PASS**. Post-import verification plan: **PASS**. Recovery plan: **PASS (prepared, not executed)**.

1. Obtain separate authorization after every hierarchy entry and review item below is checked against the supplied PDF. Approval of this report alone does not execute anything. Agree on **draft-only import** first; activation is a separate decision. Identify an authenticated, protected deployment with the audited current code and confirmed binding to `matriculation-physics-question-bank`. If deployment/permissions/bindings are unclear, stop for exact manual configuration; do not guess or change Vercel variables.
2. Quiesce administrative writes during backup/import/post-audit. Run read-only counts, course/LEGACY/semester rows, migration and schema fingerprints again. Expected baseline is this report's 1/1/2/0/0/0 and zero question/content/events. Any difference requires a new reviewed baseline, not forced import. Export LEGACY via the authenticated export API and keep a sanitized domain audit.
3. Create a uniquely named **Turso pre-import copy**, with the audited source group specified explicitly. The installed CLI's `db create --help` confirms `--from-db`, `--group`, and `--wait`. This is future authorized creation only; no copy was created now. Example future command from PowerShell, with the group value filled from the future read-only source metadata audit:

   ```powershell
   $sp015BackupName = 'physics-bank-pre-sp015-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
   # Set $sp015AuditedGroup to the audited source group before running.
   wsl.exe --distribution Ubuntu --exec /home/pekchunhoe/.turso/turso db create $sp015BackupName --from-db matriculation-physics-question-bank --group $sp015AuditedGroup --wait
   ```

   Independently verify the completed copy's domain counts, schema, migrations, taxonomy and domain fingerprints match the quiescent source using SELECT-only reads. Record backup name/time and retain it. Backup includes security records; never dump their credential values into evidence. Do not use the old migration-001 local SQLite file as a current production recovery backup. No Blob backup/modification is needed for this curriculum-only import because existing assets are zero and the artifact contains no assets.
4. Verify source and exact artifact bytes with SHA-256:

   ```powershell
   Get-FileHash -Algorithm SHA256 -LiteralPath 'C:\Users\User\Downloads\Telegram Desktop\Curriculum Specifications (CS) Physics SP015.pdf'
   Get-FileHash -Algorithm SHA256 -LiteralPath '.\data\curriculum-import\sp015-dry-run\sp015-curriculum.proposed.json'
   ```

   Require the two hashes stated in this report. Revisions after review require a new artifact/hash/rehearsal and renewed review. Archive the pinned artifact, source metadata, reports and verified backup evidence locally; the ignored artifact is not delivered by a Git commit.
5. Log in through the deployment's existing admin flow; keep password and session private. Open **Curriculum > Import an authoritative curriculum JSON**, choose the pinned file, then **Validate curriculum and preview**. The read-only command is `POST /api/curriculum/import/validate` with `{document}`. Require normalized JSON identical to the pinned artifact, counts 1/9/36/0, a draft version and no collisions. Review the full hierarchy, enter a curriculum import note, and check the existing import confirmation. The exact supported import command is the following application API request, executed by **Import reviewed curriculum** in the existing UI; there is no dedicated curriculum-import CLI:

   ```javascript
   // Equivalent request performed by the authenticated UI, after separate authorization.
   // reviewedPlan is the just-reviewed response from /api/curriculum/import/validate.
   await fetch('/api/curriculum/import', {
     method: 'POST',
     credentials: 'same-origin',
     headers: {
       'Content-Type': 'application/json',
       'X-Question-Bank-Request': '1'
     },
     body: JSON.stringify({
       document: reviewedPlan.document,
       token: reviewedPlan.token,
       note: 'Reviewed authoritative SP015 session 2022/2023; Semester 1 only; draft import'
     })
   });
   ```

   Use the UI rather than copying tokens/cookies into a terminal or report. Cookie authentication and same-origin CSRF checks remain enforced. The preview token stays in application memory. Do not run an unreviewed direct SQL hierarchy insert. A stale preview or duplicate code returns 409; re-audit and revalidate without automatically retrying writes.
6. Transaction boundary: the existing `CurriculumService.import` starts one write transaction, repeats validation/current-state token checks, inserts the draft version and all hierarchy rows, and inserts one event before commit. Any insert/constraint/event failure rolls back the whole operation. Do not weaken constraints or apply migration 004.
7. Post-import, using read-only checks, require course 1; versions 2; semesters 3; chapters 9; topics 36; subtopics 0; all question/content/tag/assets/search tables 0; exactly one new curriculum event. Confirm LEGACY is still active/revision 1, its original semester rows unchanged, the new version draft/revision 1/null dates, every new node active/isTest false and all parent/order/ID/slug values match the artifact. Check foreign keys/integrity in the verified copy as appropriate and compare authenticated export to the pinned JSON. Course/difficulty rows and old domain records must remain unchanged.
8. Verify authenticated API taxonomy/version/export and admin tree/preview on desktop/mobile. Anonymous taxonomy and curriculum-version responses must still hide the draft; no public SP015 branch is expected until a separately approved activation. Keep before/after production evidence sanitized. Do not add a question merely to demonstrate taxonomy filters.
9. If activation is later explicitly authorized, review impact using the existing version editor, confirm retirement/default browsing, and activate through the existing PATCH workflow. It adds two events (new activation plus retirement of old active version), leaves IDs/history intact, and changes course-wide active browsing to new Semester 1 only. Verify one active version, public hierarchy and Semester/Topic/Difficulty filters. Decide how to address the public version-label ambiguity before this stage. Semester 2 remains deferred; it must not be inferred or imported here. The importer cannot append another document under the same existing code; a future Semester 2 task must review the existing draft-add workflow or a distinct complete version, not a duplicate import.
10. Recovery: a failed transaction should leave the exact pre-import state; verify rather than retry blindly. For a committed but incorrect **draft**, retain it and retire via the audited editor; LEGACY remains active, and no hard delete is permitted. This is safe containment, not byte-identical rollback. If later activation is wrong, the existing reviewed activation workflow can reactivate LEGACY, retiring SP015 while keeping events/history. For exact disaster recovery, restore from the verified pre-import copy into a new recovery database, audit it, and arrange an explicitly authorized maintenance/binding switch; do not reverse migrations or delete constrained rows. Any Production Vercel binding/environment change requires a separate authorized operation and manual steps if needed. Retain the backup until the import and subsequent recovery decision are accepted.

## QUALITY

| Check | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm test` | PASS, 122 passed, 0 failures/skips |
| `npm run db:check` | PASS |
| `npm run schema:check` | PASS |
| `npm run api:check` | PASS, native ESM and credential-free API checks |
| `npm run build` | PASS |
| Artifact-specific API/Chromium simulation | PASS, real admin/public UI, desktop/mobile |
| Existing `npm run test:browser` | N/A, no application/runtime/frontend source changed |
| `git diff --check` | PASS |

Full-suite tests use their existing isolated synthetic fixtures; the custom SP015 import fixture creates **no questions**. Production credentials are removed from quality-check child environments. Results/logs are in the ignored staging directory. No tests were weakened and no application edits were needed.

## PRODUCTION ACTIONS

Curriculum imported: **NO**. Production DB modified: **NO**. LEGACY modified: **NO**. Production Blob modified/accessed: **NO**. Questions imported: **NO**. Migration 004 created: **NO**. Vercel configuration/environment changes: **NO**. Commit: **NO**. Push: **NO**. Deployment/promotion: **NO**.

No administrator password, session cookie, Turso token, OIDC token, Blob credentials or private Blob URL was logged or included in review artifacts. The existing live smoke reports were preserved.

## HUMAN REVIEW ITEMS

1. Compare every chapter/topic entry and page reference in the hierarchy report with the supplied PDF; approve mapping source `Topic 1-9` to database Chapter and decimal items to database Topic, with zero invented subtopics.
2. Approve the five outline/detailed wording choices, numeric prefixes and unchanged apparent source wording. Specifically decide 9.5 `Thermodynamic Work` versus `Thermodynamics work`, and whether the 1.3 laboratory qualifier should remain metadata.
3. Approve proposed application code `SP015-2022-2023`, readable stable IDs, `Semester I` -> `Semester 1`, exact title and null ISO dates. Confirm the source's session identifies the desired edition; a different official source must be compared before proceeding.
4. Accept that learning outcomes, formulas, remarks, experiments and provenance remain local reference metadata, with original/rendered PDF pages authoritative for mathematics.
5. Review course-wide activation timing: Semester 2 is deferred, LEGACY must remain preserved, and default active browsing after activation contains only Semester 1. Review the existing public curriculum version-label ambiguity.
6. Separately authorize any real draft import with a freshly verified Turso backup and post-import audit. Activation requires a separate explicit decision; no production action follows automatically from this report.

**FINAL STATUS: READY FOR HUMAN REVIEW**

Recommended next step: visually verify the complete Semester 1 hierarchy against the PDF and resolve the review items. A separately authorized production draft import can then follow the backup/import/audit procedure above. Semester 2 remains outside this task.
