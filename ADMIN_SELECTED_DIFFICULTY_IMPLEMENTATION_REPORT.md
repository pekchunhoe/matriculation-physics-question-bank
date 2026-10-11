# MATRICULATION PHYSICS QUESTION BANK

# ADMIN-SELECTED QUESTION DIFFICULTY

Verified locally on 11 October 2026. Implementation and testing only; ready for review.

## POLICY

| Check                             | Result             |
| --------------------------------- | ------------------ |
| Difficulty determined by marks    | NO                 |
| Difficulty automatically inferred | NO                 |
| Difficulty determined by AI       | NO                 |
| Final authority                   | ADMINISTRATOR      |
| Allowed values                    | Easy, Medium, Hard |

Searched application, server, shared validation and scripts for difficulty assignments, defaults, marks mappings and inference. No existing marks/content inference rule was found. The portable importer previously resolved the JSON value directly; it now resolves only the administrator's separate selection. Existing manual editing and structured export/revision workflows retain their canonical difficulty behavior.

## IMPORT UI

| Check                | Result               |
| -------------------- | -------------------- |
| Dropdown             | PASS                 |
| Default              | Select difficulty... |
| Required             | YES                  |
| Mobile, 390 × 844    | PASS                 |
| Desktop, 1280 × 1000 | PASS                 |
| Accessibility        | PASS                 |

[QuestionJsonImporter.tsx](src/QuestionJsonImporter.tsx) places a labelled native required select immediately after the package input and before Validate & Preview. Upload, paste/edit and successful import reset it to the placeholder. JSON never supplies a selection. Missing selection shows the requested actionable error without making a validation request; server difficulty errors are also associated with the select using `aria-invalid` and `aria-describedby`.

Browser tests exercise ArrowDown selection, Tab navigation and Enter validation, visible unclipped bounds, touch size and zero axe violations. Both screenshots were inspected visually: [mobile](data/admin-difficulty/selector-390.png), [desktop](data/admin-difficulty/selector-1280.png). A mobile accessibility failure exposed existing horizontally scrollable display equations without keyboard access; [MathText.tsx](src/MathText.tsx) now makes those display regions focusable, preserving math content and rendering.

## JSON

| Check                            | Result |
| -------------------------------- | ------ |
| Difficulty required in new JSON  | NO     |
| Legacy difficulty accepted       | YES    |
| Legacy value authoritative       | NO     |
| Legacy value preselects dropdown | NO     |
| Admin overrides legacy JSON      | PASS   |

`schemaVersion: 1` is preserved. The optional legacy string retains its existing 1–100 character bounds; invalid types remain invalid. Arbitrary valid legacy strings, including uppercase labels, are accepted and ignored. The input panel displays: “Difficulty contained in the JSON is not used. Select difficulty manually.”

[shared/question-import.ts](shared/question-import.ts) remains the canonical portable validator. [The generated schema](docs/question-json-import.schema.json) was regenerated through `npm run schema:generate`; its only change removes difficulty from required properties. [The golden package](examples/question-import/GOLDEN_QUESTION_IMPORT_REFERENCE.json) omits difficulty and its browser demonstration explicitly selects Medium. Two older synthetic examples retain their field for documented compatibility coverage.

## VALIDATION

| Check                                               | Result          |
| --------------------------------------------------- | --------------- |
| No selection blocked                                | PASS            |
| Easy                                                | PASS            |
| Medium                                              | PASS            |
| Hard                                                | PASS            |
| Changed-after-preview invalidates plan              | PASS            |
| Tampered commit                                     | REJECTED / PASS |
| Missing or ambiguous canonical reference            | REJECTED / PASS |
| Arbitrary strings, database IDs, objects and arrays | REJECTED / PASS |
| Administrator authorization and CSRF                | PASS            |
| Idempotency and draft privacy                       | PASS            |

Validation JSON and commit multipart carry a separate `selectedDifficulty`. [The import service](server/question-json-import.ts) requires an exact enum choice and resolves exactly one existing canonical record. Selection validation precedes plan creation. The signed plan contains the selected name; its digest binds both manifest and selection, while the taxonomy digest binds the resolved difficulty record and classification.

Changing selection clears preview, prepared assets and review acknowledgement. Revalidation is required before the draft action returns. Commit checks the submitted selection against the signature and digest before looking up an idempotency receipt or uploading assets. It then resolves only the signed selection, rechecking taxonomy inside the transaction. A mismatched retry is rejected; an unchanged successful retry returns the original draft. There is no JSON, marks, AI or default fallback. Multipart bounds add one metadata field; binary limits remain unchanged.

Read-only preview, private asset handling, integrity checks, compensating cleanup, signed admin binding, expiration and immutable initial history remain covered by the complete regression suite.

## MARKS INDEPENDENCE

| Check                   | Result |
| ----------------------- | ------ |
| 1 mark + HARD           | PASS   |
| 2 marks + HARD          | PASS   |
| 10 marks + EASY         | PASS   |
| 20 marks + MEDIUM       | PASS   |
| No mark-range heuristic | PASS   |

Each case validates, commits and reads back the canonical difficulty. Marks retain their existing structural/allocation validation and have no role in selecting difficulty.

## DATABASE

| Check                            | Result |
| -------------------------------- | ------ |
| Existing difficulty model reused | PASS   |
| New DB column                    | NO     |
| Migration required               | NO     |
| Existing questions changed       | 0      |

The import stores the existing canonical `question.difficultyId`, not a parallel import field. No migration 006 or database schema change was created. All three choices are verified on disposable SQLite and local libSQL databases, including filtered results, immutable version 1, idempotent receipts and foreign-key integrity. A later normal administrator revision changes the imported draft's difficulty through versioned saving while preserving its earlier version. A separate preexisting disposable question and its history remain identical. Production was not accessed during this task.

## MASTER FORMAT

| Check                               | Result |
| ----------------------------------- | ------ |
| Preview difficulty                  | PASS   |
| Export difficulty                   | PASS   |
| Uses canonical admin-selected value | PASS   |

Preview displays the resolved canonical difficulty in uppercase. Tests render both Master question and answer print templates from persisted canonical documents for Easy, Medium and Hard on both adapters. The full browser suite also verifies A4/PDF output, diagrams/FBDs, marking codes, linked hints, question-only exclusion and the golden importer preview with manually selected Medium. The print renderer reads canonical difficulty IDs; portable legacy difficulty does not enter its document.

## CHATGPT WORKFLOW

| Check                                    | Result |
| ---------------------------------------- | ------ |
| ChatGPT assigns difficulty               | NO     |
| Admin assigns difficulty                 | YES    |
| Direct JSON authoring without difficulty | PASS   |

Updated [conversion checklist](docs/CHATGPT_QUESTION_JSON_CONVERSION_CHECKLIST.md), [authoring standard](docs/QUESTION_JSON_AUTHORING_STANDARD.md), and [import format](docs/question-json-import-format.md). All state:

“Question difficulty is not inferred from marks or question content. The final Easy/Medium/Hard classification is selected manually by the administrator during JSON import.”

“New Question JSON files do not need to provide difficulty.”

The permanent workflow is Physics PDF → ChatGPT extracts educational content → ONE Question JSON → Admin website → Upload JSON → ADMIN SELECTS Easy / Medium / Hard → Validate & Preview → review → Import as Draft.

## QUALITY

| Gate                                 | Final result                            |
| ------------------------------------ | --------------------------------------- |
| Unit/integration: `npm test`         | PASS — 232 tests, 0 failures, 0 skipped |
| Browser: `npm run test:browser`      | PASS — 77 tests, 0 failures             |
| Typecheck: `npm run typecheck`       | PASS                                    |
| Lint: `npm run lint`                 | PASS                                    |
| Database: `npm run db:check`         | PASS                                    |
| Schema: `npm run schema:check`       | PASS                                    |
| API: `npm run api:check`             | PASS                                    |
| Native ESM: `npm run api:esm:check`  | PASS                                    |
| Storage: `npm run storage:check`     | PASS — 30 tests                         |
| Authentication: `npm run auth:check` | PASS — 28 tests                         |
| Build: `npm run build`               | PASS                                    |
| `git diff --check`                   | PASS                                    |

Counts increased from 205 to 232 unit/integration tests (+27) and from 65 to 77 browser tests (+12). Storage and auth counts are subsets of the full unit/integration total. Focused coverage is in [unit/integration tests](tests/admin-difficulty.test.ts) and [browser tests](tests/browser/admin-difficulty.spec.ts).

Final logs and screenshots are under ignored `data/admin-difficulty/`, including [unit log](data/admin-difficulty/unit.log), [browser log](data/admin-difficulty/browser.log) and individual gate logs. An initial browser run found the mobile equation keyboard issue and encountered a static-build reload timeout when the build was refreshed during that run. The equation issue was fixed; the final complete browser run began after a completed rebuild and passed all 77 tests. No unresolved failures remain.

Existing preview tokens from the prior implementation require revalidation after any future separately authorized rollout; no live tokens or receipts were changed here.

## PRODUCTION

| Action                             | Result for this task |
| ---------------------------------- | -------------------- |
| Production writes                  | 0                    |
| Existing production draft changed  | NO                   |
| Production question import         | NO                   |
| Production asset upload            | NO                   |
| Production curriculum modification | NO                   |
| Migration                          | NO                   |
| Deployment                         | NO                   |
| Commit                             | NO                   |
| Push                               | NO                   |

Only disposable local test databases, synthetic assets and local build artifacts were used. Git HEAD remains `cab26a23677bf8fb6b8f2c6e042a668b8e761db0`; no files were staged. The preexisting rollout-report edits, compatibility audit and reference files were preserved. This report does not authorize production rollout or real question imports.

## FINAL STATUS

ADMIN-SELECTED DIFFICULTY READY FOR REVIEW

Implementation, local verification and report are complete. Stopped without commit, push or deployment.
