import { test as base, expect } from '@playwright/test';
import express from 'express';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { setup } from '../fixtures.js';
import { createApp } from '../../server/app.js';
import { LocalAssetStorage } from '../../server/local-asset-storage.js';
import { validateUpload } from '../../server/asset-validation.js';
import type { QuestionPackage } from '../../shared/question-import.js';
import type { QuestionDocument } from '../../shared/schema.js';
import { seedAdminSession } from '../auth-fixture.js';
import type { Bank } from '../../server/database.js';

export const layoutCases = [
  'no-diagram',
  'question-diagram',
  'one-fbd',
  'multiple-fbds',
  'no-parts',
  'nested',
  'long-solution',
  'long-hint',
  'no-code',
  'easy',
  'hard',
  'answer-only-fbd',
] as const;
export const test = base.extend<{
  masterFixture: { origin: string; ids: Record<string, string>; cookie: string; bank: Bank };
}>({
  masterFixture: async ({ browserName }, use) => {
    const { bank, fixture, c1, momentum } = await setup();
    const directory = mkdtempSync(join(tmpdir(), `master-${browserName}-`));
    const storage = new LocalAssetStorage(directory);
    const ids: Record<string, string> = {};
    try {
      const pkg: QuestionPackage = JSON.parse(
        readFileSync('examples/question-import/GOLDEN_QUESTION_IMPORT_REFERENCE.json', 'utf8'),
      );
      const assets: QuestionDocument['assets'] = [];
      for (const [order, asset] of pkg.assets.entries()) {
        const upload = await storage.put(
          validateUpload(Buffer.from(asset.dataBase64, 'base64'), asset.key + '.png'),
        );
        assets.push({
          id: asset.key,
          partId: null,
          kind: asset.role === 'free_body_diagram' ? 'fbd' : 'physics_diagram',
          url: upload.url,
          alt: asset.alt ?? '',
          mime: asset.mimeType,
          order,
          importMetadata: {
            role: asset.role,
            caption: asset.caption,
            sha256: asset.sha256,
            byteLength: asset.byteLength,
          },
        });
      }
      for (const name of layoutCases) {
        const doc = fixture('SYNTHETIC-' + name.toUpperCase());
        doc.question = {
          ...doc.question,
          title: 'Synthetic ' + name,
          scenario: pkg.question.scenario,
          blocks: pkg.question.blocks,
          totalMarks: 5,
          difficultyId: name === 'easy' ? 'easy' : name === 'hard' ? 'hard' : 'medium',
        };
        doc.parts = structuredClone(pkg.parts);
        doc.solutions = structuredClone(pkg.solutions);
        doc.hints = structuredClone(pkg.hints);
        doc.assets = structuredClone(assets);
        const removeImages = (answer: boolean) => {
          if (!answer) doc.question.blocks = doc.question.blocks?.filter((b) => b.type !== 'image');
          else
            for (const s of doc.solutions)
              for (const t of s.steps) t.blocks = t.blocks?.filter((b) => b.type !== 'image');
          doc.assets = doc.assets.filter((a) => (answer ? a.kind !== 'fbd' : a.kind === 'fbd'));
        };
        if (name === 'no-diagram' || name === 'long-solution' || name === 'no-code') {
          removeImages(false);
          removeImages(true);
        }
        if (name === 'question-diagram') removeImages(true);
        if (name === 'answer-only-fbd') removeImages(false);
        if (name === 'one-fbd') {
          doc.assets = doc.assets.filter((a) => a.id !== 'answer-fbd-heavy');
          for (const s of doc.solutions)
            for (const t of s.steps)
              t.blocks = t.blocks?.filter(
                (b) => b.type !== 'image' || b.assetId !== 'answer-fbd-heavy',
              );
        }
        if (name === 'no-parts') {
          doc.parts = [];
          doc.solutions = [
            {
              ...doc.solutions[0],
              partId: null,
              steps: doc.solutions.flatMap((s) => s.steps).map((t, order) => ({ ...t, order })),
            },
          ];
          doc.hints = doc.hints.map((h) => ({ ...h, partId: null }));
        }
        if (name === 'nested') {
          doc.parts.push(
            { id: 'bi', parentId: 'b', label: '(i)', prompt: 'Light block.', marks: 2, order: 0 },
            { id: 'bii', parentId: 'b', label: '(ii)', prompt: 'Heavy block.', marks: 2, order: 1 },
          );
          const s = doc.solutions.pop()!;
          doc.solutions.push(
            { ...s, partId: 'bi', steps: s.steps.slice(0, 2) },
            { ...s, partId: 'bii', steps: s.steps.slice(2) },
          );
          doc.hints = doc.hints.map((h) => ({
            ...h,
            partId:
              h.partId === 'b'
                ? ['step-2', 'step-3'].includes(h.solutionStepId!)
                  ? 'bi'
                  : 'bii'
                : h.partId,
          }));
        }
        if (name === 'long-hint')
          doc.hints[0].text =
            'Consider the force convention carefully before applying the equations. '.repeat(65);
        if (name === 'long-solution') {
          const s = doc.solutions[1];
          for (let n = 0; n < 30; n++)
            s.steps.push({
              id: 'extra-' + n,
              number: n + 6,
              explanation: `Extended reasoning ${n + 1}. Review vectors, SI units, powers and angles.`,
              equationLatex: String.raw`\vec{F}=m\vec{a},\quad \frac{N-W}{m}=a_y,\quad \alpha=30^{\circ},\quad g=9.81\,\mathrm{m\,s^{-2}}`,
              working: 'The dimensions and sign convention agree with the force equation.',
              markingPoint: '',
              marks: 0,
              order: n + 4,
            });
        }
        if (name === 'no-code')
          for (const s of doc.solutions) for (const t of s.steps) delete t.markingCode;
        ids[name] = (await bank.create(doc, 'Disposable synthetic layout fixture', null, true)).id;
      }
      await bank.run('UPDATE chapters SET sort_order=1 WHERE id=?', c1);
      await bank.run('UPDATE topics SET sort_order=1 WHERE id=?', momentum);
      const chapter2 = await bank.addTaxon('chapters', 'TEST Z Chapter Two', 'semester-1', true);
      const chapter4 = await bank.addTaxon('chapters', 'TEST A Chapter Four', 'semester-1', true);
      await bank.run('UPDATE chapters SET sort_order=2 WHERE id=?', chapter2);
      await bank.run('UPDATE chapters SET sort_order=4 WHERE id=?', chapter4);
      const topic12 = await bank.addTaxon('topics', 'TEST A Topic 1.2', c1, true);
      const topic23 = await bank.addTaxon('topics', 'TEST Z Topic 2.3', chapter2, true);
      const topic42 = await bank.addTaxon('topics', 'TEST A Topic 4.2', chapter4, true);
      await bank.run('UPDATE topics SET sort_order=2 WHERE id=?', topic12);
      const sub1 = await bank.addTaxon('subtopics', 'TEST Z First Subtopic', momentum, true);
      const sub2 = await bank.addTaxon('subtopics', 'TEST A Second Subtopic', momentum, true);
      await bank.run('UPDATE subtopics SET sort_order=1 WHERE id=?', sub1);
      await bank.run('UPDATE subtopics SET sort_order=2 WHERE id=?', sub2);
      for (const [name, topic, subtopic] of [
        ['order-A', momentum, null],
        ['order-B', topic12, null],
        ['order-C', topic23, null],
        ['order-D', topic42, null],
        ['sub-none', momentum, null],
        ['sub-first', momentum, sub1],
        ['sub-second', momentum, sub2],
        ...Array.from({ length: 5 }, (_, i) => ['short-' + i, momentum, null]),
        ['unsupported', momentum, null],
      ] as [string, string, string | null][]) {
        const doc = fixture('EXPORT-' + name.toUpperCase(), topic, 'medium');
        doc.question.subtopicId = subtopic;
        doc.question.scenario = name === 'unsupported' ? '$\\cancel{x}$' : 'STEM ' + name;
        doc.parts = [];
        doc.solutions = [
          {
            partId: null,
            solution: 'ANSWER ' + name,
            equationLatex: '',
            teacherNotes: 'PRIVATE NOTE',
            steps: [
              {
                id: 'step',
                number: 1,
                order: 0,
                marks: 2,
                markingCode: 'JU1',
                explanation: 'REASON ' + name,
                equationLatex: 'F_c=\\frac{mv^2}{r}',
                working: 'FINAL ' + name,
                markingPoint: '',
              },
            ],
          },
        ];
        doc.hints = [
          { id: 'hint', partId: null, solutionStepId: 'step', text: 'HINT ' + name, order: 0 },
        ];
        ids[name] = (await bank.create(doc, 'Disposable export fixture', null, true)).id;
      }
      const cookie = await seedAdminSession(bank);
      const app = createApp(bank, storage);
      app.use(express.static(resolve('dist')));
      app.get('/{*path}', (_req, res) => res.sendFile(resolve('dist/index.html')));
      const server = app.listen(0, '127.0.0.1');
      await new Promise<void>((done) => server.once('listening', done));
      const address = server.address();
      if (!address || typeof address === 'string')
        throw new Error('Disposable master server unavailable');
      try {
        await use({ origin: `http://127.0.0.1:${address.port}`, ids, cookie, bank });
      } finally {
        await new Promise<void>((done) => server.close(() => done()));
      }
    } finally {
      await bank.close();
      rmSync(directory, { recursive: true, force: true });
    }
  },
  baseURL: async ({ masterFixture }, use) => use(masterFixture.origin),
});
export { expect };
