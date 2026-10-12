export type Taxon = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  order: number;
  isTest: boolean;
  status?: 'active' | 'retired';
  revision?: number;
  curriculumVersionId?: string;
};
export type Taxonomy = {
  curriculumVersions?: import('./curriculum.js').CurriculumVersion[];
  courses: Taxon[];
  semesters: Taxon[];
  chapters: Taxon[];
  topics: Taxon[];
  subtopics: Taxon[];
  difficulties: Taxon[];
};
