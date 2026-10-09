# SP015 curriculum hierarchy - audited dry run

Scope: Semester 1 only. Semester 2 is excluded and deferred; no Semester 2 node is proposed.

Status: READY FOR HUMAN REVIEW (no production import or activation).

Source: Curriculum Specifications (CS) Physics SP015.pdf, 12 pages. PDF and printed page numbers coincide. Effective session: 2022/2023 (footer); Semester I (page 1).

Mapping: source units labelled Topic 1-9 / outline 1.0-9.0 become database Chapters; numbered items 1.1-9.5 become database Topics. Lettered outcomes and roman lists are metadata, never invented subtopics. All 36 topics have zero subtopics. Display names prefix the exact outline title with its official number; only line-wrap whitespace is joined.

```text
Matriculation Physics [existing course]
  CURRICULUM SPECIFICATIONS PHYSICS 1 (SP015) [SP015-2022-2023; draft]
    Semester 1 [source Semester I, p. 1]
      1.0 Physical Quantities and Measurements [pp. 3; 5]
        1.1 Dimensions of physical quantities [pp. 3; 5; 0 subtopics]
        1.2 Scalars and vectors [pp. 3; 5; 0 subtopics]
        1.3 Significant figures and uncertainties analysis [pp. 3; 5; 0 subtopics]
      2.0 Kinematics of Linear Motion [pp. 3; 5]
        2.1 Linear motion [pp. 3; 5; 0 subtopics]
        2.2 Uniformly accelerated motion [pp. 3; 5; 0 subtopics]
        2.3 Projectile motion [pp. 3; 6; 0 subtopics]
      3.0 Dynamics of Linear Motion [pp. 3; 6]
        3.1 Momentum and impulse [pp. 3; 6; 0 subtopics]
        3.2 Conservation of linear momentum [pp. 3; 6; 0 subtopics]
        3.3 Basic of forces and free body diagram [pp. 3; 6; 0 subtopics]
        3.4 Newton’s Laws of Motion [pp. 3; 6; 0 subtopics]
      4.0 Work, Energy and Power [pp. 3; 7]
        4.1 Work [pp. 3; 7; 0 subtopics]
        4.2 Energy and Conservation of Energy [pp. 3; 7; 0 subtopics]
        4.3 Power [pp. 3; 7; 0 subtopics]
      5.0 Circular Motion [pp. 3; 7]
        5.1 Parameters in circular motion [pp. 3; 7; 0 subtopics]
        5.2 Uniform circular motion [pp. 3; 7; 0 subtopics]
        5.3 Centripetal force [pp. 3; 7; 0 subtopics]
      6.0 Rotation of Rigid Body [pp. 4; 8]
        6.1 Rotational kinematics [pp. 4; 8; 0 subtopics]
        6.2 Equilibrium of a uniform rigid body [pp. 4; 8; 0 subtopics]
        6.3 Rotational dynamics [pp. 4; 8; 0 subtopics]
        6.4 Conservation of angular momentum [pp. 4; 8; 0 subtopics]
      7.0 Simple Harmonic Motion and Waves [pp. 4; 9]
        7.1 Kinematics of simple harmonic motion [pp. 4; 9; 0 subtopics]
        7.2 Graphs of simple harmonic motion [pp. 4; 9; 0 subtopics]
        7.3 Period of simple harmonic motion [pp. 4; 9; 0 subtopics]
        7.4 Properties of waves [pp. 4; 9; 0 subtopics]
        7.5 Superposition of waves [pp. 4; 9; 0 subtopics]
        7.6 Application of standing waves [pp. 4; 10; 0 subtopics]
        7.7 Doppler Effect [pp. 4; 10; 0 subtopics]
      8.0 Physics of Matters [pp. 4; 10]
        8.1 Stress and strain [pp. 4; 10; 0 subtopics]
        8.2 Young’s Modulus [pp. 4; 10; 0 subtopics]
        8.3 Heat conduction [pp. 4; 10; 0 subtopics]
        8.4 Thermal expansion [pp. 4; 10; 0 subtopics]
      9.0 Kinetic Theory of Gases and Thermodynamics [pp. 4; 11]
        9.1 Kinetic theory of gases [pp. 4; 11; 0 subtopics]
        9.2 Molecular kinetic energy and internal energy [pp. 4; 11; 0 subtopics]
        9.3 First Law of Thermodynamics [pp. 4; 11; 0 subtopics]
        9.4 Thermodynamic Processes [pp. 4; 11; 0 subtopics]
        9.5 Thermodynamic Work [pp. 4; 11; 0 subtopics]
```

## Counts

| Chapter | Topics | Subtopics |
| --- | ---: | ---: |
| 1.0 Physical Quantities and Measurements | 3 | 0 |
| 2.0 Kinematics of Linear Motion | 3 | 0 |
| 3.0 Dynamics of Linear Motion | 4 | 0 |
| 4.0 Work, Energy and Power | 3 | 0 |
| 5.0 Circular Motion | 3 | 0 |
| 6.0 Rotation of Rigid Body | 4 | 0 |
| 7.0 Simple Harmonic Motion and Waves | 7 | 0 |
| 8.0 Physics of Matters | 4 | 0 |
| 9.0 Kinetic Theory of Gases and Thermodynamics | 5 | 0 |
| **Semester 1 total** | **36** | **0** |

Total: 1 semester, 9 chapters, 36 topics, 0 subtopics. Independent outline extraction, detailed-heading recount and artifact traversal agree.

## Exact source-to-database mapping

Chapter/topic source text below omits the separately listed number; the database display name is `number + space + source text`. All statuses are proposed. Semester parent shown is conceptual version membership; physical `semesters.course_id` retains the existing course.

| Source page(s) | Source number | Source text | Database level | Proposed ID | Parent ID | Order | Status | Notes |
| --- | --- | --- | --- | --- | --- | ---: | --- | --- |
| 1 | 1 | Physics 1 (SP015) | Course (existing) | matriculation-physics | - | 0 | existing | Specific SP015 title belongs to new version; retain broader existing course. |
| 1-12 | SP015 / Sesi 2022/2023 | CURRICULUM SPECIFICATIONS PHYSICS 1 (SP015) | Curriculum Version | curriculum-sp015-2022-2023 | matriculation-physics | 1 | draft | Code combines actual course code and effective academic session; exact ISO dates not stated. |
| 1 | 4 | Semester I | Semester | semester-sp015-2022-2023-1 | curriculum-sp015-2022-2023 | 1 | active | Semester I mapped to existing display convention Semester 1; new version-specific row, no LEGACY mutation. |
| 3; 5 | 1.0 | Physical Quantities and Measurements | Chapter | chapter-sp015-2022-2023-1 | semester-sp015-2022-2023-1 | 1 | active | Source labels this unit Topic 1; mapped to database Chapter. Outline title preserved. |
| 3; 5 | 1.1 | Dimensions of physical quantities | Topic | topic-sp015-2022-2023-1-1 | chapter-sp015-2022-2023-1 | 1 | active | No explicit structural subtopics; lettered/roman outcomes retained separately. |
| 3; 5 | 1.2 | Scalars and vectors | Topic | topic-sp015-2022-2023-1-2 | chapter-sp015-2022-2023-1 | 2 | active | No explicit structural subtopics; lettered/roman outcomes retained separately. |
| 3; 5 | 1.3 | Significant figures and uncertainties analysis | Topic | topic-sp015-2022-2023-1-3 | chapter-sp015-2022-2023-1 | 3 | active | No explicit structural subtopics; lettered/roman outcomes retained separately. HUMAN REVIEW: detailed heading differs; see variants. |
| 3; 5 | 2.0 | Kinematics of Linear Motion | Chapter | chapter-sp015-2022-2023-2 | semester-sp015-2022-2023-1 | 2 | active | Source labels this unit Topic 2; mapped to database Chapter. Outline title preserved. HUMAN REVIEW: detailed heading differs; see variants. |
| 3; 5 | 2.1 | Linear motion | Topic | topic-sp015-2022-2023-2-1 | chapter-sp015-2022-2023-2 | 1 | active | No explicit structural subtopics; lettered/roman outcomes retained separately. |
| 3; 5 | 2.2 | Uniformly accelerated motion | Topic | topic-sp015-2022-2023-2-2 | chapter-sp015-2022-2023-2 | 2 | active | No explicit structural subtopics; lettered/roman outcomes retained separately. |
| 3; 6 | 2.3 | Projectile motion | Topic | topic-sp015-2022-2023-2-3 | chapter-sp015-2022-2023-2 | 3 | active | No explicit structural subtopics; lettered/roman outcomes retained separately. |
| 3; 6 | 3.0 | Dynamics of Linear Motion | Chapter | chapter-sp015-2022-2023-3 | semester-sp015-2022-2023-1 | 3 | active | Source labels this unit Topic 3; mapped to database Chapter. Outline title preserved. |
| 3; 6 | 3.1 | Momentum and impulse | Topic | topic-sp015-2022-2023-3-1 | chapter-sp015-2022-2023-3 | 1 | active | No explicit structural subtopics; lettered/roman outcomes retained separately. |
| 3; 6 | 3.2 | Conservation of linear momentum | Topic | topic-sp015-2022-2023-3-2 | chapter-sp015-2022-2023-3 | 2 | active | No explicit structural subtopics; lettered/roman outcomes retained separately. |
| 3; 6 | 3.3 | Basic of forces and free body diagram | Topic | topic-sp015-2022-2023-3-3 | chapter-sp015-2022-2023-3 | 3 | active | No explicit structural subtopics; lettered/roman outcomes retained separately. |
| 3; 6 | 3.4 | Newton’s Laws of Motion | Topic | topic-sp015-2022-2023-3-4 | chapter-sp015-2022-2023-3 | 4 | active | No explicit structural subtopics; lettered/roman outcomes retained separately. |
| 3; 7 | 4.0 | Work, Energy and Power | Chapter | chapter-sp015-2022-2023-4 | semester-sp015-2022-2023-1 | 4 | active | Source labels this unit Topic 4; mapped to database Chapter. Outline title preserved. |
| 3; 7 | 4.1 | Work | Topic | topic-sp015-2022-2023-4-1 | chapter-sp015-2022-2023-4 | 1 | active | No explicit structural subtopics; lettered/roman outcomes retained separately. |
| 3; 7 | 4.2 | Energy and Conservation of Energy | Topic | topic-sp015-2022-2023-4-2 | chapter-sp015-2022-2023-4 | 2 | active | No explicit structural subtopics; lettered/roman outcomes retained separately. |
| 3; 7 | 4.3 | Power | Topic | topic-sp015-2022-2023-4-3 | chapter-sp015-2022-2023-4 | 3 | active | No explicit structural subtopics; lettered/roman outcomes retained separately. |
| 3; 7 | 5.0 | Circular Motion | Chapter | chapter-sp015-2022-2023-5 | semester-sp015-2022-2023-1 | 5 | active | Source labels this unit Topic 5; mapped to database Chapter. Outline title preserved. |
| 3; 7 | 5.1 | Parameters in circular motion | Topic | topic-sp015-2022-2023-5-1 | chapter-sp015-2022-2023-5 | 1 | active | No explicit structural subtopics; lettered/roman outcomes retained separately. |
| 3; 7 | 5.2 | Uniform circular motion | Topic | topic-sp015-2022-2023-5-2 | chapter-sp015-2022-2023-5 | 2 | active | No explicit structural subtopics; lettered/roman outcomes retained separately. |
| 3; 7 | 5.3 | Centripetal force | Topic | topic-sp015-2022-2023-5-3 | chapter-sp015-2022-2023-5 | 3 | active | No explicit structural subtopics; lettered/roman outcomes retained separately. |
| 4; 8 | 6.0 | Rotation of Rigid Body | Chapter | chapter-sp015-2022-2023-6 | semester-sp015-2022-2023-1 | 6 | active | Source labels this unit Topic 6; mapped to database Chapter. Outline title preserved. |
| 4; 8 | 6.1 | Rotational kinematics | Topic | topic-sp015-2022-2023-6-1 | chapter-sp015-2022-2023-6 | 1 | active | No explicit structural subtopics; lettered/roman outcomes retained separately. |
| 4; 8 | 6.2 | Equilibrium of a uniform rigid body | Topic | topic-sp015-2022-2023-6-2 | chapter-sp015-2022-2023-6 | 2 | active | No explicit structural subtopics; lettered/roman outcomes retained separately. |
| 4; 8 | 6.3 | Rotational dynamics | Topic | topic-sp015-2022-2023-6-3 | chapter-sp015-2022-2023-6 | 3 | active | No explicit structural subtopics; lettered/roman outcomes retained separately. |
| 4; 8 | 6.4 | Conservation of angular momentum | Topic | topic-sp015-2022-2023-6-4 | chapter-sp015-2022-2023-6 | 4 | active | No explicit structural subtopics; lettered/roman outcomes retained separately. |
| 4; 9 | 7.0 | Simple Harmonic Motion and Waves | Chapter | chapter-sp015-2022-2023-7 | semester-sp015-2022-2023-1 | 7 | active | Source labels this unit Topic 7; mapped to database Chapter. Outline title preserved. HUMAN REVIEW: detailed heading differs; see variants. |
| 4; 9 | 7.1 | Kinematics of simple harmonic motion | Topic | topic-sp015-2022-2023-7-1 | chapter-sp015-2022-2023-7 | 1 | active | No explicit structural subtopics; lettered/roman outcomes retained separately. |
| 4; 9 | 7.2 | Graphs of simple harmonic motion | Topic | topic-sp015-2022-2023-7-2 | chapter-sp015-2022-2023-7 | 2 | active | No explicit structural subtopics; lettered/roman outcomes retained separately. |
| 4; 9 | 7.3 | Period of simple harmonic motion | Topic | topic-sp015-2022-2023-7-3 | chapter-sp015-2022-2023-7 | 3 | active | No explicit structural subtopics; lettered/roman outcomes retained separately. |
| 4; 9 | 7.4 | Properties of waves | Topic | topic-sp015-2022-2023-7-4 | chapter-sp015-2022-2023-7 | 4 | active | No explicit structural subtopics; lettered/roman outcomes retained separately. |
| 4; 9 | 7.5 | Superposition of waves | Topic | topic-sp015-2022-2023-7-5 | chapter-sp015-2022-2023-7 | 5 | active | No explicit structural subtopics; lettered/roman outcomes retained separately. |
| 4; 10 | 7.6 | Application of standing waves | Topic | topic-sp015-2022-2023-7-6 | chapter-sp015-2022-2023-7 | 6 | active | No explicit structural subtopics; lettered/roman outcomes retained separately. |
| 4; 10 | 7.7 | Doppler Effect | Topic | topic-sp015-2022-2023-7-7 | chapter-sp015-2022-2023-7 | 7 | active | No explicit structural subtopics; lettered/roman outcomes retained separately. |
| 4; 10 | 8.0 | Physics of Matters | Chapter | chapter-sp015-2022-2023-8 | semester-sp015-2022-2023-1 | 8 | active | Source labels this unit Topic 8; mapped to database Chapter. Outline title preserved. |
| 4; 10 | 8.1 | Stress and strain | Topic | topic-sp015-2022-2023-8-1 | chapter-sp015-2022-2023-8 | 1 | active | No explicit structural subtopics; lettered/roman outcomes retained separately. |
| 4; 10 | 8.2 | Young’s Modulus | Topic | topic-sp015-2022-2023-8-2 | chapter-sp015-2022-2023-8 | 2 | active | No explicit structural subtopics; lettered/roman outcomes retained separately. |
| 4; 10 | 8.3 | Heat conduction | Topic | topic-sp015-2022-2023-8-3 | chapter-sp015-2022-2023-8 | 3 | active | No explicit structural subtopics; lettered/roman outcomes retained separately. |
| 4; 10 | 8.4 | Thermal expansion | Topic | topic-sp015-2022-2023-8-4 | chapter-sp015-2022-2023-8 | 4 | active | No explicit structural subtopics; lettered/roman outcomes retained separately. |
| 4; 11 | 9.0 | Kinetic Theory of Gases and Thermodynamics | Chapter | chapter-sp015-2022-2023-9 | semester-sp015-2022-2023-1 | 9 | active | Source labels this unit Topic 9; mapped to database Chapter. Outline title preserved. |
| 4; 11 | 9.1 | Kinetic theory of gases | Topic | topic-sp015-2022-2023-9-1 | chapter-sp015-2022-2023-9 | 1 | active | No explicit structural subtopics; lettered/roman outcomes retained separately. |
| 4; 11 | 9.2 | Molecular kinetic energy and internal energy | Topic | topic-sp015-2022-2023-9-2 | chapter-sp015-2022-2023-9 | 2 | active | No explicit structural subtopics; lettered/roman outcomes retained separately. |
| 4; 11 | 9.3 | First Law of Thermodynamics | Topic | topic-sp015-2022-2023-9-3 | chapter-sp015-2022-2023-9 | 3 | active | No explicit structural subtopics; lettered/roman outcomes retained separately. |
| 4; 11 | 9.4 | Thermodynamic Processes | Topic | topic-sp015-2022-2023-9-4 | chapter-sp015-2022-2023-9 | 4 | active | No explicit structural subtopics; lettered/roman outcomes retained separately. HUMAN REVIEW: detailed heading differs; see variants. |
| 4; 11 | 9.5 | Thermodynamic Work | Topic | topic-sp015-2022-2023-9-5 | chapter-sp015-2022-2023-9 | 5 | active | No explicit structural subtopics; lettered/roman outcomes retained separately. HUMAN REVIEW: detailed heading differs; see variants. |

## Source heading variants requiring review

Proposed display text keeps the Course Content Outline on pp. 3-4. Detailed Teaching Learning Outcomes variants are preserved here and in the sidecar; no silent correction.

| Number | Outline wording (proposed) | Detailed wording | Pages |
| --- | --- | --- | --- |
| 1.3 | Significant figures and uncertainties analysis | Significant figures and uncertainties analysis (Laboratory works) | 3; 5 |
| 2.0 | Kinematics of Linear Motion | Kinematics of linear motion | 3; 5 |
| 7.0 | Simple Harmonic Motion and Waves | Simple Harmonic motion and waves | 4; 9 |
| 9.4 | Thermodynamic Processes | Thermodynamic processes | 4; 11 |
| 9.5 | Thermodynamic Work | Thermodynamics work | 4; 11 |

Apparent source wording: `Basic of forces and free body diagram` (3.3) and `Physics of Matters` (8.0) remain unchanged. Item 9.5 has a genuine wording variant, `Thermodynamic Work` versus `Thermodynamics work`; human review must decide any later change. No missing or duplicated structural numbers, or repeated normalized sibling names, were found.

## Source completeness and metadata

| Source pages / section | Disposition |
| --- | --- |
| All pages: repeating title, effective-session footer and pagination | METADATA ONLY: provenance |
| p. 1 sections 1 and 4 | IMPORTED AS STRUCTURE: version/code and semester mapping |
| p. 1 sections 2-3 and 5-7 | METADATA ONLY: synopsis, staff, credit 5, prerequisites, 3 CLOs and MQF LOC |
| p. 2 section 8 | METADATA ONLY: 5 PEOs, 10 PLOs and mapping matrix |
| p. 3 sections 9-10 | METADATA ONLY: CLO/PLO mappings, teaching/assessment methods and transferable skills |
| pp. 3-4 section 11, all 45 numbered headings | IMPORTED AS STRUCTURE: 9 chapters and 36 topics |
| pp. 3-4 section 11 remaining cells | METADATA ONLY: CLO associations, L/T/P/O and independent SLT, assessment weights, totals 180/205 |
| p. 4 section 12 | METADATA ONLY: special resources None |
| p. 5 section 13 | METADATA ONLY: all 3 bibliographic references, not alternate syllabus sources |
| pp. 5-11 section 14, all 9 repeated unit / 36 item headings | IMPORTED AS STRUCTURE via outline mapping; variant wording retained as metadata |
| pp. 5-11 all lettered outcomes, roman lists, formulas, experiments 1-6, remarks, inclusions and exclusions | METADATA ONLY: topicSpecifications plus full page text/images; no tags/questions/assets |
| p. 12 panel table, all 13 panels and affiliations | METADATA ONLY: provenance |
| Semester 2 | NOT APPLICABLE: absent from source and explicitly outside this task |

Source metadata is not currently stored in the curriculum schema. Keep it as local import-reference metadata (option A); a future dedicated schema extension would be needed to query/display outcomes. Question tags/teacher notes are not curriculum metadata fields. No migration 004 is needed for this hierarchy.

The sidecar preserves every page and all 36 detailed blocks. Text extraction mangles some mathematical glyphs; consult the original PDF or page PNGs for formula fidelity. No formulas were transcribed into database fields.

Local reference artifacts: `data/curriculum-import/sp015-dry-run/source-metadata.json`, `source-mapping.json`, `source-structure.independent.json`, and `pages/page-1.png` through `page-12.png`.

See [the import dry-run report](SP015_CURRICULUM_IMPORT_DRY_RUN_REPORT.md) for validation, ID rules, production audit and the future approval gate.
