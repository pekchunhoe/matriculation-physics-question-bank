# Paired-image architecture

The existing Express API, administrator sessions, CSRF, durable rate limits, security headers, private Blob storage, Turso adapter and curriculum hierarchy are retained. Students have read-only access to current approved image records in active or retired (published) syllabus versions. A matching approved revision snapshot is required for public records, counts, export and image delivery.

## Additive schema version 6

`006-image-questions.sql` adds `image_assets`, `image_questions` and `image_question_versions`, indexes, immutable history guards and curriculum move guards. Original migrations and legacy content tables are unchanged. Existing `subtopics` already supports parent-topic foreign keys; the new question table requires a subtopic and enforces its matching topic through a composite foreign key. Its ancestor chain determines syllabus, semester and chapter. No academic subtopic or question is fabricated. Existing curricula and records remain intact.

Each original asset stores immutable bytes, MIME, dimensions and SHA-256. Question thumbnails are separately derived for browsing. A save validates both images and the complete hierarchy before upload, then commits both associations and a snapshot in one database transaction. Optimistic revision checks occur again inside the transaction. A legacy conversion uses its existing ID without changing the legacy row. New image records are drafts.

Approved edits require explicit replacement confirmation; they atomically replace the approved image pair and preserve previous revisions. Publication and archiving are separate confirmed actions. There is no permanent question deletion API. Legacy candidate-review records remain in the preserved tables; the obsolete structured-content candidate editor is removed.

## Browser PDF

`src/image-pdf.ts` loads original approved images sequentially with size, MIME and SHA-256 checks. It uses PDF-lib, preserves aspect ratio, and clips overlapping tall-image segments on A4 pages. One shared curriculum ordering supplies consecutive question and answer numbers. PNG/JPEG bytes are embedded; WebP is decoded to PNG in the browser. Limits: 50 questions, 64 MiB compressed unique image payload and 400 pages. These limits bound work but do not guarantee low-memory mobile devices can export every maximum-sized set. A failed export offers no partial download.

## Release boundary

This checkout is not deployed. Do not run production migrations or change production environments from the local verification commands. Before any release: review the complete diff, back up cloud database and private originals, test migration 6 on a separately verified disposable copy, validate the Linux/Vercel Sharp runtime and protected Preview, populate authoritative subtopics, and obtain explicit rollout approval. The old deployed binary and schema remain production rollback references. Do not roll back by deleting image tables or historical data.

Legacy approved structured records require administrator-supplied image conversion and publication before appearing in the new student bank. Inventory those records before rollout. Keep the legacy archive and database backups until the owner explicitly authorizes a separate retention decision.
