# Matriculation Physics Question Bank: Vercel ESM fix

Verified on 8 October 2026. Changes remain in the working tree. The deployed
Preview has not been redeployed or verified by this task.

## Root cause

The project declares `"type": "module"`. Vercel's reported function failure occurs
while loading unbundled JavaScript with native Node ESM. Two runtime references
in `shared/schema.ts` were emitted unchanged:

```typescript
import { assetKinds } from './model';
export { assetKinds, warnings } from './model';
```

Node tried to load `shared/model` rather than the existing `shared/model.js`. Both
references were invalid. `shared/model.ts` also contained a type-only import of
`./schema`; it is erased during emission but was corrected for consistent source
module resolution.

Before the fix, compiling the complete API graph without bundling and importing
`api/index.js` with ordinary Node reproduced `ERR_MODULE_NOT_FOUND` (exit 1).
The emitted schema file contained both extensionless `./model` references.
Evidence: [original graph audit](data/vercel-esm-fix/before.json).

The existing checks missed this because:

- The main tsconfig uses `module: ESNext`, `moduleResolution: Bundler`, and
  `noEmit: true`. It accepts extensionless relative imports and emits no API JS.
- The frontend Vite build bundles/resolves those source references.
- Unit tests and local server scripts use `tsx` rather than the native emitted
  module graph.
- The previous `api:check` bundled internal modules with esbuild, removing the
  failing relative runtime specifiers before inspection.

Native Node requires full relative file specifiers, including directory index
filenames. TypeScript can resolve `.js` specifiers to `.ts` sources. References:
[Node ESM resolution](https://nodejs.org/api/esm.html#mandatory-file-extensions),
[TypeScript file extension substitution](https://www.typescriptlang.org/docs/handbook/modules/reference#file-extension-substitution),
[Bundler resolution behavior](https://www.typescriptlang.org/tsconfig/moduleResolution).

## Fix

All three offending references now use explicit `.js` specifiers:

| File                 | Reference                   | Corrected to  |
| -------------------- | --------------------------- | ------------- |
| `shared/schema.ts:3` | Runtime import `./model`    | `./model.js`  |
| `shared/schema.ts:4` | Runtime re-export `./model` | `./model.js`  |
| `shared/model.ts:1`  | Type-only import `./schema` | `./schema.js` |

The architecture remains native ESM. No `.ts` runtime specifiers, CommonJS
conversion, experimental Node flags, custom loaders or new dependencies were
introduced. The emitted `shared/schema.js` now contains:

```javascript
import { assetKinds } from './model.js';
export { assetKinds, warnings } from './model.js';
```

Added `tsconfig.api.json`, extending the existing config with `module: NodeNext`
and `moduleResolution: NodeNext`, rooted at `api/index.ts`. This provides a separate
server graph validation/emission configuration. The main frontend tsconfig remains
unchanged. Package `type`, dependencies and lockfile remain unchanged;
`package.json` only adds the `api:esm:check` command.

### Files changed

- `shared/schema.ts`, `shared/model.ts`: three specifier corrections.
- `tsconfig.api.json`: NodeNext API graph configuration.
- `scripts/check-api-esm.ts`: complete source/output audit and native Node check.
- `scripts/check-vercel-api.ts`: includes the new check before existing assertions.
- `package.json`: adds `npm run api:esm:check`.
- `README.md`, `docs/TURSO_RUNTIME.md`: document the check and shared specifiers.
- `VERCEL_ESM_FIX_REPORT.md`: this report.

`api/index.ts`, `server/vercel-handler.ts`, Vite config, `vercel.json`, main
`tsconfig.json`, Turso adapters/runtime, environment semantics and migrations
required no changes.

## Audit

The TypeScript compiler graph rooted at `api/index.ts` contains 13 local source
files and 28 relative references, including static imports, re-exports, literal
dynamic imports and import-type references.

- Extensionless relative references found: **3** (2 runtime, 1 type-only).
- Corrected: **3**.
- Remaining extensionless references: **0**.
- Invalid directory/index imports: **0**.
- Deliberately unchanged: 25 already-explicit relative references; npm and Node
  built-in specifiers, which use their existing package/built-in resolution.
- Frontend-only/test/tool imports outside the API graph retain their existing
  bundler/tsx conventions. They are not part of the deployed native API graph.

Audited source graph:

```text
api/index.ts
server/vercel-handler.ts
server/runtime.ts
server/app.ts
server/database.ts
server/database-adapter.ts
server/curriculum.ts
server/revisions.ts
server/turso-adapter.ts
server/migrations.ts
shared/schema.ts
shared/model.ts
shared/curriculum.ts
```

The emitted runtime graph contains 12 JS modules and 20 relative edges; the
type-only adapter reference is erased. Every relative emitted target is checked
for an explicit extension and an existing file, including lazy import targets.
Computed dynamic imports are rejected rather than silently bypassing the audit.

## Regression coverage

`npm run api:esm:check`:

1. Typechecks the entire API dependency graph using NodeNext and audits all
   relative source references programmatically using TypeScript's AST.
2. Emits unbundled JavaScript into a new isolated temporary directory, preserving
   the native module layout, and checks every relative emitted runtime edge.
3. Imports the actual emitted `api/index.js` using ordinary Node v24.18.0, with
   no `tsx` loader, bundling or experimental flags in that child process.
4. Removes `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` and `NODE_OPTIONS` from the child
   environment. Invoking the compiled health handler returns the expected safe
   503 response because credentials are absent, without connecting to a database.
5. Removes `.js` from one reference in temporary emitted output and confirms a
   fresh ordinary Node process fails with `ERR_MODULE_NOT_FOUND`. The emitted
   fixture is restored and the owned temporary directory is removed safely.

`npm run api:check` includes this check as well as its original production bundle,
SQLite-independence and Vercel configuration assertions. The standalone command
was also run separately. No existing tests or assertions were weakened.

## Verification

| Check                                    | Result                              |
| ---------------------------------------- | ----------------------------------- |
| Native Node ESM API import               | PASS                                |
| NodeNext source and emitted-graph audit  | PASS                                |
| Extensionless-import negative regression | PASS                                |
| `npm run typecheck`                      | PASS                                |
| `npm run lint`                           | PASS                                |
| `npm test`                               | PASS: 64 tests, no failures/skips   |
| `npm run db:check`                       | PASS (isolated local database only) |
| `npm run schema:check`                   | PASS                                |
| `npm run api:check`                      | PASS                                |
| `npm run api:esm:check`                  | PASS                                |
| `npm run build`                          | PASS                                |
| `npm run test:browser`                   | PASS: 17 tests                      |
| Browser accessibility assertions         | PASS                                |
| `git diff --check`                       | PASS                                |

The first browser run, alongside other build/check jobs, passed 16 tests and
failed the URL-filter reload test because the Difficulty control was not found.
That test passed unchanged when run alone. The original failure is retained in
`data/vercel-esm-fix/test-browser.log`; the focused result is in
`browser-focused.log`. No timeout or assertion was changed. The complete suite
then passed independently: **17/17 in 36.7 seconds**, including reload and
accessibility checks. The initial reload failure did not reproduce; its exact
cause was not established.

Verification evidence is stored under ignored `data/vercel-esm-fix/`, including
`before.json`, `native-esm.log`, `typecheck.log`, `lint.log`, `test.log`,
`db-check.log`, `schema-check.log`, `api-check.log`, `build.log` and
`browser-final.log`. The final build resolves the shared `.js` specifiers to their
TypeScript sources successfully; browser artifacts retain the same content hashes
as the previous runtime build.

## Preservation

- DATABASE CHANGES: NONE
- PRODUCTION DATA CHANGES: NONE
- COMMIT: NO
- PUSH: NO
- DEPLOYMENT: NO

No Turso connection/CLI commands or production migration procedure were run.
Migration checks used isolated local databases only. Migrations 001/002, FTS
schema/data and credential semantics are unchanged. Retained local SQLite and
immutable backup hashes remain
`d7a0289a7a53ab7f924337ac1870a69f4f6aa481dbf369cc3aa666f8a87ad7a0`.
No secrets were exposed. Hosted write protections and upload limitations remain
as documented in the runtime setup guide.

## Exact manual Preview steps

After reviewing the fix, run these commands yourself from the repository root:

```powershell
git switch -c fix/vercel-esm-resolution
git add shared/schema.ts shared/model.ts scripts/check-api-esm.ts scripts/check-vercel-api.ts tsconfig.api.json package.json README.md docs/TURSO_RUNTIME.md VERCEL_ESM_FIX_REPORT.md
git diff --cached --check
git diff --cached
git commit -m "Fix native ESM module resolution in Vercel API"
git push -u origin fix/vercel-esm-resolution
```

Keep this branch separate from the production branch. In the existing Vercel
project, ensure the two server variables are configured for **Preview** and keep
Node 24.x. Open **Deployments**, select the Preview associated with this branch's
new commit, and verify the commit SHA matches the commit you just pushed. The Git
integration normally creates that Preview automatically. If it does not appear,
open **Deployments > Create Deployment**, enter the full branch name
`fix/vercel-esm-resolution`, and select **Create Deployment**. Verify its
environment is Preview and its commit SHA is the new commit.
If an explicit redeploy is needed, open that new Preview's ellipsis menu, choose
**Redeploy**, confirm the target remains Preview, and disable reuse of the existing
build cache. Do not redeploy the old failing commit. References:
[Git Preview deployments](https://vercel.com/docs/git),
[dashboard redeployment](https://vercel.com/docs/deployments/managing-deployments#redeploy-a-project).

After that Preview is Ready, open its `/api/health` URL. Expect HTTP 200 with
`{"status":"ok","database":"connected"}`. A safe 503 means credentials,
connectivity or schema availability need attention; it must not produce
`FUNCTION_INVOCATION_FAILED`. Check function logs for absence of
`ERR_MODULE_NOT_FOUND`, then verify `/api/taxonomy`, empty `/api/questions`, frontend
navigation, mutation protection (403) and unavailable hosted uploads (503).
