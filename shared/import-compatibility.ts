import {
  questionPackageSchema,
  importManifestSchema,
  importLimits,
  type SelectedDifficulty,
} from './question-import.js';
import { z } from 'zod';

type ObjectValue = Record<string, unknown>;
const portableProvenancePaths = [
  '/metadata/question_id',
  '/metadata/question_source',
  '/metadata/subject',
  '/metadata/programme',
  '/metadata/language',
] as const;
export type ImportDiagnostic = {
  category:
    | 'mapped'
    | 'optional'
    | 'required'
    | 'ambiguous'
    | 'unsupported'
    | 'conflict'
    | 'security'
    | 'default';
  message: string;
  sourcePath: string;
  destinationPath?: string;
  blocking: boolean;
};
export type MappingReview = {
  confirmedDifficulty?: SelectedDifficulty;
  classificationApproved?: boolean;
  /** Canonical destination JSON pointer -> original source JSON pointer. */
  mappings?: Record<string, string>;
  /** Only explicitly reviewed NONACADEMIC source paths can be excluded. */
  administrativePaths?: string[];
  /** Full canonical candidate edited by the administrator. Source coverage is rechecked. */
  candidate?: unknown;
};
export const mappingReviewSchema = z
  .object({
    confirmedDifficulty: z.enum(['Easy', 'Medium', 'Hard']).optional(),
    classificationApproved: z.boolean().optional(),
    mappings: z.record(z.string().max(500), z.string().max(500)).optional(),
    administrativePaths: z.array(z.string().max(500)).max(100).optional(),
    candidate: z.unknown().optional(),
  })
  .strict();
export const compatibilitySubmissionSchema = z
  .object({ source: z.unknown(), review: mappingReviewSchema })
  .strict();
export type CompatibilityResult = {
  format: string;
  sourceVersion: string;
  adapter: string;
  candidate: ObjectValue;
  diagnostics: ImportDiagnostic[];
  valid: boolean;
  lossless: boolean;
  manualRequired: boolean;
  difficulty?: SelectedDifficulty;
  sourcePaths: string[];
};
export type ImportAdapter = {
  id: string;
  format: string;
  versions: readonly string[];
  mode: 'canonical' | 'portable' | 'aliases' | 'manual';
  matches: (source: ObjectValue) => boolean;
  version: (source: ObjectValue) => string;
};
/** Ordered detection profiles. New versions need an explicit profile and compatibility tests. */
export const adapterRegistry: readonly ImportAdapter[] = [
  {
    id: 'canonical-v1@1',
    format: 'Master JSON',
    versions: ['1'],
    mode: 'canonical',
    matches: (s) =>
      Object.hasOwn(s, 'schemaVersion') || s.kind === 'matriculation-physics-question',
    version: (s) => String(s.schemaVersion),
  },
  {
    id: 'portable-worked-v1.1@2',
    format: 'Portable physics JSON',
    versions: ['1.1'],
    mode: 'portable',
    matches: (s) =>
      s.format_identifier === 'matriculation-physics-question-portable-json' &&
      object(s.question) &&
      object(s.question.stem),
    version: (s) => String(s.format_version),
  },
  {
    id: 'portable-v1.1@1',
    format: 'Portable physics JSON',
    versions: ['1.1'],
    mode: 'portable',
    matches: (s) => s.format_identifier === 'matriculation-physics-question-portable-json',
    version: (s) => String(s.format_version),
  },
  {
    id: 'aliases@1',
    format: 'Recognized field aliases',
    versions: ['unversioned'],
    mode: 'aliases',
    matches: (s) =>
      [
        'title',
        'question_title',
        'name',
        'scenario',
        'stem',
        'question_text',
        'question',
        'metadata',
      ].some((key) => Object.hasOwn(s, key)),
    version: (s) => String(s.format_version ?? 'unversioned'),
  },
  {
    id: 'administrator-mapping@1',
    format: 'Unknown JSON',
    versions: ['unversioned'],
    mode: 'manual',
    matches: () => true,
    version: (s) => String(s.format_version ?? 'unversioned'),
  },
];
const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
const object = (value: unknown): value is ObjectValue =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const escape = (s: string) => s.replace(/~/g, '~0').replace(/\//g, '~1');
const child = (path: string, key: string | number) => `${path}/${escape(String(key))}`;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function normalizeFieldValue(value: unknown, destination: string, prose: boolean) {
  if (prose && typeof value === 'string') return normalizeMathDelimiters(value);
  if (destination.endsWith('/blocks') && Array.isArray(value))
    return value.map((b: unknown) =>
      object(b) && b.type === 'paragraph' && typeof b.text === 'string'
        ? { ...b, text: normalizeMathDelimiters(b.text) }
        : b,
    );
  if (destination.endsWith('/equationLatex') && typeof value === 'string') {
    const wrapped = /^(?:\\\(([\s\S]*)\\\)|\\\[([\s\S]*)\\\]|\$\$([\s\S]*)\$\$|\$([^$]*)\$)$/.exec(
      value,
    );
    if (wrapped) return wrapped.slice(1).find((v) => v !== undefined);
  }
  return value;
}
/** Delimiter-only conversion: never modify a mathematical expression body. */
export function normalizeMathDelimiters(text: string) {
  return text
    .replace(/\\\(([\s\S]*?)\\\)/g, (_whole, body: string) => `$${body}$`)
    .replace(/\\\[([\s\S]*?)\\\]/g, (_whole, body: string) => `$$${body}$$`);
}
export function checkImportStructure(input: unknown, bytes = importLimits.packageBytes) {
  let nodes = 0;
  const visit = (value: unknown, depth: number) => {
    if (++nodes > 100000 || depth > 32)
      throw new Error(
        'package: JSON is too deeply nested or complex (32 levels / 100,000 values maximum).',
      );
    if (typeof value === 'number' && !Number.isFinite(value))
      throw new Error('package: Numbers must be finite.');
    if (Array.isArray(value)) value.forEach((v) => visit(v, depth + 1));
    else if (object(value)) {
      if (![Object.prototype, null].includes(Object.getPrototypeOf(value)))
        throw new Error('package: Only plain JSON objects are accepted.');
      for (const [key, v] of Object.entries(value)) {
        if (forbidden.has(key)) throw new Error(`package: Unsafe object key ${key}.`);
        visit(v, depth + 1);
      }
    } else if (value !== null && !['string', 'number', 'boolean'].includes(typeof value))
      throw new Error('package: Only JSON values are accepted.');
  };
  visit(input, 0);
  if (new TextEncoder().encode(JSON.stringify(input)).length > bytes)
    throw new Error('package: JSON exceeds the permitted size.');
}
export function parseImportSource(source: string): unknown {
  if (new TextEncoder().encode(source).length > importLimits.packageBytes)
    throw new Error('package: Question JSON exceeds 5 MiB');
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error('package: Invalid JSON; check commas, quotes and escaped LaTeX backslashes');
  }
  checkImportStructure(parsed);
  // JSON.parse alone silently keeps the last duplicate key. Reject ambiguous files.
  const stack: { object: boolean; expectsKey: boolean; keys: Set<string> }[] = [];
  for (const match of source.matchAll(/"(?:\\.|[^"\\])*"|[{}[\],:]|[^\s{}[\],:]+/g)) {
    const token = match[0],
      frame = stack.at(-1);
    if (token === '{' || token === '[')
      stack.push({ object: token === '{', expectsKey: token === '{', keys: new Set() });
    else if (token === '}' || token === ']') stack.pop();
    else if (token === ',' && frame?.object) frame.expectsKey = true;
    else if (token.startsWith('"') && frame?.object && frame.expectsKey) {
      const key = JSON.parse(token) as string;
      if (frame.keys.has(key))
        throw new Error(
          `package: Duplicate JSON key ${key}; preserve and disambiguate both values before importing.`,
        );
      frame.keys.add(key);
      frame.expectsKey = false;
    }
  }
  return parsed;
}
function pointer(root: unknown, path: string): unknown {
  if (path === '') return root;
  if (!path.startsWith('/')) throw new Error('mapping: Use a JSON pointer beginning with /.');
  let value = root;
  for (const encoded of path.slice(1).split('/')) {
    const key = encoded.replace(/~1/g, '/').replace(/~0/g, '~');
    if (
      forbidden.has(key) ||
      !(object(value) || Array.isArray(value)) ||
      !Object.hasOwn(value, key)
    )
      return undefined;
    value = (value as ObjectValue)[key];
  }
  return value;
}
function assign(root: ObjectValue, path: string, value: unknown) {
  const keys = path
    .slice(1)
    .split('/')
    .map((k) => k.replace(/~1/g, '/').replace(/~0/g, '~'));
  if (
    !path.startsWith('/') ||
    ![
      'question',
      'classification',
      'difficulty',
      'parts',
      'solutions',
      'hints',
      'tags',
      'assets',
    ].includes(keys[0]) ||
    keys.length > 16 ||
    keys.some((k) => forbidden.has(k) || !k || (/^\d+$/.test(k) && Number(k) >= 100))
  )
    throw new Error('mapping: Unsupported canonical destination.');
  let target: ObjectValue = root;
  for (const [i, key] of keys.slice(0, -1).entries()) {
    if (!object(target[key]) && !Array.isArray(target[key]))
      target[key] = /^\d+$/.test(keys[i + 1]) ? [] : {};
    target = target[key] as ObjectValue;
  }
  target[keys.at(-1)!] = structuredClone(value);
}
export function normalizeQuestionImport(
  input: unknown,
  review: MappingReview = {},
  manifest = false,
): CompatibilityResult {
  checkImportStructure(input, manifest ? importLimits.manifestBytes : importLimits.packageBytes);
  checkImportStructure(review);
  mappingReviewSchema.parse(review);
  const diagnostics: ImportDiagnostic[] = [];
  const report = (
    category: ImportDiagnostic['category'],
    message: string,
    sourcePath: string,
    destinationPath?: string,
    blocking = false,
  ) => diagnostics.push({ category, message, sourcePath, destinationPath, blocking });
  const root = object(input) ? input : {};
  const matches = adapterRegistry.filter((a) => a.matches(root));
  const family = matches[0].mode;
  const selected =
    matches.find((a) => a.mode === family && a.versions.includes(a.version(root))) ?? matches[0];
  const canonical = selected.mode === 'canonical',
    portable = selected.mode === 'portable',
    recognized = selected.mode === 'aliases';
  const format = selected.format,
    sourceVersion = selected.version(root);
  const workedPortable = selected.id === 'portable-worked-v1.1@2';
  const manual = Boolean(
    review.candidate ||
    Object.keys(review.mappings ?? {}).length ||
    review.administrativePaths?.length ||
    review.classificationApproved,
  );
  const adapter = manual ? 'administrator-mapping@1' : selected.id;
  const unsupportedVersion = !selected.versions.includes(sourceVersion);
  if (unsupportedVersion)
    report(
      'unsupported',
      `Unsupported source version ${sourceVersion}; a version-specific adapter is required.`,
      canonical ? '/schemaVersion' : '/format_version',
      undefined,
      true,
    );
  if (root.format_identifier !== undefined && !portable)
    report(
      'unsupported',
      'Unknown format identifier requires an explicitly supported adapter.',
      '/format_identifier',
      undefined,
      !(manual && review.administrativePaths?.includes('/format_identifier')),
    );
  const consumed = new Set<string>();
  const origins: { from: string; to: string; original: unknown; normalized: unknown }[] = [];
  const containers: { from: string; to: string; normalized: unknown }[] = [];
  const defaults = (to: string, value: unknown, why: string) => {
    report('default', why, '', to);
    return value;
  };
  const read = (src: ObjectValue, path: string, aliases: string[], to: string, prose = false) => {
    const keys = aliases.filter((key) => Object.hasOwn(src, key));
    if (!keys.length) return undefined;
    for (const key of keys) consumed.add(child(path, key));
    const value = src[keys[0]];
    if (keys.some((key) => !same(src[key], value)))
      report(
        'conflict',
        'Conflicting equivalent fields; review each original value.',
        child(path, keys[0]),
        to,
        true,
      );
    const normalized = normalizeFieldValue(value, to, prose);
    if (to.endsWith('/blocks')) containers.push({ from: child(path, keys[0]), to, normalized });
    for (const key of keys)
      origins.push({
        from: child(path, key),
        to,
        original: src[key],
        normalized: normalizeFieldValue(src[key], to, prose),
      });
    report('mapped', 'Source field mapped without rewriting content.', child(path, keys[0]), to);
    return normalized;
  };
  const extra = (src: ObjectValue, path: string) => {
    for (const key of Object.keys(src)) {
      const p = child(path, key);
      if (!consumed.has(p))
        report(
          'unsupported',
          'Unrecognized source information. Map it or explicitly identify it as nonacademic metadata; academic content must not be discarded.',
          p,
          undefined,
          true,
        );
    }
  };
  // This profile emits source text/equations into existing content blocks. Every
  // converted leaf has a destination and the resulting blocks are guarded below.
  const converted = (from: string, to: string, original: unknown, normalized: unknown) => {
    consumed.add(from);
    origins.push({ from, to, original, normalized });
    report('mapped', 'Versioned portable field represented in canonical content.', from, to);
    return normalized;
  };
  const representation = (src: ObjectValue, path: string, key: string, expected: unknown) => {
    const from = child(path, key);
    consumed.add(from);
    if (src[key] !== expected)
      report(
        'unsupported',
        `Expected ${key}=${String(expected)} in this portable profile.`,
        from,
        undefined,
        true,
      );
    else
      report(
        'mapped',
        'Supported source presentation flag retained by the canonical renderer.',
        from,
      );
  };
  const portableText = (value: unknown, path: string, to: string) => {
    if (!object(value)) return value;
    representation(value, path, 'format', 'markdown_latex');
    const text = read(value, path, ['text'], to, true);
    extra(value, path);
    return text;
  };
  const portableBlocks = (value: unknown, path: string, dest: string) => {
    if (!Array.isArray(value)) {
      report(
        'unsupported',
        'Portable worked equations must be an ordered array.',
        path,
        dest,
        true,
      );
      return [];
    }
    if (value.length > 100) throw new Error(`${path}: At most 100 worked equations are supported.`);
    return value.map((v, i) => {
      const p = child(path, i),
        d = child(dest, i);
      if (!object(v)) return v;
      representation(v, p, 'format', 'latex');
      representation(v, p, 'display', true);
      const latex = read(v, p, ['value'], `${d}/latex`);
      extra(v, p);
      return { type: 'math', latex };
    });
  };
  let candidate: ObjectValue;
  if (canonical) {
    candidate = structuredClone(root);
    const trace = (value: unknown, p: string) => {
      if (object(value) || Array.isArray(value))
        for (const [key, v] of Object.entries(value)) trace(v, child(p, key));
      else origins.push({ from: p, to: p, original: value, normalized: value });
    };
    trace(root, '');
  } else {
    candidate = {
      schemaVersion: 1,
      kind: 'matriculation-physics-question',
      classification: {},
      question: {},
      parts: [],
      solutions: [],
      hints: [],
      tags: [],
      assets: [],
    };
    for (const key of ['format_identifier', 'format_version'])
      if (portable) consumed.add(child('', key));
    const q = object(root.question) ? root.question : root;
    const qp = q === root ? '' : '/question';
    if (q !== root) consumed.add('/question');
    const meta = object(root.metadata) ? root.metadata : {};
    if (object(root.metadata)) consumed.add('/metadata');
    const question: ObjectValue = candidate.question as ObjectValue;
    for (const [to, aliases, isProse] of [
      ['title', ['title', 'question_title', 'name', ...(workedPortable ? ['heading'] : [])], false],
      [
        'scenario',
        [
          'scenario',
          ...(!workedPortable ? ['stem'] : []),
          'question_text',
          ...(typeof q.question === 'string' ? ['question'] : []),
        ],
        true,
      ],
      ['totalMarks', ['totalMarks', 'total_marks', 'marks'], false],
      [
        'estimatedMinutes',
        ['estimatedMinutes', 'estimated_minutes', 'estimated_time_minutes'],
        false,
      ],
      ['questionType', ['questionType', 'question_type', 'type'], false],
      ['questionCode', ['questionCode', 'question_code'], false],
      ['blocks', ['blocks'], false],
    ] as const) {
      const a = read(q, qp, [...aliases], `/question/${to}`, isProse);
      const b =
        q === root
          ? undefined
          : read(
              root,
              '',
              [...aliases].filter((k) => k !== 'question'),
              `/question/${to}`,
              isProse,
            );
      const c = read(meta, '/metadata', [...aliases], `/question/${to}`, isProse);
      const values = [a, b, c].filter((v) => v !== undefined);
      if (values.some((v) => !same(v, values[0])))
        report('conflict', 'Question and metadata disagree.', qp, `/question/${to}`, true);
      if (values.length) question[to] = values[0];
    }
    if (workedPortable) {
      consumed.add('/question/stem');
      question.scenario = portableText(q.stem, '/question/stem', '/question/scenario');
      const blocks: unknown[] = [];
      // Redundant source labels are represented by canonical marks/difficulty,
      // rather than adding a second copy of the app's question heading/footer.
      for (const [key, expected, to, normalized] of [
        [
          'topic_line',
          `${String(question.totalMarks)} marks`,
          '/question/totalMarks',
          question.totalMarks,
        ],
        [
          'marks_label',
          `[${String(question.totalMarks)} marks]`,
          '/question/totalMarks',
          question.totalMarks,
        ],
        [
          'difficulty_label',
          `DIFFICULTY: ${String(meta.difficulty)}`,
          '/difficulty',
          meta.difficulty,
        ],
      ] as const) {
        if (!Object.hasOwn(q, key)) continue;
        converted(child(qp, key), to, q[key], normalized);
        if (q[key] !== expected)
          report(
            'conflict',
            'Portable presentation label disagrees with its marks/difficulty field.',
            child(qp, key),
            to,
            true,
          );
      }
      if (Object.hasOwn(q, 'given')) {
        consumed.add('/question/given');
        blocks.push({
          type: 'paragraph',
          text: portableText(q.given, '/question/given', '/question/blocks/0/text'),
        });
      }
      if (question.blocks !== undefined)
        report(
          'conflict',
          'This profile cannot combine preexisting blocks with portable presentation fields.',
          '/question/blocks',
          undefined,
          true,
        );
      question.blocks = blocks;
      for (const [key, empty] of [
        ['diagram_asset_ids', []],
        ['diagram_caption', null],
      ] as const)
        if (Object.hasOwn(q, key) && same(q[key], empty)) consumed.add(child(qp, key));
      containers.push({ from: qp, to: '/question/blocks', normalized: structuredClone(blocks) });
    }
    if (question.scenario === undefined)
      question.scenario = defaults(
        '/question/scenario',
        '',
        'Empty scenario container; no statement was invented. Part/block content must satisfy canonical validation.',
      );
    const classification = object(root.classification) ? root.classification : {};
    if (object(root.classification)) consumed.add('/classification');
    for (const [to, aliases] of [
      [
        'curriculumVersionCode',
        ['curriculumVersionCode', 'curriculum_version_code', 'syllabus_version'],
      ],
      ['semester', ['semester', ...(workedPortable ? ['semester_display_name'] : [])]],
      ['chapter', ['chapter', 'chapter_name']],
      ['topic', ['topic', 'topic_name']],
      ['subtopic', ['subtopic', 'sub_topic']],
    ] as const) {
      const values = [
        read(classification, '/classification', [...aliases], `/classification/${to}`),
        read(root, '', [...aliases], `/classification/${to}`),
        read(meta, '/metadata', [...aliases], `/classification/${to}`),
      ].filter((v) => v !== undefined);
      if (values.some((v) => !same(v, values[0])))
        report(
          'conflict',
          'Classification sources disagree; no curriculum mapping was guessed.',
          '',
          `/classification/${to}`,
          true,
        );
      if (values.length) (candidate.classification as ObjectValue)[to] = values[0];
    }
    if ((candidate.classification as ObjectValue).subtopic === undefined)
      (candidate.classification as ObjectValue).subtopic = defaults(
        '/classification/subtopic',
        null,
        'No subtopic supplied; nullable classification remains empty.',
      );
    const difficulties = [
      read(root, '', ['difficulty', 'difficulty_level'], '/difficulty'),
      read(meta, '/metadata', ['difficulty', 'difficulty_level'], '/difficulty'),
      q === root ? undefined : read(q, qp, ['difficulty', 'difficulty_level'], '/difficulty'),
    ].filter((v) => v !== undefined);
    if (difficulties.some((v) => !same(v, difficulties[0])))
      report('conflict', 'Difficulty sources disagree.', '', '/difficulty', true);
    if (difficulties.length) candidate.difficulty = difficulties[0];
    const normalizeRecord = (
      value: unknown,
      p: string,
      dest: string,
      fields: [string, string[], boolean?][],
      empty: string[] = [],
    ) => {
      if (!object(value)) return value;
      const out: ObjectValue = {};
      for (const [to, aliases, prose] of fields) {
        const v = read(value, p, aliases, `${dest}/${to}`, prose);
        if (v !== undefined) out[to] = v;
      }
      for (const to of empty)
        if (out[to] === undefined)
          out[to] = defaults(
            `${dest}/${to}`,
            '',
            'Absent optional textual content represented by an empty canonical string.',
          );
      return out;
    };
    const rawParts =
      read(root, '', ['parts', 'subquestions'], '/parts') ??
      (q === root ? undefined : read(q, qp, ['parts', 'subquestions'], '/parts'));
    const parts: unknown[] = [];
    const walkParts = (list: unknown, p: string, parent: string | null) => {
      if (!Array.isArray(list)) {
        report('ambiguous', 'Parts must be an ordered array.', p, '/parts', true);
        return;
      }
      list.forEach((v, i) => {
        if (parts.length >= 100)
          throw new Error(
            'parts: The canonical schema supports at most 100 parts, including nested subparts.',
          );
        const source = child(p, i),
          dest = `/parts/${parts.length}`;
        const out = normalizeRecord(v, source, dest, [
          ['id', ['id', 'part_id']],
          ['label', ['label']],
          ['prompt', ['prompt', 'question_text', 'stem', 'question'], true],
          ['marks', ['marks']],
          ['order', ['order']],
          ['parentId', ['parentId', 'parent_id']],
          ['blocks', ['blocks']],
        ]);
        if (!object(v) || !object(out)) {
          parts.push(out);
          return;
        }
        if (out.id === undefined)
          out.id = defaults(
            `${dest}/id`,
            `import-part-${parts.length + 1}`,
            'Deterministic package-local part identifier; no academic content generated.',
          );
        if (out.label === undefined)
          out.label = defaults(
            `${dest}/label`,
            String(i + 1),
            'Structural part label from source array position.',
          );
        if (out.order === undefined)
          out.order = defaults(`${dest}/order`, i, 'Order retained from source array position.');
        if (out.parentId !== undefined && out.parentId !== parent && parent !== null)
          report(
            'conflict',
            'Explicit parent conflicts with nested part owner.',
            source,
            `${dest}/parentId`,
            true,
          );
        if (out.parentId === undefined) out.parentId = parent;
        parts.push(out);
        const nested = read(v, source, ['children', 'subparts'], '/parts');
        if (nested !== undefined)
          walkParts(
            nested,
            `${source}/${Object.hasOwn(v, 'children') ? 'children' : 'subparts'}`,
            String(out.id),
          );
        extra(v, source);
      });
    };
    if (rawParts !== undefined)
      walkParts(
        rawParts,
        `/${Object.hasOwn(root, 'parts') ? 'parts' : Object.hasOwn(root, 'subquestions') ? 'subquestions' : `question/${Object.hasOwn(q, 'parts') ? 'parts' : 'subquestions'}`}`,
        null,
      );
    candidate.parts = parts;
    const rawSchemes = read(
      root,
      '',
      ['solutions', 'answer_scheme', 'marking_scheme'],
      '/solutions',
    );
    if (rawSchemes !== undefined) {
      const schemes = Array.isArray(rawSchemes)
        ? rawSchemes
        : object(rawSchemes)
          ? [rawSchemes]
          : undefined;
      const base = `/${['solutions', 'answer_scheme', 'marking_scheme'].find((k) => Object.hasOwn(root, k))}`;
      if (!schemes)
        report(
          'ambiguous',
          'A marking scheme needs structured steps and explicit mark allocation; free text cannot supply these.',
          base,
          '/solutions',
          true,
        );
      else if (schemes.length > 100)
        throw new Error('solutions: The canonical schema supports at most 100 marking schemes.');
      else
        candidate.solutions = schemes.map((v, i) => {
          const p = Array.isArray(rawSchemes) ? child(base, i) : base,
            dest = `/solutions/${i}`;
          const out = normalizeRecord(
            v,
            p,
            dest,
            [
              ['partId', ['partId', 'part_id']],
              ['solution', ['solution', 'answer', 'final_answer'], true],
              ['equationLatex', ['equationLatex', 'equation_latex']],
              ['teacherNotes', ['teacherNotes', 'teacher_notes'], true],
              ['blocks', ['blocks']],
            ],
            ['solution', 'equationLatex', 'teacherNotes'],
          );
          if (!object(v) || !object(out)) return out;
          if (out.partId === undefined && !parts.length)
            out.partId = defaults(
              `${dest}/partId`,
              null,
              'Whole-question scheme: source has no parts.',
            );
          if (workedPortable) {
            const blocks: unknown[] = [];
            const heading = read(v, p, ['heading'], `${dest}/solution`, true);
            if (heading !== undefined) out.solution = heading;
            // Keep both the human LaTeX presentation and all supplied quantities,
            // units and roles. No numeric result or academic sentence is inferred.
            for (const key of ['given_values', 'final_answers', 'marking_allocation']) {
              if (!Object.hasOwn(v, key)) continue;
              consumed.add(child(p, key));
              const records = v[key];
              if (!Array.isArray(records) || records.length > 100) {
                report(
                  'unsupported',
                  'Portable quantity/allocation records must be an array of at most 100 records.',
                  child(p, key),
                  undefined,
                  true,
                );
                continue;
              }
              for (const [n, record] of records.entries()) {
                const rp = `${p}/${key}/${n}`;
                if (!object(record)) {
                  report(
                    'unsupported',
                    'Expected a structured portable quantity/allocation record.',
                    rp,
                    undefined,
                    true,
                  );
                  continue;
                }
                const fields =
                  key === 'given_values'
                    ? ['symbol', 'quantity', 'value', 'unit']
                    : key === 'final_answers'
                      ? ['quantity', 'value', 'unit', 'role']
                      : ['part', 'code', 'marks'];
                if (key === 'marking_allocation') {
                  const matching = Array.isArray(v.steps)
                    ? v.steps.filter((step) => object(step) && step.marking_code === record.code)
                    : [];
                  if (matching.length !== 1 || !same(matching[0].marks, record.marks))
                    report(
                      'conflict',
                      'Portable marking allocation must match exactly one source step code and mark award.',
                      rp,
                      undefined,
                      true,
                    );
                  if (
                    !Array.isArray(v.steps) ||
                    records.length !== v.steps.length ||
                    new Set(records.map((r) => (object(r) ? r.code : undefined))).size !==
                      records.length
                  )
                    report(
                      'conflict',
                      'Portable marking allocations must cover every source step exactly once.',
                      child(p, key),
                      undefined,
                      true,
                    );
                }
                const present = fields.filter((f) => Object.hasOwn(record, f));
                const text =
                  key === 'given_values'
                    ? `${String(record.quantity)} (${String(record.symbol)}): ${String(record.value)} ${String(record.unit)}`
                    : key === 'final_answers'
                      ? `${String(record.quantity)}: ${String(record.value)} ${String(record.unit)} (${String(record.role).replaceAll('_', ' ')})`
                      : `${String(record.part)}: ${String(record.code)} [${String(record.marks)} marks]`;
                if (present.length !== fields.length)
                  report(
                    'required',
                    'Portable quantity/allocation record is incomplete; supply its original fields explicitly.',
                    rp,
                    undefined,
                    true,
                  );
                const bd = `${dest}/blocks/${blocks.length}/text`;
                for (const f of present) {
                  if (!['string', 'number'].includes(typeof record[f]))
                    report(
                      'unsupported',
                      'Portable quantity fields must be text or numbers.',
                      child(rp, f),
                      undefined,
                      true,
                    );
                  converted(child(rp, f), bd, record[f], text);
                }
                blocks.push({ type: 'paragraph', text });
                const mathKey = key === 'given_values' ? 'presentation_latex' : 'latex';
                if (Object.hasOwn(record, mathKey)) {
                  const latex = read(
                    record,
                    rp,
                    [mathKey],
                    `${dest}/blocks/${blocks.length}/latex`,
                  );
                  blocks.push({ type: 'math', latex });
                }
                extra(record, rp);
              }
            }
            if (Object.hasOwn(v, 'total_marks')) {
              const total = read(v, p, ['total_marks'], '/question/totalMarks');
              if (!same(total, question.totalMarks))
                report(
                  'conflict',
                  'Scheme and question total marks disagree.',
                  child(p, 'total_marks'),
                  '/question/totalMarks',
                  true,
                );
            }
            if (out.blocks !== undefined)
              report(
                'conflict',
                'This profile cannot combine preexisting scheme blocks with portable quantities.',
                child(p, 'blocks'),
                undefined,
                true,
              );
            out.blocks = blocks;
            containers.push({ from: p, to: `${dest}/blocks`, normalized: structuredClone(blocks) });
          }
          const steps = read(v, p, ['steps', 'marking_steps'], `${dest}/steps`);
          if (Array.isArray(steps) && steps.length > 100)
            throw new Error(`${dest}/steps: At most 100 marking steps are supported per scheme.`);
          if (steps !== undefined)
            out.steps = Array.isArray(steps)
              ? steps.map((s, j) => {
                  const sp = `${p}/${Object.hasOwn(v, 'steps') ? 'steps' : 'marking_steps'}/${j}`,
                    sd = `${dest}/steps/${j}`;
                  const step = normalizeRecord(
                    s,
                    sp,
                    sd,
                    [
                      ['id', ['id', 'step_id']],
                      ['markingCode', ['markingCode', 'marking_code']],
                      ['number', ['number', 'step_number', ...(workedPortable ? ['step'] : [])]],
                      ['order', ['order']],
                      [
                        'explanation',
                        ['explanation', 'description', ...(workedPortable ? ['title'] : [])],
                        true,
                      ],
                      ['equationLatex', ['equationLatex', 'equation_latex', 'equation']],
                      ['working', ['working', 'calculation'], true],
                      ['markingPoint', ['markingPoint', 'marking_point']],
                      ['marks', ['marks']],
                      ['blocks', ['blocks']],
                    ],
                    ['explanation', 'equationLatex', 'working', 'markingPoint'],
                  );
                  if (object(step)) {
                    if (workedPortable && object(s)) {
                      if (step.id === undefined)
                        step.id = defaults(
                          `${sd}/id`,
                          `portable-scheme-${i + 1}-step-${j + 1}`,
                          'Structural step key for the hint contained by this source step.',
                        );
                      if (Object.hasOwn(s, 'worked_equations')) {
                        consumed.add(child(sp, 'worked_equations'));
                        if (step.blocks !== undefined)
                          report(
                            'conflict',
                            'Portable worked equations cannot replace supplied step blocks.',
                            child(sp, 'blocks'),
                            undefined,
                            true,
                          );
                        step.blocks = portableBlocks(
                          s.worked_equations,
                          child(sp, 'worked_equations'),
                          `${sd}/blocks`,
                        );
                        containers.push({
                          from: child(sp, 'worked_equations'),
                          to: `${sd}/blocks`,
                          normalized: structuredClone(step.blocks),
                        });
                      }
                      if (Object.hasOwn(s, 'student_hint')) {
                        const hd = `/hints/${(candidate.hints as unknown[]).length}`;
                        const text = read(s, sp, ['student_hint'], `${hd}/text`, true);
                        (candidate.hints as unknown[]).push({
                          id: `portable-hint-${i + 1}-${j + 1}`,
                          partId: out.partId,
                          solutionStepId: step.id,
                          text,
                          order: 0,
                        });
                      }
                    }
                    if (step.number === undefined)
                      step.number = defaults(
                        `${sd}/number`,
                        j + 1,
                        'Structural marking-step number follows source array order.',
                      );
                    if (step.order === undefined)
                      step.order = defaults(
                        `${sd}/order`,
                        j,
                        'Marking-step order retained from the source array.',
                      );
                  }
                  if (object(s)) extra(s, sp);
                  return step;
                })
              : steps;
          extra(v, p);
          return out;
        });
    }
    const rawHints = read(root, '', ['hints', 'student_hints'], '/hints');
    if (Array.isArray(rawHints) && rawHints.length > 100)
      throw new Error('hints: At most 100 hints are supported.');
    if (rawHints !== undefined)
      if (workedPortable && (candidate.hints as unknown[]).length)
        report(
          'conflict',
          'Portable inline hints and a separate hint collection require explicit mapping.',
          '/hints',
          undefined,
          true,
        );
    if (rawHints !== undefined)
      candidate.hints = Array.isArray(rawHints)
        ? rawHints.map((v, i) => {
            const p = `/${Object.hasOwn(root, 'hints') ? 'hints' : 'student_hints'}/${i}`,
              dest = `/hints/${i}`;
            if (typeof v === 'string') {
              origins.push({
                from: p,
                to: `${dest}/text`,
                original: v,
                normalized: normalizeMathDelimiters(v),
              });
              return {
                id: defaults(
                  `${dest}/id`,
                  `import-hint-${i + 1}`,
                  'Deterministic package-local hint identifier.',
                ),
                partId: defaults(
                  `${dest}/partId`,
                  null,
                  'Root string hint remains question-scoped; no part or step link inferred.',
                ),
                text: normalizeMathDelimiters(v),
                order: defaults(
                  `${dest}/order`,
                  i,
                  'Hint order retained from source array position.',
                ),
              };
            }
            const out = normalizeRecord(v, p, dest, [
              ['id', ['id']],
              ['partId', ['partId', 'part_id']],
              ['solutionStepId', ['solutionStepId', 'solution_step_id']],
              ['text', ['text', 'hint'], true],
              ['order', ['order']],
            ]);
            if (object(out)) {
              if (out.id === undefined)
                out.id = defaults(
                  `${dest}/id`,
                  `import-hint-${i + 1}`,
                  'Deterministic package-local hint identifier.',
                );
              if (out.partId === undefined)
                out.partId = defaults(
                  `${dest}/partId`,
                  null,
                  'Root hint remains question-scoped unless an explicit valid part relationship is supplied.',
                );
              if (out.order === undefined)
                out.order = defaults(
                  `${dest}/order`,
                  i,
                  'Hint order retained from source array position.',
                );
            }
            if (object(v)) extra(v, p);
            return out;
          })
        : rawHints;
    if (workedPortable && rawHints === undefined && (candidate.hints as unknown[]).length)
      containers.push({
        from: '/answer_scheme',
        to: '/hints',
        normalized: structuredClone(candidate.hints),
      });
    const rawTags = read(root, '', ['tags', 'keywords'], '/tags');
    candidate.tags = rawTags ?? [];
    if (workedPortable && Object.hasOwn(meta, 'syllabus_code')) {
      if (rawTags !== undefined)
        report(
          'conflict',
          'Portable syllabus information and supplied tags require explicit mapping.',
          '/tags',
          undefined,
          true,
        );
      // Curriculum information is academic. Provenance is left for explicit
      // nonacademic review by extra(meta), never automatically stored as tags.
      candidate.tags = [read(meta, '/metadata', ['syllabus_code'], '/tags/0')];
    }
    if (rawTags !== undefined)
      containers.push({ from: '/tags', to: '/tags', normalized: structuredClone(candidate.tags) });
    const rawAssets = read(root, '', ['assets', 'diagrams', 'figures'], '/assets');
    if (rawAssets !== undefined)
      candidate.assets = object(rawAssets)
        ? Object.entries(rawAssets).map(([key, v]) => (object(v) ? { ...v, key: v.key ?? key } : v))
        : rawAssets;
    if (rawAssets !== undefined)
      containers.push({
        from: '/assets',
        to: '/assets',
        normalized: structuredClone(candidate.assets),
      });
    extra(classification, '/classification');
    extra(meta, '/metadata');
    if (q !== root) extra(q, qp);
    extra(root, '');
    for (const key of ['hints', 'tags', 'assets'])
      if (!Object.hasOwn(root, key))
        report(
          'optional',
          `No ${key} supplied; empty collection contains no invented content.`,
          '',
          `/${key}`,
        );
  }
  if (review.candidate !== undefined) {
    if (!object(review.candidate))
      throw new Error('mapping: Canonical candidate must be an object.');
    candidate = structuredClone(review.candidate);
  }
  for (const [to, from] of Object.entries(review.mappings ?? {})) {
    assign({}, to, null); // Validate the destination even when the selected source is missing.
    if (
      review.administrativePaths?.some(
        (p) => isAdministrativeSourcePath(p) && (from === p || from.startsWith(p + '/')),
      )
    ) {
      report(
        'conflict',
        'Excluded metadata cannot also be mapped into the question payload.',
        from,
        to,
        true,
      );
      continue;
    }
    const v = pointer(input, from);
    if (v === undefined) {
      report('required', 'Source mapping path does not exist.', from, to, true);
      continue;
    }
    const normalized =
      typeof v === 'string' &&
      /\/(scenario|prompt|text|solution|explanation|working|teacherNotes)$/.test(to)
        ? normalizeMathDelimiters(v)
        : v;
    assign(candidate, to, normalized);
    origins.push({ from, to, original: v, normalized });
    report('mapped', 'Administrator selected this exact source field.', from, to);
  }
  const sourceDifficulty =
    typeof candidate.difficulty === 'string'
      ? (['Easy', 'Medium', 'Hard'] as const).find(
          (d) => d.toLowerCase() === String(candidate.difficulty).trim().toLowerCase(),
        )
      : undefined;
  if (workedPortable && Array.isArray(candidate.tags))
    for (const path of portableProvenancePaths)
      if (
        review.administrativePaths?.includes(path) &&
        typeof pointer(input, path) === 'string' &&
        candidate.tags.includes(pointer(input, path))
      )
        report(
          'conflict',
          'Excluded provenance metadata cannot become question tags.',
          path,
          '/tags',
          true,
        );
  const confirmedAmbiguousDifficulty = Boolean(
    review.confirmedDifficulty && !sourceDifficulty && typeof candidate.difficulty === 'string',
  );
  if (
    review.confirmedDifficulty &&
    !sourceDifficulty &&
    (candidate.difficulty === undefined || typeof candidate.difficulty === 'string')
  ) {
    if (candidate.difficulty !== undefined) candidate.difficulty = review.confirmedDifficulty;
    report(
      'default',
      'Administrator explicitly supplied or confirmed missing/ambiguous difficulty; it was not inferred from marks or content.',
      '/difficulty',
      '/difficulty',
    );
  }
  // Unknown source containers are cleared only when all their values have destinations.
  const covered = (value: unknown, from: string): boolean => {
    if (
      (from.endsWith('/schemaVersion') && value === 1 && candidate.schemaVersion === 1) ||
      (from.endsWith('/kind') &&
        value === 'matriculation-physics-question' &&
        candidate.kind === value)
    )
      return true;
    if (origins.some((o) => o.from === from && same(pointer(candidate, o.to), o.normalized)))
      return true;
    if (object(value) || Array.isArray(value))
      return Object.entries(value).every(([key, v]) => covered(v, child(from, key)));
    return false;
  };
  for (const d of diagnostics)
    if (d.category === 'unsupported' && !unsupportedVersion) {
      if (covered(pointer(input, d.sourcePath), d.sourcePath)) d.blocking = false;
      else if (
        review.administrativePaths?.includes(d.sourcePath) &&
        isAdministrativeSourcePath(d.sourcePath)
      ) {
        d.blocking = false;
        d.message =
          'Administrator explicitly excluded this nonacademic metadata; source remains visible for review and is not stored in student content.';
      }
    }
  for (const o of origins) {
    if (
      review.administrativePaths?.some(
        (p) => isAdministrativeSourcePath(p) && (o.from === p || o.from.startsWith(p + '/')),
      )
    )
      continue;
    // Container adapters are checked through their individual children, not raw container equality.
    if (object(o.original) || Array.isArray(o.original)) continue;
    const actual = pointer(candidate, o.to);
    if (same(actual, o.normalized)) continue;
    const relocated = origins.some(
      (other) =>
        other !== o &&
        other.from === o.from &&
        same(pointer(candidate, other.to), other.normalized),
    );
    const difficultyEquivalent =
      o.to === '/difficulty' &&
      typeof actual === 'string' &&
      typeof o.normalized === 'string' &&
      actual.trim().toLowerCase() === o.normalized.trim().toLowerCase();
    if (
      !same(actual, o.normalized) &&
      !relocated &&
      !difficultyEquivalent &&
      !(o.to === '/difficulty' && review.confirmedDifficulty && !sourceDifficulty) &&
      !(o.to.startsWith('/classification/') && review.classificationApproved)
    )
      report(
        'conflict',
        'A mapped source value was changed or removed. Preserve it or resolve the source ambiguity; conversion cannot be called lossless.',
        o.from,
        o.to,
        true,
      );
  }
  for (const d of diagnostics)
    if (
      d.category === 'conflict' &&
      d.destinationPath &&
      Object.hasOwn(review.mappings ?? {}, d.destinationPath) &&
      /^(Conflicting equivalent fields|Question and metadata disagree|Classification sources disagree|Difficulty sources disagree)/.test(
        d.message,
      )
    ) {
      const values = origins.filter((o) => o.to === d.destinationPath);
      if (values.length && values.every((o) => covered(pointer(input, o.from), o.from))) {
        d.blocking = false;
        d.message =
          'Administrator explicitly resolved the competing source mappings; all supplied values remain represented.';
      }
    }
  for (const c of containers)
    if (
      !same(pointer(candidate, c.to), c.normalized) &&
      !Object.hasOwn(review.mappings ?? {}, c.to)
    )
      report(
        'conflict',
        'Existing supplied content blocks, tags or asset bytes/metadata were changed. Preserve them exactly.',
        c.from,
        c.to,
        true,
      );
  let difficulty: SelectedDifficulty | undefined;
  if (typeof candidate.difficulty === 'string')
    difficulty = (['Easy', 'Medium', 'Hard'] as const).find(
      (d) => d.toLowerCase() === String(candidate.difficulty).trim().toLowerCase(),
    );
  if (candidate.difficulty !== undefined && !difficulty)
    report(
      'ambiguous',
      'Difficulty is not a recognized Easy, Medium or Hard value; administrator confirmation is required.',
      '/difficulty',
      '/difficulty',
      true,
    );
  const validation = (manifest ? importManifestSchema : questionPackageSchema).safeParse(candidate);
  if (!validation.success)
    for (const issue of validation.error.issues) {
      const dest = '/' + issue.path.map(String).map(escape).join('/');
      const missing =
        pointer(candidate, dest) === undefined &&
        (issue.code === 'invalid_type' || issue.code === 'invalid_value');
      report(
        missing ? 'required' : 'conflict',
        missing
          ? `${String(issue.path.at(-1))} not found. This field is required by the Master JSON schema; supply it explicitly before draft creation.`
          : `${issue.path.map((p, i) => (typeof p === 'number' ? `[${p}]` : `${i ? '.' : ''}${String(p)}`)).join('') || 'package'}: ${issue.message}`,
        origins.find((o) => o.to === dest)?.from ?? '',
        dest,
        true,
      );
    }
  if (!object(input))
    report(
      'ambiguous',
      'One self-contained question object is required; use manual mapping for an unfamiliar wrapper.',
      '',
      undefined,
      !manual,
    );
  if (!canonical && !recognized && !portable && !manual)
    report(
      'ambiguous',
      'Unknown JSON structure. Select source fields and complete the canonical candidate without guessing.',
      '',
      undefined,
      true,
    );
  if (!object(input))
    report(
      'unsupported',
      'Original root content must be explicitly mapped before a canonical draft can be created.',
      '',
      undefined,
      !covered(input, ''),
    );
  checkImportStructure(
    candidate,
    manifest ? importLimits.manifestBytes : importLimits.packageBytes,
  );
  const sourcePaths: string[] = [''];
  const paths = (value: unknown, p: string) => {
    if (p) sourcePaths.push(p);
    if (object(value) || Array.isArray(value))
      for (const [k, v] of Object.entries(value)) paths(v, child(p, k));
  };
  paths(input, '');
  const valid = validation.success && !diagnostics.some((d) => d.blocking);
  return {
    format,
    sourceVersion,
    adapter,
    candidate,
    diagnostics,
    valid,
    lossless:
      valid &&
      !confirmedAmbiguousDifficulty &&
      !review.classificationApproved &&
      !diagnostics.some((d) => review.administrativePaths?.includes(d.sourcePath)),
    manualRequired: !valid,
    difficulty,
    sourcePaths,
  };
}
/** Exclusions are restricted to metadata namespaces, never known academic fields. */
export function isAdministrativeSourcePath(path: string) {
  // Exact provenance fields only; academic descendants and the syllabus itself
  // still cannot be excluded through this exception.
  if (portableProvenancePaths.some((p) => p === path)) return true;
  return (
    /^\/(format_identifier|metadata\/[^/]+|importer_compatibility|pdf_export_contract|source_reference|source|administrative_metadata)(\/|$)/.test(
      path,
    ) &&
    !/(question|stem|scenario|answer|solution|hint|working|calculation|derivation|equation|diagram|figure|asset|marks|difficulty|topic|semester|chapter|syllabus|curriculum)/i.test(
      path,
    )
  );
}
/** Validation transport removes only binary fields at the selected asset container.
 * Actual bytes are independently verified and submitted through the existing multipart commit.
 * No original statements, schemes, hints, metadata or references are removed. */
export function compatibilitySubmission(source: unknown, review: MappingReview) {
  checkImportStructure(source);
  checkImportStructure(review);
  const copy = structuredClone(source);
  const assetPath =
    review.mappings?.['/assets'] ??
    (object(copy)
      ? ['assets', 'diagrams', 'figures'].find((k) => Object.hasOwn(copy, k))
      : undefined);
  const value = assetPath
    ? pointer(copy, assetPath.startsWith('/') ? assetPath : '/' + assetPath)
    : undefined;
  const strip = (assets: unknown) => {
    if (Array.isArray(assets))
      assets.forEach((a) => {
        if (object(a)) delete a.dataBase64;
      });
    else if (object(assets))
      Object.values(assets).forEach((a) => {
        if (object(a)) delete a.dataBase64;
      });
  };
  strip(value);
  const reviewed = structuredClone(review);
  if (object(reviewed.candidate)) strip(reviewed.candidate.assets);
  return { source: copy, review: reviewed };
}
