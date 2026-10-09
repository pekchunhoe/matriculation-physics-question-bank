# MATRICULATION PHYSICS QUESTION BANK
# PRODUCTION CURRICULUM ACTIVATION

**FINAL STATUS: PHYSICS-2022-2023 PRODUCTION CURRICULUM ACTIVATED AND VERIFIED**

Completed 10 October 2026 at 05:14:47 MYT. Production: https://matriculation-physics-question-bank.vercel.app.

## PRE-ACTIVATION

| Check | Result |
| --- | --- |
| Production commit | `4222aac1e4f3d27e641bd59e64a62a0e47dbec31`, PASS |
| Production deployment | `dpl_58Mosh38gxxsaNRYqcbByiNHJx9J`, Production / READY |
| Health | PASS, anonymous HTTP 200, status ok / database connected |
| Database | Existing `matriculation-physics-question-bank`, group `default` |
| Database host | `matriculation-physics-question-bank-pekchunhoe.aws-ap-northeast-1.turso.io` |
| Course | `matriculation-physics` / Matriculation Physics |
| LEGACY | active |
| PHYSICS-2022-2023 | draft |
| Active curriculum count | 1 |
| Reviewed hierarchy | 2 semesters / 18 chapters / 82 topics / 0 subtopics |
| Questions / assets | 0 / 0 |
| Approved artifact SHA-256 | `5350252cd5a76faa78437e338cf54c16a2c4e62ceb694216fb806b8f33753ace` |
| Artifact match | PASS, pinned file, all raw hierarchy fields and authenticated Production export |

Fresh SELECT-only audit: 10 October 2026 at 05:05:11 MYT (`2026-10-09T21:05:11.721Z`). It matched the previous verified pre-activation domain/schema/migration fingerprints. Fresh provider checks resolved the actual Production domain alias and independently confirmed its exact source commit and READY status.

Read the production draft-import report, combined dry-run report, curriculum presentation/runtime report, admin security report, production/pilot guidance, and existing activation API/service/UI. Dated setup and dry-run recommendations were treated as historical alongside completed production verification and this explicit authorization.

The approved JSON and both pinned source PDF hashes were preserved. No artifact regeneration, taxonomy edit, semester rename, syllabus interpretation or source change occurred.

## PUBLIC SECURITY PRECHECK

103 draft-ID scan: **PASS**. Draft matches: **0**.
82-topic scan: **PASS**. Draft topic matches: **0**.

Entire anonymous payloads of health, counts, course-filtered counts, spoofed role/draft-version counts, taxonomy, curriculum versions, questions and draft-filtered questions were scanned. Draft code/display name were also absent. Public taxonomy/versions showed only LEGACY active. Final anonymous counts and healthy runtime were rechecked after real sign-in immediately before the activation request.

## BACKUP

Fresh pre-activation backup: **`phys-pre-act-20261010-c010f5`**.
Source: current remote Production database; group: **default**.
Created: **PASS**, 10 October 2026 at 05:06:11 MYT (`2026-10-09T21:06:11.470Z`).
Verified: **PASS**, 10 October 2026 at 05:06:21 MYT.
Retained: **YES**.
Earlier pre-import backup `phys-pre-curr-20261009-c453ac`: **retained**.

Used the installed Turso CLI's supported `db create <new-name> --from-db matriculation-physics-question-bank --group default --wait` workflow. No local SQLite file was used. The copy includes the database, including security infrastructure; sanitized comparisons exclude credential/session values.

Independent backup and fresh Production audits matched exactly across courses, curriculum versions/statuses, all semester/chapter/topic/subtopic rows, question/content/asset/search domains, events, schema, and migration history. Production domain state remained identical through backup creation and sign-in; a final pre-activation audit matched both the baseline and the verified copy. The retained backup was independently re-audited after activation and still matched its pre-activation fingerprints.

| Verified backup fingerprint | SHA-256 |
| --- | --- |
| Domain | `793c3d0b43fdca3f5e54a939c16736a26bc5dc09b8985db63265e36affdf0e85` |
| Schema | `c88838ecec773071996bc1a77825c0443f1a6faa2217b4f49c3fa01ce81837ae` |
| Migration history | `ecfed613f40e9ecee5f886c04692b8500e9b5ef2db29272c9facd4b551e89db2` |

## ACTIVATION

Impact preview: **PASS**.
Confirmation: **PASS**, reviewed existing application mechanism, `confirmImpact: true`.
Transactional activation: **PASS**, one authenticated Production PATCH, HTTP 200.
PHYSICS-2022-2023 active: **PASS**.
LEGACY retired: **PASS**.
Exactly one active version: **PASS**.
Activation-related events added: **2**, no unexpected events.

A secure local console captured the existing administrator password with hidden input. Login used the actual hosted Production application, its existing enabled administrator identity, secure HttpOnly/SameSite=Strict/host-only cookie, and same-origin request protection. No authentication/CSRF bypass, bootstrap, password reset, copied session or local database fixture was used. Password, cookie, confirmation token, Turso token and OIDC credentials were never printed or persisted.

The authenticated Production export exactly matched the approved draft artifact. Fresh impact reported revision 1, **102 descendant nodes**, zero current/historical questions, zero pending revisions, and previous active LEGACY with zero current questions. It covered the entire Matriculation Physics course and both new semesters under the same version. The impact token stayed in memory. Status was changed while name, order and effective dates were preserved.

Submitted exactly one `PATCH /api/curriculum-versions/curriculum-physics-2022-2023` with the current impact token, expected revision, explicit confirmation and audit note. The unchanged service performs retirement, activation, revision updates and both events in one transaction. No ad-hoc SQL status/event write, weakened constraint, automatic retry, rollback/reactivation or history deletion occurred.

| Version | Before | After | Revision |
| --- | --- | --- | --- |
| PHYSICS-2022-2023 | draft | active | 1 → 2 |
| LEGACY | active | retired | 1 → 2 |

The only curriculum-domain changes are these version statuses, their expected revision/updated_at fields, and two service-created events. Both version rows retain all other fields; all taxonomy node rows remain exactly identical.

| New event | Entity ID | Transition | Event ID |
| --- | --- | --- | --- |
| Retirement | legacy-matriculation-physics | active → retired | 5969acfa-9d7e-4f98-9289-86915cd028fd |
| Activation | curriculum-physics-2022-2023 | draft → active | 63c7af64-666d-463c-9525-726be4732eb9 |

Event total: **1 → 3**. The original import event is preserved unchanged. Audit evidence redacts the activation impact token from event JSON; no manual event was inserted. Own-session logout: **PASS**, HTTP 200. Normal login/logout creates then revokes this task's session and updates bounded security throttling; these expected security-runtime changes are separate from curriculum/content changes.

## ACTIVE CURRICULUM

| Branch | Semesters | Chapters | Topics | Subtopics |
| --- | ---: | ---: | ---: | ---: |
| Semester 1 | 1 | 9 | 36 | 0 |
| Semester 2 | 1 | 9 | 46 | 0 |
| Combined active version | 2 | 18 | 82 | 0 |

All IDs, names, slugs, parent relationships, stored orders, node statuses/test flags, revisions and membership fields remain unchanged. Authenticated post-activation export equals the approved artifact with only the version status changed from draft to active. Effective dates remain null/null. Both new semesters remain members of the shared version.

**7.4 Huygens' Principle: PASS**, exact approved display wording, unchanged punctuation.

LEGACY is preserved with its existing ID, course membership, semester IDs/names and full historical record. Its two empty semester rows are retained alongside the two active-version semester rows; total database semesters remain four. Nothing was merged or deleted.

## PUBLIC CURRICULUM

Current Curriculum: **PASS**.
Human-readable version: **PASS**, Matriculation Physics - Session 2022/2023.
Semester 1: **PASS**.
Semester 2: **PASS**.
Historical LEGACY separated: **PASS**.

Anonymous /curriculum renders the current reviewed version with two permanent semester headings, 18 chapter headings and all 82 topics. Every chapter and topic display sequence was compared against stored sibling order. Internal version/semester IDs do not appear as visible content.

The Historical curricula disclosure starts collapsed, works with keyboard Enter and separates Existing curriculum (unversioned), LEGACY · Retired, and its preserved semesters. Historical headings are outside Current Curriculum and never mixed into the active branch.

## TOPIC FILTER

Chapter grouping: **PASS**, all nine chapters per selected semester.
Stored chapter order: **PASS**.
Stored topic order: **PASS**.
Stable IDs: **PASS**.
URL persistence: **PASS**.
Difficulty filter: **PASS**.
Zero-question state: **PASS**.

Default browser selection is active curriculum, exposing exactly the two new semester cards and 82 topic options grouped Semester → Chapter → Topic. Selecting Semester 1 shows 36 options; Semester 2 shows 46. All group legends and every topic label were compared to the stored hierarchy. Selected topic IDs in URLs remain the database IDs.

Semester 1 begins with 1.0 Physical Quantities and Measurements, its three approved topics, then 2.0 Kinematics of Linear Motion. Semester 2 begins with 1.0 Electrostatics and its four approved topics, then 2.0 Capacitors and Dielectrics. Exact approved typography and Huygens wording are preserved.

Each semester was exercised with a topic and Hard difficulty, reload, navigation to Curriculum, Back, Forward and Back. Selections survived. Long Semester 2 labels remained readable; Filters opens/closes on mobile with correct aria-expanded state and retained selections. No test or real question was created to obtain positive results; all result counts correctly remain zero.

## SECURITY AFTER ACTIVATION

/api/counts: **PASS**, anonymous HTTP 200.
Unexpected hidden IDs: **NONE**.
Public taxonomy: **PASS**.
Public versions: **PASS**.

The new hierarchy is now legitimately public. Public versions contain exactly PHYSICS-2022-2023 active and LEGACY retired, under the existing published-retired policy; no draft version is exposed. The public taxonomy's active membership/fields match the reviewed hierarchy and retain the two historical LEGACY semesters.

Counts return **84 eligible rows**: 82 active topic rows plus two empty LEGACY semester placeholders. All counts are zero. Every response row was validated against eligible public version membership and its complete semester/chapter/topic ancestry; no unknown or hidden ID is accepted, no unexpected fields appear, and no question data is present.

Health, taxonomy, versions, counts, course/spoofed-role counts, active/default/historical question listings, and anonymous auth/session all return expected HTTP 200 responses. All question result arrays are empty. The durable-rate-limited public question-set route was not exercised; no extra security-rate write was needed for public verification.

The exact public-counts fix remains deployed. This live check validates the available Production state, which now has no remaining draft curriculum. Hypothetical additional drafts remain covered by the prior exact-commit isolated regression tests; no extra draft/test curriculum was created here.

## RESPONSIVE / ADMIN VERIFICATION

| Check | Desktop 1280×1000 | Mobile 390×844 |
| --- | --- | --- |
| Current Curriculum / both semesters | PASS | PASS |
| Historical disclosure / separation | PASS | PASS |
| Full chapter/topic grouping and stored order | PASS | PASS |
| Stable topic IDs / difficulty / reload / Back / Forward | PASS | PASS |
| Long labels / zero-question state | PASS | PASS |
| Horizontal overflow | NONE | NONE |
| Console / uncaught JavaScript errors | NONE | NONE |
| Failed application API/asset loads | NONE | NONE |
| Filter-view axe violations | 0 | 0 |

Applied the Browser skill. In-app browser discovery remained unavailable, so verification used the existing Chromium tooling against real Production. Public contexts were anonymous. The separate administrator context used only the newly authenticated task-owned cookie in memory. Browser application traffic allowed GET/HEAD only, blocked upload/mutation attempts, and recorded zero such attempts. No traces, HARs, cookie jars or persistent browser profiles were retained.

Admin UI: **PASS**, PHYSICS-2022-2023 active and LEGACY retired in the existing version controls. The complete hierarchy's stored names are present; admin topic selector contains all 82 topics. No form was submitted during the UI check. Authenticated API/export and independent raw-row audits confirm Semester 1 9/36 and Semester 2 9/46 without hierarchy edits.

All screenshots were visually reviewed:

- [Authenticated active-version control](data/production-curriculum-activation/admin-active-desktop.png)
- [desktop-current-curriculum.png](data/production-curriculum-activation/desktop-current-curriculum.png)
- [desktop-history.png](data/production-curriculum-activation/desktop-history.png)
- [desktop-semester-1-filters.png](data/production-curriculum-activation/desktop-semester-1-filters.png)
- [desktop-semester-2-filters.png](data/production-curriculum-activation/desktop-semester-2-filters.png)
- [desktop-huygens-and-long-labels.png](data/production-curriculum-activation/desktop-huygens-and-long-labels.png)
- [mobile-current-curriculum.png](data/production-curriculum-activation/mobile-current-curriculum.png)
- [mobile-history.png](data/production-curriculum-activation/mobile-history.png)
- [mobile-semester-1-filters.png](data/production-curriculum-activation/mobile-semester-1-filters.png)
- [mobile-semester-2-filters.png](data/production-curriculum-activation/mobile-semester-2-filters.png)
- [mobile-huygens-and-long-labels.png](data/production-curriculum-activation/mobile-huygens-and-long-labels.png)

## QUESTIONS / ASSETS

| Table | Final rows |
| --- | ---: |
| questions | 0 |
| question_parts | 0 |
| solutions | 0 |
| solution_steps | 0 |
| hints | 0 |
| assets | 0 |
| tags | 0 |
| question_tags | 0 |
| question_versions | 0 |
| revision_candidates | 0 |
| question_version_classifications | 0 |
| question_search | 0 |

Questions: **0**. Assets: **0**. Blob write: **NO**.
All question/content/revision/tag/classification/search and asset rows remain exactly equal to the zero pre-activation state. No question authoring/import, curriculum PDF upload, Blob object enumeration/read, disposable upload or permanent object write occurred. Existing private store/OIDC configuration is unchanged.

## DATABASE

Foreign keys: **PASS**, no violations.
Integrity: **PASS**, integrity_check = ok.
One-active constraint: **PASS**, unchanged unique partial index and exactly one active version.
Schema unchanged: **PASS**.
Migrations unchanged: **PASS**, 001 / 002 / 003.
Unexpected taxonomy changes: **NONE**.
Duplicate IDs / orphan rows: **NONE**, unchanged primary-key schema and exact parent/row comparison.
Unexpected revision changes: **NONE**; only the two version revisions increment once.

Final SELECT-only audit: 10 October 2026 at 05:11:31 MYT (`2026-10-09T21:11:31.581Z`). Every non-version/non-event domain table matched its pre-activation rows exactly. Both original version records remain with only intended status/revision/update-time changes; all old events remain identical and exactly two new events were added.

| Fingerprint | Before | After |
| --- | --- | --- |
| Sanitized domain | `793c3d0b43fdca3f5e54a939c16736a26bc5dc09b8985db63265e36affdf0e85` | `5f430a3d644e228a644feb0d7d0ad146afec93986e7967ce375b72e628a81434` |
| Schema | `c88838ecec773071996bc1a77825c0443f1a6faa2217b4f49c3fa01ce81837ae` | `c88838ecec773071996bc1a77825c0443f1a6faa2217b4f49c3fa01ce81837ae` |
| Migration history | `ecfed613f40e9ecee5f886c04692b8500e9b5ef2db29272c9facd4b551e89db2` | `ecfed613f40e9ecee5f886c04692b8500e9b5ef2db29272c9facd4b551e89db2` |

Domain fingerprints use deterministic complete domain JSON with activation impact tokens redacted. Auth credential/session values are excluded. The changed domain hash is fully explained by the intended version/history changes; backup and pre-activation hashes still match. No raw activation-token-containing event JSON was persisted in local evidence.

## PRODUCTION CODE / SEMESTER POLICY

Commit unchanged: **`4222aac1e4f3d27e641bd59e64a62a0e47dbec31`**.
Deployment unchanged: **`dpl_58Mosh38gxxsaNRYqcbByiNHJx9J`**.
Vercel config changed: **NO**.
Deployment performed: **NO**.
Turso URL/token, Blob connections/private access, OIDC, environment definitions, Production domain, Git branch policy and authentication configuration: **unchanged**.
Application source / schema / migrations: **unchanged**.

Permanent names: **Semester 1 / Semester 2**, preserved for both new and historical versions.
SP015/SP025 hard-coded as permanent semester identities: **NO**.
Migration 004: **NO**.

Existing exact-commit quality evidence remains 126 unit/integration and 31 browser tests passing. Expensive isolated suites were not rerun for a source-free data transition; focused real Production API/browser/integrity checks passed. git diff --check passed. No source commit, amend, push, merge, deployment or unrelated report update was performed. This new report is local/untracked; the previous report-only working-tree modification and unrelated reports are preserved.

## FINAL PRODUCTION STATE

LEGACY: **retired**.
PHYSICS-2022-2023: **active**.
Active curriculum versions: **exactly 1**.
Active hierarchy: **2 semesters / 18 chapters / 82 topics / 0 subtopics**.
Questions: **0**.
Assets: **0**.
New activation-related events: **2**.
Fresh and pre-import backups: **retained**.

**FINAL STATUS: PHYSICS-2022-2023 PRODUCTION CURRICULUM ACTIVATED AND VERIFIED**

Stopped after activation verification. First-question authoring/import remains the next separately reviewed phase.

Sanitized evidence: `data/production-curriculum-activation/` contains preflight/source/provider checks, fresh backup identity and independent audits, exact before/after exports, impact without token, single-attempt activation/login/logout statuses, authenticated admin read-only results, public API/UI assertions and screenshots, exact database/event comparisons, and final verification. No password, cookie, Turso/OIDC credential or private Blob object contents are saved.
