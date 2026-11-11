'use strict';

const Database = require('better-sqlite3');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'silo.sqlite');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

db.exec(`
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  industry TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  plan TEXT NOT NULL DEFAULT 'free',
  subscription_status TEXT NOT NULL DEFAULT 'inactive',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  email_verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS memberships (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'owner' CHECK(role IN ('owner','admin','member')),
  created_at TEXT NOT NULL,
  UNIQUE(user_id, workspace_id)
);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_workspace ON memberships(workspace_id);
CREATE TABLE IF NOT EXISTS workspace_records (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  collection TEXT NOT NULL CHECK(collection IN ('tasks','customers','documents','automations','activity','proposals')),
  data_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_records_scope ON workspace_records(workspace_id, collection, updated_at);
CREATE TABLE IF NOT EXISTS workspace_settings (
  workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  data_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  sid TEXT PRIMARY KEY,
  session_json TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_email_tokens_user ON email_verification_tokens(user_id);
CREATE TABLE IF NOT EXISTS app_secrets (
  name TEXT PRIMARY KEY,
  secret_value TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT,
  action TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_workspace ON audit_log(workspace_id, created_at);
`);

const now = () => new Date().toISOString();
const collections = ['tasks','customers','documents','automations','activity','proposals'];

function tableHasColumn(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === column);
}

function migrateLegacyJson() {
  const already = db.prepare('SELECT version FROM schema_migrations WHERE version=1').get();
  if (already) return { migrated: false, reason: 'Already migrated.' };

  const dataDir = DATA_DIR;
  const legacy = {};
  for (const name of collections) {
    const p = path.join(dataDir, `${name}.json`);
    if (!fs.existsSync(p)) { legacy[name] = []; continue; }
    let parsed;
    try { parsed = JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { throw new Error(`Cannot migrate ${name}.json: invalid JSON. Original file was preserved.`); }
    if (!Array.isArray(parsed)) throw new Error(`Cannot migrate ${name}.json: expected an array.`);
    legacy[name] = parsed;
  }
  const settingsPath = path.join(dataDir, 'settings.json');
  let settings = {};
  if (fs.existsSync(settingsPath)) {
    try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); }
    catch { throw new Error('Cannot migrate settings.json: invalid JSON. Original file was preserved.'); }
  }
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) settings = {};

  const migrate = db.transaction(() => {
    const workspaceId = 'legacy-workspace';
    db.prepare(`INSERT OR IGNORE INTO workspaces(id,name,industry,description,created_at)
      VALUES(?,?,?,?,?)`).run(workspaceId, settings.workspaceName || 'My SILO Workspace',
      settings.industry || '', settings.description || '', now());

    const insert = db.prepare(`INSERT OR IGNORE INTO workspace_records
      (id,workspace_id,collection,data_json,created_at,updated_at) VALUES(?,?,?,?,?,?)`);
    let count = 0;
    for (const collection of collections) {
      for (const raw of legacy[collection]) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
        const record = { ...raw, id: typeof raw.id === 'string' && raw.id ? raw.id : randomUUID() };
        const timestamp = record.updatedAt || record.createdAt || now();
        insert.run(record.id, workspaceId, collection, JSON.stringify(record),
          record.createdAt || timestamp, timestamp);
        count++;
      }
    }
    db.prepare(`INSERT OR IGNORE INTO workspace_settings(workspace_id,data_json,updated_at)
      VALUES(?,?,?)`).run(workspaceId, JSON.stringify(settings), now());
    db.prepare('INSERT INTO schema_migrations(version,applied_at) VALUES(1,?)').run(now());
    return count;
  });
  return { migrated: true, totalRecords: migrate(), workspaceId: 'legacy-workspace' };
}

function ensureMigrations() {
  // Preserve databases created by the earlier SILO 2.0 database bootstrap.
  // Version 2 adds billing columns without rebuilding or deleting user data.
  const v1 = db.prepare('SELECT version FROM schema_migrations WHERE version=1').get();
  if (!v1) migrateLegacyJson();

  const v2 = db.prepare('SELECT version FROM schema_migrations WHERE version=2').get();
  if (!v2) {
    const migrateV2 = db.transaction(() => {
      if (!tableHasColumn('workspaces', 'plan')) {
        db.exec("ALTER TABLE workspaces ADD COLUMN plan TEXT NOT NULL DEFAULT 'free'");
      }
      if (!tableHasColumn('workspaces', 'subscription_status')) {
        db.exec("ALTER TABLE workspaces ADD COLUMN subscription_status TEXT NOT NULL DEFAULT 'inactive'");
      }
      if (!tableHasColumn('workspaces', 'stripe_customer_id')) {
        db.exec('ALTER TABLE workspaces ADD COLUMN stripe_customer_id TEXT');
      }
      if (!tableHasColumn('workspaces', 'stripe_subscription_id')) {
        db.exec('ALTER TABLE workspaces ADD COLUMN stripe_subscription_id TEXT');
      }
      db.prepare('INSERT INTO schema_migrations(version,applied_at) VALUES(2,?)').run(now());
    });
    migrateV2();
  }

  const v3 = db.prepare('SELECT version FROM schema_migrations WHERE version=3').get();
  if (!v3) {
    const migrateV3 = db.transaction(() => {
      // Be defensive with databases created by an earlier 2.0 schema revision.
      // Add the column before grandfathering existing accounts as verified.
      if (!tableHasColumn('users', 'email_verified')) {
        db.exec('ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 1');
      } else {
        // Accounts that predate email verification remain usable after upgrading.
        db.prepare('UPDATE users SET email_verified=1 WHERE email_verified=0').run();
      }
      db.prepare('INSERT INTO schema_migrations(version,applied_at) VALUES(3,?)').run(now());
    });
    migrateV3();
  }

  const v4 = db.prepare('SELECT version FROM schema_migrations WHERE version=4').get();
  if (!v4) {
    const migrateV4 = db.transaction(() => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
          token_hash TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at INTEGER NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id);
        CREATE TABLE IF NOT EXISTS ai_usage (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          user_id TEXT,
          provider TEXT NOT NULL,
          model TEXT NOT NULL,
          input_tokens INTEGER NOT NULL DEFAULT 0,
          output_tokens INTEGER NOT NULL DEFAULT 0,
          estimated_cost_usd REAL NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_ai_usage_workspace_date ON ai_usage(workspace_id,created_at);
        CREATE TABLE IF NOT EXISTS ai_execution_history (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          user_id TEXT,
          proposal_id TEXT,
          action TEXT NOT NULL,
          detail_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_ai_history_workspace ON ai_execution_history(workspace_id,created_at);
        CREATE TABLE IF NOT EXISTS support_tickets (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          user_id TEXT,
          subject TEXT NOT NULL,
          message TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'open',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS stripe_events (
          event_id TEXT PRIMARY KEY,
          event_type TEXT NOT NULL,
          received_at TEXT NOT NULL
        );
      `);
      db.prepare('INSERT INTO schema_migrations(version,applied_at) VALUES(4,?)').run(now());
    });
    migrateV4();
  }

  const v5 = db.prepare('SELECT version FROM schema_migrations WHERE version=5').get();
  if (!v5) {
    const migrateV5 = db.transaction(() => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS email_change_tokens (
          token_hash TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          new_email TEXT NOT NULL COLLATE NOCASE,
          expires_at INTEGER NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_email_change_user ON email_change_tokens(user_id);
      `);
      db.prepare('INSERT INTO schema_migrations(version,applied_at) VALUES(5,?)').run(now());
    });
    migrateV5();
  }

  const v6 = db.prepare('SELECT version FROM schema_migrations WHERE version=6').get();
  if (!v6) {
    const migrateV6 = db.transaction(() => {
      if (!tableHasColumn('users', 'mfa_enabled')) db.exec('ALTER TABLE users ADD COLUMN mfa_enabled INTEGER NOT NULL DEFAULT 0');
      if (!tableHasColumn('users', 'mfa_secret_enc')) db.exec('ALTER TABLE users ADD COLUMN mfa_secret_enc TEXT');
      if (!tableHasColumn('users', 'mfa_pending_secret_enc')) db.exec('ALTER TABLE users ADD COLUMN mfa_pending_secret_enc TEXT');
      if (!tableHasColumn('users', 'mfa_recovery_json')) db.exec("ALTER TABLE users ADD COLUMN mfa_recovery_json TEXT NOT NULL DEFAULT '[]'");
      if (!tableHasColumn('users', 'mfa_last_counter')) db.exec('ALTER TABLE users ADD COLUMN mfa_last_counter INTEGER NOT NULL DEFAULT -1');
      db.prepare('INSERT INTO schema_migrations(version,applied_at) VALUES(6,?)').run(now());
    });
    migrateV6();
  }

  const v7 = db.prepare('SELECT version FROM schema_migrations WHERE version=7').get();
  if (!v7) {
    const migrateV7 = db.transaction(() => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS workspace_invitations (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          email TEXT NOT NULL COLLATE NOCASE,
          role TEXT NOT NULL CHECK(role IN ('admin','member')),
          token_hash TEXT NOT NULL UNIQUE,
          invited_by TEXT,
          expires_at INTEGER NOT NULL,
          accepted_at TEXT,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_workspace_invites_scope ON workspace_invitations(workspace_id,created_at);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_invites_pending ON workspace_invitations(workspace_id,email) WHERE accepted_at IS NULL;
      `);
      db.prepare('INSERT INTO schema_migrations(version,applied_at) VALUES(7,?)').run(now());
    });
    migrateV7();
  }

  const v8 = db.prepare('SELECT version FROM schema_migrations WHERE version=8').get();
  if (!v8) {
    const migrateV8 = db.transaction(() => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS calendar_events (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          user_id TEXT,
          title TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          location TEXT NOT NULL DEFAULT '',
          starts_at TEXT NOT NULL,
          ends_at TEXT,
          reminder_minutes INTEGER NOT NULL DEFAULT 0,
          reminder_sent_at TEXT,
          reminder_attempted_at TEXT,
          reminder_status TEXT NOT NULL DEFAULT 'pending',
          recurrence TEXT NOT NULL DEFAULT 'none' CHECK(recurrence IN ('none','daily','weekly','monthly')),
          recurrence_until TEXT,
          recurrence_next_created INTEGER NOT NULL DEFAULT 0,
          parent_event_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_calendar_workspace_start ON calendar_events(workspace_id,starts_at);
        CREATE INDEX IF NOT EXISTS idx_calendar_reminders ON calendar_events(reminder_status,starts_at,reminder_minutes);
        CREATE TABLE IF NOT EXISTS email_templates (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          category TEXT NOT NULL DEFAULT 'general',
          subject TEXT NOT NULL,
          body TEXT NOT NULL,
          created_by TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_email_templates_workspace ON email_templates(workspace_id,updated_at);
      `);
      db.prepare('INSERT INTO schema_migrations(version,applied_at) VALUES(8,?)').run(now());
    });
    migrateV8();
  }

  const v9 = db.prepare('SELECT version FROM schema_migrations WHERE version=9').get();
  if (!v9) {
    const migrateV9 = db.transaction(() => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS email_messages (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          created_by TEXT,
          to_email TEXT NOT NULL,
          subject TEXT NOT NULL,
          body TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','sent')),
          provider_message_id TEXT,
          sent_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_email_messages_workspace ON email_messages(workspace_id,status,updated_at);
      `);
      db.prepare('INSERT INTO schema_migrations(version,applied_at) VALUES(9,?)').run(now());
    });
    migrateV9();
  }

  const v10 = db.prepare('SELECT version FROM schema_migrations WHERE version=10').get();
  if (!v10) {
    const migrateV10 = db.transaction(() => {
      if (!tableHasColumn('users', 'notification_preferences_json')) db.exec("ALTER TABLE users ADD COLUMN notification_preferences_json TEXT NOT NULL DEFAULT '{\"calendarReminders\":true}'");
      db.prepare('INSERT INTO schema_migrations(version,applied_at) VALUES(10,?)').run(now());
    });
    migrateV10();
  }

  const v11 = db.prepare('SELECT version FROM schema_migrations WHERE version=11').get();
  if (!v11) {
    const migrateV11 = db.transaction(() => {
      if (!tableHasColumn('email_messages', 'send_lock')) db.exec('ALTER TABLE email_messages ADD COLUMN send_lock INTEGER NOT NULL DEFAULT 0');
      if (!tableHasColumn('email_messages', 'send_started_at')) db.exec('ALTER TABLE email_messages ADD COLUMN send_started_at TEXT');
      db.prepare('INSERT INTO schema_migrations(version,applied_at) VALUES(11,?)').run(now());
    });
    migrateV11();
  }

  const v12 = db.prepare('SELECT version FROM schema_migrations WHERE version=12').get();
  if (!v12) {
    const migrateV12 = db.transaction(() => {
      if (!tableHasColumn('workspaces', 'stripe_last_subscription_id')) db.exec('ALTER TABLE workspaces ADD COLUMN stripe_last_subscription_id TEXT');
      if (!tableHasColumn('workspaces', 'stripe_last_event_created')) db.exec('ALTER TABLE workspaces ADD COLUMN stripe_last_event_created INTEGER NOT NULL DEFAULT 0');
      db.prepare('INSERT INTO schema_migrations(version,applied_at) VALUES(12,?)').run(now());
    });
    migrateV12();
  }

  const v13 = db.prepare('SELECT version FROM schema_migrations WHERE version=13').get();
  if (!v13) {
    const migrateV13 = db.transaction(() => {
      db.exec(`CREATE TABLE IF NOT EXISTS business_memory (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        category TEXT NOT NULL DEFAULT 'other' CHECK(category IN ('goal','decision','customer','preference','lesson','process','other')),
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_business_memory_workspace ON business_memory(workspace_id,updated_at);`);
      db.prepare('INSERT INTO schema_migrations(version,applied_at) VALUES(13,?)').run(now());
    });
    migrateV13();
  }
}


function getOrCreateSecret(name) {
  const existing = db.prepare('SELECT secret_value FROM app_secrets WHERE name=?').get(name);
  if (existing) return existing.secret_value;
  const value = require('node:crypto').randomBytes(48).toString('hex');
  db.prepare('INSERT OR IGNORE INTO app_secrets(name,secret_value,created_at) VALUES(?,?,?)').run(name,value,now());
  return db.prepare('SELECT secret_value FROM app_secrets WHERE name=?').get(name).secret_value;
}

function status() {
  return {
    database: 'sqlite',
    workspaceCount: db.prepare('SELECT COUNT(*) c FROM workspaces').get().c,
    userCount: db.prepare('SELECT COUNT(*) c FROM users').get().c,
    recordCount: db.prepare('SELECT COUNT(*) c FROM workspace_records').get().c,
    migration: db.prepare('SELECT MAX(version) version FROM schema_migrations').get().version
  };
}

function getRecords(workspaceId, collection) {
  return db.prepare('SELECT data_json FROM workspace_records WHERE workspace_id=? AND collection=? ORDER BY updated_at DESC')
    .all(workspaceId, collection).map(r => JSON.parse(r.data_json));
}
function getRecord(workspaceId, collection, id) {
  const row = db.prepare('SELECT data_json FROM workspace_records WHERE workspace_id=? AND collection=? AND id=?')
    .get(workspaceId, collection, id);
  return row ? JSON.parse(row.data_json) : null;
}
function saveRecord(workspaceId, collection, record) {
  const stamp = now();
  const data = { ...record, updatedAt: record.updatedAt || stamp };
  db.prepare(`INSERT INTO workspace_records(id,workspace_id,collection,data_json,created_at,updated_at)
    VALUES(?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET data_json=excluded.data_json,updated_at=excluded.updated_at
    WHERE workspace_records.workspace_id=excluded.workspace_id AND workspace_records.collection=excluded.collection`)
    .run(data.id, workspaceId, collection, JSON.stringify(data), data.createdAt || stamp, stamp);
  return data;
}
function deleteRecord(workspaceId, collection, id) {
  return db.prepare('DELETE FROM workspace_records WHERE workspace_id=? AND collection=? AND id=?')
    .run(workspaceId, collection, id).changes > 0;
}
function getSettings(workspaceId) {
  const row = db.prepare('SELECT data_json FROM workspace_settings WHERE workspace_id=?').get(workspaceId);
  return row ? JSON.parse(row.data_json) : {};
}
function saveSettings(workspaceId, settings) {
  db.prepare(`INSERT INTO workspace_settings(workspace_id,data_json,updated_at) VALUES(?,?,?)
    ON CONFLICT(workspace_id) DO UPDATE SET data_json=excluded.data_json,updated_at=excluded.updated_at`)
    .run(workspaceId, JSON.stringify(settings), now());
}
function logAudit(workspaceId, userId, action, detail={}) {
  db.prepare('INSERT INTO audit_log(id,workspace_id,user_id,action,detail_json,created_at) VALUES(?,?,?,?,?,?)')
    .run(randomUUID(), workspaceId, userId || null, action, JSON.stringify(detail), now());
}
function getAudit(workspaceId, limit=50) {
  return db.prepare('SELECT action,detail_json,created_at FROM audit_log WHERE workspace_id=? ORDER BY created_at DESC LIMIT ?')
    .all(workspaceId, limit).map(r => ({ action:r.action, detail:JSON.parse(r.detail_json), createdAt:r.created_at }));
}

ensureMigrations();

module.exports = { db, DATA_DIR, DB_PATH, collections, migrateLegacyJson, status, getRecords, getRecord, saveRecord, deleteRecord, getSettings, saveSettings, logAudit, getAudit, getOrCreateSecret, now };
