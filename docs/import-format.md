# Structured JSON import/export v1

`docs/question-v1.schema.json` describes the canonical document shape. The strict runtime schema in `shared/schema.ts` is authoritative, including relational, LaTeX and approval checks that JSON Schema cannot express.

An export is a complete structured document with these top-level fields:

| Field           | Purpose                                                                       |
| --------------- | ----------------------------------------------------------------------------- |
| `schemaVersion` | Exactly `1`                                                                   |
| `question`      | Stable code, topic/subtopic IDs, authored metadata and availability flags     |
| `parts`         | Stable part IDs, label, prompt, marks, order, nullable parent ID              |
| `solutions`     | Part ID, solution, LaTeX equation, teacher notes and solution steps           |
| `hints`         | Stable ID, nullable part ID, hint text and order                              |
| `assets`        | Stable ID, nullable part ID, kind, URL, alternative text, MIME type and order |
| `tags`          | Array of tag strings                                                          |

All fields shown in the schema are required unless explicitly optional. Use `null` for absent subtopics and question-level hint/asset references. Use empty arrays for absent hints/assets/tags. Use an empty string for optional equation or teacher notes. An approved question requires a solution for each leaf part; draft content may have no solutions.

The code must contain uppercase letters, digits and hyphens, be 3–80 characters, start with a letter/digit and be unique. Examples such as `SP015-S1-MOM-012` describe the coding convention and are not seeded questions. After creation the code cannot be changed, even if classification later changes.

Difficulty is identified by the controlled record ID (`easy`, `medium`, `hard` initially). It is preserved verbatim; imports never infer or replace it. Status values are `draft`, `reviewing`, `approved`, `retired`. Marks are nonnegative integers; the question total must be positive. The app warns when part totals or solution-step allocations differ and never changes them.

## Contextual classification

With multiple versions, additionally supply `classification.curriculumVersion` by ID or code to disambiguate same-named semesters. Stable topic/subtopic IDs remain authoritative; conflicting ancestry is rejected. See [curriculum JSON](curriculum.md) for taxonomy imports and [provenance v2](production-and-pilot.md) for the optional question envelope. Original v1 exports remain accepted unchanged.

Instead of knowing taxonomy IDs, an import can additionally supply:

```json
{
  "classification": {
    "course": "Matriculation Physics",
    "semester": "Semester 1",
    "chapter": "<existing authoritative chapter name>",
    "topic": "<existing authoritative topic name>",
    "subtopic": "<existing optional subtopic name>"
  }
}
```

This is an additional object on the complete canonical document, not a standalone import. Course/semester/chapter/topic are required in this object. Omit subtopic when absent. Each value resolves by ID, stable slug, or a case/spacing-normalized display name under the selected parent. If using classification instead of IDs, omit `question.topicId` and `question.subtopicId`; the resolver supplies them. If supplying both, they must agree. Unknown names or inconsistent parents fail; the resolver never creates taxonomy.

## Mathematics

In `equationLatex`, store raw LaTeX without `$` delimiters. JSON requires doubled backslashes: `"N = \\frac{mv^2}{r}"`. Prompt/scenario/solution/hint text can include `$inline LaTeX$` or `$$display LaTeX$$`. The shared validator parses equation fields and delimited expressions using KaTeX, while rendering disables trusted HTML commands. Literal text, numbers and units remain unchanged.

## Assets

Upload files using the editor before referencing local `/uploads/<unique-file>` URLs in JSON. Supported kinds: `illustration`, `physics_diagram`, `fbd`, `graph`, `vector_diagram`, `circuit_diagram`, `answer_diagram`, `reference_image`, `original_pdf`, `question_pdf`, `answer_pdf`. PDF kinds require `application/pdf`; all other kinds require an image MIME type. Provide descriptive alternative text. File bytes are separate from JSON and must be preserved with backups.

New managed files use opaque `/uploads/<UUID>-<SHA256>.<extension>` references for both local files and hosted private Blob objects. Raw Blob URLs are rejected; do not export storage credentials or signed delivery URLs. Legacy local links remain compatible. Hosted upload/delivery stays disabled until server-side authorization exists. Other valid external HTTPS references remain author-managed. See [private asset storage](ASSET_STORAGE.md) for validation, staged-upload retention and setup.

## Review

Choose **Create new question** for a new code. A duplicate code fails. Choose **Revise existing question with this stable code** to revise an existing master. The import UI validates and displays the structured content before saving; an explicit confirmation and revision note are required. Revisions to approved questions remain candidates until a named teacher approves the comparison. Historical snapshots remain viewable.
