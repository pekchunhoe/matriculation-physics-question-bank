# Public PDF and Word export

Select up to 20 approved questions in the public Question Bank and choose **Prepare question set**. On the same page choose **Export format** (PDF by default, or Word (.docx)) and **Document** (Question by default, or Answer Scheme with Student's Hints), then **Export**. Empty selections cannot export. Removing a selected item renumbers the remaining selection. Both native dropdowns support keyboard and mobile use; status and errors are announced.

PDF opens the device's print dialog. Choose Save as PDF; the suggested document title is a neutral filename such as `matriculation-physics-semester-1-questions`. The browser and its print settings control the final saved PDF filename. Word downloads a real Office Open XML `.docx`, constructed on the device. No separate export page, server Office service or AI service is needed.

## Syllabus order and shared numbering

`shared/export-plan.ts` builds one plan from the selected public canonical documents and current taxonomy. It uses the canonical `Taxon.order` values, which come from database `sort_order`, for semester → chapter → topic → subtopic. It never sorts by title, marks, difficulty, source numbering or selection click order.

When sibling curriculum positions tie, their stable taxonomy IDs resolve the tie and keep each group together. Questions without a subtopic come first within their topic, followed by subtopics in canonical order. No artificial subtopic is created. There is no pedagogical question-order column; only within the exact same classification, stable canonical question ID provides the final deterministic ordinal string comparison. It is not the primary sorting key. Invalid/missing classification blocks export.

Display numbers are assigned 1 through N after sorting. PDF Question, PDF Answer, Word Question and Word Answer consume this same plan. Reversing selection clicks has no effect; removing a question produces consecutive numbers. The plan includes question ID, display number, semester, chapter, topic, nullable subtopic and their order positions. All are ephemeral; export changes no database record or identity.

Semester/chapter/topic/subtopic labels appear when entering a new group. The full hierarchy is not repeated before each question within the same group.

## Document modes and eligibility

Question contains stems, parts, question visuals and exact marks. It excludes solutions, final answers, marking codes, all hints, teacher notes and answer-owned diagrams/FBDs. The public API removes answers, hints and answer assets before Question mode receives data; the shared content builder also enforces asset ownership.

Answer Scheme with Student's Hints contains only the answer side, with the same question numbers, part references, introductions, worked steps, equations, marking codes, ordered general/part/step hints, original answer diagrams/FBDs and total marks. Teacher notes remain excluded.

Both export actions re-fetch the selected set through the existing approved-public endpoint immediately before generation. Draft/reviewing/retired questions and ineligible hierarchy records fail under the existing public visibility policy, including for administrators. An old preview cannot bypass this recheck. Only selected IDs enter the plan. Assets are obtained through mediated `/uploads/...` delivery and embedded as bytes; no private Blob URL or external image relationship appears in Word.

## Layout and content parity

`shared/export-content.ts` creates the educational content model used by PDF and Word: ordered prose, editable math, original images, step awards and hints. Canonical administrator-selected difficulty and exact validated marks are preserved. The source PDF is not replayed or embedded.

PDF retains KaTeX mathematics, A4 portrait, normal margins and page counters. Word uses A4 with academic fonts, paragraph styles and page fields. Both flow consecutive questions/answers naturally, with one normal section margin and no page per question, fixed page-height container, reserved working space or multiple empty paragraphs. Headings stay with following content; small diagrams/captions and FBD/equation groups stay together where practical. Oversized print groups can split. Pagination can differ between Word versions and browsers.

No SP015/SP025, paper sets, source years/sessions, original source question number, PDF filename/provenance or student working-space layout is generated. Filenames use only Matriculation Physics, an optional single-semester scope and question/answer mode; mixed-semester sets use a neutral name.

## Word mathematics and images

LaTeX is validated and rendered to structured MathML by KaTeX, then mapped to native Office Math (OMML). Fractions, sub/superscripts, indexed roots, Greek letters, vectors/common accents, scalable brackets, degrees, SI units, negative exponents, aligned equations/matrices and boxed results are editable equations. Ordinary prose is editable Word text. No equation, prose or whole page is rasterized for mathematics.

The converter is deliberately bounded, not a claim of support for every KaTeX construct. Unsupported MathML, cancellation/phantoms, custom color/style, negative mathematical spacing, unsupported accents/enclosures and irregular equation tables fail explicitly with an instruction to choose PDF or revise the equation. It validates all equations before image retrieval and never downloads a partial Word file. PDF remains available for supported KaTeX content outside this Word subset.

PNG/JPEG bytes are embedded unchanged with preserved aspect ratio. SVG originals are embedded with an original SVG relationship and a device-rendered PNG compatibility preview. WebP originals are retained in the package with a device-rendered PNG representation for Word compatibility. These export-only representations do not change permanent assets. Images use alt text and authored captions. Resource limits prevent unbounded image decoding or packages; unusually large selections can be exported in smaller groups.

Local QA reparses DOCX independently and renders representative files with LibreOffice. Native alignment uses equation arrays with run alignment properties. LibreOffice's preview preserves the mathematical values but omits the border decoration of native boxed results; the DOCX retains the Office Math border-box structure. Microsoft Word desktop rendering has not been independently verified in this local QA run.

The Word ZIP dependency is `fflate`; the Word generator loads only when selected. Normal generation makes zero OpenAI/LLM/image-generation calls and uses zero server AI tokens.

Primary format references: [KaTeX MathML output](https://katex.org/docs/options), [Microsoft OfficeMath structures](https://devblogs.microsoft.com/math-in-office/officemath/), and [Microsoft LaTeX/OMML support](https://learn.microsoft.com/en-us/office/math/latex).

## Local verification

Tests cover all four combinations, hierarchy order contrary to alphabetic/click order, null and ordered subtopics, deterministic ties, removal, mode isolation, native equations, OOXML namespace validity, internal media relationships, byte preservation, compact PDF layout and responsive accessible controls. Independent DOCX parsing and PDF text/page inspection complement visual page review. Production rollout requires separate authorization; implementation does not deploy, migrate or import real questions.
