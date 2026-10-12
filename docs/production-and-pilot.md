# Controlled protected Preview sequence

The image-bank refactor is locally verified and requires additive schema migration 006. It has not been committed, pushed or deployed. Production remains on migrations 001-005. Existing deployed questions and original data must remain untouched.

1. Review the complete intended diff and the refactor report. Keep historical reports, local verification evidence, original source files, databases and credentials out of the release commit. Preserve the existing security history. Obtain approval for the feature release and any separate resource or environment changes.
2. Provision a disposable Turso database and a separate private Blob store or rigorously isolated approved namespace. Independently verify database identity, ownership and connection targets. Do not assume existing Preview credentials are isolated. Never migrate the production-backed Preview target.
3. Back up any data copied into the disposable database, record its logical/schema hashes, and apply the existing explicit migration runner through 006 only to that verified isolated target. Assert migrations 1-6, integrity and foreign keys; compare all original legacy rows. Do not erase or rewrite legacy records.
4. Bootstrap a test administrator only in that disposable database. Use clearly labelled test curriculum and image pairs. Review authoritative subtopics separately; do not fabricate production academic classification.
5. With separately approved Preview-only configuration, deploy the reviewed feature commit to a protected Vercel Preview. Verify the exact SHA and protection. Check Sharp's native Linux runtime, original private-image delivery, secure cookies, CSRF/CSP and required metadata validation.
6. Re-run hosted administrator upload/edit/revision/publication/archive, student access restrictions, image persistence, numeric curriculum ordering, 1/5/20/50-question PDF exports and tall/whole-page images. Perform hosted writes only after isolation is proven. Record blocked tests honestly.
7. Stop and report. Production rollout, production migration, production environment changes and publication require separate explicit approval. Retain old deployment, immutable legacy tables and backed-up originals as recovery references; rollback must not drop image tables or history.

For a read-only Preview using unverified backing data, do not bootstrap, upload, publish, migrate or run write fixtures. Such a Preview cannot establish full hosted readiness for the new schema.
