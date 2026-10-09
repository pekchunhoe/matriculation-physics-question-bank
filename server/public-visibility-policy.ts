import type { CurriculumVersion } from '../shared/curriculum.js';

const publishedStatuses = ['active', 'retired'] as const;

export function isPublishedCurriculum(status: CurriculumVersion['status']): boolean {
  return publishedStatuses.some((published) => published === status);
}

/** Aliases are fixed by our queries, never supplied by request parameters. */
export function publishedCurriculumSql(alias: 'cv' | 'public_cv'): string {
  return `${alias}.status IN (${publishedStatuses.map((status) => `'${status}'`).join(',')})`;
}

/** Requires an approved current snapshot AND a publicly published live classification. */
export const publicQuestionSql =
  "q.status='approved' AND EXISTS(SELECT 1 FROM question_versions pv WHERE pv.question_id=q.id AND pv.version_number=q.active_version AND json_extract(pv.snapshot,'$.question.status')='approved')" +
  ' AND EXISTS(SELECT 1 FROM topics public_t JOIN chapters public_c ON public_c.id=public_t.chapter_id JOIN semesters public_s ON public_s.id=public_c.semester_id JOIN curriculum_versions public_cv ON public_cv.id=public_s.curriculum_version_id WHERE public_t.id=q.topic_id AND ' +
  publishedCurriculumSql('public_cv') +
  ')';
