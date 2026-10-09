import type { CurriculumVersion } from '../shared/curriculum';
import type { Taxonomy } from '../shared/schema';
import { inStoredOrder } from './taxonomy-order';

function VersionHierarchy({ version, tax }: { version: CurriculumVersion; tax: Taxonomy }) {
  return (
    <section className="curriculum-version" aria-label={version.name}>
      <h3>{version.name}</h3>
      <p className="muted">
        {version.code}
        {version.status === 'retired' && ' · Retired'}
      </p>
      {inStoredOrder(
        tax.semesters.filter((semester) => semester.curriculumVersionId === version.id),
      ).map((semester) => (
        <section key={semester.id} className="curriculum-semester">
          <h4>{semester.name}</h4>
          {inStoredOrder(tax.chapters.filter((chapter) => chapter.parentId === semester.id)).map(
            (chapter) => (
              <section className="tree-level" key={chapter.id}>
                <h5>{chapter.name}</h5>
                <ul>
                  {inStoredOrder(tax.topics.filter((topic) => topic.parentId === chapter.id)).map(
                    (topic) => (
                      <li key={topic.id}>
                        {topic.name}
                        {inStoredOrder(
                          tax.subtopics.filter((subtopic) => subtopic.parentId === topic.id),
                        ).map((subtopic) => (
                          <p key={subtopic.id}>{subtopic.name}</p>
                        ))}
                      </li>
                    ),
                  )}
                </ul>
              </section>
            ),
          )}
        </section>
      ))}
    </section>
  );
}

export function PublicCurriculum({ tax }: { tax: Taxonomy }) {
  return (
    <section className="panel public-curriculum">
      <p className="eyebrow">PUBLIC CURRICULUM</p>
      <h1>Courses, semesters and topics</h1>
      {inStoredOrder(tax.courses).map((course) => {
        const versions = inStoredOrder(
          (tax.curriculumVersions ?? []).filter((version) => version.courseId === course.id),
        );
        const current = versions.filter((version) => version.status === 'active');
        const historical = versions.filter((version) => version.status === 'retired');
        return (
          <section key={course.id}>
            <h2>{course.name}</h2>
            {current.map((version) => (
              <section
                className="current-curriculum"
                aria-label="Current Curriculum"
                key={version.id}
              >
                <p className="eyebrow">Current Curriculum</p>
                <VersionHierarchy version={version} tax={tax} />
              </section>
            ))}
            {!current.length && <p className="muted">No current curriculum is published.</p>}
            {historical.length > 0 && (
              <details className="curriculum-history">
                <summary>Historical curricula</summary>
                {historical.map((version) => (
                  <VersionHierarchy key={version.id} version={version} tax={tax} />
                ))}
              </details>
            )}
          </section>
        );
      })}
      <h2>Difficulty levels</h2>
      <p>{tax.difficulties.map((difficulty) => difficulty.name).join(' · ')}</p>
    </section>
  );
}
