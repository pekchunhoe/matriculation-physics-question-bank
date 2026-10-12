# Editable curriculum

Migration `002-curriculum.sql` adds curriculum versions between courses and semesters. Semesters retain `course_id` and add `curriculum_version_id`; database triggers validate membership. Existing chapter/topic/subtopic parent keys and question topic/subtopic references are unchanged. Full question ancestry is derived relationally.

Existing semesters receive code `LEGACY`, name **Existing curriculum (unversioned)** and no invented dates/year. This labels existing data, not an official syllabus. No chapters, topics or questions are seeded.

## Version lifecycle and editing

In **Curriculum**, create an empty draft or clone an existing hierarchy using your supplied code/name. Cloning creates new taxonomy IDs, preserves names/order/status/test labels and copies no questions. Semester slugs are version-specific because the original database scopes their uniqueness by course.

Versions have optional ISO effective dates, order and draft/active/retired status. Only one version can be active per course. Activation requires impact review and transactionally retires the previous active version; its question count is displayed. Retirement preserves hierarchy/history. Reactivation uses the same control. An active version cannot return to draft.

Browsing defaults to the active curriculum. Dependent dropdowns select version, semester, chapter, topic, subtopic and difficulty. Changing a parent clears child selections; changing version or semester also clears a student question selection. Numeric stored order determines browsing and PDF order, with stable Question ID as the final tie breaker. Retired versions remain available, while drafts remain administrator-only.

The existing add form remains. New semesters select their course/version; other records select a parent. New records cannot be added under retired ancestry/version. The edit form supports rename, nonnegative integer display order, retire and restore for all four levels. IDs/slugs stay stable; normalized names remain unique under their parent/version. Retirement does not change question status/content. Restoring a child does not restore its ancestors.

Impact previews show current questions, distinct historical questions, pending revisions and descendants. Edits require a note, current revision and token; referenced changes require confirmation. Concurrent taxonomy/question changes invalidate the preview. Unreferenced chapters/topics/subtopics may move within one version, including between semesters. Referenced subtrees cannot move. Use a new cloned/imported version for major syllabus changes, splits and merges. Reclassifying a question uses the existing reviewed editor workflow. Semester course/version membership is stable. Permanent hierarchy/version deletion is blocked by API and database triggers; retire instead.

## Historical provenance

Image question history captures the full classification alongside each immutable pair snapshot. Existing legacy question snapshots and their classification companion table are preserved. Renames change current browsing labels without rewriting historical labels.

Pre-migration names were never recorded. Migration reconstructs old classifications from available taxonomy and labels them `reconstructed`; names changed earlier cannot be recovered. If history references missing taxonomy, migration rolls back explicitly. Restore missing records from backup rather than deleting history. `curriculum_events` logs before/after metadata, note and time. New question assignments cannot use retired ancestry; existing questions may retain their retired classification when revised. No authored Physics values are repaired or inferred.

## JSON import/export

See [curriculum-v1.schema.json](curriculum-v1.schema.json) and `shared/curriculum.ts`. Imports create a new draft in an existing course; no merge/overwrite occurs. Add a course with the existing form if needed. Empty template (no authoritative syllabus):

```json
{
  "schemaVersion": 1,
  "course": { "id": "matriculation-physics", "name": "Matriculation Physics" },
  "curriculumVersion": {
    "code": "YOUR-CURRICULUM-CODE",
    "name": "Your supplied curriculum name",
    "effectiveFrom": null,
    "effectiveTo": null,
    "status": "draft",
    "order": 0
  },
  "semesters": []
}
```

Semester fields are `{id?, slug?, name, order, status, isTest, chapters:[]}`; chapters instead have `topics:[]`, topics have `subtopics:[]`, and subtopics have no child array. Item status is active/retired. Set `isTest:false` for authoritative data. Course ID/slug/name must agree with an existing record. Codes use 2–80 uppercase letters/digits/hyphens and are unique per course.

Read-only preview assigns missing IDs/slugs and returns normalized JSON, counts, warnings and token. Review the hierarchy, supply a note/confirmation, and apply that document/token. Concurrent changes invalidate it. Inserts are transactional; failures leave no partial import. Limits: 10,000 records and the existing 5 MB request limit.

Exports preserve hierarchy, IDs/slugs, order, statuses, test labels and version metadata. They omit questions, file bytes, edit events and secrets. For a changed copy, use Clone or a new code/draft status with existing IDs omitted and new/version-specific semester slugs. Export is not an overwrite or full-database restore tool. Disaster recovery uses a consistent database/files backup.

| API                                       | Contract                                                                                         |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `GET/POST /api/curriculum-versions`       | List; create `{version, note, author?}`; optional cloneFromId                                    |
| `GET /api/curriculum-versions/:id/impact` | References, previous active/count, revision/token                                                |
| `PATCH /api/curriculum-versions/:id`      | Name/dates/status/order plus expectedRevision/impactToken/confirmImpact/note/author?             |
| `GET /api/curriculum-versions/:id/export` | Curriculum JSON v1                                                                               |
| `POST /api/curriculum/import/validate`    | `{document}` → read-only normalized plan                                                         |
| `POST /api/curriculum/import`             | `{document, token, note, author?}` → atomic draft                                                |
| `GET /api/taxonomy/:kind/:id/impact`      | References, revision/token                                                                       |
| `PATCH /api/taxonomy/:kind/:id`           | Optional name/order/status/parentId plus expectedRevision/impactToken/confirmImpact/note/author? |
| Hierarchy/version DELETE                  | Rejected; retire instead                                                                         |

Existing taxonomy POST accepts optional `curriculumVersionId` for semesters; legacy callers default to the course's active version. Semester `parentId` still means course ID.

## Migration safety

Migration 002 was tested only on isolated banks and a populated v1 fixture. It was not applied to real local/production data. Before the first updated start, stop the old server, back up the complete data directory and rehearse on a copy. Startup applies migrations once inside transactions. Migration 001 is unchanged. Migration 002 adds/backfills columns/tables/indexes/triggers without resets, ID changes or rewriting original question snapshots/content/assets. Large banks require time, disk space and a write lock. There is no destructive down-migration; recovery uses the consistent backup.
