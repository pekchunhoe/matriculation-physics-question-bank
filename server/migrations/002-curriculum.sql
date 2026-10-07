-- Additive: existing IDs, question snapshots and content tables are retained.
CREATE TABLE curriculum_versions (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  effective_from TEXT,
  effective_to TEXT,
  status TEXT NOT NULL CHECK(status IN ('draft','active','retired')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(course_id,code),
  CHECK(effective_from IS NULL OR effective_to IS NULL OR effective_from<=effective_to)
);
CREATE UNIQUE INDEX one_active_curriculum ON curriculum_versions(course_id) WHERE status='active';
CREATE TRIGGER curriculum_course_stable BEFORE UPDATE OF course_id ON curriculum_versions WHEN NEW.course_id!=OLD.course_id BEGIN SELECT RAISE(ABORT,'Curriculum course membership is stable'); END;
INSERT INTO curriculum_versions
SELECT 'legacy-'||id,id,'LEGACY','Existing curriculum (unversioned)',NULL,NULL,'active',0,1,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM courses;
ALTER TABLE semesters ADD COLUMN curriculum_version_id TEXT REFERENCES curriculum_versions(id);
UPDATE semesters SET curriculum_version_id='legacy-'||course_id;
ALTER TABLE semesters ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','retired'));
ALTER TABLE semesters ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE chapters ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','retired'));
ALTER TABLE chapters ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE topics ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','retired'));
ALTER TABLE topics ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE subtopics ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','retired'));
ALTER TABLE subtopics ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
CREATE INDEX semesters_curriculum ON semesters(curriculum_version_id,status,sort_order);
CREATE INDEX curriculum_course ON curriculum_versions(course_id,status,sort_order);
CREATE TABLE curriculum_events(id TEXT PRIMARY KEY,kind TEXT NOT NULL,entity_id TEXT NOT NULL,before_json TEXT CHECK(before_json IS NULL OR json_valid(before_json)),after_json TEXT NOT NULL CHECK(json_valid(after_json)),note TEXT NOT NULL,author TEXT,created_at TEXT NOT NULL);
CREATE INDEX curriculum_events_entity ON curriculum_events(kind,entity_id,created_at);
CREATE TABLE question_version_classifications (
  question_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  snapshot TEXT NOT NULL CHECK(json_valid(snapshot)),
  PRIMARY KEY(question_id,version_number),
  FOREIGN KEY(question_id,version_number) REFERENCES question_versions(question_id,version_number)
);
-- Prior snapshots contain IDs, but not historical names. Label the reconstruction honestly.
INSERT INTO question_version_classifications
SELECT v.question_id,v.version_number,json_object(
 'course',json_object('id',co.id,'name',co.name,'slug',co.slug),
 'curriculumVersion',json_object('id',cv.id,'name',cv.name,'code',cv.code),
 'semester',json_object('id',s.id,'name',s.name,'slug',s.slug),
 'chapter',json_object('id',c.id,'name',c.name,'slug',c.slug),
 'topic',json_object('id',t.id,'name',t.name,'slug',t.slug),
 'subtopic',CASE WHEN st.id IS NULL THEN NULL ELSE json_object('id',st.id,'name',st.name,'slug',st.slug) END,
 'provenance','reconstructed')
FROM question_versions v JOIN topics t ON t.id=json_extract(v.snapshot,'$.question.topicId')
JOIN chapters c ON c.id=t.chapter_id JOIN semesters s ON s.id=c.semester_id
JOIN courses co ON co.id=s.course_id JOIN curriculum_versions cv ON cv.id=s.curriculum_version_id
LEFT JOIN subtopics st ON st.id=json_extract(v.snapshot,'$.question.subtopicId');
CREATE TRIGGER classifications_immutable_update BEFORE UPDATE ON question_version_classifications BEGIN SELECT RAISE(ABORT,'Historical classifications are immutable'); END;
CREATE TRIGGER classifications_immutable_delete BEFORE DELETE ON question_version_classifications BEGIN SELECT RAISE(ABORT,'Historical classifications are immutable'); END;
CREATE TRIGGER semester_curriculum_insert BEFORE INSERT ON semesters WHEN NEW.curriculum_version_id IS NULL OR NOT EXISTS(SELECT 1 FROM curriculum_versions WHERE id=NEW.curriculum_version_id AND course_id=NEW.course_id) BEGIN SELECT RAISE(ABORT,'Semester must belong to a curriculum version of its course'); END;
CREATE TRIGGER semester_curriculum_update BEFORE UPDATE OF course_id,curriculum_version_id ON semesters WHEN NEW.course_id!=OLD.course_id OR NEW.curriculum_version_id!=OLD.curriculum_version_id OR NEW.curriculum_version_id IS NULL BEGIN SELECT RAISE(ABORT,'Curriculum membership is stable; create a new curriculum version'); END;
CREATE TRIGGER semesters_no_delete BEFORE DELETE ON semesters BEGIN SELECT RAISE(ABORT,'Retire curriculum items instead of deleting them'); END;
CREATE TRIGGER chapters_no_delete BEFORE DELETE ON chapters BEGIN SELECT RAISE(ABORT,'Retire curriculum items instead of deleting them'); END;
CREATE TRIGGER topics_no_delete BEFORE DELETE ON topics BEGIN SELECT RAISE(ABORT,'Retire curriculum items instead of deleting them'); END;
CREATE TRIGGER subtopics_no_delete BEFORE DELETE ON subtopics BEGIN SELECT RAISE(ABORT,'Retire curriculum items instead of deleting them'); END;
CREATE TRIGGER curriculum_no_delete BEFORE DELETE ON curriculum_versions BEGIN SELECT RAISE(ABORT,'Retire curriculum versions instead of deleting them'); END;
CREATE TRIGGER chapter_move_guard BEFORE UPDATE OF semester_id ON chapters WHEN NEW.semester_id!=OLD.semester_id AND (
 (SELECT curriculum_version_id FROM semesters WHERE id=NEW.semester_id)!=(SELECT curriculum_version_id FROM semesters WHERE id=OLD.semester_id)
 OR EXISTS(SELECT 1 FROM question_version_classifications WHERE json_extract(snapshot,'$.chapter.id')=OLD.id)
 OR EXISTS(SELECT 1 FROM questions q JOIN topics t ON t.id=q.topic_id WHERE t.chapter_id=OLD.id)
 OR EXISTS(SELECT 1 FROM revision_candidates r JOIN topics t ON t.id=json_extract(r.snapshot,'$.question.topicId') WHERE t.chapter_id=OLD.id AND r.status='pending')
) BEGIN SELECT RAISE(ABORT,'Referenced or cross-version chapters cannot move; use a new curriculum version'); END;
CREATE TRIGGER topic_move_guard BEFORE UPDATE OF chapter_id ON topics WHEN NEW.chapter_id!=OLD.chapter_id AND (
 (SELECT s.curriculum_version_id FROM chapters c JOIN semesters s ON s.id=c.semester_id WHERE c.id=NEW.chapter_id)!=(SELECT s.curriculum_version_id FROM chapters c JOIN semesters s ON s.id=c.semester_id WHERE c.id=OLD.chapter_id)
 OR EXISTS(SELECT 1 FROM question_version_classifications WHERE json_extract(snapshot,'$.topic.id')=OLD.id)
 OR EXISTS(SELECT 1 FROM questions WHERE topic_id=OLD.id)
 OR EXISTS(SELECT 1 FROM revision_candidates WHERE json_extract(snapshot,'$.question.topicId')=OLD.id AND status='pending')
) BEGIN SELECT RAISE(ABORT,'Referenced or cross-version topics cannot move; use a new curriculum version'); END;
CREATE TRIGGER subtopic_move_guard BEFORE UPDATE OF topic_id ON subtopics WHEN NEW.topic_id!=OLD.topic_id AND (
 (SELECT s.curriculum_version_id FROM topics t JOIN chapters c ON c.id=t.chapter_id JOIN semesters s ON s.id=c.semester_id WHERE t.id=NEW.topic_id)!=(SELECT s.curriculum_version_id FROM topics t JOIN chapters c ON c.id=t.chapter_id JOIN semesters s ON s.id=c.semester_id WHERE t.id=OLD.topic_id)
 OR EXISTS(SELECT 1 FROM question_version_classifications WHERE json_extract(snapshot,'$.subtopic.id')=OLD.id)
 OR EXISTS(SELECT 1 FROM questions WHERE subtopic_id=OLD.id)
 OR EXISTS(SELECT 1 FROM revision_candidates WHERE json_extract(snapshot,'$.question.subtopicId')=OLD.id AND status='pending')
) BEGIN SELECT RAISE(ABORT,'Referenced or cross-version subtopics cannot move; use a new curriculum version'); END;
