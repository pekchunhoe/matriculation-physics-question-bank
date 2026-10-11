# Question JSON authoring standard

Permanent design reference: `reference/Master JSON Format.json` and `reference/Master PDF Format.pdf`. They define desired educational features and presentation, subject to the exclusions below. They are **not uploadable schema examples**. Generate the accepted machine syntax from `docs/question-json-import.schema.json`; the shared/server runtime validators remain authoritative for import validity. JSON Schema cannot express all LaTeX, marks, hierarchy, classification, byte-integrity and lifecycle checks.

Use this document with `docs/CHATGPT_QUESTION_JSON_CONVERSION_CHECKLIST.md`, the machine schema and `examples/question-import/GOLDEN_QUESTION_IMPORT_REFERENCE.json`. The compatibility assessment is `QUESTION_JSON_MASTER_FORMAT_COMPATIBILITY_AUDIT.md`. Version 1 currently reproduces only part of the master presentation; do not claim full compatibility.

## Permanent content policy

Keep the stem, part hierarchy, exact marks, difficulty, canonical classification, physics instructions, given quantities, worked equations, reasoning, final results, progressive hints and meaningful original visuals. For every real PDF question, the PDF's question/answer content is authoritative. Verify the physics and the rendered mathematics against the source; never repair malformed LaTeX using AI inside the importer.

Discard original source question number, source-derived question ID, source set/name/order, paper series, source year/session, source course codes such as SP015/SP025, PDF filename/hash/pages/xrefs and source-paper identity. Do not move discarded data into tags, captions, title, prose, notes or IDs. Do not embed the full PDF, its export contract, working-space rules or blank-space reservation. Retain legitimate curriculum-version classification independently of source year/session. Do not alter historical curriculum metadata to enforce this authoring policy.

Source **question numbering** is discarded. Educational figure labels needed to interpret the original visual remain intact; do not relabel original diagrams to remove them. Use neutral asset keys. An educational figure identifier is not a permanent question ID.

Omit optional `question.questionCode` for normal new imports. The application generates an opaque stable UUID and a `JSON-...` code. Use an unnumbered descriptive title. Set preview and export generate Question 1, 2, 3 from the current selected order using one shared question/answer numbering plan, including their per-page footers. Moving or removing a selected question renumbers the set immediately. Numbers are ephemeral presentation data and never enter the database.

## One-file package

Top-level required properties are `schemaVersion: 1`, `kind: "matriculation-physics-question"`, `classification`, `difficulty`, `question`, `parts`, `solutions`, `hints`, `assets`, `tags`. Use arrays even when empty. Unknown properties are rejected. This package is different from database export JSON; do not paste the legacy master structure or a saved internal document.

Classification requires:

```json
{
  "curriculumVersionCode": "PHYSICS-2022-2023",
  "semester": "Semester 1",
  "chapter": "3.0 Dynamics of Linear Motion",
  "topic": "3.4 Newton’s Laws of Motion",
  "subtopic": null
}
```

Use the exact available, non-retired version code and exact chapter/topic/subtopic names under their parents. The semester must be exactly `Semester 1` or `Semester 2`; no source-code dependency exists. `subtopic` is required but nullable. Never invent a taxonomy entry. Current public taxonomy has no subtopics; use `null` until a legitimate one exists. Authoring requires an up-to-date taxonomy supplied by the user or obtained from the website; a static schema alone cannot determine classifications. Do not guess a newer curriculum from the source-paper year. If unresolved, ask for the actual taxonomy before finalizing the file.

Difficulty is an exact database name, currently `Easy`, `Medium`, or `Hard`. The master label `MEDIUM` maps to `Medium`; uppercase `MEDIUM` fails current server resolution. The golden file demonstrates medium difficulty. Check the live options if they change.

`question` requires `title` (1–300 characters), `scenario` (prose, possibly empty if blocks/parts provide content), `totalMarks` (positive integer ≤10000), `estimatedMinutes` (positive integer ≤10000) and `questionType` (`structured`, `multiple_choice`, `short_answer`, `essay`). Estimated time is author judgement, not a source provenance field. Optional `blocks` holds ordered content. Avoid repeating the same prose in both `scenario` and blocks: both render.

`tags` is an array of at most 50 nonblank trimmed strings, each ≤100 characters; use pedagogical tags only. `parts` and `hints` may be empty. `solutions` needs at least one marking scheme. Maximum 100 parts, solutions, hints, steps per scheme and blocks per owner; this is a bounded format, not unlimited hierarchy.

## Ordered content and mathematics

Supported ordered blocks, each strict:

```json
[
  { "type": "paragraph", "text": "Given: use $g=9.81\\,\\mathrm{m\\,s^{-2}}$." },
  { "type": "math", "latex": "F_c=\\frac{mv^2}{r}" },
  { "type": "image", "assetId": "question-diagram" }
]
```

Owners are `question.blocks`, `parts[].blocks`, `solutions[].blocks`, `solutions[].steps[].blocks`. Array order is display order. Owner scalar prose/math renders before its blocks, so put the FBD and subsequent force equations together in step blocks for exact ordered association. The Master answer template pairs an image followed by one or more math blocks beside their equations without changing the authored sequence or stored bytes; other blocks retain their order.

Prose fields support `$...$` inline and `$$...$$` display math. Pure math fields (`equationLatex`, block `latex`) contain LaTeX without delimiters. Escape every backslash as `\\` in JSON. Prose is plain text with mathematics; Markdown emphasis and legacy `\(...\)` are not rendered as intended. Convert those into supported fields/delimiters. Do not turn equations into bitmap images.

Fractions, superscripts, subscripts, Greek letters, vectors, units, degrees, bracket sizing, negative signs, scientific notation and boxed final answers are supported by strict KaTeX validation. Examples include `N_{\\mathrm{top}}`, `N_{\\mathrm{bottom}}`, `\\vec{F}`, `30^{\\circ}`, `-1.2\\times10^{-3}`, and `m=250\\,\\mathrm{g}=0.250\\,\\mathrm{kg}`. Unknown commands, missing braces and unmatched dollar delimiters fail. KaTeX syntax validity does not prove physical correctness. All prose/math strings are ≤30000 characters. `markingPoint` is plain text, not a math field.

## Parts and deterministic marks

Each flat part record requires `id`, `parentId` (`null` for roots), `label`, `prompt`, `marks`, `order`; optional `blocks` is allowed. Local IDs/labels are nonempty strings ≤120 characters. Marks are nonnegative integers ≤10000; order is a nonnegative integer. Prompt or blocks must provide content. IDs are unique. Parent IDs must exist; cycles are invalid. Sibling orders must be unique.

Use labels `(a)`, `(b)` and child labels `(i)`, `(ii)` under the correct `parentId`. Labels are author supplied, not auto-created. A no-part question has `parts: []` and one solution with `partId: null`; do not invent `(a)`.

For each parent, marks equal the sum of **direct child marks**. The question total equals the sum of root marks. Never add a parent's aggregate to its descendants again. Each leaf has exactly one solution, and its step marks sum to its own marks. A no-part solution's step marks sum to the question total. Zero-mark explanatory steps are permitted. Invalid totals, negative or fractional marks block import.

## Answer schemes, hints and known limitations

Every solution requires `partId`, `solution`, `equationLatex`, `teacherNotes`, `steps`; optional ordered `blocks` supports generic introductory conventions/instructions/given values before steps. Use leaf part IDs or `null` only for a no-part question. These are generic fields; do not create topic-specific fields such as `radial_force_convention`. Introduction currently belongs to each leaf solution; there is no separate multipart whole-answer introduction object.

Every step requires `number` (positive integer), `order` (nonnegative integer), `explanation`, `equationLatex`, `working`, `markingPoint`, `marks`; optional `blocks` adds ordered text/math/images. Numbers and orders are unique within each scheme. Empty strings are accepted in the prose/math properties. Put final results in the last relevant step, preferably using `\\boxed{...}`; a separate numeric `final_answers` object is unsupported. The renderer displays schemes by part and steps by order. It has no dedicated step-title property; explanation is the available step introduction. `teacherNotes` is private admin material and is removed in public output.

Use optional `markingCode` on the corresponding solution step. It preserves exact authored text, is 1–24 characters, starts with a letter/digit and then permits letters/digits or `+ . _ / -`. Examples: `G1`, `JU1`, `GJU1`. No fixed enum is imposed. Codes render separately beside the step marks and never affect totals. Do not concatenate codes into prose, teacher notes, hints, marking points or numerical marks. Omit the field when no code is supplied. Optional step `id` is a 1–120 character key, unique across all solutions in the package, required only when a hint targets that step.

Each hint requires unique `id`, `partId`, nonblank `text`, and nonnegative `order` unique within its target. Valid scopes are QUESTION (`partId:null`, no `solutionStepId`), PART (existing part/subpart ID, no `solutionStepId`), and SOLUTION STEP (`solutionStepId` referencing a step `id`, with `partId` equal to that solution owner). Optional `solutionStepId:null` is also an unlinked hint. Step IDs are unique throughout this question package; all IDs are local relationship keys, never database primary keys. Missing steps, duplicate step keys and conflicting owners fail at exact JSON paths. Multiple hints on one step sort by authored `order`; hints on different steps may reuse order values. Existing unlinked question/part hints remain valid and are not fabricated into step hints. Step hints appear immediately inside their answer step in admin preview and answer PDF.

Answer export displays each step mark and an explicit `Total: N marks` summary without changing numerical mark allocation.

## Original visuals and exact ownership

For every real PDF-derived question, ALL educational visuals must come from the ORIGINAL PDF: diagrams, answer diagrams, FBDs, graphs, circuits, rays, apparatus, vectors, geometry and visual tables. First extract the original embedded raster/object when safe and available. Otherwise render the exact original PDF region at sufficient print resolution (typically ≥300 dpi at intended size) and crop only that region. Inspect every label and thin arrow. Remove only unrelated blank margins, headers/footers/page numbers or neighboring material.

NEVER redraw, regenerate, AI-generate, beautify, simplify, reconstruct using OCR, recolor, relabel, reposition or change educational content. Preserve geometry, vector origins/directions/arrowheads, labels, weights, normal/friction/tension/applied forces, acceleration, angles, axes, curves, circuit symbols and meaningful annotations exactly. Synthetic golden/test visuals are fixtures, not substitutes for original source visuals.

Preserve safely extracted original raster bytes. Prefer **lossless PNG** for vector-region rasterization, line art and FBDs. Do not unnecessarily convert line art to JPEG. Accepted PNG/JPEG/WebP bytes are copied unchanged, without resizing/recompression. Current SVG handling validates/rejects unsafe XML and also copies accepted bytes unchanged; it does not sanitize by rewriting. A future SVG sanitizer could change bytes; exact identity must not be promised in that case. PNG is the recommended fidelity choice for real PDF line art.

Each asset requires `key`, `role`, `mimeType`, `byteLength`, `sha256`, `dataBase64`; optional `alt`, `caption`. Keys are unique, 1–80 letters/digits/underscore/hyphen. Allowed roles: `question_diagram`, `answer_diagram`, `free_body_diagram`, `graph`, `circuit_diagram`, `table_image`, `other_visual`. MIME: `image/png`, `image/jpeg`, `image/webp`, `image/svg+xml`. PDFs are excluded. Accessibility alt and captions are ≤1000 characters; describe educational content without provenance.

Each asset needs **exactly one** explicit image block placement using `assetId` equal to its package `key`. To intentionally repeat the same bytes, use distinct keys and placements. Question visuals go in question/part blocks. Answer visuals go in solution/step blocks. `answer_diagram` and `free_body_diagram` are rejected in question blocks. Actual owner blocks control filtering for other roles too; an answer-only graph must remain in answer blocks. Answer visuals never belong in question-only preview/print/PDF.

Compute metadata from the actual bytes, never invent a hash or estimate a size:

```python
import base64, hashlib
image_bytes = open("original-region.png", "rb").read()
asset["byteLength"] = len(image_bytes)
asset["sha256"] = hashlib.sha256(image_bytes).hexdigest()
asset["dataBase64"] = base64.b64encode(image_bytes).decode("ascii")
```

Base64 must be canonical with correct padding, no whitespace and no `data:` URL prefix. SHA-256 is exactly 64 lowercase hex digits. Detect the actual MIME from the file, not its extension alone. A ChatGPT environment needs PDF-rendering/extraction and byte/hash/file tools; if it lacks them, it cannot produce a fidelity-verified self-contained visual package. Never replace missing assets with placeholders.

## Import/security/storage and print

Limits: JSON ≤5 MiB UTF-8 including Base64; manifest without Base64 ≤384 KiB; at most 8 assets; each and combined decoded asset bytes ≤3 MiB. Compress package overhead without changing educational pixels, or report a size blocker. Do not discard a diagram to pass limits.

Website workflow: paste/upload ONE `.json` → browser parse/strict schema → Base64 decode/byte count/SHA verification → server Validate & Preview → visual/mark/classification/hint review → review checkbox → Import as Draft. Preview is read-only; no Blob upload yet. It cannot authoritatively certify binary signatures until commit. Editing invalidates the plan.

Commit sends a manifest without Base64 plus decoded binary files automatically. The server independently verifies authentication/admin authorization, CSRF, signed admin-bound plan, manifest/taxonomy binding, 15-minute expiry, role/size/count, byte length, actual signatures, multipart MIME and SHA-256 before storage. Current raster signature checks inspect magic bytes; they do not fully decode/validate an image or prove its PDF origin. Human source review is mandatory.

Images go through the existing storage abstraction; hosted imports use Private Blob, local fixtures use disposable local storage. DB stores opaque `/uploads/...` references and metadata/structured records, not Base64 or image bytes. Draft assets are private; the website mediates retrieval and does not expose raw Blob URLs. Only approved eligible questions become public. All portable imports create drafts, never publish, overwrite or implicitly revise an existing question. Retry of the same successful signed plan returns the existing ID; a newly validated identical package can produce another draft with a duplicate warning.

Normal Print / Save as PDF uses browser `window.print()`, canonical content/private visual assets and KaTeX text/vector mathematics, with zero OpenAI, LLM or image-generation calls and zero server AI tokens. The reusable Master-style template sets A4 portrait (210 × 297 mm), sensible margins, canonical `Matriculation Physics | Semester 1/2` headers, topic, uppercase difficulty, marks, paired dynamic question/answer numbers, restrained marking codes, adjacent hints, final totals and running page counters. Step/image break rules keep FBDs near their equations when they fit; oversized steps flow across pages. Long display equations scale as browser text to their available width. It excludes student working space/ruled lines, original source question numbers, SP015/SP025, set/year and source provenance. Assets scale through CSS without altering stored bytes. Question-only mode excludes all solutions, hints, codes and answer FBDs. In answer mode the existing separate hints checkbox controls hint inclusion. Page margin boxes and counters are verified in Chromium; browser printing capabilities and user print settings may vary.

The supported schemaVersion remains 1. Migration 005 passed the separately authorized production backup and existing-draft preservation checks. See the [rollout report](../MASTER_FORMAT_FIDELITY_PRODUCTION_ROLLOUT_REPORT.md) for application release status. Implementation and rollout do not authorize any real or production import.
