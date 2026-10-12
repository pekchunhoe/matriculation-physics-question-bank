> Historical baseline for the earlier structured-question release. Current image architecture and release requirements are documented in [architecture.md](architecture.md) and [the refactor report](../IMAGE_BANK_REFACTOR_REPORT.md).

# Authorization audit before implementation

Audit date: 2026-10-09. The working tree was clean. Production was not accessed.

| Method            | Route                                                                   | Previous access                                     | Required access                                                 | Sensitivity                                       |
| ----------------- | ----------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------- |
| GET/HEAD          | `/api/health`                                                           | Public, database check                              | Public                                                          | Safe status only                                  |
| GET               | `/api/taxonomy`, `/api/curriculum-versions`                             | Public, all versions                                | Public published curriculum; admin all                          | Draft curriculum                                  |
| GET               | `/api/counts`                                                           | Public all-status counts                            | Public approved counts; admin all                               | Private record counts                             |
| GET               | `/api/questions`                                                        | Public, client controls status                      | Public approved only; admin all                                 | Draft/reviewing/retired summaries and source URLs |
| GET               | `/api/questions/:id`                                                    | Public any ID/version; view flag controls filtering | Public current approved with notes/source stripped; admin all   | Full snapshots, teacher notes                     |
| GET               | `/api/questions/:id/export`                                             | Public full/provenance export                       | Admin                                                           | Private content/history                           |
| GET               | `/api/questions/:id/versions`, `/revisions`                             | Public                                              | Admin                                                           | Immutable history, candidates, authors            |
| GET               | `/api/taxonomy/:kind/:id/impact`, `/api/curriculum-versions/:id/impact` | Public                                              | Admin                                                           | Draft IDs, candidate impact                       |
| GET               | `/api/curriculum-versions/:id/export`                                   | Public                                              | Admin                                                           | Administrative export                             |
| POST/PUT          | `/api/questions`, `/api/questions/:id`                                  | Local unguarded; hosted blanket 403                 | Admin                                                           | Questions, schemes, hints, taxonomy links         |
| POST              | `/api/import/validate`, `/api/import`                                   | Local unguarded; hosted 403                         | Admin                                                           | Authoring import                                  |
| POST              | `/api/revisions/:id/review`, `/api/questions/:id/pdf-revision`          | Local unguarded; hosted 403                         | Admin                                                           | Approvals and source PDFs                         |
| POST/PATCH/DELETE | `/api/taxonomy/:kind[/:id]`                                             | Local unguarded; hosted 403                         | Admin, existing retirement rules                                | Curriculum                                        |
| POST/PATCH/DELETE | `/api/curriculum-versions[/:id]`                                        | Local unguarded; hosted 403                         | Admin, existing history rules                                   | Curriculum versioning                             |
| POST              | `/api/curriculum/import/validate`, `/api/curriculum/import`             | Local unguarded; hosted 403                         | Admin                                                           | Curriculum imports                                |
| POST              | `/api/uploads`                                                          | Local unguarded; hosted 403                         | Admin, all existing validation                                  | Staged authoring bytes                            |
| GET/HEAD          | `/uploads/:key`                                                         | Local any stored file; hosted 403/503               | Public current approved non-source assets; admin staged/private | Diagrams, schemes, source PDFs                    |

No dedicated scheme/hint CRUD route exists: edits use question writes. No hard
question deletion exists. No question-set persistence, generated PDF endpoint,
cookie, login, session or student account exists. Existing PDF functionality is
links to uploaded PDFs. Source PDF revision imports deliberately require manual
structured authoring. Teacher/student UI modes are presentation only.

Critical: unrestricted local authoring has no identity boundary. High: public
status/ID/version/export/revision reads expose private authoring content; source
URLs and teacher notes leak; local asset delivery ignores owning visibility.
Medium: no durable login/session/abuse model exists for enabling hosted writes;
origin checks compare host only and accept absent Origin; responses lack private
cache separation; hosted upload validation allows files above platform limits.
Low: all visitors see active authoring navigation; there is no public selection
and print workflow despite the desired product policy.

Already safe: server-only Turso credentials and parameterized SQL, transactional
content writes, immutable question/classification history, guarded retirement,
Private Blob namespace/validation/digests, no raw Blob URLs, no hosted filesystem
persistence, native ESM checks. These mechanisms are retained.

Implementation decision: migration 003 adds only admins, digest-only sessions and
durable throttle buckets. Node's built-in scrypt uses an OWASP-listed memory/CPU
profile; random sessions have finite expiry and revocation. Same-origin mutations
require exact Origin plus a custom header and SameSite cookies, without CORS.
Every authoring route requires a database-validated admin. Public reads force
current approved visibility; marking schemes/hints are public, teacher notes and
source archives private. Public assets require an approved current relationship.
Client selections use a bounded public resource endpoint and browser Print/Save
as PDF; no persistent authoring permission is needed. Tests remain isolated;
migration/bootstrap/deployment are separate manual steps.
