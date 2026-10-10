-- Review-only migration. Runtime initialization never applies DDL.
-- Extend the existing solution model to permit authentic whole-question answers.
CREATE TABLE solutions_new(question_id TEXT NOT NULL REFERENCES questions(id),part_id TEXT,solution TEXT NOT NULL,equation_latex TEXT NOT NULL,teacher_notes TEXT NOT NULL,PRIMARY KEY(question_id,part_id),FOREIGN KEY(question_id,part_id) REFERENCES question_parts(question_id,id));
INSERT INTO solutions_new SELECT * FROM solutions;
CREATE TABLE solution_steps_new(question_id TEXT NOT NULL REFERENCES questions(id),part_id TEXT,step_number INTEGER NOT NULL,explanation TEXT NOT NULL,equation_latex TEXT NOT NULL,working TEXT NOT NULL,marking_point TEXT NOT NULL,marks INTEGER NOT NULL CHECK(marks>=0),display_order INTEGER NOT NULL,PRIMARY KEY(question_id,part_id,step_number),FOREIGN KEY(question_id,part_id) REFERENCES solutions_new(question_id,part_id));
INSERT INTO solution_steps_new SELECT * FROM solution_steps;
DROP TABLE solution_steps;
DROP TABLE solutions;
ALTER TABLE solutions_new RENAME TO solutions;
ALTER TABLE solution_steps_new RENAME TO solution_steps;
CREATE UNIQUE INDEX whole_question_solution ON solutions(question_id) WHERE part_id IS NULL;
CREATE UNIQUE INDEX whole_question_step ON solution_steps(question_id,step_number) WHERE part_id IS NULL;
CREATE TRIGGER whole_step_insert BEFORE INSERT ON solution_steps WHEN NEW.part_id IS NULL AND NOT EXISTS(SELECT 1 FROM solutions WHERE question_id=NEW.question_id AND part_id IS NULL) BEGIN SELECT RAISE(ABORT,'Whole-question solution required'); END;
CREATE TRIGGER whole_step_update BEFORE UPDATE ON solution_steps WHEN NEW.part_id IS NULL AND NOT EXISTS(SELECT 1 FROM solutions WHERE question_id=NEW.question_id AND part_id IS NULL) BEGIN SELECT RAISE(ABORT,'Whole-question solution required'); END;
CREATE TRIGGER whole_solution_delete BEFORE DELETE ON solutions WHEN OLD.part_id IS NULL AND EXISTS(SELECT 1 FROM solution_steps WHERE question_id=OLD.question_id AND part_id IS NULL) BEGIN SELECT RAISE(ABORT,'Delete solution steps first'); END;
CREATE TRIGGER whole_solution_update BEFORE UPDATE OF question_id,part_id ON solutions WHEN OLD.part_id IS NULL AND EXISTS(SELECT 1 FROM solution_steps WHERE question_id=OLD.question_id AND part_id IS NULL) BEGIN SELECT RAISE(ABORT,'Delete solution steps first'); END;
ALTER TABLE assets ADD COLUMN import_metadata TEXT CHECK(import_metadata IS NULL OR json_valid(import_metadata));
CREATE TABLE question_content_blocks(question_id TEXT NOT NULL REFERENCES questions(id),owner_key TEXT NOT NULL,display_order INTEGER NOT NULL,block_type TEXT NOT NULL CHECK(block_type IN ('paragraph','math','image')),content TEXT,asset_id TEXT,PRIMARY KEY(question_id,owner_key,display_order),FOREIGN KEY(question_id,asset_id) REFERENCES assets(question_id,id));
CREATE TABLE question_import_receipts(plan_id TEXT PRIMARY KEY,question_id TEXT NOT NULL UNIQUE REFERENCES questions(id),admin_id TEXT NOT NULL REFERENCES admins(id),manifest_digest TEXT NOT NULL,fingerprint TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE INDEX question_import_fingerprint ON question_import_receipts(fingerprint);
