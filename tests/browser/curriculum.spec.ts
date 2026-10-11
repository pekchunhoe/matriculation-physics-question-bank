import { test, expect } from './admin-fixture.js';
import type { APIRequestContext } from '@playwright/test';
import { installAxe } from './accessibility.js';
import { readFileSync } from 'node:fs';
import type { QuestionDocument, Taxonomy } from '../../shared/schema';
import type { CurriculumDocument } from '../../shared/curriculum';
async function fixture(request: APIRequestContext, suffix: string) {
  async function add(kind: string, name: string, parentId: string | null) {
    const r = await request.post('/api/taxonomy/' + kind, {
      data: { name, parentId, isTest: true },
    });
    expect(r.ok()).toBe(true);
    return (await r.json()).id as string;
  }
  const course = await add('courses', 'TEST DATA curriculum ' + suffix, null),
    semester = await add('semesters', 'TEST DATA Semester ' + suffix, course),
    chapter = await add('chapters', 'TEST DATA Chapter ' + suffix, semester),
    topic = await add('topics', 'TEST DATA Topic ' + suffix, chapter),
    subtopic = await add('subtopics', 'TEST DATA Subtopic ' + suffix, topic);
  const tax = (await (await request.get('/api/taxonomy')).json()) as Taxonomy,
    version = tax.semesters.find((s) => s.id === semester)!.curriculumVersionId!;
  const listing = await (await request.get('/api/questions?q=TEST-S2-0')).json(),
    doc = (await (
      await request.get('/api/questions/' + listing.items[0].id + '/export')
    ).json()) as QuestionDocument;
  doc.question.questionCode = 'TEST-CURRICULUM-' + suffix;
  doc.question.title = 'TEST DATA curriculum question ' + suffix;
  doc.question.topicId = topic;
  doc.question.subtopicId = subtopic;
  const created = await request.post('/api/questions', {
    data: { document: doc, note: 'TEST DATA fixture', confirmApproval: true },
  });
  expect(created.ok()).toBe(true);
  return {
    course,
    semester,
    chapter,
    topic,
    subtopic,
    version,
    question: (await created.json()).id as string,
    doc,
  };
}
test('teacher renames, reorders, retires and restores referenced taxonomy with explicit impact review', async ({
  page,
  request,
}) => {
  const f = await fixture(request, 'EDIT');
  await page.goto('/curriculum');
  await page.getByLabel('Edit record type').selectOption('chapters');
  await page.getByLabel('Curriculum record', { exact: true }).selectOption(f.chapter);
  await expect(page.getByText(/This item contains 1 current questions/)).toBeVisible();
  await page.getByLabel('Edited name').fill('TEST DATA Renamed Chapter');
  await page.getByLabel('Curriculum change note').fill('TEST DATA rename chapter');
  await page.getByRole('checkbox', { name: /I reviewed the impact on current browsing/ }).check();
  await page.getByRole('button', { name: 'Save curriculum change' }).click();
  await expect(page.getByLabel('Edited name')).toHaveValue('TEST DATA Renamed Chapter');
  await page.getByLabel('Edit record type').selectOption('topics');
  await page.getByLabel('Curriculum record', { exact: true }).selectOption(f.topic);
  await expect(page.getByLabel('Move to parent')).toBeDisabled();
  await page.getByLabel('Edited name').fill('TEST DATA Renamed Topic');
  await page.getByLabel('Display order', { exact: true }).fill('2');
  await page.getByLabel('Curriculum item status').selectOption('retired');
  await page.getByLabel('Curriculum change note').fill('TEST DATA rename and retire');
  await page.getByRole('checkbox', { name: /I reviewed the impact on current browsing/ }).check();
  const saved = page.waitForResponse(
    (r) => r.url().includes(`/taxonomy/topics/${f.topic}`) && r.request().method() === 'PATCH',
  );
  await page.getByRole('button', { name: 'Save curriculum change' }).click();
  expect((await saved).ok()).toBe(true);
  await page.goto(`/?course=${f.course}&curriculum=${f.version}&taxonomyStatus=active`);
  await expect(page.locator('.question-card')).toHaveCount(0);
  await page.getByText('Curriculum version and retired items', { exact: true }).click();
  await page.getByLabel('Curriculum item visibility').selectOption('all');
  await expect(page.locator('.question-card')).toHaveCount(1);
  await page.goto(`/questions/${f.question}?version=1`);
  await expect(page.locator('.metadata-summary')).toContainText('TEST DATA Topic EDIT');
  await expect(page.locator('.metadata-summary')).toContainText('TEST DATA Chapter EDIT');
  await page.goto('/curriculum');
  await page.getByLabel('Curriculum record', { exact: true }).selectOption(f.topic);
  await expect(page.getByLabel('Curriculum item status')).toHaveValue('retired');
  await page.getByLabel('Curriculum item status').selectOption('active');
  await page.getByLabel('Curriculum change note').fill('TEST DATA restore');
  await page.getByRole('checkbox', { name: /I reviewed the impact on current browsing/ }).check();
  const restored = page.waitForResponse(
    (r) => r.url().includes(`/taxonomy/topics/${f.topic}`) && r.request().method() === 'PATCH',
  );
  await page.getByRole('button', { name: 'Save curriculum change' }).click();
  expect((await restored).ok()).toBe(true);
  await page.goto(`/?course=${f.course}&curriculum=${f.version}&taxonomyStatus=active`);
  await expect(page.locator('.question-card')).toHaveCount(1);
});
test('teacher clones and activates a new curriculum while old questions and exports stay available', async ({
  page,
  request,
}) => {
  const f = await fixture(request, 'VERSIONS');
  await page.goto('/curriculum');
  await page.getByText('Create or clone a draft version', { exact: true }).click();
  await page.getByLabel('Version course', { exact: true }).selectOption(f.course);
  await page.getByLabel('New version code').fill('TEST-NEW');
  await page.getByLabel('New version name').fill('TEST DATA newer curriculum');
  await page.getByLabel('Clone taxonomy from').selectOption(f.version);
  await page.getByLabel('New version note').fill('TEST DATA clone');
  await page.getByRole('button', { name: 'Create draft version' }).click();
  await expect(page.getByLabel('Version name', { exact: true })).toHaveValue(
    'TEST DATA newer curriculum',
  );
  const newId = await page.getByLabel('Curriculum version to manage').inputValue();
  await expect(
    page.getByText(/Activation also retires.*containing 1 current questions/),
  ).toBeVisible();
  await page.getByLabel('Version status', { exact: true }).selectOption('active');
  await page.getByLabel('Version change note').fill('TEST DATA activate');
  await page.getByRole('checkbox', { name: /I reviewed linked questions/ }).check();
  const activated = page.waitForResponse(
    (r) => r.url().includes(`/curriculum-versions/${newId}`) && r.request().method() === 'PATCH',
  );
  await page.getByRole('button', { name: 'Save version changes' }).click();
  expect((await activated).ok()).toBe(true);
  await page.goto(`/?course=${f.course}&curriculum=active`);
  await expect(page.locator('.question-card')).toHaveCount(0);
  await page.getByText('Curriculum version and retired items', { exact: true }).click();
  await page.getByLabel('Browse curriculum version').selectOption(f.version);
  await expect(page.locator('.question-card')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('.question-card')).toHaveCount(1);
  await expect(page.getByLabel('Browse curriculum version')).toHaveValue(f.version);
  await page.goto('/curriculum');
  await page.getByLabel('Curriculum version to manage').selectOption(f.version);
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export curriculum JSON' }).click();
  const file = await pending,
    path = await file.path();
  expect(path).not.toBeNull();
  const doc = JSON.parse(readFileSync(path!, 'utf8')) as CurriculumDocument;
  expect(doc.curriculumVersion.status).toBe('retired');
  expect(doc.semesters[0].id).toBe(f.semester);
});
test('curriculum import preview rejects malformed JSON and explicitly imports the reviewed draft', async ({
  page,
  request,
}) => {
  const f = await fixture(request, 'IMPORT');
  const exported = (await (
    await request.get(`/api/curriculum-versions/${f.version}/export`)
  ).json()) as CurriculumDocument;
  exported.curriculumVersion = {
    ...exported.curriculumVersion,
    id: undefined,
    code: 'TEST-IMPORT',
    name: 'TEST DATA imported curriculum',
    status: 'draft',
  };
  for (const s of exported.semesters) {
    delete s.id;
    delete s.slug;
    for (const c of s.chapters) {
      delete c.id;
      for (const t of c.topics) {
        delete t.id;
        for (const st of t.subtopics) delete st.id;
      }
    }
  }
  await page.goto('/curriculum');
  await page.getByText('Import an authoritative curriculum JSON', { exact: true }).click();
  await page.getByLabel('Curriculum JSON (schemaVersion 1)').fill('{bad');
  await page.getByRole('button', { name: 'Validate curriculum and preview' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByLabel('Curriculum JSON (schemaVersion 1)').fill(JSON.stringify(exported));
  await page.getByRole('button', { name: 'Validate curriculum and preview' }).click();
  await expect(page.getByRole('heading', { name: 'Curriculum import preview' })).toBeVisible();
  await expect(page.getByText('1 semesters · 1 chapters · 1 topics · 1 subtopics')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Import reviewed curriculum' })).toBeDisabled();
  await page.getByLabel('Curriculum import note').fill('TEST DATA reviewed curriculum');
  await page.getByRole('checkbox', { name: /I checked this supplied hierarchy/ }).check();
  await page.getByRole('button', { name: 'Import reviewed curriculum' }).click();
  await expect(page.getByLabel('Version name', { exact: true })).toHaveValue(
    'TEST DATA imported curriculum',
  );
  expect((await (await request.get('/api/questions?curriculum=' + f.version)).json()).total).toBe(
    1,
  );
});
test('curriculum editing controls and import preview fit mobile and pass automated accessibility checks', async ({
  page,
  request,
}) => {
  const f = await fixture(request, 'ACCESS');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/curriculum');
  await page.getByLabel('Curriculum version to manage').selectOption(f.version);
  await page.getByLabel('Curriculum record', { exact: true }).selectOption(f.topic);
  await expect(page.getByLabel('Move to parent')).toBeDisabled();
  await page.getByText('Create or clone a draft version', { exact: true }).click();
  await page.getByText('Import an authoritative curriculum JSON', { exact: true }).click();
  await installAxe(page);
  const violations = await page.evaluate(async () => {
    return (
      await (
        window as unknown as { axe: { run: () => Promise<{ violations: unknown[] }> } }
      ).axe.run()
    ).violations;
  });
  expect(violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(
    false,
  );
  await page.screenshot({ path: 'test-results/curriculum-mobile.png', fullPage: true });
  await page.screenshot({ path: 'test-results/curriculum-mobile-top.png' });
  await page
    .getByRole('heading', { name: 'Edit curriculum records' })
    .locator('..')
    .screenshot({ path: 'test-results/curriculum-edit-mobile.png' });
});

test('question imports keep validated IDs across taxonomy renames and preserve v2 provenance', async ({
  page,
  request,
}) => {
  const f = await fixture(request, 'STABLE');
  const input = {
    ...f.doc,
    question: {
      ...f.doc.question,
      questionCode: 'TEST-IMPORT-STABLE-ALIAS',
      status: 'draft',
      topicId: undefined,
      subtopicId: undefined,
    },
    classification: {
      course: f.course,
      curriculumVersion: f.version,
      semester: f.semester,
      chapter: f.chapter,
      topic: 'TEST DATA Topic STABLE',
      subtopic: f.subtopic,
    },
  };
  await page.goto('/import');
  await page.getByLabel('Question JSON (schemaVersion 1)').fill(JSON.stringify(input));
  await page.getByRole('button', { name: 'Validate and preview' }).click();
  await expect(page.locator('.metadata-summary')).toContainText('TEST DATA Topic STABLE');
  const impact = await (await request.get(`/api/taxonomy/topics/${f.topic}/impact`)).json();
  const changed = await request.patch(`/api/taxonomy/topics/${f.topic}`, {
    data: {
      name: 'TEST DATA changed after preview',
      expectedRevision: impact.revision,
      impactToken: impact.token,
      confirmImpact: true,
      note: 'TEST DATA rename between preview and save',
    },
  });
  expect(changed.ok()).toBe(true);
  await page.getByLabel('Revision note').fill('TEST DATA import with previewed IDs');
  await page.getByRole('checkbox', { name: /I reviewed this imported content/ }).check();
  await page.getByRole('button', { name: 'Import question', exact: true }).click();
  await expect(page).toHaveURL(/\/questions\//);
  const copied = await (await request.get('/api/questions?q=TEST-IMPORT-STABLE-ALIAS')).json();
  expect(copied.items[0].topic_id).toBe(f.topic);
  const envelope = await (
    await request.get(`/api/questions/${f.question}/export?provenance=true`)
  ).json();
  envelope.document.question.questionCode = 'TEST-IMPORT-STABLE-PROVENANCE';
  envelope.document.question.status = 'draft';
  await page.goto('/import');
  await page.getByLabel('Question JSON (schemaVersion 1)').fill(JSON.stringify(envelope));
  await page.getByRole('button', { name: 'Validate and preview' }).click();
  await expect(page.locator('.metadata-summary')).toContainText('TEST DATA Topic STABLE');
  await page.getByLabel('Revision note').fill('TEST DATA provenance import');
  await page.getByRole('checkbox', { name: /I reviewed this imported content/ }).check();
  await page.getByRole('button', { name: 'Import question', exact: true }).click();
  await expect(page).toHaveURL(/\/questions\//);
  await expect(page.locator('.metadata-summary')).toContainText('TEST DATA Topic STABLE');
});
