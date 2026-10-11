# Flexible JSON importer implementation report

**11 October 2026, Malaysia time — LOCAL IMPLEMENTATION COMPLETE; RELEASE AWAITING APPROVAL.**

291 unit tests and 107 browser tests pass. Typecheck, lint, database/schema checks, both API checks, storage, auth and production build pass. No commit, push, deployment, production import, hosted database write or migration was performed for this task. The canonical Master schema and student export implementation remain unchanged.

## 1. Confirmed problem and root cause

The previous browser preparation function parsed JSON and immediately applied a strict Master package schema. Portable fields such as format_identifier, format_version, metadata and answer_scheme had no detector or adapter; their names and structures therefore produced literal-version, missing-field and unknown-key errors. Server validation also accepted only canonical manifests. This was a structural compatibility gap, not evidence of invalid physics.

The named `First_Law_of_Thermodynamics_MEDIUM_PORTABLE.json` was not present in the repository or attachment inventory. This implementation supplies a clearly labeled synthetic portable first-law fixture, documents its exact supported profile, and offers manual mapping for other structures. It does **not** claim that an unavailable source file has been verified.

## 2. Audit and files examined before implementation

The pre-implementation record is [architecture audit and design](docs/flexible-json-importer-audit.md).

Examined:

- Canonical validation/types: shared/question-import.ts, shared/schema.ts, shared/content.ts, shared/model.ts, shared/curriculum.ts, generated question JSON schemas and format documentation.
- Browser import: src/QuestionJsonImporter.tsx, src/question-import-preparation.ts, src/api.ts, src/main.tsx and existing admin gates/components.
- Trusted persistence: server/app.ts, server/question-json-import.ts, server/database.ts, server/curriculum.ts, server/auth.ts, server/visibility.ts, asset service/storage/validation and migrations 001–005.
- Mathematics/export: src/MathText.tsx, src/Preview.tsx, src/MasterPrint.tsx, src/QuestionSet.tsx, shared/export-content.ts, shared/export-plan.ts, src/word-export.ts, src/word-math.ts and existing print styles.
- Fixtures/tests: examples/question-import, question-import tests and upgrades, admin difficulty tests, browser import fixtures, auth/storage tests, master fidelity and public PDF/Word export suites; test-bank.ts, browser-server.ts, Playwright config and npm check scripts.
- Workspace/history: current HEAD and working-tree changes, package/lockfile, migration and schema differences; prior security/export reports were preserved.

## 3. Files changed for this upgrade

| File | Purpose |
| --- | --- |
| shared/import-compatibility.ts (new) | Bounded parse, versioned registry, deterministic adapters, path mapping, source coverage, diagnostics and review transport |
| src/ImportCompatibilityReview.tsx (new) | Format report, original/candidate review, exact field mapping, corrections, metadata choices and curriculum selectors |
| src/QuestionJsonImporter.tsx | Integrate detection/review, preserve difficulty, invalidate stale edits, independently checked source submission and duplicate approval |
| src/question-import-preparation.ts | Normalize before canonical package parsing; retain existing byte/hash checks and binary splitting |
| server/question-json-import.ts | Bounded server normalization, reviewed-source/manifest parity, difficulty preservation, signed duplicate choice and transactional duplicate recheck |
| server/app.ts | Extend the existing authenticated preview payload; retain existing routes and auth/CSRF boundary |
| shared/question-import.ts | Update difficulty contract comment; add duplicate IDs/titles to preview type; no canonical field/validator change |
| examples/question-import/portable-first-law-synthetic.json (new) | Explicit synthetic v1.1 profile with MEDIUM, exact first-law working, Unicode and step-linked hints |
| tests/import-compatibility.test.ts (new) | 18 compatibility, persistence, export, security, curriculum and rollback cases |
| tests/browser/flexible-json-import.spec.ts (new) | Seven real UI/import/mapping/duplicate/export/accessibility cases |
| tests/admin-difficulty.test.ts; tests/browser/admin-difficulty.spec.ts | Replace obsolete source-difficulty override expectations with preservation and rejection tests |
| tests/question-import-fixture.ts; tests/browser/z-question-json-import.spec.ts | Explicit source-absent administrator-selection fixtures; preserve official source-bearing examples |
| docs/question-json-import-format.md | Correct obsolete difficulty instructions and document request/duplicate behavior |
| docs/flexible-json-importer-audit.md; docs/flexible-json-importer.md (new) | Architecture record, precise profiles and future adapter instructions |
| This report (new) | Reviewable results and release gate |

Pre-existing uncommitted changes in server/security-headers.ts, vercel.json and tests/browser/security.spec.ts are the pending KaTeX font CSP correction from the earlier security rollout. They were preserved and covered by regression testing; they are not importer changes. Historical security/export reports remain local and unchanged. Temporary logs, screenshots and generated test documents are under ignored data directories.

## 4. Authoritative canonical contract

The unchanged strict package schema requires schemaVersion 1, the canonical kind, explicit classification, question fields and arrays for parts, solutions, hints, tags and embedded assets. The persisted QuestionDocument remains the existing schema, with generated stable question identity, resolved taxonomy/difficulty and draft status.

Required question values include title, scenario (possibly empty if other content provides the question), positive integer totalMarks, positive integer estimatedMinutes and supported questionType. **Estimated minutes is required in the actual schema**; this upgrade does not invent it. Classification requires an explicit version, Semester 1/2, chapter, topic and nullable subtopic. Question code and content blocks are optional. Parts/hints/tags/assets can be empty; solutions cannot. Empty permitted scheme/step text containers do not replace required mark allocations.

Parts retain adjacency-list IDs, parents, labels, marks and order. Parent totals equal direct children, roots equal question marks, and each leaf has exactly one scheme with exact step allocation. Explicit step IDs/marking codes and hint-to-step ownership retain their existing constraints. Assets retain signature, SHA-256, byte-length, supported type, role and unique content-block placement checks.

Generated schema parity passed; no migration or canonical JSON Schema diff exists.

## 5. Formats and field mappings

| Adapter | Support |
| --- | --- |
| canonical-v1@1 | Existing official Master JSON; exact candidate structure retained |
| portable-v1.1@1 | Exact portable identifier, string version 1.1 and documented structured fields |
| aliases@1 | Unversioned equivalent title/stem/marks/type/classification/scheme/hint/asset fields, only with appropriate shapes |
| administrator-mapping@1 | Exact JSON-pointer selections, reviewed canonical corrections and explicit nonacademic metadata decisions |

The registry owns detectors, version readers, supported versions and normalization modes. Known unsupported versions remain blocked even when a candidate is edited. Unknown wrappers are analyzed and shown for mapping; they are not converted into invented questions.

Title aliases: title/question_title/name. Statement: scenario/stem/question_text/string question. Difficulty: difficulty/difficulty_level. Total marks: totalMarks/total_marks/marks. Topic: topic/topic_name. Subtopic: subtopic/sub_topic. Type: questionType/question_type/type. Schemes: solutions/answer_scheme/marking_scheme. Hints: hints/student_hints. Existing assets: assets/diagrams/figures. Full per-record rules are in [the developer guide](docs/flexible-json-importer.md).

Object/array question fields are not guessed to be a statement. working_steps is not automatically treated as hints. Free-text schemes do not gain fabricated marking steps. Competing aliases block until an administrator explicitly resolves them while retaining every supplied value. Keyed embedded asset objects can become arrays; unsupported/URL-only assets remain blocking. No external asset fetching or diagram generation exists.

## 6. Optional, required and default values

Missing hints/tags/assets/parts remain empty where permitted. Missing subtopic is null. Optional textual scheme containers are empty rather than invented prose. Structural IDs, ordering, numbers and actual parent links may be generated from source array position/nesting and are visibly reported. Supplied identifiers/order are retained.

Missing marks, time, title, type, required classification, scheme allocations and academic content need explicit administrator input. Difficulty is never inferred: recognized Easy/Medium/Hard is preserved across capitalization and must match the signed selection. Missing difficulty uses the separate administrator selection; an ambiguous string needs explicit confirmation. Changing a recognized source category is rejected.

## 7. Content integrity and loss reporting

No academic prose is summarized, recalculated or paraphrased. Original source remains visible beside the candidate. Mapped scalar values and supplied blocks/assets are checked against their destinations; changed/removed academic values block. Unknown academic information remains blocking until represented. Multipart links, leaf targets, step IDs, hint links, marks and ordered content survive normalization and persistence.

Balanced prose math delimiters \(...\) and \[...\] are translated to existing dollar delimiters; equation bodies are unchanged. Wrapped raw-equation fields can be unwrapped without rewriting their bodies. Unicode Δ, θ, μ, Ω and ° persisted exactly. Tests cover vectors/fractions/delimiters and existing broad mathematical export cases.

Exclusions are restricted to designated metadata namespaces, require explicit nonacademic review and set lossless:false. Known academic fields cannot use that exemption. PDF export contracts never override the app. Administrator-approved curriculum replacement and confirmation of an ambiguous source difficulty are also explicitly not called lossless classification conversions. Mechanical source coverage cannot certify physics correctness or that an administrator's metadata designation is appropriate; human academic review remains necessary.

## 8. Administrative review interface

Upload/paste → detect format/version/adapter → normalize → review grouped diagnostics → map/correct/recheck → server validation/rendered preview → explicit review → create draft.

Diagnostics separate mapped, optional, required, ambiguous, unsupported, conflicting and default information. Original and destination paths are shown. Human-readable errors lead, with expandable technical details. The original source is read only in the comparison; the canonical candidate is editable and must be explicitly applied before validation. Source edits or mapping/difficulty/duplicate changes invalidate the prior signed preview.

Curriculum selectors use available version/semester/chapter/topic/subtopic records, permanent semester names, exact parent relationships and no fixed topic counts. Server resolution remains authoritative. The page displays complete existing question/marking/hint/visual previews and only creates drafts after review. Import never publishes automatically. Mobile and axe checks pass.

## 9. Server security findings

- Existing administrative authentication and same-origin CSRF execute before privileged request handling. Anonymous and forged-origin requests cannot sign or commit imports.
- Parsing checks 5 MiB package size, 32-level depth, 100,000 JSON values, plain JSON values, finite numbers, duplicate keys and prohibited prototype keys. Canonical manifest limit remains 384 KiB; semantic collection limits remain authoritative.
- JSON-pointer destinations are bounded and cannot create huge sparse arrays or prototype properties. Mapping performs no expression/code execution or network access.
- Reviewed source/mapping are independently normalized server-side and must match the submitted strict canonical manifest before preview signing. Canonical API clients remain compatible; all data are independently revalidated on commit.
- Signed content/admin/difficulty/taxonomy/expiry checks and exact binary signature/hash/length checks remain. Unsafe SVG handling, trust:false math rendering, private assets and public approved-only visibility remain unchanged.
- HTML/script strings are preserved as escaped text, not executable markup. Unsupported external asset references are rejected. No credentials, privileged URLs or original source metadata are added to student exports.

## 10. Database and revision safety

**No database schema change or migration. No production data access for this task.** All writes exercised in tests used explicitly disposable local SQLite/libSQL banks.

Validation performs no question writes. Commit uses the existing transaction for content, blocks, classification, immutable initial version/search and import receipt. Failure-injection tests roll back rows and clean owned new uploads; a portable-specific marking-step failure also leaves content, versions, search and receipts empty. No existing question is revised or overwritten by the importer.

Source/normalization diagnostics are displayed and sent transiently for verification; no redundant full source copies are persisted. The canonical schema has no provenance field. Retain original files when historical metadata needs long-term preservation.

## 11. Duplicate/idempotency behavior

Exact structured-content fingerprints, independent of filenames, expose matching question IDs/titles. Reuploading identical content with a fresh preview cannot commit by default. Intentional separate drafts need explicit approval and a fresh signed preview; the permission is inside the signed plan. The duplicate check repeats inside the transaction, protecting against content appearing after preview.

Successful unchanged plan retries return the same question/receipt, including response-loss and concurrent retry tests. Published questions are not overwritten. Fingerprints include resolved curriculum/difficulty and structured fields; this is not semantic similarity detection for paraphrases or changed identities.

## 12. PDF and Word compatibility

Student export modules, numbering, print styles, approved-only selection and device-side generation are unchanged. The portable fixture's source → normalized JSON → server-normalized draft → immutable retrieval → rendered math/native OMML comparison passed. The browser test verifies draft creation, then performs a **separate explicit approval only in its isolated local bank** to exercise the existing public export flow.

Actual portable PDF and DOCX generated successfully. PDF visual inspection showed correctly aligned ΔU equations, unchanged 500/200/300 J values, Medium difficulty, individual marks and adjacent step hints on one readable page. Word XML contains native math and supplied hint/final-answer text. Existing export regressions cover fractions, exponents/subscripts, Greek/vector notation, alignment, multipart marks, supplied assets and question/answer isolation.

Independent inspection of **21 PDFs and 14 DOCX files**, including the new portable specimens, found zero active-content/private-URL findings. Word uses its existing explicit rejection for unsupported math, not silent conversion. No server PDF generation or paid AI call is introduced.

## 13. Automated validation

| Gate | Final result |
| --- | --- |
| npm run typecheck | PASS |
| npm run lint | PASS |
| npm test | **291 passed, 0 failed** (273 prior + 18 new) |
| npm run db:check | PASS, disposable DB integrity/FKs/migrations |
| npm run schema:check | PASS, unchanged generated canonical schema |
| npm run api:check | PASS |
| npm run api:esm:check | PASS |
| npm run storage:check | **30 passed** |
| npm run auth:check | **28 passed** |
| npm run build | PASS |
| npm run test:browser | **107 passed, 0 failed** (100 existing working-tree cases + 7 new) |
| Focused compatibility tests | **18 passed** |
| Focused import/difficulty browser run | **37 passed** |
| git diff --check | PASS |
| Package, lockfile, migration and generated schema diff checks | No changes |

The full suites have no remaining unrelated pre-existing failures. Existing build dependency annotation warnings are non-fatal. Windows test-server shutdown required terminating only the confirmed completed isolated server after every test had finished; runner exit was 0. No running test case was stopped to obtain a pass.

### Required A–O coverage

| Case | Evidence |
| --- | --- |
| A Master JSON | Official no-part/visual packages retained; canonical import/browser regressions |
| B portable first law | Synthetic explicit v1.1 fixture, MEDIUM, math/steps/hints, real local draft |
| C aliases | Unversioned equivalent-field profile and structural records |
| D optional fields | Empty supported arrays/text and absent source difficulty |
| E required fields | Missing minutes blocked before HTTP; explicit correction and revalidation |
| F multipart | Nested source flattening, exact leaf marks/schemes/part and step links |
| G LaTeX | Delimiter/body/Unicode invariants plus existing PDF/OMML math matrix |
| H unknown JSON | Real browser pointer mapping; unmatched wrapper/array content remains blocking |
| I unsupported content | Unmapped academic fields and altered source values blocked; explicit metadata exclusions disclosed |
| J unauthorized | Direct API auth/CSRF, existing admin gate and public draft/asset privacy tests |
| K duplicates | Identical-content IDs, default block, signed intentional separate draft, durable retries |
| L exports | Portable actual PDF/DOCX plus all previous export/fidelity regressions |
| M curriculum | Explicit retired local version rejected; reviewed available mapping accepted; no automatic reassignment |
| N security | Malformed/oversized/deep/prototype/duplicate/nonfinite JSON, bounded mapping, literal HTML and rejected external assets |
| O transaction safety | No-write validation, portable rollback and existing per-table/binary compensation failures |

## 14. Known limitations

- Only the documented portable profile has been verified. Other files sharing its identifier may need mapping or an additional adapter. The actual named user file remains unverified because it was unavailable.
- Arbitrary physics content cannot be understood automatically. Manual mapping requires canonical shapes, exact preservation and authorized academic review; it does not supply LLM/AI inference.
- Extra independent schemes for one leaf, unsupported embedded media or an unrepresentable relationship block until resolved. No academic field is silently discarded to force acceptance.
- Required estimated time and canonical mark allocations remain required; no automatic estimates/sums/answers are produced.
- Retired curriculum cannot be assigned directly. Explicit reviewed reassignment retains the original in the visible source, not a new provenance database field. Original metadata is not persisted outside canonical supported fields.
- Reviewed structured source/candidate submissions are bounded separately from the package's embedded bytes; very large metadata-only inputs may require a smaller explicitly reviewed source. Normal assets retain the existing aggregate limits.
- Allowed metadata exclusion still depends on human verification that the field is nonacademic. A conversion with exclusions is not certified lossless. Private teacher notes do not appear in student exports.
- Duplicate detection is exact structured matching, not detection of semantically equivalent paraphrases.
- Word retains its existing supported-math boundary; unsupported constructs raise a clear export error.

## 15. Remaining risks and operational limits

No production or protected-deployment verification was performed for this local upgrade, because Phase 7 explicitly prohibits automatic commit/push/deployment. Local checks do not substitute for release verification. The earlier pending security rollout is also still incomplete; its font correction remains in the working tree.

The compatibility module is lazy-loaded with the administrative importer. Student browsing/export modules do not acquire new importer work or requests. Normalization is deterministic browser/server code, with no new dependency, paid service, curriculum mutation or storage operation during preview.

## 16. Future extension instructions

Use [the developer guide](docs/flexible-json-importer.md). Inspect real representative files, declare an exact registry profile/version, add typed structural mappings with original/destination tracking, preserve all meaningful content, and add malformed/conflicting/unsupported/round-trip tests. Never merely accept a future version without verifying its semantics. Retain canonical schema authority and existing auth, signed plans, image checks and transaction boundary.

## 17. Recommended deployment steps and approval gate

1. Review these local changes, documented limits and the actual portable file when available. Confirm the deliberate difficulty-preservation and duplicate-approval behavior.
2. Explicitly approve commit/push and release scope, including whether to include the already pending three-file CSP font correction. No staging/commit was performed in this task. Current HEAD remains `fcab13143fbacc9cf5f6629938af18be96fe7abe`.
3. After approval, explicitly stage reviewed source/docs/fixtures/tests, excluding temporary evidence and historical reports; commit normally and push without force.
4. Verify an exact-SHA protected Preview and bindings, health, actual CSP/font behavior, admin/public route privacy and export controls. Treat any shared hosted data as production-backed and use read-only checks; use disposable local banks for import writes.
5. Release only the verified commit after approval, verify production health/bundles/headers and read-only content preservation. No migration, real question import, environment/domain change or Avira appeal is needed for this importer upgrade.

**Stopped before commit, push and deployment, as explicitly required by Phase 7 of the supplied request.**
