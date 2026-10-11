# MATRICULATION PHYSICS QUESTION BANK

# MASTER FORMAT COMPATIBILITY AUDIT

Audit date: 11 October 2026 (Asia/Kuala_Lumpur). Scope: documentation, synthetic examples, source inspection, disposable local verification and public production GET requests only. No runtime behavior was changed.

## MASTER FILES

Master JSON: `reference/Master JSON Format.json` (1,049,273 bytes).

Master PDF: `reference/Master PDF Format.pdf` (759,214 bytes).

JSON parsed: **PASS** — entire UTF-8 JSON parsed, including all three image payloads and the full embedded reference-PDF payload. All four decoded payload hashes match their declarations; the embedded PDF equals the standalone master PDF byte for byte. The readable audit copy abbreviates only Base64 for inspection; parsing did not truncate it.

PDF rendered: **PASS** — both pages rendered with PyMuPDF. Poppler was unavailable, so a workspace-local renderer was installed temporarily and removed after inspection.

Pages visually inspected: **PASS** — page 1's track illustration, question hierarchy, mathematical stem, two parts, marks, source headers and ruled space; page 2's convention, givens, five solution steps, codes, adjacent hints, top/downward FBD, bottom/upward FBD, equations, results and total. Source visuals were not redrawn or altered.

Both reference files were **untracked, not ignored** at entry and remain so. No Git add/status change was performed. Audit images: `data/master-format-audit/master-page-1.png`, `master-page-2.png`; complete parsed structure with abbreviated payload display: `master-readable.json`.

## MASTER POLICY

Original question number retained: **NO**.

Student working space retained: **NO**.

Source set retained: **NO**.

Source year/session retained: **NO**.

SP015 retained in Question JSON/export: **NO** under the permanent authoring policy; existing curriculum code metadata is not changed.

Source PDF provenance retained: **NO**.

Full source PDF retained: **NO**.

Permanent Semester identity: **Semester 1 / Semester 2**.

These are the contract decisions. Strict schema rejects dedicated legacy/source properties. Free-text titles, captions, tags, notes and optional question codes are not semantically scanned for every source identity; the conversion process must enforce those exclusions. Educational figure labels needed for reading original diagrams remain intact and do not serve as question IDs. The current exporter displays the stored canonical question code; it does not yet implement dynamic set numbers.

## EXECUTIVE VERDICT

Can the current importer represent the important Master educational features? **PARTIAL**.

Can ChatGPT create a direct-upload one-file JSON? **YES for supported content**, provided it has the actual taxonomy and PDF/image/byte/hash/file tools; **PARTIAL for the complete master contract** because some required semantic/presentation features are missing.

| Feature                         | Current status                                                                                     |
| ------------------------------- | -------------------------------------------------------------------------------------------------- |
| Question diagram                | SUPPORTED                                                                                          |
| Answer diagram                  | SUPPORTED                                                                                          |
| FBD                             | SUPPORTED as original visual asset and ordered step placement; side-by-side layout PARTIAL         |
| Marking codes                   | MISSING                                                                                            |
| Hints aligned with solution     | PARTIAL: question/part/subpart targeting exists, step targeting/adjacent answer placement does not |
| Accurate LaTeX                  | SUPPORTED with strict KaTeX syntax validation; physical/source accuracy needs review               |
| Dynamic question numbering      | MISSING; selected order is preserved                                                               |
| Master-style browser PDF export | PARTIAL; actual print pathway works without AI but lacks required template features                |

Do not import the legacy master JSON directly. No schema/runtime changes were made to accept its field names. The generated schema remains unchanged and passes `npm run schema:check`.

## MASTER FIELD MAPPING

Paths with `[]` apply to every corresponding item; `assets.*` applies to all three reference assets. The rows cover every master structural property and nested feature, without repeating image/PDF Base64 payloads.

| MASTER FIELD / FEATURE                                                                       | CURRENT OFFICIAL REPRESENTATION                                     | DISPOSITION             | STATUS    | NOTES                                                                                                                 |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------- | --------- | --------------------------------------------------------------------------------------------------------------------- |
| `format_identifier`                                                                          | `kind: matriculation-physics-question`                              | TRANSFORM               | SUPPORTED | Legacy identifier is not accepted.                                                                                    |
| `format_version`                                                                             | `schemaVersion: 1`                                                  | TRANSFORM               | SUPPORTED | Integer version, not legacy string.                                                                                   |
| `importer_compatibility`                                                                     | Authoring docs + this audit, outside package                        | DISCARD                 | SUPPORTED | Not canonical content.                                                                                                |
| `importer_compatibility.status`, `.explanation`, `.requires_app_support[]`                   | Current validators and documented capability verdict                | DISCARD                 | SUPPORTED | Legacy NOT_VERIFIED flag is not stored.                                                                               |
| `metadata.question_id`                                                                       | Server UUID; generated question code if omitted                     | DISCARD                 | SUPPORTED | Discard source-derived ID entirely.                                                                                   |
| `metadata.question_number`                                                                   | No canonical source-number property                                 | DISCARD                 | SUPPORTED | Never store the paper's Question 5.                                                                                   |
| `metadata.subject`, `.programme`                                                             | Existing canonical course/classification and app identity           | DERIVE AT RENDER TIME   | PARTIAL   | No arbitrary portable subject/programme fields; clean export course header is missing.                                |
| `metadata.semester_display_name`                                                             | `classification.semester`                                           | KEEP AS CANONICAL       | SUPPORTED | Exact Semester 1 / Semester 2.                                                                                        |
| `metadata.syllabus_code`                                                                     | None in portable question format                                    | DISCARD                 | SUPPORTED | No SP015/SP025 classification key.                                                                                    |
| `metadata.session`, `.paper_series`, `.set`                                                  | None                                                                | DISCARD                 | SUPPORTED | Do not hide these in prose/IDs/tags.                                                                                  |
| `metadata.topic`                                                                             | Exact `classification.chapter`, `.topic`, `.subtopic`, version      | TRANSFORM               | SUPPORTED | Map educational topic into actual version-specific hierarchy.                                                         |
| `metadata.difficulty`                                                                        | `difficulty: Medium`                                                | TRANSFORM               | SUPPORTED | Exact DB spelling; MEDIUM is not accepted by resolver.                                                                |
| `metadata.total_marks`                                                                       | `question.totalMarks`                                               | KEEP AS CANONICAL       | SUPPORTED | Positive integer with allocation checks.                                                                              |
| `metadata.language`                                                                          | Author text language; no language property                          | NOT CURRENTLY SUPPORTED | MISSING   | English content renders; first-class language identity/filter is absent, low-priority compared with educational gaps. |
| `metadata.question_source`                                                                   | None                                                                | DISCARD                 | SUPPORTED | No source-PDF identity.                                                                                               |
| `question.heading` (source numbered)                                                         | Unnumbered `question.title`; eventual export index                  | DERIVE AT RENDER TIME   | PARTIAL   | Discard source value; dynamic export heading missing.                                                                 |
| `question.topic_line`                                                                        | Classification topic + totalMarks                                   | DERIVE AT RENDER TIME   | PARTIAL   | Data exists; print renderer omits topic.                                                                              |
| `question.difficulty_label`                                                                  | Resolved difficulty                                                 | DERIVE AT RENDER TIME   | PARTIAL   | Admin metadata shows it; print renderer omits difficulty.                                                             |
| `question.diagram_asset_ids[]`                                                               | Image blocks referencing package asset keys                         | TRANSFORM               | SUPPORTED | Explicit, ordered placement.                                                                                          |
| `question.diagram_caption`                                                                   | Corresponding `assets[].caption`                                    | TRANSFORM               | SUPPORTED | Retain educational caption, not provenance.                                                                           |
| `question.stem`                                                                              | `question.scenario` and/or ordered paragraph/math blocks            | TRANSFORM               | SUPPORTED | Avoid duplicating text in both.                                                                                       |
| `question.stem.format`, `.text`                                                              | Plain prose with dollar math; explicit math blocks                  | TRANSFORM               | PARTIAL   | No Markdown renderer; convert emphasis/legacy math delimiters to supported syntax.                                    |
| `question.parts[]`                                                                           | Flat `parts[]` with IDs, parentId and order                         | TRANSFORM               | SUPPORTED | Bounded to 100 parts; no-part supported.                                                                              |
| `question.parts[].label`, `.text`, `.marks`                                                  | `label`, `prompt`/blocks, `marks` plus required `id/order/parentId` | TRANSFORM               | SUPPORTED | Never invent a part for no-part source.                                                                               |
| `question.marks_label`                                                                       | `question.totalMarks`                                               | DERIVE AT RENDER TIME   | SUPPORTED | Current header shows marks, with different typography.                                                                |
| `question.student_working_space`, `.label`, `.ruled_lines`                                   | None                                                                | DISCARD                 | SUPPORTED | No lines or deliberate work-space reservation.                                                                        |
| `answer_scheme.heading`                                                                      | Renderer heading                                                    | DERIVE AT RENDER TIME   | PARTIAL   | Current heading is Answer scheme; hints not adjacent.                                                                 |
| `answer_scheme.radial_force_convention`                                                      | Generic `solutions[].blocks` paragraph                              | TRANSFORM               | SUPPORTED | No circular-motion-specific field; per-leaf scope.                                                                    |
| `answer_scheme.figure_reference_instruction`                                                 | Generic solution paragraph block                                    | TRANSFORM               | SUPPORTED | Preserve instruction meaning with actual placement.                                                                   |
| `answer_scheme.given_values[]`                                                               | Ordered solution paragraph/math blocks                              | TRANSFORM               | SUPPORTED | Before that scheme's steps.                                                                                           |
| `given_values[].symbol`, `.quantity`, `.value`, `.unit`, `.presentation_latex`               | Accurate LaTeX and explanatory prose                                | TRANSFORM               | SUPPORTED | Presentation retained; no first-class numeric quantity object.                                                        |
| `answer_scheme.steps[]`                                                                      | `solutions[].steps[]` grouped by leaf part                          | TRANSFORM               | SUPPORTED | Generic step model.                                                                                                   |
| `step.step`                                                                                  | `steps[].number` and `order`                                        | TRANSFORM               | SUPPORTED | Uniqueness per scheme; renderer retains authored step number.                                                         |
| `step.part`                                                                                  | Owning `solutions[].partId`                                         | TRANSFORM               | SUPPORTED | Stable local part reference, not paper numbering.                                                                     |
| `step.title`                                                                                 | `steps[].explanation`                                               | TRANSFORM               | PARTIAL   | Available step introduction renders as body text below Step N, not master title on same line.                         |
| `step.marking_code`                                                                          | No separate property                                                | NOT CURRENTLY SUPPORTED | MISSING   | Unknown-field rejection; markingPoint is not a code.                                                                  |
| `step.marks`                                                                                 | `steps[].marks`                                                     | KEEP AS CANONICAL       | SUPPORTED | Deterministic leaf total check.                                                                                       |
| `step.student_hint`                                                                          | `hints[]` with question/part target                                 | TRANSFORM               | PARTIAL   | Cannot retain a semantic step link or master adjacent placement.                                                      |
| `step.worked_equations[]`                                                                    | Ordered math blocks or equationLatex                                | TRANSFORM               | SUPPORTED | Multiple equations in blocks.                                                                                         |
| `worked_equations[].format`, `.display`, `.value`                                            | `type: math`, `latex`                                               | TRANSFORM               | SUPPORTED | Math block is display mode; inline uses prose dollars.                                                                |
| `step.diagram_asset_id`                                                                      | Image block in owning step                                          | TRANSFORM               | SUPPORTED | FBD is answer-only.                                                                                                   |
| `answer_scheme.final_answers[]`                                                              | Final relevant step equation/math block                             | TRANSFORM               | SUPPORTED | No separate final-answer numeric schema.                                                                              |
| `final_answers[].part`, `.quantity`, `.latex`, `.value`, `.unit`                             | Owning part scheme, reasoning and worked final LaTeX                | TRANSFORM               | SUPPORTED | Preserve value/units in canonical LaTeX; no duplicate mark allocation.                                                |
| `answer_scheme.marking_allocation[]`                                                         | One allocation per corresponding step + markingPoint                | TRANSFORM               | PARTIAL   | Marks persist; codes do not.                                                                                          |
| `marking_allocation[].part`, `.marks`                                                        | Owning leaf scheme + step marks                                     | TRANSFORM               | SUPPORTED | Never count mirrored allocation twice.                                                                                |
| `marking_allocation[].code`                                                                  | None                                                                | NOT CURRENTLY SUPPORTED | MISSING   | Same marking-code architecture gap.                                                                                   |
| `answer_scheme.total_marks`                                                                  | Question total checked against all leaf step sums                   | DERIVE AT RENDER TIME   | PARTIAL   | Validated; final answer Total label missing.                                                                          |
| `assets` dictionary                                                                          | `assets[]` strict portable manifest entries                         | TRANSFORM               | SUPPORTED | All bytes carried in one JSON.                                                                                        |
| `assets.*.asset_id`                                                                          | `assets[].key`; image `assetId`                                     | TRANSFORM               | SUPPORTED | Neutral local key, mapped to opaque DB asset reference.                                                               |
| `assets.*.role = question_figure`                                                            | `question_diagram`                                                  | TRANSFORM               | SUPPORTED | Master role spelling is not accepted.                                                                                 |
| `assets.*.role = free_body_diagram`                                                          | `free_body_diagram`                                                 | KEEP AS CANONICAL       | SUPPORTED | Maps internally to fbd, owner remains answer scope.                                                                   |
| `assets.*.caption`                                                                           | `caption`                                                           | KEEP AS CANONICAL       | SUPPORTED | Renders under image.                                                                                                  |
| `assets.*.alt_text`                                                                          | `alt`                                                               | TRANSFORM               | SUPPORTED | Optional; missing alt warns.                                                                                          |
| `assets.*.mime_type`                                                                         | `mimeType`                                                          | TRANSFORM               | SUPPORTED | Actual signature and multipart MIME checked.                                                                          |
| `assets.*.encoding`                                                                          | Implicit canonical Base64                                           | TRANSFORM               | SUPPORTED | Do not add encoding property.                                                                                         |
| `assets.*.content_base64`                                                                    | `dataBase64` + exact required `byteLength`                          | TRANSFORM               | SUPPORTED | Browser decodes, server receives binary; not DB storage.                                                              |
| `assets.*.sha256`                                                                            | `sha256`                                                            | KEEP AS CANONICAL       | SUPPORTED | Must match exact bytes.                                                                                               |
| `assets.*.provenance`                                                                        | None                                                                | DISCARD                 | SUPPORTED | Author review occurs before import.                                                                                   |
| `provenance.source`, `.source_pdf_page`, `.source_pdf_image_xref`, `.generated_or_redrawn`   | Preparation-only review information                                 | DISCARD                 | SUPPORTED | Do not retain even as false origin certificate.                                                                       |
| `pdf_export_contract`                                                                        | Shared browser print design, outside question package               | DISCARD                 | PARTIAL   | Master is design input, not stored export engine.                                                                     |
| `pdf_export_contract.style_id`                                                               | Shared future template identity                                     | DERIVE AT RENDER TIME   | MISSING   | Not per-question storage.                                                                                             |
| `pdf_export_contract.fidelity_priority`                                                      | Structured content + canonical original assets policy               | DISCARD                 | SUPPORTED | Reject PDF replay approach.                                                                                           |
| `reference_pdf_embedded`                                                                     | None                                                                | DISCARD                 | SUPPORTED | Full PDF never required for portable import.                                                                          |
| `reference_pdf_embedded.mime_type`, `.encoding`, `.content_base64`, `.sha256`, `.page_count` | None                                                                | DISCARD                 | SUPPORTED | Audit input only.                                                                                                     |
| `page_format.name`, `.width_pt`, `.height_pt`, `.orientation`                                | Shared print stylesheet/browser paper settings                      | DERIVE AT RENDER TIME   | PARTIAL   | A4 portrait selected in test; app has no @page enforcement.                                                           |
| `layout.page_1.role`, `layout.page_2.role`                                                   | Question and answer renderer sections                               | DERIVE AT RENDER TIME   | SUPPORTED | No replay of original pages.                                                                                          |
| `layout.page_1.header_left`, `layout.page_2.header_left`                                     | Desired canonical course + semester header                          | DERIVE AT RENDER TIME   | MISSING   | Discard source header including code/paper series.                                                                    |
| `layout.page_1.header_right`, `layout.page_2.header_right`                                   | None                                                                | DISCARD                 | SUPPORTED | Source set/year excluded.                                                                                             |
| `layout.page_1.content_order[]`, `layout.page_2.content_order[]`                             | Owner block order, parts and step order; renderer sections          | TRANSFORM               | PARTIAL   | Exclude work space/source numbering; hints/template layout gaps remain.                                               |
| `layout.page_1.original_diagram_asset_id`, `layout.page_2.original_fbd_asset_ids[]`          | Question/answer image blocks                                        | TRANSFORM               | SUPPORTED | Not layout metadata stored separately.                                                                                |
| `layout.page_1.footer_left`, `layout.page_2.footer_left`                                     | Desired dynamic question index + canonical topic                    | DERIVE AT RENDER TIME   | MISSING   | Discard source number; current print footer hidden.                                                                   |
| `layout.page_1.footer_right`, `layout.page_2.footer_right`                                   | Actual Page x of y from exported pagination                         | DERIVE AT RENDER TIME   | MISSING   | Browser default headers can be enabled, but app has no polished footer.                                               |
| `layout.visual_requirements[]`                                                               | Authoring visual policy + shared renderer requirements              | TRANSFORM               | PARTIAL   | Original-visual rules documented; master layout still incomplete.                                                     |
| `layout.template_variable_examples.header_left`                                              | Course + permanent semester                                         | DERIVE AT RENDER TIME   | MISSING   | Discard source syllabus code.                                                                                         |
| `layout.template_variable_examples.header_right`                                             | None                                                                | DISCARD                 | SUPPORTED | No set/session header.                                                                                                |
| `layout.template_variable_examples.page_1_title`, `.difficulty_label`, `.footer_left`        | Export index, canonical difficulty/topic                            | DERIVE AT RENDER TIME   | MISSING   | No package template variables.                                                                                        |
| `student_export.device`, `.server_side_ai_tokens_required`                                   | Existing browser print, no AI                                       | DERIVE AT RENDER TIME   | SUPPORTED | No author-supplied export flags.                                                                                      |
| `student_export.single_question_exact_export`, `.multi_question_export`                      | Fresh browser print from data/assets                                | DISCARD                 | SUPPORTED | Never decode/merge original source PDFs.                                                                              |
| `student_export.requires_web_app_code_support`, `.note`                                      | This compatibility report                                           | DISCARD                 | SUPPORTED | Documentation only.                                                                                                   |

## QUESTION FORMAT

`shared/question-import.ts` defines a strict package with schemaVersion/kind/classification/difficulty/question/parts/solutions/hints/assets/tags. Stem and ordered paragraph/math/image blocks work; question content can be no-part, multipart or nested. `shared/schema.ts` supplies flat part parent links, labels, marks and order. Bounds are 100 parts; IDs, parent relationships, cycles and sibling ordering are validated. No `(a)` is fabricated for no-part questions.

`validatePackage` checks direct-child aggregates, root totals and exactly one solution for every leaf (or one whole-question solution). Step marks must equal that leaf/whole-question total. Negative/fractional marks fail. All mirrored master marking allocations must be represented once as step marks. Reused explicit asset placements require distinct keys. Marks and source exclusions are not reason to alter educational content.

Current answer labels display the immediate part label only. For nested `(a)(i)`/`(b)(i)`, parent links persist, but displaying only Part (i) is ambiguous; the renderer should derive the full path. This is a presentation gap, not a failure to store hierarchy.

## ANSWER SCHEME

Generic introductory prose and givens work in `solutions[].blocks` before steps. There is no hard-coded force convention. For multipart questions, each leaf owns a scheme; there is no single whole-answer introduction separate from those leaf schemes. An introduction can be placed in the first relevant scheme now, but a global multipart answer header is only partial support.

Sequential steps retain number/order, explanation, equations, working, descriptive marking point and marks. Multiple equations and FBD placement are available in ordered blocks. Scalar explanation/equation/working renders before the blocks: put FBD then equation in the same block array to control their order. Final answers work as boxed LaTeX in the final step. Individual step marks render, but there is no printed answer total summary. The model is generic across topics.

## MARKING CODES

**MISSING end to end.** `stepSchema` has no marking-code property; strict validation rejects `markingCode`/`marking_code`. The disposable audit explicitly verified rejection. DB `solution_steps` contains `marking_point`, not a separate code column. API persistence, admin preview/editor, student rendering and PDF therefore cannot carry first-class codes. No codes were stuffed into teacher notes, hints, marking descriptions or solution prose in the golden example.

Recommended later architecture: optional nullable `markingCode` on each step; bounded literal text, separate from assessment description; shared/generated schemas and both importer/internal API persistence updated; additive DB column/migration; snapshots/backward compatibility preserved; admin input and preview; badge beside step title/mark count in answer UI/export. This is **not renderer-only**. No migration or implementation was performed.

## STUDENT HINTS

Whole-question `partId: null`, part and subpart hints are supported; orders are unique within each target. `src/Preview.tsx` reveals hints progressively to students and prints supplied hints in the question/part sections. `src/QuestionJsonImporter.tsx` displays them in a separate review panel. There is no step target, association constraint or automatic adjacent rendering in the answer scheme. Ordering alone does not preserve the master's step association.

A future optional solution-step target should identify the scheme/part plus stable step key or number, validate it, persist it and retain untargeted progressive hints. Add DB/schema/API support and render targeted hints beside the corresponding working in answer export. Do not replace hints with plain paragraphs as an undocumented workaround.

## MATHEMATICS

**SUPPORTED.** `shared/content.ts` invokes KaTeX with throwOnError, trust false and bounded macro expansion. Pure equations and dollar-delimited prose fail on malformed input; no AI repair occurs. Fourteen audit examples cover all requested master equations, SI conversions/units, Greek symbols, vectors, degrees, negative signs, brackets and scientific notation. Malformed `\\frac{1}{` was rejected. Existing import tests additionally reject malformed prose delimiters and equations.

`src/MathText.tsx` renders text/MathML/KaTeX HTML and SVG where appropriate; browser print keeps text/vector math. PDF inspection found embedded text fonts and extractable equations, with raster images confined to fixture visuals. We did not rasterize mathematics. The golden export visually shows sharp units, subscripts, summation and boxed answers. A separate two-page synthetic typesetting specimen prints all fourteen requested notation examples through the same question-set pathway; both pages were visually inspected. Fractions, superscripts/subscripts, Greek symbols, vector arrows, SI units, degrees, brackets, negative signs and scientific notation were sharp; PDF inspection found **zero raster images** and embedded KaTeX fonts in that specimen. It is a notation fixture, not the real master question. Syntax checks cannot establish physical correctness. Legacy Markdown and parenthesized math delimiters need conversion.

## QUESTION DIAGRAM

**SUPPORTED.** The package carries original bytes under an asset key; a question image block controls ordered placement. Caption/alt metadata persists. Browser validation previews decoded Blob URLs; commit uploads binary without separate user file selection. One question diagram and two distinct answer FBD assets are demonstrated in the golden fixture.

## FREE-BODY DIAGRAMS

**SUPPORTED assets, PARTIAL presentation.** `free_body_diagram` maps to internal `fbd`. Import validation requires answer ownership. `server/app.ts` student view and `server/visibility.ts` question-set filtering remove assets actually placed in solution/step blocks, including FBDs and generic graph roles. Placed assets are not repeated in the unplaced fallback. Browser/local export verified zero answer visuals in question-only output and four answer FBD placements in a two-question answer-inclusive set.

FBDs are stacked above the relevant force equation when authored in that order; side-by-side compact placement is absent. Original FBD image labels, vectors, origins and arrows are not changed by the importer. Broader legacy unplaced assets use older fallback behavior; this finding applies to strict portable packages with mandatory placement.

## ORIGINAL VISUAL PRESERVATION

Direct extraction: **Preparation responsibility**, outside the website. Prefer exact original embedded raster/object bytes when safe and available.

Lossless crop fallback: **Required policy** for vector/page figures; render sufficient print resolution and crop the exact original region. Remove only unrelated margins/header/footer/page numbers/neighbors. Use lossless PNG for line art/FBDs.

Redrawing: **NO**. AI regeneration: **NO**. Beautification: **NO**. OCR reconstruction: **NO**. No relabeling, repositioning, recoloring or changing meaningful educational content.

Importer byte preservation: **YES for accepted raster bytes**. PDF-origin proof: **NO**. Signature/MIME/SHA verification proves the supplied upload matches the declared bytes, not that it was extracted from the PDF. Original-source fidelity requires preparation and human visual review.

### Disposable asset round-trip evidence

`data/master-format-audit/exercise.ts` used the real built browser importer and real local HTTP server against an explicit in-memory SQLite test bank and a newly created temporary LocalAssetStorage directory. No production environment/database factory was used. The golden package's classification was remapped in memory to isolated TEST ONLY taxonomy for local import; the checked-in golden retains the actual public classification. It entered through Upload one .json → actual browser preparation/Base64/hash → Validate & Preview → review checkbox → Import as Draft → server validation/storage → authenticated HTTP retrieval. Temporary bank/storage were closed/deleted.

Nine asset deliveries across three local imports matched the original bytes exactly; all returned authenticated 200 and anonymous 404. Representative SHA-256 values:

| Asset/format                       | Bytes | SHA-256 before = after                                             |
| ---------------------------------- | ----: | ------------------------------------------------------------------ |
| Question PNG                       |  6405 | `8da968f8edbc6a5acd5b8ed44b01afebccd62322c14a89dee3a2ab4dfb81cbfe` |
| Answer FBD PNG (each distinct key) |  5723 | `cb34231b6874233969041299a5ec918075b6fc306c7c40a0d2a78a772a98f134` |
| Question JPEG                      | 20540 | `00c51e06446f62ea0178e1b1288e01944af063ca54aac3ac9f02e0467dba25f0` |
| Question WebP                      | 11060 | `3295fad7a85fb2dcf1ee3b4f0d01a3210fc0801d3eccd393c2a4bbf236f0b130` |

JPEG/WebP were newly encoded **synthetic test variants before import**, not transformations of real source visuals. The importer performed no transformation. The golden uses only original existing synthetic PNG fixtures; its two FBD keys intentionally reuse the same suitable fixture bytes. It imports no real master question.

SVG special case: `server/asset-validation.ts` parses/rejects unsafe SVG elements/attributes/XML/URLs; it does not rewrite/sanitize accepted SVG. Safe fixture bytes were unchanged. Unsafe SVG fails instead of being repaired. Exact-byte guarantees must be reassessed if a sanitizer is introduced; PNG remains preferred for real PDF line diagrams. SVG HTTP/storage security is additionally covered by the existing storage tests.

## ASSET SECURITY

| Server-side boundary         | Evidence / result                                                                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Authentication/authorization | `createApp` admin guard and AuthService; anonymous import endpoints 401 in tests.                                                                            |
| CSRF                         | Same-origin/custom request header checks precede mutating API routes; authenticated requests without required CSRF context fail 403.                         |
| Validated import plan        | HMAC plan bound to admin, exact normalized manifest, resolved taxonomy/difficulty; 15-minute expiry. Tampered/changed/stale/expired plans fail.              |
| SHA-256/byte length          | Server hashes received buffers; lengths and digests must match the signed manifest; storage receipts/read integrity also checked.                            |
| MIME/signature               | Magic signatures identify PNG/JPEG/WebP; strict SVG parser; declared and multipart MIME must agree. **Not a full raster decoder** or PDF-origin certificate. |
| Roles/placements             | Server manifest validates enum role, explicit use, uniqueness and answer-only roles before upload.                                                           |
| Size/count                   | 8 assets, individual/combined decoded 3 MiB, manifest 384 KiB; browser total package 5 MiB; bounded multipart endpoint.                                      |
| Private storage              | Existing abstraction; hosted `VercelBlobAssetStorage` sets access private, no overwrite, scoped path and metadata checks.                                    |
| Relational data              | DB holds blocks, opaque URL references and metadata; no Base64/image bytes. Immutable snapshots contain references/content.                                  |
| Retrieval                    | App `/uploads/...` gate before storage I/O; drafts/staged assets require admin. No raw private Blob URL returned.                                            |

Browser checks are usability checks, not the security authority. Binary signatures are checked on commit, after preview, before upload. Tests reject invalid signature/MIME/hash/length/extra files before storage writes and verify rollback/compensation. Browser validation does not claim to prove those binary server checks already occurred.

## ONE-JSON WORKFLOW

**SUPPORTED.** `src/question-import-preparation.ts` checks package bytes, parses JSON, invokes strict schema, strips Base64 into manifest, decodes canonical Base64, checks count/hash and creates Blob previews. `src/QuestionJsonImporter.tsx` supports Paste JSON and Upload .json, requires Validate & Preview and review acknowledgement before the draft button is enabled, then submits manifest/token and binary images automatically. `server/question-json-import.ts` validates the plan and binaries, uploads through AssetService and commits relational content/receipt transactionally. Asset references render via authenticated or approved-public mediated retrieval.

Draft-only: forced `status: draft`, forbidden publication properties; no existing question overwrite. Optional duplicate question code rejects. Same successful plan is durable/idempotent across retries/double clicks; a newly validated copy is a different plan and can create another draft after duplicate warning. Source edits invalidate preview. Hints and all visuals are previewable, subject to missing first-class marking codes/step links.

## CLASSIFICATION

Permanent semester strings and exact canonical version/chapter/topic/subtopic are supported. SP015 dependency: **NONE in portable authoring/import syntax**. Classification retains legitimate version identity and existing internally versioned curriculum code metadata; none was removed.

Read-only public production taxonomy on 11 October showed active `PHYSICS-2022-2023`, permanent Semester 1 / Semester 2, difficulty names Easy/Medium/Hard and **zero subtopics**. Golden therefore uses `subtopic: null`, not an invented entry. It selects `3.0 Dynamics of Linear Motion` / `3.4 Newton’s Laws of Motion`; all names were checked against that taxonomy. A future valid non-null subtopic works when actually configured. An external author needs current taxonomy beyond the static schema; classification cannot be safely inferred from the master topic label alone.

## DYNAMIC NUMBERING

**MISSING.** `VisibilityService.questionSet` iterates selected IDs in supplied order; the local test also verified reversed order. `QuestionSet` maps items without an index and `ContentPreview` prints the stored questionCode/title. No Question 1/2/3 labels or matching numbered answer headings are generated. UUID/code stability is independent of selection. Implement a transient `exportNumber = index + 1` shared by question and answer renderers; do not persist it or modify question IDs. Renderer-only change, no DB migration required.

## PDF EXPORT

**Client/browser pathway SUPPORTED; master template PARTIAL.** Print / Save as PDF calls `window.print()` using canonical records and canonical assets. There are zero OpenAI/LLM/server AI/image generation calls and no source-PDF replay or merging.

The local audit created two approved **synthetic export fixtures only inside the disposable bank**, leaving the imported local drafts as drafts. It exercised the actual anonymous `/question-set` and `/api/public/question-set` pathways for question-only and answer-inclusive output. Images were scrolled into view and decoded before print to ensure lazy loading; bundled KaTeX fonts loaded, external Google font CSS was deliberately blocked for stable offline fallback. PDF settings selected A4 portrait and disabled generic browser headers/footers; the app itself has no A4 `@page`/margin declaration.

Actual generated outputs: `data/master-format-audit/current-question-only-export.pdf` (**2 pages**, two questions, two question images, no answer assets/hints); `current-question-answer-export.pdf` (**8 pages**, two questions, six total visuals, all five steps per question, part-scoped hints). Every rendered page was visually inspected. PDF dimensions are Chromium's approximately A4 portrait, 595.92 × 842.88 pt. Text/fonts and sharp math remain available; figures remain bitmap assets.

Confirmed absent in these synthetic outputs: original question number, work-space lines, SET A, 2026/2027 and SP015/SP025. The absence is verified for compliant fixtures, not a guarantee against arbitrary source text authored into free fields. Dynamic export numbers are missing. The current app footer is hidden by print CSS; no page-number footer appears. These evidence PDFs show current limitations and are not proposed replacement templates.

## MASTER DESIGN COMPARISON

| Requirement                   | Observed comparison                                                                                                                                                                                                        |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A4 portrait / clean margins   | A4 works when selected; no application-enforced paper size/margins. Test zero-margin browser default leaves screen-style padding/background.                                                                               |
| Academic hierarchy            | Readable title/parts/steps, but persistent code dominates top metadata and canonical course/semester/topic/difficulty are missing in print.                                                                                |
| Body/math                     | Legible prose and sharp text/vector math; synthetic output is sans/system + serif title rather than master academic body typography.                                                                                       |
| Diagram sizing                | Sharp supplied PNGs, but large full-width FBDs consume much of a page; no role-specific print size/adjacent equation grid.                                                                                                 |
| Answer organization           | Step marks and descriptive marking points render. Whole question+answer took four pages per synthetic fixture, vs master compact two pages; this is not a required exact page count, but demonstrates inefficient spacing. |
| Hints                         | Appear in question parts, with a part heading at the bottom of one page and its hints on the next; not next to worked steps.                                                                                               |
| Marking codes                 | Missing.                                                                                                                                                                                                                   |
| Final results / marks / total | Boxed results and per-step marks visible; total question marks visible; no final answer Total summary. Singular 1 marks is unpolished.                                                                                     |
| Footer / page numbering       | Missing with browser headers off; current footer explicitly hidden.                                                                                                                                                        |
| Forbidden source furniture    | No ruled work space or master source header generated. Compliant fixtures omit source metadata.                                                                                                                            |

Comparable master presentation: **NOT YET achieved**. The test exposed gaps; it does not certify print-template parity.

## CAPABILITY GAPS

All gaps below are recommendations only. No runtime, schema, DB or API modifications/migrations were made.

| CAPABILITY                                    | CURRENT STATUS                                | SEVERITY                                        | SCHEMA IMPACT                                                                        | DATABASE IMPACT                                                                                                                  | API IMPACT                                                                       | ADMIN UI IMPACT                       | STUDENT UI IMPACT                                              | PDF EXPORT IMPACT                                                                                           | RECOMMENDED IMPLEMENTATION                                                                                  |
| --------------------------------------------- | --------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| First-class marking code                      | MISSING                                       | HIGH: required master semantic content lost     | Add optional step markingCode to shared/internal/portable schemas; regenerate schema | Add nullable solution_steps column; additive migration and snapshot compatibility                                                | Persist/return code, include in plan/fingerprint naturally                       | Editor + visible code in preview      | Answer-step badge                                              | Code beside step/marks                                                                                      | Separate bounded property, never repurpose prose/notes.                                                     |
| Hint-to-step association                      | PARTIAL                                       | HIGH: intended pedagogical association lost     | Add optional validated scheme/step target; stable target design                      | Hint target column(s)/FK or validated linkage; migration                                                                         | Persist/return links; validate missing targets                                   | Target selection and adjacent review  | Keep progressive question hints, render linked answer hints    | Adjacent hint per worked step                                                                               | Preserve existing untargeted hints and enforce referential integrity.                                       |
| Dynamic question/answer numbering             | MISSING                                       | HIGH: explicit required customized-set behavior | None                                                                                 | None; no migration                                                                                                               | Existing ordered IDs suffice                                                     | No required change                    | Ordered index shared across sections                           | Question 1/2/3 + same answer labels                                                                         | Pass render-time index; never store source number.                                                          |
| Canonical print header/topic/difficulty       | MISSING in print                              | MEDIUM                                          | None; data already classified                                                        | None                                                                                                                             | Return safe resolved display classification/difficulty in set response if needed | Metadata preview already exists       | Show permanent course/semester + topic/difficulty              | Clean header and meta line; no set/year/code                                                                | Resolve display labels without exposing source metadata.                                                    |
| Master print template/FBD sizes/footer        | PARTIAL                                       | HIGH for final export target                    | None for default shared template                                                     | None; no migration                                                                                                               | Normally none beyond display metadata above                                      | Preview polished output               | Consistent print controls                                      | A4 @page margins, white print body, compact FBD/equation layout, part/step break control and page numbering | Shared template; browser-only print; verify varied long questions visually.                                 |
| Final answer total                            | MISSING printed summary                       | MEDIUM                                          | None                                                                                 | None                                                                                                                             | None                                                                             | Preview total already available       | Answer footer                                                  | Total: N marks                                                                                              | Derive from validated canonical marks, no duplicate persisted total.                                        |
| Multipart whole-answer introduction           | PARTIAL: intro per leaf exists                | MEDIUM                                          | Optional generic whole-answer blocks if single global intro required                 | Existing generic owner_key block storage can support new owner; persistence readers/writers need updates, DDL may be unnecessary | Carry new owner blocks through document/import                                   | Edit/preview intro above leaf schemes | Global intro before steps                                      | Convention/givens once above multipart answers                                                              | Reuse ordered generic blocks; no radial-specific fields.                                                    |
| Nested answer part path / step heading polish | PARTIAL                                       | MEDIUM                                          | None for deriving path/explanation heading                                           | None                                                                                                                             | None                                                                             | Show full path when previewing        | Part (a)(i), not ambiguous Part (i)                            | Full part path and explanation heading; singular marks grammar                                              | Derive path from parent links; use existing explanation as title where appropriate.                         |
| First-class language property                 | MISSING                                       | LOW: English text itself works                  | Optional language tag if needed later                                                | Column/metadata strategy and migration only if first-class persistence added                                                     | Return language if added                                                         | Optional input                        | Optional labeling/filtering                                    | Optional language-aware styles                                                                              | Not required to imitate source metadata; keep out of current package until implemented.                     |
| Absolute source-text exclusion enforcement    | PARTIAL: strict properties + authoring policy | LOW for reviewed compliant packages             | None required; optional explicit policy validation later                             | No historical curriculum mutation                                                                                                | None required                                                                    | Human review/canonical header         | Export canonical metadata rather than source-authored headings | Stored questionCode currently displayed                                                                     | Omit source-derived code/title in conversion; do not promise semantic free-text filtering currently exists. |

Accepted asset signatures are shallow raster magic-byte checks, not a full raster decoder. This is an accuracy/security limitation disclosed above, not evidence of a transformation or origin check. Optional decoder validation can be considered separately; it should preserve accepted original bytes rather than recompressing them.

## CHATGPT AUTHORING READINESS

Authoring standard sufficient: **YES for supported v1 syntax/policy; NO for promising complete master feature fidelity**.

Checklist sufficient: **YES**, including all 31 requested conversion steps, strict original-visual rules and explicit missing capabilities.

Machine schema sufficient: **NO alone** — it describes accepted fields/shape, but cannot encode runtime refinements, actual taxonomy, physics accuracy or original-PDF origin. Schema freshness: **PASS**, no change needed for this audit.

Golden reference validates: **YES** — current runtime package schema, actual asset hashes/lengths, marks and current public classification spellings checked. Three example files (existing no-part, existing visual, new golden) validated. Golden has medium difficulty (`Medium`), Semester 1, chapter/topic and nullable subtopic, two parts, five marks/steps, LaTeX, descriptive marking scheme, progressive part hints, one question visual and two FBD keys. No unsupported marking code or pretend step hint exists. No production import occurred. A non-null invented subtopic was deliberately avoided because none currently exists.

ChatGPT can author future supported packages without Codex by following these files, a valid example, current taxonomy and tool-supported PDF extraction/hash creation. A ChatGPT session without byte/PDF tools cannot honestly produce exact embedded visuals and hashes. Complete master-style coded and step-hinted questions remain blocked by the semantic gaps, not by JSON authoring instructions.

### Verification evidence

- `node --import tsx --test tests/question-import.test.ts tests/storage.test.ts`: **85/85 PASS**, zero failed, including role/mark/LaTeX rejection, idempotency, auth/CSRF, public draft isolation, private Blob transport behavior and rollback/cleanup.
- Existing browser importer suite: **18/18 PASS with clean exit**, covering paste/upload, math/hints/marks, errors, nested hierarchy, FBD ownership, edit invalidation, double-click/retry/draft hiding and accessibility at mobile/desktop sizes. A task-local Playwright configuration uses the suite's own isolated fixture servers without the unused global webServer, which had kept the first runner open; that first runner was stopped after all 18 results. Evidence: `data/master-format-audit/browser-tests-clean.log`.
- Standalone browser/local master exercise: **PASS with clean exit**, 3 imports/9 exact byte round trips, anonymous draft hiding, two real synthetic question-set exports, reversed order and expected documented gaps. Script/results: `data/master-format-audit/exercise.ts`, `exercise-results.json`, `pdf-inspection.json`.
- `npm run schema:check`: **PASS**; `npm run build`: **PASS** (TypeScript + Vite).
- Generated/exported PDF pages: **12/12 visually inspected** (2 question-only + 8 question/answer + 2 notation specimen), in addition to **2/2 master pages**.

## PRODUCTION SAFETY

Questions changed: **0 in Production**.

Questions edited: **0 in Production**.

Assets changed: **0 in Production**.

Curriculum changed: **0 in Production**.

Migration: **NO against project/Production data**; existing migrations ran only to initialize explicit disposable in-memory test databases.

Deployment: **NO**. Commit: **NO**. Push: **NO**.

No real question was imported anywhere. The existing production draft was not requested, edited, approved, revised or overwritten. No production assets uploaded. The normal production import/validate/commit routes received no requests from this audit; live checks used GET only. Runtime/source/DB migration files remained unchanged.

### Deployed-version read-only comparison

Canonical site: `https://matriculation-physics-question-bank.vercel.app`. Public GET `/api/health`, `/api/taxonomy`, `/import/question-json` returned 200. Eight JS/CSS bundles, including importer, preview and question-set chunks, matched the newly built local files byte for byte (`data/master-format-audit/production-readonly.json`). No backend import request was submitted.

Local HEAD: `f5c39e901fb1838ef1421de0e359592a61ccf8e2`. Prior verified release report identifies deployed commit `0fc2958589cac88b45181f916684ac60231459b5` and completed migration 004. Comparing that release to local HEAD shows only four report/README changes; `shared`, `server`, `src`, `api` and generated portable schema have **zero diffs**. Current served frontend equality is directly verified. Exact current provider deployment SHA and production DB schema were **not independently re-queried**; backend schema equivalence is supported by unchanged release source and prior rollout evidence, not certified by this public GET audit. No observed deployed importer/frontend difference.

## FINAL PLAIN-LANGUAGE ANSWERS

1. **Can the two masters be the permanent reference?** Yes, as educational/design references with your exclusions. Their legacy JSON is not the upload contract; current generated schema and runtime validation define accepted syntax.
2. **Which features are fully supported?** Stems, multipart/nested/no-part structure, exact marks, medium difficulty/classification, LaTeX, generic per-scheme instructions/givens, ordered worked steps/final results/marking descriptions, progressive question/part hints, captions and original embedded question/answer/FBD bytes with private storage and explicit ownership.
3. **Which need implementation?** First-class marking codes, step-linked adjacent hints, dynamic matched question/answer numbering and polished print template; also printed topic/difficulty/course-semester header, final total/footer, compact FBD layout, nested answer labels and optional global multipart intro.
4. **Will original source question numbering be discarded?** Yes in the documented authoring contract; omit source-number/code/title metadata. No source-number field exists.
5. **Will customized sets use dynamic Question 1, 2, 3?** Not yet. Order is preserved, but numbers need renderer implementation.
6. **Will working-space lines be omitted?** Yes; no such field or print section is generated.
7. **Will source sets be omitted?** Yes in compliant conversion; no source-set field/header generated.
8. **Will source year/session be omitted?** Yes; keep only legitimate curriculum version classification.
9. **Will SP015 be omitted from JSON/export?** Yes in this contract and the golden/test outputs; no portable requirement or hard-coded export source header. Arbitrary legacy/free text is not automatically scrubbed.
10. **Will Semester 1 / Semester 2 remain permanent?** Yes, exactly those accepted values.
11. **Can one JSON contain a question diagram and answer FBDs?** Yes; the golden demonstrates one plus two with explicit placements.
12. **Are visuals automatically stored in Private Blob?** Yes on hosted commit when existing private storage is configured. Preview does not upload. This audit used local disposable storage only.
13. **Does it preserve raster bytes?** Yes for accepted PNG/JPEG/WebP; exact browser-to-authenticated-retrieval identity was verified locally.
14. **Can it prove original-PDF origin?** No. Byte identity/security is verified; origin is established by extraction and human source review.
15. **Can ChatGPT create future JSON without Codex?** Yes for supported features, with current taxonomy and PDF/image/hash/file tools. Not all ChatGPT environments provide those tools, and unsupported codes/step hints cannot be faked.
16. **Can the browser generate question/answer PDF without AI tokens?** Yes using Print / Save as PDF, canonical content/assets and KaTeX; the current visual template is incomplete.
17. **What must still be built?** Separate markingCode persistence/schema/migration/UI; validated step targets for hints with persistence/UI; transient selected-order numbering shared by answers; a browser A4 print template with canonical headers/topic/difficulty, compact original FBD placement, coherent breaks, answer total and page footer. No source PDFs, source identities or working-space fields are needed.

**Ready to convert real PDFs?** The secure one-file draft importer is ready for its existing supported subset. Do not begin permanent full-master imports that must preserve marking codes and exact hint-step association until those semantic gaps are implemented. Preparing real source material outside Production is possible, but this audit performs and authorizes no real import. The master contract is now documented; full application compliance is not yet achieved.
