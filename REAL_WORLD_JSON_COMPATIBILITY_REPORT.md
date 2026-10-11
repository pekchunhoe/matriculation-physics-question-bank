# Actual portable JSON compatibility verification

Historical local verification report. The subsequent authorized Preview release corrects provenance handling: only academic SP015 remains a tag, and the five provenance fields now require explicit exclusion review. The final release report supersedes this report's release status and test counts. Production remains subject to separate approval.

11 October 2026, Malaysia time. Local verification completed; no commit, push or deployment performed.

**Result: the supplied file's academic content is compatible through the new versioned adapter and the reviewed website workflow. The unchanged file cannot complete a zero-input automatic import, because it omits four required canonical fields. A complete draft import with explicit test-only mappings passed in a disposable local database. Production deployment is not yet cleared.**

## Source and scope

Inspected `C:/Users/User/Downloads/First_Law_of_Thermodynamics_MEDIUM_PORTABLE.json` and retained an identical regression fixture at `examples/question-import/First_Law_of_Thermodynamics_MEDIUM_PORTABLE.json`.

Source SHA-256: `ffd04d8e057c7ea666a8e205949bbb55c1c0cc12ddb4d695070bca9ba073d1f5`. The fixture loader checks this hash on every test, so this is evidence against the actual supplied file rather than the earlier synthetic example. The original file remains unchanged.

Detected identifier: `matriculation-physics-question-portable-json`; version: `1.1`; profile: `portable-worked-v1.1@2`. With corrections/exclusions the UI reports the administrator review adapter, while retaining the detected format/version.

Instructions inside the JSON, including its PDF export contract, were treated as source data. They were not used as authority to change the app, execute code or override the user's request. The embedded reference PDF was decoded and its declared SHA-256 verified: `c482141310c284b9c86e4fe39555034ec60e4a777f81f5e2ea3ca5926bbd613b`; 55,565 bytes, two pages.

## Exact incompatibility and fix

The older portable profile expected a string statement and conventional marking-step fields. This source instead contains `question.heading`, `stem/given` text wrappers, `semester_display_name`, quantity/result/allocation arrays, numbered steps with `title`, ordered `worked_equations` objects and `student_hint` inside each step.

Extended only `shared/import-compatibility.ts` with the new, higher-priority versioned descriptor and explicit conversions. Existing canonical and synthetic portable adapters remain supported. The canonical validator, generated schemas, database migrations and export implementation were not changed in this follow-up.

The profile now:

- Maps stem/given prose with delimiter-only conversion and preserves equation bodies exactly.
- Converts ordered equations to existing math blocks and inline hints to distinct, explicitly step-owned hints.
- Preserves quantities, symbols, numeric values, units, result roles and allocations in readable answer blocks, including their exact LaTeX presentations.
- Validates redundant marks/difficulty labels against their source fields and uses canonical display fields without duplicate labels.
- Rejects unsupported presentation flags, incomplete records, allocation disagreements, future versions and unknown academic fields.
- Checks converted blocks and hint ownership against subsequent corrections, preventing academic content from being silently removed or changed.
- Preserves SP015 and supplied provenance/subject/programme/language values as tags. It never equates SP015 with a curriculum version.

No automatic academic estimates, answers, marks, hints or curriculum assignments were added.

## Required website review

The source lacks `estimatedMinutes`, `questionType`, `classification.curriculumVersionCode` and `classification.chapter`. These remain blocking under the unchanged canonical schema. Semester 1 and the source topic are preserved; absent optional subtopic remains null.

The user explicitly elected to map the missing fields later on the website. The browser test verified both canonical corrections and the actual cascading curriculum selectors before signed validation and draft creation. No additional answer from the user is required to finish this local verification.

The user approved excluding reviewed nonacademic metadata while retaining the original JSON/reference PDF. The tested exclusions are `/importer_compatibility` and `/pdf_export_contract`; other supplied metadata values remain represented. The conversion correctly reports `lossless:false` for these exclusions. Academic-content preservation is verified separately; the complete source file is not claimed to be stored losslessly in the database.

The local harness supplied **test parameters only**: 3 minutes, `structured`, local version `LEGACY`, and `TEST ONLY portable verification chapter`, with a local topic retaining the exact source topic name. These values exercise persistence/export mechanics and are not proposed production metadata. They were not inserted into the original JSON. The real selections remain the user's later website task.

## Academic preservation evidence

| Source content               | Verified result                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------ |
| Complete ideal-gas statement | Exact prose retained; only `\\(...\\)` delimiters become `$...$`                                 |
| Heat, volumes and pressure   | 1.5 kJ, 20 L, 35 L and 30 kPa preserved                                                          |
| Given conversion             | `1 L = 0.001 m^3` preserved and rendered                                                         |
| SI quantities                | 1500 J, 30000 Pa, 0.02 m^3 and 0.035 m^3 retained, with symbols and quantity names               |
| Difficulty                   | Source `MEDIUM` retained; persisted difficulty `medium`; rendered label MEDIUM                   |
| Answer mathematics           | All 13 supplied answer equations retained in order, with exact LaTeX bodies                      |
| Results                      | Work 450 J and internal energy change +1050 J preserved; no recalculation replaces the source    |
| Marking scheme               | GJU1, G1 and JU1; one mark each; total three marks; source allocation descriptions retained      |
| Student hints                | All three exact hints retained and linked to their containing marking steps                      |
| Question parts               | Source has no parts; canonical parts remain empty; no artificial parts created                   |
| Classification               | Explicit Semester 1, source topic and SP015 retained; missing fields require review              |
| Original image assets        | None supplied: assets object and diagram pointers are empty, caption null; no diagrams generated |
| Reference PDF                | Verified and retained separately; not misrepresented as an importable question diagram           |

After commit, the retrieved immutable version retained scenario, blocks, solutions, hints, tags, marks and draft status. Negative tests reject removal of equations/quantities, shortened hints, moved hint ownership, altered marks and changed statements. Failure injection during marking-step persistence rolled back content, search, classifications, versions and receipts. Duplicate protections and server source/manifest parity checks also passed.

## Preview and exports

The actual website preview was visually inspected and verified with browser assertions: full statement/conversion, 13 rendered answer equations, all three hints, correct codes and marks, and no KaTeX errors. See `data/real-source-verification/actual-content-preview.png`.

Actual source-based exports:

| Artifact                                             | Verification                                                                                                                           |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `data/real-source-verification/actual-question.pdf`  | One A4 page; statement, conversion, difficulty and marks visibly intact                                                                |
| `data/real-source-verification/actual-answer.pdf`    | Two A4 pages; all answer content, linked hints, superscripts/subscripts, Greek symbols and three boxed equations visibly intact        |
| `data/real-source-verification/actual-question.docx` | Five native OMML math objects; statement/conversion/difficulty/marks retained; no answer hints leaked into question mode               |
| `data/real-source-verification/actual-answer.docx`   | Thirteen native OMML math objects and three border-box structures; complete step titles, hints, codes, quantities and results retained |

Both DOCX files were opened and rendered using the document skill's renderer with the existing workspace-local portable LibreOffice runtime. Their pages were visually inspected; text and equations are readable. LibreOffice renders unit styling differently and does not visibly reproduce the OMML box outlines, although those structures are present in the DOCX. Native Microsoft Word rendering could not be completed: the restricted attempt failed with a logon-session error, and the isolated elevated automation attempt stalled and was cleaned up. **Native Word appearance, especially boxed-equation styling, remains unverified.** No export code was changed to mask this limitation.

The app uses its own question/answer layout. It does not reproduce or concatenate the embedded two-page reference PDF. This is consistent with the user's approved exclusion of the PDF contract; exact reference-template fidelity is not a verified capability. The exports carry clearly labelled local test curriculum scaffolding where curriculum headings are shown.

Inspection of five PDFs (including the original reference and both DOCX renderings) and two DOCX files found zero JavaScript/launch/embedded-active-content, external active-relationship, dangerous Word-field or private-storage-URL findings. Evidence: `data/real-source-verification/artifact-inspection.json`.

## Final regression results

| Gate                                    | Result                                                                                                                             |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                              | **298 passed, 0 failed, 0 skipped**: 291 existing + seven actual-source tests                                                      |
| `npm run test:browser`                  | **108 passed, 0 failed**: 107 existing + actual-source website/draft/export test                                                   |
| Actual-source browser workflow          | PASS: missing fields block before API calls; corrections/selectors/review lead to local draft and exports                          |
| `npm run auth:check`                    | **28 passed**; also included in the final unit suite                                                                               |
| `npm run storage:check`                 | **30 passed**; also included in the final unit suite                                                                               |
| Export and security regressions         | PASS in full unit/browser suites, including public/draft isolation, hostile prose, invalid math/assets, CSP and credential routing |
| Typecheck, lint, build                  | PASS                                                                                                                               |
| Disposable DB integrity/migration check | PASS                                                                                                                               |
| Generated canonical schema parity       | PASS; no canonical schema change                                                                                                   |
| Vercel API and native ESM checks        | PASS                                                                                                                               |
| `git diff --check`                      | PASS                                                                                                                               |

Final logs and verification artifacts are under ignored `data/real-source-verification/`. Browser test-server teardown required cleanup of confirmed task-owned processes on Windows; all cases completed successfully. No user application/server was repurposed. Native Word was only attempted in a new guarded verification instance, which was stopped after it stalled.

## Pending CSP changes: separate release status

The following preexisting uncommitted changes are **not importer changes**:

- `server/security-headers.ts`: permits `data:` in `font-src` for bundled KaTeX fonts.
- `vercel.json`: mirrors the same font policy for hosted responses.
- `tests/browser/security.spec.ts`: verifies bundled KaTeX font loading without policy violations.

All three files' final SHA-256 hashes match their task-start hashes exactly. They were neither edited nor staged. Their separate historical security report also remains untouched. No release commit or package was created, so no CSP changes were mixed into an importer commit.

The successful full browser run used the current working tree, including the pending CSP correction. An independent disposable-server probe against the actual question confirmed zero font-policy violations under the pending policy, and a `data` font-policy violation when the HEAD policy was substituted. Font-load promises still fulfilled through available sources; the result establishes a policy violation, not complete font-load failure. Evidence: `data/real-source-verification/csp-isolation-probe.json`.

Consequently, an importer-only deployment that excludes this pending CSP correction must not inherit the claim that its deployed font policy was verified clean. Decide on the security change separately; do not silently bundle it with the importer release.

## Release readiness and remaining issues

**Importer compatibility: verified for the actual source through reviewed mapping. Unchanged-file automatic import: intentionally blocked on missing required fields. Production deployment: awaiting explicit approval and the separate release decisions below.**

1. The user will supply real time/type/curriculum selections on the website; production taxonomy resolution cannot be certified using local test classifications.
2. Native Word visual fidelity remains unverified, with a portable-renderer box/unit-styling limitation documented above. PDF rendering and DOCX structure/content checks passed.
3. Pending CSP changes need their own release decision; excluding them retains the demonstrated font-policy violation.
4. No hosted release smoke test was performed because deployment is not authorized.

Follow-up implementation files: `shared/import-compatibility.ts`, `docs/flexible-json-importer.md`, the exact original JSON fixture, `tests/real-portable-fixture.ts`, `tests/real-portable-import.test.ts`, `tests/browser/real-portable-import.spec.ts`, and this report. Earlier importer work and historical security/export reports remain pending in the working tree.

All database writes used explicit in-memory SQLite test banks through `createTestBank`, which never reads Turso connection settings. The export flow used a separate local-only approval after verifying draft status. No production Turso data was read, modified, imported, reset or migrated. No production question was created. No commit, push or deployment occurred. Work is stopped pending the user's explicit approval for any release action.
