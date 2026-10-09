import { test as base } from '@playwright/test';
import express from 'express';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Server } from 'node:http';
import { createApp } from '../../server/app.js';
import { curriculumImportSchema, type CurriculumDocument } from '../../shared/curriculum.js';
import type { QuestionDocument } from '../../shared/schema.js';
import { createTestBank } from '../test-bank.js';
import { seedAdminSession } from '../auth-fixture.js';

type Fixture = { origin: string; document: CurriculumDocument; adminCookie: string };
type Options = {
  curriculumState: 'active' | 'draft';
  fixtureQuestions: boolean;
  reordered: boolean;
};

export const test = base.extend<Options & { curriculumFixture: Fixture }>({
  curriculumState: ['active', { option: true }],
  fixtureQuestions: [false, { option: true }],
  reordered: [false, { option: true }],
  curriculumFixture: async ({ curriculumState, fixtureQuestions, reordered }, use) => {
    // Explicit SQLite memory fixture: never reads a Turso URL or production credentials.
    const bank = await createTestBank();
    let server: Server | undefined;
    try {
      const document = curriculumImportSchema.parse(
        JSON.parse(
          readFileSync(new URL('../fixtures/physics-curriculum.json', import.meta.url), 'utf8'),
        ),
      );
      if (reordered) {
        // Deliberately contradict the numbering in names, only in this isolated copy.
        document.semesters[0].order = 2;
        document.semesters[1].order = 1;
        for (const semester of document.semesters) {
          semester.chapters.forEach((chapter, index) => {
            chapter.order = semester.chapters.length - index;
            chapter.topics.forEach((topic, index) => {
              topic.order = chapter.topics.length - index;
            });
          });
        }
      }
      const plan = await bank.curriculum.plan(document);
      await bank.curriculum.import(document, plan.token, 'TEST ONLY isolated presentation fixture');
      const versionId = document.curriculumVersion.id!;
      if (curriculumState === 'active') {
        const impact = await bank.curriculum.impact('curriculumVersions', versionId);
        await bank.curriculum.editVersion(versionId, {
          name: document.curriculumVersion.name,
          effectiveFrom: null,
          effectiveTo: null,
          status: 'active',
          order: document.curriculumVersion.order,
          expectedRevision: impact.revision,
          impactToken: impact.token,
          confirmImpact: true,
          note: 'TEST ONLY future activation in SQLite memory',
        });
      }
      if (fixtureQuestions) {
        for (const [index, semester] of document.semesters.entries()) {
          for (const difficultyId of ['easy', 'hard']) {
            const code = `TEST-PRESENTATION-S${index + 1}-${difficultyId.toUpperCase()}`;
            const question: QuestionDocument = {
              schemaVersion: 1,
              question: {
                questionCode: code,
                topicId: semester.chapters[0].topics[0].id!,
                subtopicId: null,
                title: 'TEST ONLY ' + code,
                scenario: 'TEST ONLY synthetic filter fixture.',
                difficultyId,
                questionType: 'structured',
                totalMarks: 1,
                estimatedMinutes: 1,
                status: 'approved',
                containsDiagram: false,
                containsGraph: false,
                containsFbd: false,
              },
              parts: [
                {
                  id: 'part-a',
                  label: '(a)',
                  prompt: 'TEST ONLY prompt',
                  marks: 1,
                  order: 0,
                  parentId: null,
                },
              ],
              solutions: [
                {
                  partId: 'part-a',
                  solution: 'TEST ONLY answer scheme',
                  equationLatex: '',
                  teacherNotes: '',
                  steps: [],
                },
              ],
              hints: [],
              assets: [],
              tags: ['TEST ONLY'],
            };
            await bank.create(question, 'TEST ONLY isolated filter fixture', null, true);
          }
        }
      }
      const adminCookie = await seedAdminSession(bank);
      const app = createApp(bank, undefined);
      app.use(express.static(resolve('dist')));
      app.get('/{*path}', (_req, res) => res.sendFile(resolve('dist/index.html')));
      server = await new Promise<Server>((resolveServer, reject) => {
        const listening = app.listen(0, '127.0.0.1', () => resolveServer(listening));
        listening.on('error', reject);
      });
      const address = server.address();
      if (!address || typeof address === 'string')
        throw new Error('Missing isolated fixture address');
      await use({ origin: `http://127.0.0.1:${address.port}`, document, adminCookie });
    } finally {
      if (server) await new Promise<void>((resolveClose) => server!.close(() => resolveClose()));
      await bank.close();
    }
  },
  baseURL: async ({ curriculumFixture }, use) => {
    await use(curriculumFixture.origin);
  },
});
export { expect } from '@playwright/test';
