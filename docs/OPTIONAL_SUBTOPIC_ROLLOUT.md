# Optional subtopic: migration and original-website rollout

Prepared 13 October 2026. Production execution requires separate explicit approval. This plan supersedes earlier instructions requiring an authoritative subtopic before uploading.

## Behavior and schema

Syllabus, semester, chapter, topic, difficulty, positive integer marks and both images remain required. Subtopic accepts a valid ID, null, omission or blank text; blank values normalize to SQL NULL. When supplied, the subtopic must belong to the selected topic and its complete syllabus hierarchy. Editing preserves the Question ID and assets, increments the optimistic revision and records an immutable snapshot with a nullable classification. Legacy conversion also permits no subtopic.

Migration `007-optional-image-subtopic.sql` leaves migration 006 unchanged. It reconstructs `image_questions` and its referencing `image_question_versions` together inside the migration transaction, copies all rows verbatim, then restores indexes and triggers. Only `image_questions.subtopic_id` becomes nullable; a check rejects empty identifiers. The required topic foreign key and composite `(subtopic_id,topic_id)` foreign key remain. All image, difficulty, legacy-ID, status, marks and revision constraints remain. No changes to `subtopics` or historical JSON snapshots are needed. Foreign-key checking remains enabled, with deferred validation and an explicit pre-commit check. Failure rolls back DDL and rows; inspect actual state before retrying an uncertain commit.

Student browsing uses a left join and retains null-subtopic questions in ordinary, chapter and topic searches. A specific subtopic filter selects only that subtopic. PDF ordering remains curriculum order; unassigned questions come first within a topic, followed by subtopic order, then stable Question ID. Questions and answers share the same ordered selection and numbering.

## Isolated Preview first

Reuse `physics-image-preview-20261012` (`prj_Q3TSUyjfmTZ9SAaFHE5MF3qdxagR`), database `phys-preview-image-20261012` and private store `store_cbLbAb1k796zV0Sl`. Verify exact project, Preview target, feature branch, source SHA, Vercel Authentication, branch-scoped Secrets, effective database/store identities and denied Production access before any hosted write.

Capture an encrypted, consistent database backup including authentication and revision history; restore it locally and rehearse migration 007. Compare every existing logical row, indexes, triggers and foreign keys. Before applying, recheck the backup against current data inside the write transaction; if anything changed, refresh the backup and rehearsal. Apply only 007 to schema 6. Verify integrity, preserved records and migration markers. Do not create replacement services or reset the administrator password.

The old Preview build requires schema 6 and cannot be reused after the schema-7 migration. Prepare the replacement Preview first, then migrate and verify its health. Use the new protected URL after cutover. Hosted tests must create a real question/answer pair with Subtopic blank and exercise adding/clearing subtopic, publication, browsing, filtered selection, PDF numbering and security. Preserve all pre-existing user data.

## Permanent Production targets and gates

Keep the original domain `matriculation-physics-question-bank.vercel.app`, Vercel project `prj_Ifh8Q46BCQWi7ENgkayhQUDwQ5Ov`, Turso database `matriculation-physics-question-bank` and private Blob store `store_El7fbP5PEpIgQK5i`. Never copy disposable credentials, test accounts, questions or images into Production. Existing OIDC storage and administration remain in place.

1. Obtain approval for the exact verified application commit, migrations, maintenance window, original-project deployment, first real upload and recovery procedure. The 13 October read-only Production audit found migrations **1–5**. Re-audit before execution: schema 5 needs **006 then 007**, schema 6 needs **007**, and schema 7 needs verification only. Stop on unexpected history or drift.
2. During an approved write freeze, create an encrypted full Production backup and existing Blob inventory. Verify a local restore, all logical data, authentication records, schema, migration history and foreign keys. Record current deployment/domain and environment metadata without secrets. Do not assume a provider export is current until compared with live data.
3. Rehearse 006→007 on that exact backup. Review any additional custom indexes, triggers or foreign keys before reconstruction. Do not run disposable seeding/bootstrap scripts on Production. Confirm original private Blob/OIDC compatibility; no image migration, store replacement or credential change is required by this feature.
4. Stage the verified commit in the ORIGINAL Vercel project with Production bindings and domain assignment suppressed, after approval. Pin the exact source tree; keep the permanent domain on the old deployment until the maintenance cutover. Confirm no automatic migrations run during build or request initialization.
5. Apply only missing migrations, preserving existing timestamps and data. Each migration has its own atomic transaction: if 007 fails after 006 committed, the database remains at schema 6. Verify the actual schema and recover deliberately. Check schema 7, all legacy rows/histories, existing administrators, integrity and foreign keys before serving traffic.
6. Promote only the staged original-project deployment to the existing domain. Verify project, commit, database/store identity, administrator login, secure cookies, authorization, CSRF, CSP, private draft images and rejected direct private Blob access. No new Production administrator is needed.
7. Upload the user's approved real question and answer images. Save the required academic fields with Subtopic blank, inspect one stable ID and both images, publish explicitly, then verify student browsing, topic filters, answer retrieval, PDF order and matching numbering. Do not seed synthetic scale-test questions in Production.

## Recovery

Before migration, keep the old deployment and abandon staging if checks fail. A failed individual migration rolls back atomically; re-read versions and fingerprints after transport ambiguity. After schema 7, rolling back only application code to the schema-5 or schema-6 build is insufficient. Prefer a reviewed schema-7 forward fix.

If no writes occurred after the backup, a separately approved restore can return the SAME original database to the verified backup schema and data, followed by its matching application version. Rehearse the restore first and retain the backup; do not substitute a new permanent database. If uploads or edits occurred, freeze writes, capture a fresh backup and all new Blob references, and preserve that work before any recovery. Never delete images or drop new records as an automatic rollback. Reconcile migration history with the restored schema. Production rollback is also outside Preview authorization.
