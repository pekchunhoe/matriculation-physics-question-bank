-- Explicit, additive administrative migration. No accounts or sessions seeded.
CREATE TABLE admins (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK(role='admin'),
  disabled INTEGER NOT NULL DEFAULT 0 CHECK(disabled IN (0,1)),
  created_at INTEGER NOT NULL
);
CREATE TABLE admin_sessions (
  token_digest TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL REFERENCES admins(id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  CHECK(expires_at>created_at)
);
CREATE INDEX admin_sessions_admin ON admin_sessions(admin_id);
CREATE INDEX admin_sessions_expiry ON admin_sessions(expires_at);
CREATE TABLE security_rate_limits (
  bucket TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  attempts INTEGER NOT NULL CHECK(attempts>=1),
  expires_at INTEGER NOT NULL
);
CREATE INDEX security_rate_limits_expiry ON security_rate_limits(expires_at);
