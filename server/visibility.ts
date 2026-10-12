import type { Bank } from './database.js';
import type { Taxonomy } from '../shared/schema.js';
import { isPublishedCurriculum } from './public-visibility-policy.js';
export class VisibilityService {
  constructor(private readonly bank: Bank) {}
  async taxonomy(): Promise<Taxonomy> {
    const tax = await this.bank.taxonomy(),
      curriculumVersions = (tax.curriculumVersions ?? []).filter((v) =>
        isPublishedCurriculum(v.status),
      ),
      semesters = tax.semesters.filter((s) =>
        curriculumVersions.some((v) => v.id === s.curriculumVersionId),
      ),
      chapters = tax.chapters.filter((c) => semesters.some((s) => s.id === c.parentId)),
      topics = tax.topics.filter((t) => chapters.some((c) => c.id === t.parentId)),
      subtopics = tax.subtopics.filter((st) => topics.some((t) => t.id === st.parentId));
    return { ...tax, curriculumVersions, semesters, chapters, topics, subtopics };
  }
}
