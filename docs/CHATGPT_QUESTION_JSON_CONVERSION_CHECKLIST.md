# ChatGPT PDF-to-Question JSON conversion checklist

Read `docs/QUESTION_JSON_AUTHORING_STANDARD.md`, `docs/question-json-import.schema.json` and `examples/question-import/GOLDEN_QUESTION_IMPORT_REFERENCE.json`. The master JSON/PDF are design/content references; their legacy field names are not accepted upload syntax. Runtime validation is the final authority. Deliver one file without requiring Codex per question, provided the ChatGPT environment can inspect PDFs, extract visual bytes, calculate hashes and create a downloadable JSON file.

1. Read AND render the selected PDF pages, including answer pages. Visually inspect notation, hierarchy, labels and every figure; text extraction alone is insufficient.
2. Treat PDF question and answer content as authoritative. Never guess missing answers, force directions or illegible mathematical symbols.
3. Extract the selected question only, with its complete answer scheme and relevant figures.
4. DISCARD the original source question number and source-derived permanent IDs. Use an unnumbered descriptive title; normally omit `questionCode`.
5. DISCARD source set name/number and paper series/organization.
6. DISCARD source year/session. Keep curriculum-version identity distinct from paper date.
7. DISCARD SP015/SP025 and equivalent source codes from Question JSON and export presentation. Do not change historical curriculum records.
8. DISCARD student working-space layout, ruled lines and deliberately reserved blank areas.
9. DISCARD source-PDF provenance: filename/hash/page/xref/source question identity. Do not hide it in tags/captions/notes.
10. Determine the canonical curriculum version using current website taxonomy or a supplied verified taxonomy. Do not infer it from paper year.
11. Use permanent `Semester 1` or `Semester 2` identity.
12. Resolve exact chapter/topic/subtopic names under the correct parents. Use `subtopic: null` when none exists; never invent taxonomy. Preserve meaningful original figure labels inside educational visuals.
13. Determine difficulty and use the exact database spelling (`Medium`, not master `MEDIUM`, for the current medium level).
14. Preserve exact total and part/step mark allocations as integers. Supply a reasonable positive `estimatedMinutes` and supported `questionType`.
15. Preserve part hierarchy using flat local IDs, `parentId`, labels and sibling order. No-part questions use `parts: []` and `partId: null` solutions.
16. Convert ALL mathematics accurately to LaTeX. Use `$...$`/`$$...$$` in prose, undelimited pure math fields, and escaped JSON backslashes. Convert legacy Markdown/`\(...\)` appropriately. Malformed math must fail validation; do not create equation images.
17. Extract the complete answer scheme: generic convention/instructions/given values in solution blocks, reasoning, worked equations and final answers in relevant steps.
18. Preserve exact marking codes using optional solution-step `markingCode` (1–24 letters/digits or `+ . _ / -`, starting with a letter/digit). Do not put codes into notes, hints, prose, marking points or numerical marks. Omit absent codes.
19. Preserve sequential worked solution steps with `number`, `order`, `explanation`, `equationLatex`, `working`, `markingPoint`, `marks`, and optional blocks. Use exactly one solution per leaf part or one whole-question solution for a no-part question.
20. Preserve QUESTION, PART/subpart and SOLUTION STEP hints. Give targeted steps a unique package-local `id`; set hint `solutionStepId` to that key and `partId` to the same solution owner. Never use array position or hint prose to encode linkage. Hints sort by authored `order`, unique within each target; multiple hints per step are supported. Existing question/part hints omit `solutionStepId` or set it to null.
21. Detect EVERY meaningful educational visual, including question/answer diagrams, FBDs, graphs, circuits, ray/vector/geometry/apparatus diagrams and visual tables.
22. Extract EACH diagram/FBD FROM THE ORIGINAL PDF. Prefer original embedded raster/object bytes; otherwise render a sufficiently high-resolution exact source region and crop only that original region.
23. NEVER redraw/regenerate/AI-generate/beautify/reinterpret/OCR-reconstruct/relabel/reposition/recolor visuals or alter arrows, origins, forces, geometry, axes or annotations. Remove only unrelated outer whitespace/headers/footers/page numbers/neighboring text.
24. Use lossless PNG when rasterizing PDF line diagrams/FBDs; preserve original raster bytes when safely extractable. Do not unnecessarily use JPEG for line art. Current accepted SVG bytes are unchanged, but unsafe SVG is rejected; future sanitization may change bytes.
25. Embed all visual bytes inside the ONE JSON package as canonical `dataBase64`; no separate user image uploads, external URLs or placeholder assets.
26. Calculate actual `byteLength`, lowercase SHA-256 and MIME from exact bytes. Verify Base64 decodes back to those bytes. Respect 8 assets, 3 MiB combined decoded data, 384 KiB manifest and 5 MiB package limits.
27. Put question visuals only in question/part content blocks. Every asset needs one explicit placement; neutral `assetId` references equal package asset keys.
28. Put answer/FBD visuals only in answer solution/step blocks, beside or directly near relevant force equations. Preserve explicit block order and original bytes. Step/image print rules avoid separation when reasonably possible; oversized steps may flow across pages. Answer-only visuals never appear in question-only output.
29. Do NOT embed the whole source PDF or its export/layout contract. Canonical storage is structured content and private original visual assets.
30. Validate all mark totals: parents equal direct children, roots equal question total, each leaf's steps equal leaf marks; do not double count parent aggregates. Validate syntax, all LaTeX, local references, asset ownership and exact taxonomy/difficulty. The machine schema alone cannot check every rule.
31. Output ONE self-contained `.json` with only official fields, not a real-source legacy master clone. Include no source numbering, ruled work space, set/year/course code/provenance. Review the rendered content against the PDF before upload.

On the website: Paste JSON or Upload one .json → Validate & Preview → review question, classification, difficulty, totals, parts, equations, solutions, hints and every visual → acknowledge review → Import as Draft. This does not approve/publish content. The importer verifies byte integrity, not that an image originated from the PDF; preparation and human review establish origin.

Set preview/export generates dynamic Question 1, 2, 3 strictly from current selected order, with the same mapping for answers and page footers; reorder/removal renumbers without database writes. Browser Print / Save as PDF uses the A4 Master-style canonical header/topic/difficulty/marks, ordered steps, marking codes, adjacent optional student hints, final totals and page counters. No working space, SP015/SP025, source set/year, provenance or source question numbers are generated. Export uses zero AI calls/tokens, and stored visual bytes are unchanged. Migration 005 passed separately authorized production backup and preservation checks; see the [rollout report](../MASTER_FORMAT_FIDELITY_PRODUCTION_ROLLOUT_REPORT.md) for application release status. No real import is authorized by implementation or rollout.
