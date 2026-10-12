# Original image storage

New question uploads accept exactly one question and one answer image, PNG/JPEG/WebP only, at most 1.5 MiB each and 3 MiB combined. Sharp fully decodes each image, rejects truncated/animated/rotated-orientation images, and enforces width 12,000, height 30,000 and 40 million pixels. Original bytes are preserved. A separate question thumbnail is derived for the list; PDF and preview use the original.

Local development/test storage uses unique immutable filenames. Hosted storage retains the existing private Vercel Blob adapter and scoped, sanitized opaque application URLs; no Blob credentials or raw provider URLs are returned. Published question and answer image access is checked against the matching approved current revision. Draft and historical files require administrator authentication. Historical PDF/SVG attachments are download-only administrator resources, not new image uploads.

Both files and metadata are associated atomically under one stable Question ID. Failure cleanup only considers upload receipts created by that save and checks database references first. Files remain when commit outcome or reference lookup is uncertain; log references support reconciliation. Historical revisions always retain their originals. Duplicate bytes produce a warning but never overwrite or merge records.

Back up database and image storage together. No general orphan deletion or automatic production cleanup is enabled. `npm run clean:generated` only audits fixed disposable build/test directories and excludes all data/uploads/backups.
