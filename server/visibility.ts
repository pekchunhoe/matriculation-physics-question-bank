import type { Bank } from './database.js';
import type { Taxon, Taxonomy } from '../shared/schema.js';
import { isPublishedCurriculum } from './public-visibility-policy.js';
export class VisibilityService {
  constructor(private readonly bank: Bank) {}
  async taxonomy(admin = false, showRetired = false): Promise<Taxonomy> {
    const tax = await this.bank.taxonomy();
    if (admin && showRetired) return tax;
    const active = (record: Taxon) => record.status !== 'retired';
    const curriculumVersions = (tax.curriculumVersions ?? []).filter(
      (v) => admin || isPublishedCurriculum(v.status),
    );
    const semesters = tax.semesters.filter(
      (s) => active(s) && curriculumVersions.some((v) => v.id === s.curriculumVersionId),
    );
    const chapters = tax.chapters.filter(
      (c) => active(c) && semesters.some((s) => s.id === c.parentId),
    );
    const topics = tax.topics.filter((t) => active(t) && chapters.some((c) => c.id === t.parentId));
    const subtopics = tax.subtopics.filter(
      (st) => active(st) && topics.some((t) => t.id === st.parentId),
    );
    return { ...tax, curriculumVersions, semesters, chapters, topics, subtopics };
  }
}
