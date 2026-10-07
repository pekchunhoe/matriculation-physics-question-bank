# Production findings and first-question pilot

Read-only checks on 7 October 2026: [the supplied Vercel frontend](https://matriculation-physics-question-bank.vercel.app/) returned HTTP 200; `/api/taxonomy` and `/api/questions` returned HTTP 404. This checkout has no Vercel API adapter/configuration, hosted database/storage integration or authenticated authorization. No separate backend configuration was supplied during the audit. No production mutation/deployment occurred.

Vite production build succeeds, verifying frontend build compatibility. It does not establish a working Vercel backend. Hosted onboarding requires identifying/provisioning and verifying the durable backend/storage/authentication arrangement. The existing Node 24 SQLite/Express runtime needs persistent database/upload storage. Public exposure requires server-enforced authentication and roles.

## Configuration and security

| Variable      | Meaning                                                          |
| ------------- | ---------------------------------------------------------------- |
| PORT          | Optional local port, default 3000                                |
| BANK_DATA_DIR | Optional database/uploads directory, default data/               |
| NODE_ENV      | Existing production switch; npm start also supplies --production |

`.env.example` contains names/empty values only. All `.env*` files are ignored except the example. Scripts read process environment, not `.env` automatically; set shell variables or explicitly use Node's `--env-file`. No Supabase keys/RLS/storage policies exist. Server configuration is not bundled into the client.

The server binds to 127.0.0.1. Cross-origin browser writes are blocked, but callers without Origin are not authenticated. Student preview removes teacher content; teacher endpoints and uploaded archives have no role-based authorization. These are failures for public hosted use, not hidden security claims. Existing validation, SQL parameters/foreign keys, immutable history, human approval, file size/signature/MIME restrictions, restricted SVG, upload sandbox CSP, nosniff, escaped React text and KaTeX trust:false remain. External HTTPS asset availability is the author's responsibility. Backups must keep database and uploads together. Non-JSON API responses now produce a clear backend-unavailable error.

## Pilot sequence

1. Use the verified local workspace or verify the hosted backend first. Back up data/rehearse migration on a copy. Import the complete authoritative Semester 1/2 hierarchy as one draft. Two partial imports cannot share an existing code: combine semesters into one reviewed document or add the second with the existing form in that draft.
2. Verify all names, relationships, order, statuses/dates against your source. Export a backup; activate after impact review. No official syllabus is supplied by this task.
3. Upload one real question's SVG/images/PDFs through the existing editor. Preserve its approved master PDF as an archive. Supply structured question JSON with explicit classification IDs, difficulty, code, marks, parts, solutions, steps, hints and asset links.
4. Validate/preview ancestry, difficulty and content counts. Compare all authored wording, numbers, units, significant figures, formulae, angles, force directions and diagrams. Review mark warnings; the application never repairs marks or infers difficulty.
5. Verify teacher solutions/marking points/answer diagrams/notes; student parts/diagrams/progressive hints and hidden answers/master PDFs; inline/display mathematics and archive links. Check upload availability and MIME agreement.
6. Save as draft/reviewing if further inspection is needed. An already approved source requires explicit human confirmation and leaf-part answers; an existing draft promotion uses the reviewed candidate workflow.
7. Verify Semester + Topic + Difficulty + Approved, search and URL reload; download v1 and provenance JSON. Rehearse revisions in a disposable copy: approved changes stay pending until named review, with old content/classifications/PDF links preserved.
8. Approve the pilot process before importing more. The model supports future approved-question queries by curriculum/semester/topic/difficulty/marks. No generator/basket/OCR/extraction/accounts/portal was added.

## Question provenance export

Existing Export JSON/default export API remain canonical v1. Download provenance JSON adds `{schemaVersion:2, document:<complete v1 object>, savedClassification:<frozen ancestry object>}`. See [question-v2.schema.json](question-v2.schema.json). Ancestry IDs are validated against existing relationships; historical names do not create identities. New v2 imports preserve supplied frozen labels/provenance. Existing-question revisions use normal candidates and capture local live classification on promotion; imported labels do not rename taxonomy. Physics content stays unchanged; files are not embedded.

`GET /api/questions/:id/export` supports optional `version=<number>` and `provenance=true`. Teacher detail returns savedClassification; student detail omits it and teacher metadata. All three JSON schemas are generated/checked from shared validators with the existing schema scripts.
