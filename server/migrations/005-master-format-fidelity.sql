-- Review-only, explicit rollout. No runtime initialization applies this migration.
-- Old steps and hints remain unlinked; immutable snapshots are untouched.
ALTER TABLE solution_steps ADD COLUMN step_id TEXT CHECK(step_id IS NULL OR length(step_id) BETWEEN 1 AND 120);
ALTER TABLE solution_steps ADD COLUMN marking_code TEXT CHECK(marking_code IS NULL OR (length(marking_code) BETWEEN 1 AND 24 AND substr(marking_code,1,1) GLOB '[A-Za-z0-9]' AND marking_code NOT GLOB '*[^A-Za-z0-9+._/-]*'));
CREATE UNIQUE INDEX question_solution_step_key ON solution_steps(question_id,step_id);
CREATE TABLE hints_new(
  question_id TEXT NOT NULL REFERENCES questions(id),
  id TEXT NOT NULL,
  part_id TEXT,
  hint_text TEXT NOT NULL,
  display_order INTEGER NOT NULL,
  solution_step_id TEXT,
  PRIMARY KEY(question_id,id),
  FOREIGN KEY(question_id,part_id) REFERENCES question_parts(question_id,id),
  FOREIGN KEY(question_id,solution_step_id) REFERENCES solution_steps(question_id,step_id)
);
INSERT INTO hints_new(question_id,id,part_id,hint_text,display_order) SELECT question_id,id,part_id,hint_text,display_order FROM hints;
DROP TABLE hints;
ALTER TABLE hints_new RENAME TO hints;
CREATE INDEX hint_solution_step ON hints(question_id,solution_step_id);
-- NULL-safe part equality includes authentic whole-question solutions.
CREATE TRIGGER hint_step_owner_insert BEFORE INSERT ON hints
WHEN NEW.solution_step_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM solution_steps s WHERE s.question_id=NEW.question_id AND s.step_id=NEW.solution_step_id AND s.part_id IS NEW.part_id)
BEGIN SELECT RAISE(ABORT,'Hint solution step must belong to the same question and part'); END;
CREATE TRIGGER hint_step_owner_update BEFORE UPDATE ON hints
WHEN NEW.solution_step_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM solution_steps s WHERE s.question_id=NEW.question_id AND s.step_id=NEW.solution_step_id AND s.part_id IS NEW.part_id)
BEGIN SELECT RAISE(ABORT,'Hint solution step must belong to the same question and part'); END;
CREATE TRIGGER linked_step_owner_update BEFORE UPDATE OF question_id,part_id,step_id ON solution_steps
WHEN EXISTS(SELECT 1 FROM hints h WHERE h.question_id=OLD.question_id AND h.solution_step_id=OLD.step_id AND (NEW.question_id IS NOT h.question_id OR NEW.part_id IS NOT h.part_id OR NEW.step_id IS NOT h.solution_step_id))
BEGIN SELECT RAISE(ABORT,'Remove linked hints before changing step ownership'); END;
