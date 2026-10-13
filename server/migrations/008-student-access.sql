-- Additive student access. Existing academic content and administrator records are untouched.
CREATE TABLE students (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  email_key TEXT NOT NULL UNIQUE,
  email_version INTEGER NOT NULL DEFAULT 1 CHECK(email_version>0),
  status TEXT NOT NULL CHECK(status IN ('PENDING_VERIFICATION','VERIFIED_AWAITING_CODE','ACTIVE','DISABLED')),
  email_verified_at INTEGER,
  access_code_hash TEXT,
  credential_version INTEGER NOT NULL DEFAULT 1 CHECK(credential_version>0),
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0),
  active_challenge_id TEXT REFERENCES student_email_challenges(id),
  delivery_state TEXT NOT NULL DEFAULT 'NOT_SENT' CHECK(delivery_state IN ('NOT_SENT','NOT_CONFIGURED','MANUAL_READY','SENDING','SENT','FAILED','UNKNOWN')),
  last_attempt_at INTEGER,
  registration_request_id TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL REFERENCES admins(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK(status<>'ACTIVE' OR (email_verified_at IS NOT NULL AND access_code_hash IS NOT NULL)),
  CHECK(status<>'PENDING_VERIFICATION' OR (email_verified_at IS NULL AND access_code_hash IS NULL)),
  CHECK(status<>'VERIFIED_AWAITING_CODE' OR (email_verified_at IS NOT NULL AND access_code_hash IS NULL)),
  CHECK(access_code_hash IS NULL OR email_verified_at IS NOT NULL)
);
CREATE INDEX students_browse ON students(created_at,id);
CREATE TABLE student_email_challenges (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id),
  email_key TEXT NOT NULL,
  email_version INTEGER NOT NULL,
  token_digest TEXT NOT NULL UNIQUE CHECK(length(token_digest)=64),
  request_id TEXT NOT NULL UNIQUE,
  delivery_state TEXT NOT NULL CHECK(delivery_state IN ('MANUAL_READY','SENDING','SENT','FAILED','UNKNOWN')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER,
  superseded_at INTEGER,
  CHECK(expires_at>created_at)
);
CREATE INDEX student_challenges_student ON student_email_challenges(student_id,created_at);
CREATE TABLE student_sessions (
  token_digest TEXT PRIMARY KEY CHECK(length(token_digest)=64),
  student_id TEXT NOT NULL REFERENCES students(id),
  credential_version INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER
);
CREATE INDEX student_sessions_student ON student_sessions(student_id);
CREATE INDEX student_sessions_expiry ON student_sessions(expires_at);
CREATE TABLE student_access_events (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id),
  actor_id TEXT REFERENCES admins(id),
  action TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TRIGGER student_events_immutable_update BEFORE UPDATE ON student_access_events
BEGIN SELECT RAISE(ABORT,'Student access events are immutable'); END;
CREATE TRIGGER student_events_immutable_delete BEFORE DELETE ON student_access_events
BEGIN SELECT RAISE(ABORT,'Student access events are immutable'); END;
