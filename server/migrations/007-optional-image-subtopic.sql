-- Run atomically through applyMigrations with foreign keys enabled and deferred.
-- Reconstruct parent and referencing history together; preserve every row and snapshot.
-- Migration 006 remains unchanged. Any failure rolls back the entire migration.
DROP TRIGGER image_topic_move_guard;
DROP TRIGGER image_subtopic_move_guard;
DROP TRIGGER image_chapter_move_guard;
DROP TRIGGER image_semester_move_guard;
CREATE TABLE image_questions_v7 (
  id TEXT PRIMARY KEY,
  legacy_id TEXT UNIQUE REFERENCES questions(id),
  topic_id TEXT NOT NULL REFERENCES topics(id),
  subtopic_id TEXT CHECK(subtopic_id IS NULL OR length(trim(subtopic_id))>0),
  difficulty_id TEXT NOT NULL REFERENCES difficulty_levels(id),
  total_marks INTEGER NOT NULL CHECK(total_marks>0 AND total_marks<=10000),
  status TEXT NOT NULL CHECK(status IN ('draft','reviewing','approved','retired')),
  question_image TEXT NOT NULL REFERENCES image_assets(key),
  answer_image TEXT NOT NULL REFERENCES image_assets(key),
  revision INTEGER NOT NULL CHECK(revision>0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK(legacy_id IS NULL OR legacy_id=id),
  FOREIGN KEY(subtopic_id,topic_id) REFERENCES subtopics(id,topic_id)
);

CREATE TABLE image_question_versions_v7 (
  question_id TEXT NOT NULL REFERENCES image_questions_v7(id),
  revision INTEGER NOT NULL,
  question_image TEXT NOT NULL REFERENCES image_assets(key),
  answer_image TEXT NOT NULL REFERENCES image_assets(key),
  snapshot TEXT NOT NULL CHECK(json_valid(snapshot)),
  classification TEXT NOT NULL CHECK(json_valid(classification)),
  actor_id TEXT NOT NULL REFERENCES admins(id),
  created_at TEXT NOT NULL,
  PRIMARY KEY(question_id,revision)
);

INSERT INTO image_questions_v7 SELECT * FROM image_questions;
INSERT INTO image_question_versions_v7 SELECT * FROM image_question_versions;
DROP TABLE image_question_versions;
DROP TABLE image_questions;
ALTER TABLE image_questions_v7 RENAME TO image_questions;
ALTER TABLE image_question_versions_v7 RENAME TO image_question_versions;
CREATE INDEX image_questions_browse ON image_questions(status,topic_id,difficulty_id,id);
CREATE INDEX image_questions_subtopic ON image_questions(subtopic_id);

CREATE TRIGGER image_question_id_guard BEFORE INSERT ON image_questions
WHEN EXISTS(SELECT 1 FROM questions WHERE id=NEW.id) AND NEW.legacy_id IS NOT NEW.id
BEGIN SELECT RAISE(ABORT,'Legacy ID requires explicit conversion'); END;
CREATE TRIGGER image_versions_immutable_update BEFORE UPDATE ON image_question_versions
BEGIN SELECT RAISE(ABORT,'Historical image versions are immutable'); END;
CREATE TRIGGER image_versions_immutable_delete BEFORE DELETE ON image_question_versions
BEGIN SELECT RAISE(ABORT,'Historical image versions are immutable'); END;
-- Referenced hierarchy identities cannot be moved out from under current or historical image records.
CREATE TRIGGER image_topic_move_guard BEFORE UPDATE OF chapter_id ON topics
WHEN OLD.chapter_id<>NEW.chapter_id AND (
 EXISTS(SELECT 1 FROM image_questions WHERE topic_id=OLD.id) OR
 EXISTS(SELECT 1 FROM image_question_versions WHERE json_extract(classification,'$.topic.id')=OLD.id))
BEGIN SELECT RAISE(ABORT,'Referenced image question topic cannot move'); END;
CREATE TRIGGER image_subtopic_move_guard BEFORE UPDATE OF topic_id ON subtopics
WHEN OLD.topic_id<>NEW.topic_id AND (
 EXISTS(SELECT 1 FROM image_questions WHERE subtopic_id=OLD.id) OR
 EXISTS(SELECT 1 FROM image_question_versions WHERE json_extract(classification,'$.subtopic.id')=OLD.id))
BEGIN SELECT RAISE(ABORT,'Referenced image question subtopic cannot move'); END;
CREATE TRIGGER image_chapter_move_guard BEFORE UPDATE OF semester_id ON chapters
WHEN OLD.semester_id<>NEW.semester_id AND (
 EXISTS(SELECT 1 FROM image_questions q JOIN topics t ON t.id=q.topic_id WHERE t.chapter_id=OLD.id) OR
 EXISTS(SELECT 1 FROM image_question_versions WHERE json_extract(classification,'$.chapter.id')=OLD.id))
BEGIN SELECT RAISE(ABORT,'Referenced image question chapter cannot move'); END;
CREATE TRIGGER image_semester_move_guard BEFORE UPDATE OF course_id,curriculum_version_id ON semesters
WHEN (OLD.course_id<>NEW.course_id OR OLD.curriculum_version_id<>NEW.curriculum_version_id) AND (
 EXISTS(SELECT 1 FROM image_questions q JOIN topics t ON t.id=q.topic_id JOIN chapters c ON c.id=t.chapter_id WHERE c.semester_id=OLD.id) OR
 EXISTS(SELECT 1 FROM image_question_versions WHERE json_extract(classification,'$.semester.id')=OLD.id))
BEGIN SELECT RAISE(ABORT,'Referenced image question semester cannot move'); END;
