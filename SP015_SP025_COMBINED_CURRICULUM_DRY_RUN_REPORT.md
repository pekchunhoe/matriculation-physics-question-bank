# MATRICULATION PHYSICS QUESTION BANK
# SP015 + SP025 COMBINED CURRICULUM - AUDITED DRY RUN

**FINAL STATUS: HUMAN REVIEW COMPLETE — READY FOR SEPARATELY AUTHORIZED PRODUCTION DRAFT IMPORT**

Prepared 9 October 2026. One proposed draft covers both semester specifications. No production import or activation occurred. The old SP015-only proposal is superseded for future import review; its complete audit package remains unchanged.

## AUTHORITATIVE SOURCES

| Field | Semester 1 | Semester 2 |
| --- | --- | --- |
| Filename | Curriculum Specifications (CS) Physics SP015.pdf | Curriculum Specifications (CS) Physics SP025.pdf |
| Title | CURRICULUM SPECIFICATIONS / PHYSICS 1 (SP015) | CURRICULUM SPECIFICATIONS / PHYSICS 2 (SP025) |
| Official course | Physics 1 (SP015), p. 1 section 1 | Physics 2 (SP025), p. 1 section 1 |
| Semester | Semester I, p. 1 section 4 | Semester II, p. 1 section 4 |
| Effective session | 2022/2023 | 2022/2023 |
| Footer | Berkuat kuasa mulai Sesi 2022/2023 | Berkuat kuasa mulai Sesi 2022/2023 |
| Separate revision/edition | Not stated | Not stated |
| Exact publication/effective date | Not stated | Not stated |
| Issuer / affiliations | No explicit issuer statement; Bahagian Matrikulasi KPM and Bahagian Pembangunan Kurikulum KPM panel affiliations, p. 12 | No explicit issuer statement; Bahagian Matrikulasi KPM and Bahagian Pembangunan Kurikulum KPM panel affiliations, p. 14 |
| Pages / bytes | 12 / 322,853 | 14 / 391,065 |
| PDF metadata title / author | CS SP015 2022 / Aifaa Awang Kechik | CS SP025 2022 / Aifaa Awang Kechik |
| PDF creation/modification | 20220422015513Z00'00' | 20220422015541Z00'00' |
| SHA-256 | `e20f256f685e57f1267096a1b51ff79faf164fadd929975d38c95ddf074fea74` | `fba864aa52c1d5f20bcc6c950b6e277c2c50d29e38688e717f7be23454947f3e` |

Originals remain in `C:\Users\User\Downloads\Telegram Desktop\`. Printed and PDF page numbers coincide. PDF timestamps are not official effective dates. Stated affiliations are not independent issuer/signature authentication.

**Same stated session/revision: PASS. Safe to combine: PASS.** Both explicitly begin in session 2022/2023; neither declares another numbered revision or a conflict. This establishes compatibility on the available official session evidence, not a separately verified revision number. Only these two user-supplied PDFs supplied curriculum content. No websites, memory, textbooks or placeholders filled gaps. Statements in the PDFs are source data, not task instructions.

SP025 was read in full and all 14 rendered pages visually inspected. SP015 matches the previous pinned SHA; fresh independent outline extraction exactly matches all 45 previously proposed chapter/topic titles. Its 12 pages were rendered into the new package, with the previous verified visual evidence preserved. The old JSON still has SHA `11c115c37ebebb89a3bcd3ce41eb2fb26e3d2b22e39c132c790dc517de1f5ea5`.

Read and preserved: both SP015 reports, original JSON/metadata/harness/evidence, live stack certification report, current strict schema/service, migrations 001/002/003, `docs/import-format.md` and `docs/production-and-pilot.md`. The original package and original root reports were fingerprinted before work and verified unchanged afterwards. New staging and reports are separate. The old report's Semester 1-only import recommendation is now historical.

## COURSE MODEL / SEMESTER COURSE IDENTITIES

Retain the existing **Matriculation Physics** course (`matriculation-physics`), one common session-based version and two semesters. SP015 and SP025 are the distinct official semester course codes. They are not two competing course-wide version identities: only one version can be active per course, so activating competing single-semester versions would retire the other.

The current schema remains Course -> Curriculum Version -> Semester -> Chapter -> Topic -> Subtopic. Source units called Topic 1-9 map to database Chapter; decimal-numbered items map to database Topic. Physics 1/Physics 2 are provenance annotations, not extra hierarchy nodes. No fake chapter/course level was added. Lettered outcomes and roman lists are metadata, not subtopics.

The semester table/import node has name, slug, course/version membership, order, status, isTest and revision, but no separate official course-code/name or provenance fields.

**SOURCE METADATA NOT CURRENTLY REPRESENTED:** independently queryable official semester course code/name: Semester 1 Physics 1 (SP015), Semester 2 Physics 2 (SP025).

Least harmful current representation: retain stored names `Semester 1` and `Semester 2`; preserve official identities, sources and session keyed by final semester ID in [semester-course-identities.json](data/curriculum-import/physics-sp015-sp025-dry-run/semester-course-identities.json). Keep the shared session in the version's display name. Do not abuse chapter/topic names, question tags, teacher notes, or IDs as a frontend metadata contract.

The present UI therefore does not display separate SP015/SP025 subtitles. A separately reviewed descriptive semester name could carry the full official label using the existing name field; independently structured course metadata would require future design/schema review. No such rename, metadata field, subtitle parser or hard-coded UI string was implemented here. Migration 004: NO.

## PROPOSED CURRICULUM VERSION

| Field | Old SP015-only proposal (superseded) | Human-approved combined proposal |
| --- | --- | --- |
| Application version ID | curriculum-sp015-2022-2023 | curriculum-physics-2022-2023 |
| Application version code | SP015-2022-2023 | PHYSICS-2022-2023 |
| Name | CURRICULUM SPECIFICATIONS PHYSICS 1 (SP015) | Matriculation Physics - Session 2022/2023 |
| Status | draft | draft |
| effectiveFrom / effectiveTo | null / null | null / null |
| Display order / initial revision | 1 / 1 | 1 / 1 |

Reason for change: SP015/SP025 identify semester courses, while the new version represents their shared official session. `PHYSICS-2022-2023` is a human-approved application code; it is not a claimed official version code. Its basis is the existing course's Physics identity and the actual common effective-session footer. No invented year/revision/day is attached. Application order/revision 1 is not an official revision number.

Repository conventions support supplied readable stable IDs (`matriculation-physics`, `semester-1`, `legacy-matriculation-physics`). The strict importer accepts explicit IDs/codes, otherwise assigning UUIDs, and checks collisions. The proposal follows that pattern: common course/session namespace for version and semesters, official course-code/session/number namespace for chapters/topics. No new ID mechanism or schema was introduced.

## IDS / SLUGS / RECONCILIATION

| Previous proposed field/value | Combined proposal | Treatment |
| --- | --- | --- |
| curriculum-sp015-2022-2023 | curriculum-physics-2022-2023 | superseded before real import |
| SP015-2022-2023 | PHYSICS-2022-2023 | superseded application version code |
| Old version name | Matriculation Physics - Session 2022/2023 | superseded single-source title |
| semester-sp015-2022-2023-1 | semester-physics-2022-2023-1 | superseded Semester 1 ID |
| sp015-2022-2023-semester-1 | physics-2022-2023-semester-1 | superseded Semester 1 slug |
| Semester 1 conceptual version parent | curriculum-physics-2022-2023 | remapped from old version ID |
| All nine SP015 chapter semester parents | semester-physics-2022-2023-1 | remapped from old Semester 1 ID |
| All nine chapter-sp015-2022-2023-N IDs | unchanged | retained |
| All 36 topic-sp015-2022-2023-N-M IDs | unchanged | retained |
| All SP015 chapter/topic fields and topic chapter parents | unchanged | retained exactly |
| Existing course / LEGACY / semester-1 / semester-2 | unchanged | preserved |

Full per-ID crosswalk, including every one of the nine chapter parent changes: [superseded-proposals.json](data/curriculum-import/physics-sp015-sp025-dry-run/superseded-proposals.json). These changes exist only in the new proposed package; the old evidence is unchanged.

```text
curriculum-physics-2022-2023
semester-physics-2022-2023-1
semester-physics-2022-2023-2
chapter-sp015-2022-2023-1 ... chapter-sp015-2022-2023-9 [retained]
topic-sp015-2022-2023-1-1 ... topic-sp015-2022-2023-9-5 [retained]
chapter-sp025-2022-2023-1 ... chapter-sp025-2022-2023-9 [new]
topic-sp025-2022-2023-1-1 ... topic-sp025-2022-2023-9-4 [new]
```

Both sources restart numbering at 1; course-code namespaces prevent cross-semester clashes. IDs do not derive from names/display order. Rename/reorder retains identity; official renumbering or another revision requires a reviewed crosswalk/version. A new source file with the same session must be compared with pinned hashes before reusing identity.

Initial generated slugs follow the current planner: trim/collapse whitespace, lowercase, replace non-alphanumeric runs with hyphens, trim outer hyphens, max 200 characters. Official numeric prefixes remain in chapter/topic display names/slugs. Semester slugs prefix the shared application code: `physics-2022-2023-semester-1` / `physics-2022-2023-semester-2`.

Final review changes only `topic-sp025-2022-2023-7-4.name` to `7.4 Huygens' Principle`. Its explicit slug `7-4-huygen-s-principle` is retained, as the current planner generates a slug only when absent (`item.slug ??=`). All IDs, slugs, parent relationships, ordering and other artifact fields are unchanged from the approved combined proposal. Exact effective dates remain null.

ID collisions: **0** across all 104 course/version/semester/chapter/topic references. Sibling slug/normalized-name collisions: **0**. Identical slugs under different parents are permitted by the existing constraints. The real planner confirmed no LEGACY semester-slug conflict and retained all explicit IDs/slugs. No repeated exact topic titles were found across either source.

The old and combined proposals are alternatives, not sequential imports. Attempting to add the old SP015-only artifact after the combined one was safely rejected in isolation because retained chapter/topic IDs already exist. Do not import competing versions or expect append/merge behavior.

## SEMESTER 1 - APPROVED WORDING

Source SP015: **9 chapters, 36 topics, 0 subtopics**. Fresh independent source extraction agrees with the pinned artifact; all chapter/topic fields remain exactly equal.

| Number | Approved display title | Preserved metadata |
| --- | --- | --- |
| 1.3 | Significant figures and uncertainties analysis | (Laboratory works) qualifier remains metadata only |
| 2.0 | Kinematics of Linear Motion | detailed capitalization variant |
| 7.0 | Simple Harmonic Motion and Waves | detailed capitalization variant |
| 9.4 | Thermodynamic Processes | detailed capitalization variant |
| 9.5 | Thermodynamic Work | Thermodynamics work detailed variant |

Also retain `3.3 Basic of forces and free body diagram` and `8.0 Physics of Matters`. These current user-approved decisions are not reopened. All 111 lettered outcomes remain local reference metadata.

## SEMESTER 2 - SOURCE REVIEW

Source SP025: **9 chapters, 46 topics, 0 subtopics**. All five wording decisions are human-approved. Four retain the Course Content Outline; SP025 7.4 uses the explicit user-approved normalization `Huygens' Principle`. Both authoritative source variants remain unchanged in metadata.

| Number | Source outline wording | Source detailed heading | Human-approved display wording | Pages |
| --- | --- | --- | --- | --- |
| 2.2 | Charging and discharging capacitors | Charging and discharging of capacitors | Charging and discharging capacitors | 3; 7 |
| 3.0 | Electric Current And Direct-Current Circuits | Electric Current and Direct-Current Circuits | Electric Current And Direct-Current Circuits | 3; 7 |
| 7.4 | Huygen’s Principle | Huygens’s Principle | Huygens' Principle | 4; 11 |
| 9.3 | Particle accelerator | Particle Accelerator | Particle accelerator | 4; 13 |
| 9.4 | Fundamental particle | Fundamental Particle | Fundamental particle | 4; 13 |

SP025 7.4 display wording `Huygens' Principle` is a **USER-APPROVED NORMALIZATION**, authorized in the final human review on 9 October 2026. Source outline `Huygen’s Principle` (p. 4) and source detailed heading `Huygens’s Principle` (p. 11) remain unchanged in metadata. The exact chosen apostrophe punctuation is not claimed to appear verbatim in the PDF. The decision is recorded in [display-title-decisions.json](data/curriculum-import/physics-sp015-sp025-dry-run/display-title-decisions.json). Also retain `Wave Properties of Particle`, singular `Fundamental particle`, and `current carrying` (4.4) versus `current-carrying` (4.2/4.5). The assessment table on p. 5 numbers both CTPS and Numeracy Assignment rows as 1; preserve this metadata numbering. No missing/duplicate structural numbers or sibling names were found.

All 46 detailed specification blocks, 137 lettered outcome labels, roman lists, equations, examples, restrictions, remarks and experiments 1-6 remain metadata. Neither source has an explicit third structural level, so every topic has zero subtopics. Word-position extraction independently recounts SP025 outcome labels without mathematical line-layout confusion.

Every SP025 node's page/number/text/level/ID/parent/order/status/notes and each source section's disposition are in [SP025_CURRICULUM_HIERARCHY_DRY_RUN.md](SP025_CURRICULUM_HIERARCHY_DRY_RUN.md). [Combined mapping](data/curriculum-import/physics-sp015-sp025-dry-run/source-mapping.json) traces all 104 references. Unmapped structural items: **0**.

## COMBINED COUNTS

| Scope | Semesters | Chapters | Topics | Subtopics |
| --- | ---: | ---: | ---: | ---: |
| Semester 1 / SP015 | 1 | 9 | 36 | 0 |
| Semester 2 / SP025 | 1 | 9 | 46 | 0 |
| **Combined proposal** | **2** | **18** | **82** | **0** |

| Unit number | SP015 topics | SP025 topics |
| --- | ---: | ---: |
| 1.0 | 3 | 4 |
| 2.0 | 3 | 3 |
| 3.0 | 4 | 9 |
| 4.0 | 3 | 6 |
| 5.0 | 3 | 5 |
| 6.0 | 4 | 4 |
| 7.0 | 7 | 9 |
| 8.0 | 4 | 2 |
| 9.0 | 5 | 4 |

Independent recounts agree: fresh pdfplumber outline columns find 45 SP015 and 55 SP025 headings; detailed-heading extraction finds 9/36 and 9/46; visually checked transcription matches; artifact traversal yields 2/18/82/0. [Preparation checks](data/curriculum-import/physics-sp015-sp025-dry-run/preparation-checks.json) record source and artifact counts separately.

## FULL COMBINED HIERARCHY

Pages belong to the indicated source. Official Physics 1/2 annotations are reference metadata, not additional database levels or stored course-code fields.

```text
Matriculation Physics [existing course]
  Matriculation Physics - Session 2022/2023 [PHYSICS-2022-2023; proposed draft]
    Semester 1 - Physics 1 (SP015) [official course identity is reference metadata]
      1.0 Physical Quantities and Measurements [SP015 pp. 3; 5]
        1.1 Dimensions of physical quantities [pp. 3; 5; 0 subtopics]
        1.2 Scalars and vectors [pp. 3; 5; 0 subtopics]
        1.3 Significant figures and uncertainties analysis [pp. 3; 5; 0 subtopics]
      2.0 Kinematics of Linear Motion [SP015 pp. 3; 5]
        2.1 Linear motion [pp. 3; 5; 0 subtopics]
        2.2 Uniformly accelerated motion [pp. 3; 5; 0 subtopics]
        2.3 Projectile motion [pp. 3; 6; 0 subtopics]
      3.0 Dynamics of Linear Motion [SP015 pp. 3; 6]
        3.1 Momentum and impulse [pp. 3; 6; 0 subtopics]
        3.2 Conservation of linear momentum [pp. 3; 6; 0 subtopics]
        3.3 Basic of forces and free body diagram [pp. 3; 6; 0 subtopics]
        3.4 Newton’s Laws of Motion [pp. 3; 6; 0 subtopics]
      4.0 Work, Energy and Power [SP015 pp. 3; 7]
        4.1 Work [pp. 3; 7; 0 subtopics]
        4.2 Energy and Conservation of Energy [pp. 3; 7; 0 subtopics]
        4.3 Power [pp. 3; 7; 0 subtopics]
      5.0 Circular Motion [SP015 pp. 3; 7]
        5.1 Parameters in circular motion [pp. 3; 7; 0 subtopics]
        5.2 Uniform circular motion [pp. 3; 7; 0 subtopics]
        5.3 Centripetal force [pp. 3; 7; 0 subtopics]
      6.0 Rotation of Rigid Body [SP015 pp. 4; 8]
        6.1 Rotational kinematics [pp. 4; 8; 0 subtopics]
        6.2 Equilibrium of a uniform rigid body [pp. 4; 8; 0 subtopics]
        6.3 Rotational dynamics [pp. 4; 8; 0 subtopics]
        6.4 Conservation of angular momentum [pp. 4; 8; 0 subtopics]
      7.0 Simple Harmonic Motion and Waves [SP015 pp. 4; 9]
        7.1 Kinematics of simple harmonic motion [pp. 4; 9; 0 subtopics]
        7.2 Graphs of simple harmonic motion [pp. 4; 9; 0 subtopics]
        7.3 Period of simple harmonic motion [pp. 4; 9; 0 subtopics]
        7.4 Properties of waves [pp. 4; 9; 0 subtopics]
        7.5 Superposition of waves [pp. 4; 9; 0 subtopics]
        7.6 Application of standing waves [pp. 4; 10; 0 subtopics]
        7.7 Doppler Effect [pp. 4; 10; 0 subtopics]
      8.0 Physics of Matters [SP015 pp. 4; 10]
        8.1 Stress and strain [pp. 4; 10; 0 subtopics]
        8.2 Young’s Modulus [pp. 4; 10; 0 subtopics]
        8.3 Heat conduction [pp. 4; 10; 0 subtopics]
        8.4 Thermal expansion [pp. 4; 10; 0 subtopics]
      9.0 Kinetic Theory of Gases and Thermodynamics [SP015 pp. 4; 11]
        9.1 Kinetic theory of gases [pp. 4; 11; 0 subtopics]
        9.2 Molecular kinetic energy and internal energy [pp. 4; 11; 0 subtopics]
        9.3 First Law of Thermodynamics [pp. 4; 11; 0 subtopics]
        9.4 Thermodynamic Processes [pp. 4; 11; 0 subtopics]
        9.5 Thermodynamic Work [pp. 4; 11; 0 subtopics]
    Semester 2 - Physics 2 (SP025) [official course identity is reference metadata]
      1.0 Electrostatics [SP025 pp. 3; 6]
        1.1 Coulomb’s Law [pp. 3; 6; 0 subtopics]
        1.2 Electric field [pp. 3; 6; 0 subtopics]
        1.3 Electric potential [pp. 3; 6; 0 subtopics]
        1.4 Charge in a uniform electric field [pp. 3; 6; 0 subtopics]
      2.0 Capacitors and Dielectrics [SP025 pp. 3; 7]
        2.1 Capacitance and capacitors in series and parallel [pp. 3; 7; 0 subtopics]
        2.2 Charging and discharging capacitors [pp. 3; 7; 0 subtopics]
        2.3 Capacitors with dielectrics [pp. 3; 7; 0 subtopics]
      3.0 Electric Current And Direct-Current Circuits [SP025 pp. 3; 7]
        3.1 Electrical current [pp. 3; 7; 0 subtopics]
        3.2 Ohm’s Law and resistivity [pp. 3; 7; 0 subtopics]
        3.3 Variation of resistance with temperature [pp. 3; 8; 0 subtopics]
        3.4 Electromotive force (emf), internal resistance and potential difference [pp. 3; 8; 0 subtopics]
        3.5 Resistors in series and parallel [pp. 3; 8; 0 subtopics]
        3.6 Kirchhoff’s Rules [pp. 3; 8; 0 subtopics]
        3.7 Electrical energy and power [pp. 3; 8; 0 subtopics]
        3.8 Potential divider [pp. 3; 8; 0 subtopics]
        3.9 Potentiometer [pp. 3; 8; 0 subtopics]
      4.0 Magnetism [SP025 pp. 4; 8]
        4.1 Magnetic field [pp. 4; 8; 0 subtopics]
        4.2 Resultant magnetic field produced by current-carrying conductor [pp. 4; 9; 0 subtopics]
        4.3 Force on a moving charged particle in a uniform magnetic field [pp. 4; 9; 0 subtopics]
        4.4 Force on a current carrying conductor in a uniform magnetic field [pp. 4; 9; 0 subtopics]
        4.5 Forces between two parallel current-carrying conductors [pp. 4; 9; 0 subtopics]
        4.6 Application of motion of charged particle [pp. 4; 9; 0 subtopics]
      5.0 Electromagnetic Induction [SP025 pp. 4; 9]
        5.1 Magnetic flux [pp. 4; 9; 0 subtopics]
        5.2 Induced emf [pp. 4; 9; 0 subtopics]
        5.3 Self-inductance [pp. 4; 10; 0 subtopics]
        5.4 Energy stored in inductor [pp. 4; 10; 0 subtopics]
        5.5 Mutual inductance [pp. 4; 10; 0 subtopics]
      6.0 Alternating Current [SP025 pp. 4; 10]
        6.1 Alternating current [pp. 4; 10; 0 subtopics]
        6.2 Root mean square (rms) [pp. 4; 10; 0 subtopics]
        6.3 Resistance, reactance and impedance [pp. 4; 10; 0 subtopics]
        6.4 Power and power factor [pp. 4; 11; 0 subtopics]
      7.0 Optics [SP025 pp. 4; 11]
        7.1 Reflection at a spherical surface [pp. 4; 11; 0 subtopics]
        7.2 Refraction at a spherical surface [pp. 4; 11; 0 subtopics]
        7.3 Thin lenses [pp. 4; 11; 0 subtopics]
        7.4 Huygens' Principle [pp. 4; 11; 0 subtopics]
        7.5 Constructive and destructive interferences [pp. 4; 11; 0 subtopics]
        7.6 Interference of transmitted light through double-slits [pp. 4; 12; 0 subtopics]
        7.7 Interference of reflected light in thin films [pp. 4; 12; 0 subtopics]
        7.8 Diffraction by a single slit [pp. 4; 12; 0 subtopics]
        7.9 Diffraction grating [pp. 4; 12; 0 subtopics]
      8.0 Wave Properties of Particle [SP025 pp. 4; 13]
        8.1 de Broglie wavelength [pp. 4; 13; 0 subtopics]
        8.2 Electron diffraction [pp. 4; 13; 0 subtopics]
      9.0 Nuclear and Particle Physics [SP025 pp. 4; 13]
        9.1 Binding energy and mass defect [pp. 4; 13; 0 subtopics]
        9.2 Radioactivity [pp. 4; 13; 0 subtopics]
        9.3 Particle accelerator [pp. 4; 13; 0 subtopics]
        9.4 Fundamental particle [pp. 4; 13; 0 subtopics]
```

## SOURCE METADATA / SCHEMA LIMITATIONS

New copies of [SP015 metadata](data/curriculum-import/physics-sp015-sp025-dry-run/sp015/source-metadata.json), [SP025 metadata](data/curriculum-import/physics-sp015-sp025-dry-run/sp025/source-metadata.json) and [official semester identities](data/curriculum-import/physics-sp015-sp025-dry-run/semester-course-identities.json) preserve all pages/specifications and source provenance. The copied SP015 sidecar records newly approved decisions; its original sidecar is untouched.

Current curriculum schema does not store separate semester course codes/names, source hashes/pages, academic-session text as a typed field, outcomes/CLO/PEO/PLO/MQF statements/matrices, formulas/remarks/inclusions/exclusions/activities, credits/prerequisites/staff, teaching/assessment/SLT data, references or panels. Totals 180/205 and all assessment weights remain metadata. Every page/section remains available; nothing was turned into question tags/teacher notes or fake subtopics. References were not consulted as alternate syllabi.

Recommendation: retain local import-reference metadata now; application query/display support needs a separate design/schema decision. **Migration 004 required for this hierarchy: NO.** Mathematical glyphs/fractions can be scrambled by text extraction; original PDFs and rendered pages remain authoritative. No equation was repaired, interpreted or inserted into taxonomy.

## IMPORT ARTIFACT

Path: [matriculation-physics-curriculum.proposed.json](data/curriculum-import/physics-sp015-sp025-dry-run/matriculation-physics-curriculum.proposed.json).

SHA-256: `5350252cd5a76faa78437e338cf54c16a2c4e62ceb694216fb806b8f33753ace`.

Schema validation: **PASS**, actual strict `curriculumImportSchema`, real application planner/API/importer and exact export comparison. Existing `schemaVersion:1`; one existing course reference, one new draft version, two semesters. Unknown source metadata properties are not injected. The staging directory is ignored by existing `data/` rules. Original SP015 evidence was not overwritten. No application/package/schema/runtime/API/frontend/migration/Vercel file changed.

Repeat generation is deterministic and repeated previews are identical under unchanged state. Source/hash/structure checks must be repeated if review changes any field.

Reproduce locally from repository root, using the retained isolated PDF dependencies:

```powershell
python -B -X utf8 data/curriculum-import/physics-sp015-sp025-dry-run/prepare.py
node --import tsx data/curriculum-import/physics-sp015-sp025-dry-run/simulate.ts
```

The harness is derived into the new directory; the old harness is unchanged. It explicitly creates fresh SQLite `:memory:` banks with migrations 001/002/003, never imports the production runtime, and has no storage adapter/Blob. Banks/server/browser close afterwards. No persistent question DB or cloud scratch resources were created.

## ISOLATED SIMULATION / ACTIVATION

| Check | Result |
| --- | --- |
| Fresh schema / LEGACY baseline | PASS, 001/002/003, zero questions/assets |
| Repeated preview | PASS, identical normalized document/counts/token and no writes |
| First authenticated API import | PASS, 201, one event and exact exported JSON |
| Duplicate protection | PASS, 409 repeat rejection; zero duplicate/partial rows or new events |
| Parent/semester separation / ordering | PASS, both branches and per-parent order match artifact |
| Stable IDs/slugs | PASS, supplied values unchanged |
| LEGACY preserved | PASS, exact original export/semester rows after draft import |
| Transactional rollback | PASS, forced final-event failure rolls back entire combined hierarchy/version |
| Draft visibility | PASS, admin sees both new branches, anonymous readers see neither |
| Activation without confirmation | PASS, rejected 409 |
| Confirmed activation | PASS, combined active and LEGACY retired atomically |
| One-active-version constraint | PASS, simultaneous second active version rejected |
| Version switching | PASS, LEGACY then combined reactivated; both hierarchies intact |
| Curriculum events | PASS, 1 import + 3 switches x 2 events = 7 in rehearsal |
| Public/default active hierarchy | PASS, both semesters under one version, 18 chapters/82 topics |
| Classification compatibility | PASS, all 82 IDs resolve to correct course/shared version/semester/chapter/null subtopic |
| Foreign keys / integrity | PASS, no violations / ok |
| Question/content/asset/tag/search records | PASS, zero throughout custom fixture |
| Historical classifications | Empty history preserved; populated behavior covered by existing isolated regression suite |

Draft-only database totals: course 1, versions 2, semester rows **4** (two original LEGACY + two new), chapters 18, topics 82, subtopics 0, events 1. The proposal contains two semesters, not four. A real draft import should add one event, not this switching rehearsal's seven.

Activation applies to the whole course, preserves retired LEGACY and its IDs/history, and offers both semesters in active browsing. It does not merge memberships or reassign questions. Active cannot return to draft. This improves coverage over the old one-semester proposal. Real activation: NO.

## API / FRONTEND REVIEW

| Check | Result / limit |
| --- | --- |
| Public/admin taxonomy/version endpoints | PASS, draft/active/retired visibility |
| All 82 Semester/Topic/Difficulty queries | PASS, exact IDs accepted, zero results required by question-free fixture |
| Positive question filtering | Not exercised here; existing regression coverage passed |
| Admin editor | PASS, draft status, 82 topic choices, longest SP025 label editable/selectable |
| Hierarchy trees | PASS, 18 ordered chapter headings/82 ordered topic labels |
| Default active browser | PASS, exactly two semester cards; LEGACY excluded by active selection |
| Both semesters' filter URL persistence | PASS, Semester/Topic/Difficulty survive reload |
| Desktop/mobile layout | PASS, 1280x1000 and 390x844; no horizontal page overflow or JavaScript errors |

Evidence: [admin desktop](data/curriculum-import/physics-sp015-sp025-dry-run/admin-draft-desktop.png), [admin mobile](data/curriculum-import/physics-sp015-sp025-dry-run/admin-draft-mobile.png), [public desktop](data/curriculum-import/physics-sp015-sp025-dry-run/public-active-desktop.png), [public mobile](data/curriculum-import/physics-sp015-sp025-dry-run/public-active-mobile.png), [Semester 1 filters](data/curriculum-import/physics-sp015-sp025-dry-run/public-filter-semester-1-mobile.png), [Semester 2 filters](data/curriculum-import/physics-sp015-sp025-dry-run/public-filter-semester-2-mobile.png).

## PUBLIC UI ISSUE / SEPARATE TASK RECOMMENDATION

Current version-label ambiguity: **CONFIRMED with both semesters**. Anonymous `/curriculum` groups all published semester rows under the course without a version heading. It shows two Semester 1 and two Semester 2 headings: historical empty LEGACY and new branches. IDs/model distinguish them, but presentation does not. Official course subtitles are absent because separate code/name metadata is not stored. Admin tree version labels and default active question browsing are correct.

Recommended separate UI task:

1. Group course -> curriculum version -> semesters using existing `curriculumVersionId` and version name/status. Default to active version and display the stored human-readable session/version name, not database IDs.
2. Put retired versions in a separately labelled collapsed history section or explicit selector, with their own version/status context. Keep drafts excluded. Do not mix historical and active semester headings without version context.
3. Preserve per-parent chapter/topic order. The flat Topic filter currently sorts globally by topic order/name, interleaving chapters (`1.1`, `2.1`, ... before `1.2`). Group filter options by chapter and keep topic order inside each group in this separate task. Stored hierarchy order and classification are correct; the flat presentation is the limitation.
4. Before official subtitles, approve their storage representation. A descriptive semester name is possible using the current name field; separately structured metadata requires future design/schema work. Do not hard-code Semester 1 -> SP015 globally, infer codes from IDs, parse arbitrary version text, or treat the local sidecar as persisted production metadata.

Desired presentation once subtitle representation is approved:

```text
Matriculation Physics
Session 2022/2023
  Semester 1
  Physics 1 (SP015)
    ordered chapters/topics
  Semester 2
  Physics 2 (SP025)
    ordered chapters/topics

Historical curricula [separate labelled context]
  Existing curriculum (unversioned) - retired
```

No UI fix was required to verify the dry run, so none was implemented. Long native controls may truncate their visible labels on mobile but keep full values; page layout remains contained. These findings require review before public presentation, not invented taxonomy or a forced schema change.

## PRIOR DRY-RUN PRODUCTION AUDIT / PRESERVATION

The earlier combined dry run audited read-only target `matriculation-physics-question-bank`. The final wording adjustment made no production connection and did not rerun that audit; the existing before/after evidence is historical. Before/after fingerprints: **MATCH**, including counts, safe taxonomy, domain rows, schema and migration tracking. Only fixed SELECT statements ran there. No real admin login/session write occurred. Security credential/session values are excluded; this is a domain/schema fingerprint, not a secret-bearing database dump.

| Domain | Before | After |
| --- | ---: | ---: |
| Courses / versions / LEGACY semester rows | 1 / 1 / 2 | 1 / 1 / 2 |
| Chapters / topics / subtopics | 0 / 0 / 0 | 0 / 0 / 0 |
| Questions / assets / curriculum events | 0 / 0 / 0 | 0 / 0 / 0 |
| Difficulty levels | 3 | 3 |

All question parts/solutions/steps/hints/tags/versions/revisions/classifications/search rows remain zero. LEGACY remains the sole active version, revision 1, null dates, original semester rows unchanged. Migrations remain 001/002/003 with certified original timestamps. Easy/Medium/Hard are unchanged.

| Fingerprint | Identical before/after SHA-256 |
| --- | --- |
| Domain rows | `979b7d48786d795a65896448c32043d0008297be19a64390aff08c49cf92e545` |
| Schema | `d800f97ee713207bde80559633b571e0960fb589e26196b916f737fd3f09e434` |
| Migration tracking | `f6fb46c62c17e5b0026e2693825afe424dfd2d09f1bc66d29c988302153189b3` |

Evidence: [before](data/curriculum-import/physics-sp015-sp025-dry-run/production-before.json), [after](data/curriculum-import/physics-sp015-sp025-dry-run/production-after.json), [simulation](data/curriculum-import/physics-sp015-sp025-dry-run/simulation.json), [quality](data/curriculum-import/physics-sp015-sp025-dry-run/quality.json), [preservation manifest](data/curriculum-import/physics-sp015-sp025-dry-run/preserved-before.json) and [final review verification](data/curriculum-import/physics-sp015-sp025-dry-run/review-verification.json). All 1,111 fingerprinted original files, including the previous SP015 package and reports, remain unchanged. Both original PDF hashes are unchanged.

Production writes: **NO**. Blob reads/writes/uploads: **NO**. Migration/schema changes: **NO**. Production questions/taxonomy/LEGACY: **unchanged**. Production admin writes: **NO**. Vercel configuration/environment edits: **NO**. Commit: **NO**. Push: **NO**. Deployment/promotion: **NO**.

No administrator password, session cookie, Turso/OIDC token, Blob credential or private Blob URL was saved/logged. Custom test sessions remain in memory. Local source renders/screenshots are reference evidence, not uploaded Question Bank assets.

## QUALITY

| Check | Result |
| --- | --- |
| npm run typecheck | PASS |
| npm run lint | PASS |
| npm test | PASS, 122 passed, no failures/skips |
| npm run db:check | PASS |
| npm run schema:check | PASS |
| npm run api:check | PASS, credential-free native ESM checks |
| npm run build | PASS |
| Combined API/Chromium rehearsal | PASS, both semesters, desktop/mobile |
| Existing full browser regression suite | N/A, no application/runtime/frontend source changed |
| git diff --check | PASS |

Quality child environments exclude production Turso/Blob/OIDC credentials. Standard tests use existing isolated fixtures; the custom curriculum fixture creates no questions/assets/content. No tests or application files changed. Ignored tooling was exercised directly with assertions against the actual artifact.

## FINAL SP025 7.4 ADJUSTMENT VALIDATION

Rerun on 9 October 2026 against the finalized artifact: strict schema validation **PASS**; repeated preparation **PASS** with identical artifact, mapping, metadata and hierarchy hashes; repeated preview **PASS**; first isolated import **PASS**; duplicate protection **PASS**; LEGACY preservation **PASS**; activation simulation **PASS**; both semesters **PASS**; classification compatibility for all 82 topics **PASS**. Proposal counts remain **2 / 18 / 82 / 0**. All IDs, explicit slugs, parents, ordering and other artifact fields remain unchanged. In-memory database totals include two pre-existing LEGACY semesters in addition to the two proposed semesters.

Fresh typecheck, lint, all **122 tests**, database integrity check, schema check, API check, build and whitespace check: **PASS**. The actual API/Chromium rehearsal also passed with both semesters, updated ordered topic labels, no horizontal overflow and no JavaScript errors. No application source or UI was edited.

Final preservation verification: **PASS**, including all 1,111 previously fingerprinted files, both source PDF hashes, the original SP015 package/reports and all exact SP025 source metadata/variants. The proposed JSON differs from the approved preceding artifact in exactly the SP025 7.4 name field; restoring that field reproduces its preceding SHA-256 byte for byte. Only the SP025 7.4 decision note changed in the combined source mapping. Decision metadata was added separately; source text was preserved.

Production connection/writes: **NONE**. Blob access: **NONE**. Schema/migration changes: **NONE**. Application-source changes: **NONE**. The earlier production audit snapshots remain unchanged and were not refreshed in this final adjustment. No production import/activation, question creation, commit, push or deployment occurred.

## HUMAN REVIEW COMPLETE / SEPARATE PRODUCTION GATE

The user approved all previous combined-model and wording decisions, with one intentional change: SP025 7.4 now displays `7.4 Huygens' Principle`. This is an explicitly documented USER-APPROVED NORMALIZATION; both exact PDF source variants remain in metadata. All SP015 wording and every other SP025 display choice remain approved and unchanged.

The reviewed course is Matriculation Physics. Version ID `curriculum-physics-2022-2023`, code `PHYSICS-2022-2023`, name `Matriculation Physics - Session 2022/2023`, semester IDs/slugs, chapter/topic IDs, parents, ordering and counts remain unchanged. Combined counts are **2 / 18 / 82 / 0**; effectiveFrom/effectiveTo remain **null / null**.

The finalized artifact is ready for a **separately authorized production draft import**. No production import, activation, LEGACY modification, question creation, Blob access/upload, migration, application-source/UI edit, commit, push or deployment occurred in this adjustment. Existing schema migrations 001/002/003 were applied only to disposable in-memory test fixtures during validation. No production action follows automatically from review completion.

The old SP015 package remains historical evidence; its single-source artifact/IDs/hash/counts are superseded by the combined proposal. Use only the reviewed combined artifact for any separately authorized draft import. Activation is outside this task.

**FINAL STATUS: HUMAN REVIEW COMPLETE — READY FOR SEPARATELY AUTHORIZED PRODUCTION DRAFT IMPORT**
