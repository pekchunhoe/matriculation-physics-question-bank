import type { Bank } from '../server/database.js';

/** Only called with disposable test banks. Copies metadata/history, sharing synthetic image assets. */
export async function seedQuestionCopies(
  bank: Bank,
  template: string,
  first: number,
  count: number,
) {
  await bank.transaction(async () => {
    for (let i = first; i < first + count; i++) {
      const id = 'test-pagination-' + String(i).padStart(5, '0');
      await bank.run(
        `INSERT INTO image_questions
        SELECT ?,NULL,topic_id,subtopic_id,difficulty_id,total_marks,status,question_image,answer_image,revision,created_at,updated_at
        FROM image_questions WHERE id=?`,
        id,
        template,
      );
      await bank.run(
        `INSERT INTO image_question_versions
        SELECT ?,revision,question_image,answer_image,json_set(snapshot,'$.id',?),classification,actor_id,created_at
        FROM image_question_versions WHERE question_id=? AND revision=(SELECT revision FROM image_questions WHERE id=?)`,
        id,
        id,
        template,
        template,
      );
    }
  });
}

export async function seedLegacyQuestions(bank: Bank, topic: string, count: number) {
  await bank.transaction(async () => {
    for (let i = 0; i < count; i++) {
      const id = 'test-legacy-page-' + String(i).padStart(4, '0');
      await bank.run(
        `INSERT INTO questions(id,question_code,topic_id,title,scenario,difficulty_id,question_type,total_marks,estimated_minutes,status,contains_diagram,contains_graph,contains_fbd,created_at,updated_at)
        VALUES(?,?,?,'TEST ONLY legacy pagination','TEST ONLY','medium','structured',5,10,'draft',0,0,0,'test','test')`,
        id,
        id,
        topic,
      );
    }
  });
}
