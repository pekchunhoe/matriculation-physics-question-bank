export const unassignedName = 'Unassigned Questions';
export const unassignedSlug = 'system-unassigned-questions';
const idPrefix = 'system-unassigned:';

export const isUnassignedId = (id: string) => id.startsWith(idPrefix);
export const unassignedId = (kind: 'chapter' | 'topic', semesterId: string) =>
  idPrefix + kind + ':' + semesterId;
export const unassignedTopicSql = `instr(t.id, '${idPrefix}')=1`;

export function isReservedCurriculumName(name: string) {
  const normalized = name.trim().replace(/\s+/g, ' ').toLowerCase();
  return normalized === unassignedName.toLowerCase() || normalized === unassignedSlug;
}
