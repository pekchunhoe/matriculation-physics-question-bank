# Matriculation Physics Question Bank

Image-based question bank with authenticated administration, stable paired question/answer records, versioned curricula and browser PDF export. This refactor is local and uncommitted. Production has not been migrated or deployed.

## Safe local preview

Requires Node.js 24+. Run `npm ci`, then `npm run dev:local`. Open http://127.0.0.1:3100. This command builds the app and starts a disposable in-memory SQLite bank with clearly labelled test images and a test administrator from `tests/auth-fixture.ts`. It never reads Turso credentials. Its database is discarded on exit; its fixed, ownership-marked image directory is cleared on restart, including after interrupted runs; it is not a persistent authoring environment.

`npm run dev` and `npm start` use configured Turso credentials. Do not point this unreleased checkout at production: runtime requires migrations 001-006 and **never migrates automatically**. Production currently remains on its existing schema. See [migration and release boundaries](docs/architecture.md).

## Workflow

1. Administrators maintain the authoritative syllabus in Curriculum. Select a version, Semester 1 or Semester 2, chapter, topic and subtopic. Subtopics are not invented or seeded by migrations.
2. Add one upright question image and one answer image (PNG, JPEG or WebP, at most 1.5 MiB each), all six dropdowns and positive integer total marks. Save creates one stable Question ID as a draft.
3. Preview the saved originals. Publish explicitly after review. Published replacements require confirmation and the current revision; concurrent stale edits fail. Archive retains records, files and immutable history.
4. Students filter approved questions, select at most 50 within one syllabus and semester, and download one A4 PDF. Questions precede answers, both in numeric curriculum order with matching numbering. Tall pictures span pages with a small overlap. Original embedded numbering should be removed from source images by their author before upload.

Question JSON import, academic LaTeX/FBD processing and Word generation are removed. Curriculum JSON import/export remains available for maintaining the syllabus. The read-only administrator legacy archive preserves original structured records; explicit conversion requires a real image pair and complete classification and retains the original ID and legacy data.

## Checks and storage

```
npm run lint
npm test
npm run db:check
npm run schema:check
npm run api:check
npm run auth:check
npm run storage:check
npm run build
npm run test:browser
npm run clean:generated
```

The last command is a dry run. Add `-- --apply` to remove only `dist`, `test-results` and `playwright-report`. It refuses links, junctions, credentials and database files. It never touches `data`, uploaded images or backups. Test output paths are bounded and reused; successful traces are not retained. PDF verification writes four fixed files under ignored `data/architecture-refactor/pdf`.

Preserve both database and image-store backups. Historical pairs are retained intentionally. Failed saves remove only newly uploaded files verified to have no database references; uncertain results are retained for reconciliation. See [storage](docs/ASSET_STORAGE.md), [security](docs/ADMIN_SECURITY.md), and [refactor results](IMAGE_BANK_REFACTOR_REPORT.md). Older root rollout reports describe historical releases, not this checkout.
