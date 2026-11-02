# Production dependency security remediation

Audit date: 2 November 2026, Asia/Kuala_Lumpur.

**PASS recommendation for the combined security and universal-pagination release, subject to the owner's explicit approval to commit and push.** Production and full npm audits now report zero vulnerabilities. No commit, push, deployment, hosted setting change, or Production database/storage operation was performed.

This report supersedes the dependency blocker recorded in the earlier [pagination audit](../UNIVERSAL_QUESTION_PAGINATION_REPORT.md). That report and all other 17 staged pagination files were preserved exactly. The pagination-only index still uses the old dependency files until the separately reviewed security patch is committed; do not deploy that index alone.

## Original findings and minimum safe versions

The original Production audit reported eight affected-package findings: seven high and one moderate. These were five affected libraries, with three additional Vercel findings propagated through the dependency graph. They were not eight independent exploits. Every entry below belongs to the Production dependency tree; the server imports Express/Multer/Zod and the Blob Node SDK, whose OIDC token helpers import the config package. Some affected library features are not used by this application, but none of the findings was suppressed on that basis.

| Package and installed version | Severity | Direct/transitive and introducing parent | Advisory | Minimum safe compatible remediation |
| --- | --- | --- | --- | --- |
| `body-parser` 2.3.0 | High | Transitive: `express` 5.2.1, range `^2.2.1` | [GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828) | Resolve 2.4.0 within Express's existing range |
| `multer` 2.4.0 | High | Direct application dependency | [GHSA-q7qp-rjg7-q26m](https://github.com/advisories/GHSA-q7qp-rjg7-q26m) | Raise the declared floor and lock to 2.5.0 |
| `qs` 6.16.0 | Moderate | Transitive: Express and body-parser | [GHSA-6pq8-jhm2-2vcw](https://github.com/advisories/GHSA-6pq8-jhm2-2vcw) | Resolve 6.16.1, accepted by both parents |
| `undici` 6.29.0 | High overall | Transitive: `@vercel/blob` 2.8.1, range `^6.23.0` | Five advisories listed below | Resolve 6.29.1 within the existing 6.x range |
| `zod` 4.6.5 and nested 4.1.11 | High | Direct, plus `@vercel/blob` → `@vercel/oidc` → `@vercel/cli-config` → exact `zod` 4.1.11 | [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) | Pin root 4.6.6 and override only config-package 0.3.1's Zod dependency to the root specification |
| `@vercel/cli-config` 0.3.1 | High, propagated | Transitive: `@vercel/oidc` 3.8.10 | Same Zod advisory; no separate advisory | Keep package version; replace its pinned vulnerable Zod. Current 0.3.5 also pins 4.1.11, so a parent-only patch upgrade would not fix this |
| `@vercel/oidc` 3.8.10 | High, propagated | Transitive: `@vercel/blob` 2.8.1 | Same Zod advisory through config package | Keep version and fix underlying Zod; no OIDC major upgrade required |
| `@vercel/blob` 2.8.1 | High, propagated | Direct application dependency | Same Zod advisory through OIDC/config | Keep version; fix Zod and Undici instead of the audit's suggested Blob downgrade |

Undici 6.29.1 addresses all five reported advisories:

| Advisory | Severity | Affected feature |
| --- | --- | --- |
| [GHSA-4qv8-2p9j-2685](https://github.com/advisories/GHSA-4qv8-2p9j-2685) | Moderate | EventSource parser resource consumption |
| [GHSA-xjj6-f33q-929c](https://github.com/advisories/GHSA-xjj6-f33q-929c) | High | Excessive content-encoding error handling |
| [GHSA-2m5v-pch6-74hx](https://github.com/advisories/GHSA-2m5v-pch6-74hx) | High | Agent TLS option/certificate validation |
| [GHSA-qrxm-fqhp-jwvm](https://github.com/advisories/GHSA-qrxm-fqhp-jwvm) | High | TLS renegotiation error handling |
| [GHSA-9fm3-97px-rjf6](https://github.com/advisories/GHSA-9fm3-97px-rjf6) | Moderate | WebSocket automatic-PONG buffering |

### body-parser 1.20.9 versus 2.4.0

The upstream advisory identifies both 1.20.9 and 2.4.0 as patched release lines. Registry metadata confirms Express 5.2.1 requires `body-parser ^2.2.1`: 2.4.0 satisfies that range, while 1.20.9 does not. A 1.x override would downgrade the application's parser major and change its dependency family. There is no body-parser 1.x consumer in this lockfile, so no 1.x installation or application downgrade was needed. Body-parser 2.4.0 requires Node >=18, compatible with this application's Node >=24 requirement.

The application retains its existing `express.json()` middleware and compressed-body support. Two new regressions send bounded gzip/deflate JSON bodies with trailing bytes to the parser resolved through Express, then confirm correct parsing and continued request handling. An isolated negative control using the original body-parser 2.3.0 failed the gzip case with an uncaught `Z_DATA_ERROR`; the patched 2.4.0 passes both. The negative control never contacted Production.

## Additional full-audit finding and justified tooling major change

The initial full audit reported 19 affected-package findings: seven high and twelve moderate. Eleven additional development-package findings propagated from [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249), which affects minimatch below 11.0.1. The installed copies were 3.1.5 (ESLint/config packages) and 10.2.6 (TypeScript ESLint). These are development/build dependencies, not application runtime dependencies.

The propagated packages were `eslint`, `typescript-eslint`, `@eslint-community/eslint-utils`, `@eslint/config-array`, `@eslint/eslintrc`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `@typescript-eslint/type-utils`, `@typescript-eslint/typescript-estree`, and `@typescript-eslint/utils`, in addition to minimatch itself.

There is no patched 3.x or 10.x release in current registry metadata. ESLint 9 uses the old callable/default minimatch API, so globally forcing minimatch 11 into the original lint tree would be incompatible. The separately justified tooling change is:

1. Move only the ESLint engine from 9.39.5 to exact 10.0.0, the first 10.x release. This removes the legacy 3.x consumer and obsolete eslintrc dependencies.
2. Override only dependency edges requesting minimatch `^10.0.0` to exact 11.0.1. ESLint 10, config-array 0.23.5, and the unchanged TypeScript ESLint 8.71.1 then share the patched named API.
3. Keep `@eslint/js` 9.39.5, the existing recommended rules, the TypeScript plugin, and `eslint.config.js` unchanged. No rule was disabled or relaxed. Node 24 satisfies all updated engine requirements; TypeScript ESLint 8.71.1 explicitly supports ESLint 10.

The new ESLint dependency closure accounts for development-only package updates/removals in the lockfile. No unrelated application package was upgraded. The exact versions and removed/deduplicated paths are recorded in `data/dependency-security-remediation-20261102/lockfile-version-changes.json`. See the [ESLint 10 migration guidance](https://eslint.org/docs/latest/use/migrate-to-10.0.0) for the engine and configuration changes reviewed.

## Final package changes

| Package | Before | After |
| --- | --- | --- |
| body-parser | 2.3.0 | 2.4.0 |
| multer | 2.4.0 | 2.5.0 |
| qs | 6.16.0 | 6.16.1 |
| undici | 6.29.0 | 6.29.1 |
| zod | Root 4.6.5 and nested 4.1.11 | Shared 4.6.6; vulnerable nested copy removed |
| eslint | 9.39.5 | 10.0.0, development only |
| minimatch | 3.1.5 and 10.2.6 | Shared 11.0.1, development only |

`package.json` raises Multer's floor to `^2.5.0`, pins Zod 4.6.6 and ESLint 10.0.0, and contains two scoped overrides: `@vercel/cli-config@0.3.1` → `zod: "$zod"`, and `minimatch@^10.0.0` → 11.0.1. No runtime package major was changed. The lockfile was generated by npm using temporary, subsequently removed constraints to choose the minimum safe body-parser/qs/Undici versions. Final clean installations used only the final manifest and lockfile. `npm audit fix --force` was not used.

The only dependency files changed are `package.json` and `package-lock.json`. Additional security-only files are `tests/dependency-security.test.ts` and this report. All four remain unstaged so the existing pagination index is not mixed with the patch.

## Validation

Two clean snapshots were reconstructed without the twelve unrelated files: base commit `78a71ec6257510945cce47e4eddb6f1d2692a42a` plus security files, and the same snapshot plus the exact seventeen staged pagination files. Each installed 244 packages from the final lockfile with `npm ci --offline --no-audit --no-fund`. A clean installation in the original workspace also passed. npm's existing pending-script notice for esbuild did not prevent either build or API bundling; no script approval/security setting was changed.

| Check | Result |
| --- | --- |
| Fresh Production audit, `npm audit --omit=dev --json` | PASS: zero vulnerabilities, exit 0 |
| Fresh full audit, `npm audit --json` | PASS: zero vulnerabilities, exit 0 |
| Actual installed tree, `npm ls` | PASS: patched leaf versions; no invalid dependency/peer entries |
| Original working-tree automated suite | PASS: 115 tests, zero failures/skips |
| Clean security-only automated suite | PASS: 108 tests, zero failures/skips |
| Clean combined-release automated suite | PASS: 114 tests, zero failures/skips |
| New security regressions | PASS: gzip/deflate availability and Blob OIDC/config parsing/request-context token behavior |
| Negative control with body-parser 2.3.0 | Expected FAIL: gzip regression catches the original uncaught decoder error |
| TypeScript | PASS in workspace and clean combined candidate; security-only build also typechecks |
| ESLint | PASS in workspace and both clean candidates, with unchanged lint configuration |
| Lint coverage/security probe | PASS: TSX/server sources remain included, ignored private data remains excluded, and a deliberate `no-explicit-any` violation is detected |
| Image metadata schema check | PASS |
| Production build | PASS in both clean candidates |
| Vercel API/Node ESM checks | PASS in both clean candidates; native imports, import edges, function bundle and no SQLite fallback verified |
| Standard complete Chromium browser suite | PASS: 31 tests, zero failures/skips; normal server teardown |
| New-file/manifest formatting and Git whitespace checks | PASS |

The working tree's extra test is the preserved, unrelated student role-separation regression. The clean combined candidate excludes it and the unrelated documents/ignore changes.

Browser and service coverage includes administrator/student authentication, CSRF and access boundaries, student verification/reset/disable, paired uploads and image loading, question/marking-scheme identity and bytes, optional subtopics, filtered server-side ten-question pages, history/Back/Forward, shrinking result sets, cross-page selection/deselection, and full-selection combined PDFs of 1/5/20/50 questions. SQLite and the real libSQL adapter were exercised locally. Existing Turso, Blob/OIDC, React, Vite, Sharp, PDF, authentication source, Vercel routing/settings, and schema/migration files were not changed. All 27 Sharp platform dependency entries, including Linux binaries, remain unchanged.

Evidence is retained under ignored `data/dependency-security-remediation-20261102/`: original/final audits, original tree and file/index manifests, changed-version inventory, parser negative-control log, browser HTML report/screenshots, and final validation/preservation records. Browser tests used synthetic assets and disposable local databases. Live Vercel/Linux execution, Production resource bindings, physical devices and Safari/WebKit were not retested by a deployment; the native hosted-API checks and local regressions passed. These are remaining verification limits, not known blockers.

## Preservation and reviewed commit/push plan

The entire Git index remains identical to its pre-remediation contents. All seventeen pagination files and twelve unrelated files remain byte-for-byte unchanged. Their backups/hashes are retained. No migration or Production image/data write was required. Dependency/security files remain unstaged, and HEAD remains the original base SHA.

After explicit owner approval for both commits and the deployment-capable push:

1. Recheck master/HEAD, the exact file hashes, unchanged pagination index, fresh audit status, and live remote master. Stop and review if remote master moved from the base SHA or any reviewed content changed.
2. Stage only the four security files and use a path-limited security commit, which preserves other staged paths:

   ```powershell
   $securityFiles = @('package.json', 'package-lock.json', 'tests/dependency-security.test.ts', 'docs/DEPENDENCY_SECURITY_REMEDIATION.md')
   git add -- $securityFiles
   git commit --only -m "fix: remediate production and build dependency vulnerabilities" -- $securityFiles
   ```

   Review that commit's four-file diff, then verify the seventeen pagination paths remain staged exactly and the twelve unrelated files remain unstaged. Git documents [path-limited commit preservation](https://git-scm.com/docs/git-commit#Documentation/git-commit.txt---only). Do not use `git commit -a`, stage-all, reset, or unstage the pagination release.
3. Review and commit the existing pagination index with a normal staged-only commit, for example `git commit -m "feat: paginate question listings in groups of ten"`. Verify its exact seventeen-file diff, the two-commit order, the final combined source hashes against the tested candidate, and preservation of all unrelated work. Neither commit is pushed individually.
4. Recheck remote master and perform one ordinary controlled `git push origin master:master`. Do not force or rewrite history. With the owner's restored integration/Automatic build setting and Production branch master, this push is deployment-capable. Vercel may create events for both commits; do not promise a single build merely because there is one push. Confirm that the final combined HEAD is the deployment serving the intended Production project/domain.
5. Read deployment/build status and perform read-only post-deployment checks of the final SHA, health, anonymous denial, authenticated image delivery, pagination/filter/selection behavior and PDF export. Do not change settings, bindings, accounts or Production data as part of verification. A hosted write test would require its own explicit scope.

No step above has been executed. This PASS is a release recommendation and reviewed plan, not permission to commit, push, or deploy.
