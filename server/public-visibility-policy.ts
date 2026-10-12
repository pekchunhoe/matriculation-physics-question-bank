import type { CurriculumVersion } from '../shared/curriculum.js';

const publishedStatuses = ['active', 'retired'] as const;

export function isPublishedCurriculum(status: CurriculumVersion['status']): boolean {
  return publishedStatuses.some((published) => published === status);
}

/** Aliases are fixed by our queries, never supplied by request parameters. */
export function publishedCurriculumSql(alias: 'cv' | 'public_cv'): string {
  return `${alias}.status IN (${publishedStatuses.map((status) => `'${status}'`).join(',')})`;
}
