# Self-contained Question JSON import format (v1)

Question difficulty is not inferred from marks or question content. The final Easy/Medium/Hard classification is selected manually by the administrator during JSON import.

New Question JSON files do not need to provide difficulty. ChatGPT authors educational content and omits difficulty; the administrator chooses it using their own judgement. An optional legacy `difficulty` string (1–100 characters) remains accepted in schemaVersion 1 but is ignored, never preselects the dropdown and never overrides the administrator. No AI or heuristic assigns it.

Physics PDF → ChatGPT extracts question → ONE Question JSON → Admin website → Upload JSON → ADMIN SELECTS Easy / Medium / Hard → Validate & Preview → review → Import as Draft.

The admin workflow at `/import/question-json` accepts **one question in one JSON file**, including its prepared image bytes. Paste JSON and Upload one `.json` file use the same pipeline. Select **Difficulty** manually (the initial value is **Select difficulty...**), then click **Validate & Preview**, inspect the rendered question, marking scheme, hints and visuals, acknowledge the review, then click **Import as Draft**. Publication remains a separate existing admin action. Neither preparation nor importing is performed by an AI service on this website. Normal importing uses zero AI calls or tokens.

The canonical validator is `shared/question-import.ts`. The generated machine-readable schema is [question-json-import.schema.json](question-json-import.schema.json). Regenerate it with `npm run schema:generate`; `npm run schema:check` detects drift. JSON Schema describes field types and bounds; the runtime additionally checks LaTeX, references, hierarchy, marks, placements, exact taxonomy, signatures and hashes.

Complete ready-to-adapt examples:

- [Golden Master reference](../examples/question-import/GOLDEN_QUESTION_IMPORT_REFERENCE.json): multipart question, LaTeX, a question diagram, two answer FBDs, five marking codes and six explicitly step-linked hints. Difficulty is omitted; the administrator selects Medium for its demonstration. Synthetic assets only.

- [Dimensional analysis](../examples/question-import/dimensional-analysis.json): legacy compatibility fixture with ignored difficulty, authentic no-part shape, 2 marks, four hints, no images.
- [Synthetic supported block](../examples/question-import/synthetic-visual.json): legacy compatibility fixture with ignored difficulty, two embedded PNGs, one question visual and one answer FBD. Images were drawn locally for testing and contain no extracted curriculum material.

These examples target the current curriculum by name. They are files/fixtures only; none has been imported into production. Isolated tests substitute their own existing test taxonomy.

## Envelope

All objects are strict. Unknown properties are errors, including `status`, arrays of independent questions, production IDs and external asset URLs. No educational content is silently discarded. Required arrays may be empty except `solutions`.

```json
{
  "schemaVersion": 1,
  "kind": "matriculation-physics-question",
  "classification": {
    "curriculumVersionCode": "PHYSICS-2022-2023",
    "semester": "Semester 1",
    "chapter": "1.0 Physical Quantities and Measurements",
    "topic": "1.1 Dimensions of physical quantities",
    "subtopic": null
  },
  "question": {
    "title": "Dimensional analysis",
    "scenario": "Show that the following equation is homogeneous.",
    "blocks": [{ "type": "math", "latex": "KE = \\frac{1}{2}k\\left(A^2-y^2\\right)" }],
    "totalMarks": 2,
    "estimatedMinutes": 4,
    "questionType": "short_answer"
  },
  "parts": [],
  "solutions": [
    {
      "partId": null,
      "solution": "",
      "equationLatex": "",
      "teacherNotes": "",
      "steps": [
        {
          "number": 1,
          "explanation": "Both sides have dimensions of energy.",
          "equationLatex": "[KE]=ML^2T^{-2}",
          "working": "",
          "markingPoint": "Identify and compare the dimensions of both sides.",
          "marks": 2,
          "order": 0
        }
      ]
    }
  ],
  "hints": [],
  "assets": [],
  "tags": []
}
```

The abbreviated solution above demonstrates field syntax. Use the full example for the complete worked solution and progressive hints.

## Classification and question

| Field                                  | Rule                                                                                                                                                                                                            |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`                        | Integer `1`; unsupported versions rejected. This is a portable-package version, separate from older structured export envelopes.                                                                                |
| `kind`                                 | Exactly `matriculation-physics-question`.                                                                                                                                                                       |
| `classification.curriculumVersionCode` | Exact existing non-retired version code, max 100 characters. Exactly one matching version must exist.                                                                                                           |
| `classification.semester`              | Exactly `Semester 1` or `Semester 2`, within that version and its course.                                                                                                                                       |
| `classification.chapter`, `topic`      | Exact existing names under their specified parents, max 200 characters each.                                                                                                                                    |
| `classification.subtopic`              | Exact existing name under the topic, or required `null` for no subtopic.                                                                                                                                        |
| `difficulty`                           | Optional legacy string, 1–100 characters. Ignored; omit in new packages. Admin selection is separate.                                                                                                           |
| `question.questionCode`                | Optional stable unique code, 3–80 uppercase letters/digits/hyphens, starting with a letter/digit. Omit to generate a plan-specific stable code. An existing code is an error; this workflow creates new drafts. |
| `question.title`                       | Required nonempty string, max 300 characters.                                                                                                                                                                   |
| `question.scenario`                    | Required prose string, may be empty when blocks/parts carry content.                                                                                                                                            |
| `question.blocks`                      | Optional ordered content blocks following scenario text.                                                                                                                                                        |
| `question.totalMarks`                  | Integer 1–10000.                                                                                                                                                                                                |
| `question.estimatedMinutes`            | Integer 1–10000.                                                                                                                                                                                                |
| `question.questionType`                | `structured`, `multiple_choice`, `short_answer` or `essay`; existing model, no new choice-answer engine.                                                                                                        |
| `tags`                                 | Required array, ≤50 nonempty trimmed strings, each ≤100 characters; never use tags for provenance.                                                                                                              |

Matching is case- and whitespace-sensitive. No normalization, slug matching, fuzzy matching or taxonomy creation occurs. Renamed, retired, missing, ambiguous or inconsistent hierarchies fail. Curriculum revisions and difficulty state are signed into the plan and checked again inside the commit transaction. A future `PHYSICS-2028-2029` can use the same semester names with entirely different chapters/course codes. `SP015`/`SP025` are version-specific course codes and are never permanent semester keys. Source-paper metadata is excluded from this format.

## Text, LaTeX and ordered content blocks

Prose fields allow plain text with `$...$` inline math and `$$...$$` display math. JSON requires each LaTeX backslash to be escaped: `"$\\vec{F}$"` represents `$\vec{F}$`. Equations remain LaTeX, not images or Unicode approximations. The importer does not repair equations. KaTeX validates with `throwOnError`, `trust:false` and bounded macro expansion; unmatched delimiters/braces and rendering failures block import. Strings are preserved; tags alone are trimmed by the existing model.

Prose/equation strings are ≤30000 characters. Each optional `blocks` array has ≤100 items and preserves its exact array order. Blocks are supported on `question`, each part, each solution and each solution step:

| Block            | Exact properties                                                     |
| ---------------- | -------------------------------------------------------------------- |
| Paragraph        | `{"type":"paragraph","text":"Plain wording with $m$ inline math."}`  |
| Display equation | `{"type":"math","latex":"F=ma"}` (nonempty valid LaTeX)              |
| Image            | `{"type":"image","assetId":"answer-fbd"}` (local embedded asset key) |

Legacy fields render first: scenario then question blocks; prompt then part blocks; solution/equation then solution blocks; step explanation/equation/working then step blocks, followed by marking point. For precise interleaving, leave the corresponding legacy text/equation fields empty and place all content in its `blocks` array. Images appear at their image block position; they are not automatically appended. Each embedded asset must be placed exactly once. To reuse identical bytes intentionally, supply a second asset record with a distinct local key.

## Parts and subparts

`parts` is an array of ≤100 records. Each record requires:

```json
{
  "id": "ai",
  "label": "(i)",
  "prompt": "Find the acceleration.",
  "marks": 2,
  "order": 0,
  "parentId": "a"
}
```

Optional `blocks` follows the prompt. `id` and `label` are 1–120 characters; IDs are package-local keys. `parentId` is a matching local part ID, or `null` for a root. The internal model natively uses flat parent references and recursive rendering. Use `(a)` as a root and `(i)`, `(ii)` as children to reproduce `(a)(i)` and `(a)(ii)`; do not invent a labelled part for a source question that has none. For a no-part question use `parts:[]` and a solution with `partId:null`.

Marks are nonnegative integers ≤10000. Every parent with children must have marks equal to its direct children's marks. Root marks must sum to question total; parent marks are aggregate totals and are never counted twice. Cycles, missing parents, duplicate keys and duplicate sibling order values are errors. `order` is a nonnegative integer, determines sibling display order and need not be consecutive.

## Worked solutions / marking scheme

`solutions` requires exactly one scheme per leaf part, or exactly one `partId:null` scheme for a no-part question. Parent parts do not receive additional allocated schemes. Required solution fields:

| Field           | Meaning                                                                  |
| --------------- | ------------------------------------------------------------------------ |
| `partId`        | Local leaf part key, or `null` for a no-part question.                   |
| `solution`      | Prose worked answer, possibly empty if using blocks/steps.               |
| `equationLatex` | Display equation, possibly empty.                                        |
| `teacherNotes`  | Prose notes, possibly empty; existing public policy keeps these private. |
| `steps`         | Ordered structured marking steps, ≤100.                                  |
| `blocks`        | Optional ordered answer content, including answer images.                |

Each step requires `number` (positive integer, unique per solution), `explanation` (prose), `equationLatex` (LaTeX or empty), `working` (prose), `markingPoint` (plain text), `marks` (nonnegative integer ≤10000), `order` (nonnegative integer, unique per solution). Optional `blocks` provides exact visual/text placement. Steps are rendered by `order` and retain their authored numbers. Step marks must equal the associated leaf marks; total step marks across schemes must equal question total. Zero-mark explanatory steps are permitted. Hidden additional, negative or fractional marks are errors.

Optional step `markingCode` is a separate authored assessment code, such as `G1`, `JU1`, `GJU1`. It is 1–24 characters, starts with an ASCII letter/digit and otherwise permits ASCII letters/digits or `+ . _ / -`. It is preserved exactly, displayed separately near the step marks in admin preview, answers and PDF, omitted when absent, and never changes mark summation. There is no fixed enum. Optional step `id` is a 1–120 character package-local key, unique across ALL solutions in this question. Supply it when a hint targets that step; it is not a database primary key.

## Progressive hints

`hints` is a required array of ≤100 objects:

```json
{ "id": "hint-1", "partId": null, "text": "Start with the base dimensions of energy.", "order": 0 }
```

`id` is a unique local key (1–120 characters). `partId` is `null` for the whole question or an existing local part/subpart key. `text` is nonblank prose with optional inline math, ≤30000 characters. `order` is nonnegative and unique within the hint target. Order is preserved. The preparation process authors progressively revealing hints; the server cannot judge pedagogy or rewrite an overly revealing first hint.

Optional hint `solutionStepId` references a step `id` in this same package. `partId` must match that solution's `partId`, including `null` for no-part solutions. The existing relationship fields express three valid scopes:

| Target scope   | Relationship                                                    |
| -------------- | --------------------------------------------------------------- |
| QUESTION       | `partId:null`, `solutionStepId` absent/null                     |
| PART / subpart | existing `partId`, `solutionStepId` absent/null                 |
| SOLUTION STEP  | `solutionStepId` equal to step `id`, matching solution `partId` |

```json
{
  "id": "hint-forces",
  "partId": "b",
  "solutionStepId": "step-forces",
  "text": "Resolve toward the centre.",
  "order": 0
}
```

Use a corresponding step `{"id":"step-forces","markingCode":"G1", ...}` (ellipsis is explanatory, not upload syntax). Existing `partId` naming is retained; no parallel `target.type` syntax exists. Unknown target fields/types are rejected by the strict schema. Missing step keys, duplicate keys, conflicting solution owners and duplicate hint order within a target fail with exact paths, such as `hints[0].solutionStepId`. Multiple hints per step sort by `order`; distinct steps may reuse order values. Step linkage is never inferred from positions or free text. General/part hints remain valid; migration never fabricates links, rewrites text or reorders them. Step hints appear immediately inside their matching answer step when hints are included.

## Embedded visual assets

`assets` is a required array, possibly empty. Supported raster formats are PNG, JPEG and WebP; safe SVG is accepted through the unchanged existing SVG validator. PDFs are not embedded/imported by this feature. A record uses:

```json
{
  "key": "answer-fbd",
  "role": "free_body_diagram",
  "mimeType": "image/png",
  "byteLength": 12345,
  "sha256": "64 lowercase hex characters calculated from the exact image bytes",
  "dataBase64": "canonical Base64 of those same bytes",
  "alt": "Source-grounded accessibility description",
  "caption": "Optional educational caption"
}
```

The illustrative byteLength/hash/data above are placeholders; use the complete synthetic example for real valid values.

| Property     | Rule                                                                                                                                                                                                |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `key`        | Unique 1–80 letters/digits/underscore/hyphen; no paths, URLs or production IDs.                                                                                                                     |
| `role`       | `question_diagram`, `answer_diagram`, `free_body_diagram`, `graph`, `circuit_diagram`, `table_image`, `other_visual`. Maps to existing application asset kinds, never storage-specific assumptions. |
| `mimeType`   | `image/png`, `image/jpeg`, `image/webp`, `image/svg+xml`; actual signature and multipart MIME must agree.                                                                                           |
| `byteLength` | Positive exact decoded byte count, ≤3 MiB.                                                                                                                                                          |
| `sha256`     | SHA-256 of exact decoded bytes, 64 lowercase hex digits.                                                                                                                                            |
| `dataBase64` | Standard canonical Base64, correct padding, no whitespace or `data:` prefix.                                                                                                                        |
| `alt`        | Optional accessibility description, ≤1000 characters; omitted/empty generates a review warning.                                                                                                     |
| `caption`    | Optional caption, ≤1000 characters.                                                                                                                                                                 |

`answer_diagram` and `free_body_diagram` must appear in a solution or solution-step block, never question/part blocks. Graphs/circuits/tables/other visuals may appear in either question or answer content according to block placement. The application distinguishes answer scope by its actual content-block owner, including FBDs, rather than relying on the generic storage layer. Alt/caption/hash/byte count and role persist with asset metadata; image bytes live in private external storage.

### Preparing bytes and hashes

Example offline Python (no website API token):

```python
import base64, hashlib
image_bytes = open("exact-crop.png", "rb").read()
asset["byteLength"] = len(image_bytes)
asset["sha256"] = hashlib.sha256(image_bytes).hexdigest()
asset["dataBase64"] = base64.b64encode(image_bytes).decode("ascii")
```

The local preparation filename is not part of the portable package. One uploaded JSON is sufficient; no second user image upload is required. The browser separates Base64 into binary memory blobs for preview and commit. The server independently validates received bytes, hash, length, signature, allowed role and plan. Client preparation is never the security authority.

### PDF visual fidelity

Prepare PDF crops outside the website. Preserve source diagrams/FBDs as extracted: geometry, arrow origins, directions, arrowheads, force labels, angles, scales, axes, curves, circuit symbols and object positions. Do not regenerate, redraw, beautify, OCR/reconstruct, relabel or reinterpret them without an explicit user request. Prefer lossless PNG at sufficient resolution for legible labels and thin arrows in browser print. Retain a clean isolated original raster when supported. Do not convert line art to lossy JPEG for size alone. SVG security validation may reject an unsafe SVG; choose PNG when exact preservation cannot be guaranteed. Accepted raster bytes are neither resized nor recompressed. The isolated authenticated FBD retrieval test verifies byte identity and SHA-256.

## Canonical content and original visuals

Question-level and per-asset source provenance are excluded from this unreleased strict format. Do not supply `source`, PDF filenames/hashes, source question numbers/pages/regions, source sets or source course codes. Original numbering and provenance are not retained. After successful import, the original PDF and prepared JSON may be discarded: canonical educational content lives in structured database records and private visual assets. Role, placement, MIME type, digest, byte length, alt text, caption and opaque asset references remain available. Do not hide provenance in captions, tags, notes or question text.

Real PDF visuals must be extracted unmodified from the original PDF. Prefer direct original raster/vector extraction where safely possible; otherwise use lossless high-resolution rasterization and an exact crop of the source region. Cropping may remove only unrelated blank space, headers, footers, page numbers or adjacent questions. Preserve every meaningful pixel, label, arrow, angle, axis, curve, symbol, colour and object position. Use PNG for line art; do not reduce it using lossy JPEG. Redrawing, regeneration, beautification, OCR reconstruction, relabelling or educational alterations require an explicit user request. Synthetic example images are test fixtures only.

The importer verifies supplied byte identity, signatures, sizes and hashes and performs no visual transformation. It cannot independently prove that supplied bytes originated from the original PDF; preparation and human fidelity review establish that origin.

## Limits, errors, warnings and safety

| Limit                          | Bound                                                                                     |
| ------------------------------ | ----------------------------------------------------------------------------------------- |
| Uploaded/pasted JSON           | 5 MiB UTF-8, including Base64.                                                            |
| Manifest after removing Base64 | 384 KiB UTF-8.                                                                            |
| Asset count                    | 8.                                                                                        |
| One image                      | 3 MiB decoded bytes.                                                                      |
| Combined decoded images        | 3 MiB.                                                                                    |
| Commit request                 | Combined images + manifest + 64 KiB multipart overhead; <4 MiB for normal valid requests. |
| Preview plan                   | 15 minutes; bound to admin, exact manifest and resolved taxonomy/difficulty state.        |

Global upload/security limits remain unchanged: normal hosted file uploads are still 3 MiB, hosted JSON parser still 3 MiB (local 5 MiB), and the generic adapter limit remains 20 MiB. This importer uses tighter own bounds. It sends a manifest without Base64 to validation and all images as binary multipart at confirmed commit. The aggregate 3 MiB cap intentionally permits one bounded commit request; version 1 does not introduce staged-upload state, asynchronous jobs or abandoned-preview objects. Multer also bounds file count, each file, text fields and part count; normal accepted commit data is at most 3 MiB. Invalid multipart requests with no declared Content-Length remain bounded by per-file/count limits before aggregate rejection.

Errors block preview/import and identify paths such as `question.totalMarks`, `parts[0].marks`, `solutions[0].steps[1].equationLatex`, `classification.topic`, `assets[0].sha256`, or `token`. Unknown fields, invalid LaTeX, mark mismatch, missing assets, MIME/signature/hash/length mismatch, unsupported version, stale/tampered/expired plans and publication properties are errors. Warnings allow explicit review: identical content fingerprint, asset >2 MiB, missing alt text. Hash matches are shown locally during preview; binary security checks occur authoritatively on commit. The preview cannot certify physical correctness; inspect every source crop and FBD.

No validation writes occur. Commit prevalidates every received image before any upload, uploads through the existing private storage abstraction, and uses one database transaction for question, parts, schemes, steps, hints, asset metadata, ordered blocks, search, immutable version, classification snapshot and idempotency receipt. A repeated valid successful plan returns its existing question; concurrent duplicate uploads are cleaned. No-asset imports make zero Blob calls. Failure compensates only owned new unreferenced objects; cleanup/uncertain upload errors are contained and log opaque `/uploads/...` references for admin repair, never raw private URLs or secrets. Uploaded/decoded Base64 is not persisted or used as live content; the prepared manifest itself is not retained.

All imports are `draft`. Anonymous/public lists, counts, taxonomy, search, detail, print/question-set/PDF resources and asset delivery keep drafts hidden. Existing separate approval and browser Print / Save as PDF remain in place.

## Database review requirement

Migration 004 is already applied to production and is unchanged. `server/migrations/005-master-format-fidelity.sql` adds nullable `step_id` and `marking_code` to solution steps and a nullable `solution_step_id` relationship on hints. A composite foreign key scopes the hint to the same question; NULL-safe ownership triggers require the same solution part, including whole-question answers. Old rows/snapshots remain unchanged with new nullable fields NULL. Disposable populated SQLite/libSQL tests verify preservation and new imports. Migration 005 passed separately authorized production backup and preservation checks; see the [rollout report](../MASTER_FORMAT_FIDELITY_PRODUCTION_ROLLOUT_REPORT.md) for application release status. Runtime initialization never applies DDL; the runtime expects schema 005. The auth migration CLI remains limited to 003. This rollout does not authorize any real question import.

## Customized sets and client-side A4 PDF

Canonical syllabus sorting creates one authoritative ephemeral numbering plan for question and answer headings. Removing selections renumbers both sections consecutively; no display number is stored. Individual importer preview uses an unnumbered question title. Source question numbers/codes are not used as export headings.

Print / Save as PDF renders canonical structured content and canonical private assets in the browser, using A4 portrait (210 × 297 mm), 16 mm top / 19 mm side / 18 mm bottom margins, a `Matriculation Physics | Semester 1/2` header, topic/difficulty/marks, centered aspect-preserving diagrams, ordered parts, matching answer sections, restrained marking codes, adjacent step hints and `Total: N marks`. Running footers provide browser page counters; dynamic question numbers appear in content headings. Chromium page margin boxes provide page counters over long answers; other browsers may vary. Image/step break rules and widow/orphan rules preserve readability; oversized steps may flow. Equations stay KaTeX browser text and scale to available width without rasterization. Use aligned LaTeX for unusually long derivations.

Question-only mode excludes solutions, marking codes, ALL hints and answer-only diagrams/FBDs, even when a stale hints option is true. Answer mode retains the existing optional hints checkbox; general and part hints appear before their relevant answer scope. No source number, student working space/ruled lines, SP015/SP025, source set/year or provenance is generated. Stored asset bytes are displayed unchanged using CSS scaling. Export calls browser `window.print()` and needs zero OpenAI/LLM/image-generation calls or server AI tokens. It does not replay or require the original PDF. Public approved-only visibility, draft/asset privacy, authorization, CSRF and immutable history remain in force.

## Administrator difficulty request contract

The authenticated validation request is `{ "manifest": { ... }, "selectedDifficulty": "Medium" }`. `selectedDifficulty` is a separate required choice, not a portable-package property or database ID. Commit multipart contains `manifest`, `token`, `selectedDifficulty`, and each binary asset. Only Easy, Medium or Hard is accepted; missing/unknown values and missing/ambiguous canonical references fail before storage writes. The signed plan binds manifest, administrator selection and resolved taxonomy/difficulty state. Changing selection requires a new preview; mismatched commits and retries are rejected. Successful unchanged retries remain idempotent.

The preview displays the resolved canonical value as `DIFFICULTY: MEDIUM`. Canonical difficulty drives browsing, filters, normal admin versioned editing and Master PDF presentation. No extra database field or migration is required. Existing question data is unaffected. Validation is read-only and all imports remain private drafts under the existing admin/CSRF controls.

Public export now offers PDF/Word and Question/Answer Scheme with Student's Hints dropdowns. All formats/modes share syllabus sorting and consecutive numbering, use compact natural page flow, and generate on the device. Word uses native editable OMML for supported mathematics and explicitly rejects unsupported constructs. See [public PDF/Word export](USER_PDF_WORD_EXPORT.md) for ordering, mode isolation, assets and math limits.
