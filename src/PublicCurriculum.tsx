import type { Taxonomy } from '../shared/schema';
export function PublicCurriculum({ tax }: { tax: Taxonomy }) {
  return (
    <section className="panel">
      <p className="eyebrow">PUBLIC CURRICULUM</p>
      <h1>Courses, semesters and topics</h1>
      {tax.courses.map((course) => (
        <section key={course.id}>
          <h2>{course.name}</h2>
          {tax.semesters
            .filter((semester) => semester.parentId === course.id)
            .map((semester) => (
              <section key={semester.id}>
                <h3>{semester.name}</h3>
                {tax.chapters
                  .filter((chapter) => chapter.parentId === semester.id)
                  .map((chapter) => (
                    <section className="tree-level" key={chapter.id}>
                      <h4>{chapter.name}</h4>
                      <ul>
                        {tax.topics
                          .filter((topic) => topic.parentId === chapter.id)
                          .map((topic) => (
                            <li key={topic.id}>
                              {topic.name}
                              {tax.subtopics
                                .filter((subtopic) => subtopic.parentId === topic.id)
                                .map((subtopic) => (
                                  <p key={subtopic.id}>{subtopic.name}</p>
                                ))}
                            </li>
                          ))}
                      </ul>
                    </section>
                  ))}
              </section>
            ))}
        </section>
      ))}
      <h2>Difficulty levels</h2>
      <p>{tax.difficulties.map((difficulty) => difficulty.name).join(' · ')}</p>
    </section>
  );
}
