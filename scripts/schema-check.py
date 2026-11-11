#!/usr/bin/env python3
"""Dependency-free SQLite compatibility check for additive SILO schema migrations."""
import sqlite3

con = sqlite3.connect(':memory:')
con.execute('PRAGMA foreign_keys=ON')
con.executescript('''
CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,display_name TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,email_verified INTEGER NOT NULL DEFAULT 1);
INSERT INTO users VALUES('existing-user','owner@example.com','hash','Owner','2026-01-01','2026-01-01',1);
''')
# This is deliberately the same additive migration used by server/database.js.
columns = {row[1] for row in con.execute('PRAGMA table_info(users)')}
for name, sql in [
    ('mfa_enabled', 'ALTER TABLE users ADD COLUMN mfa_enabled INTEGER NOT NULL DEFAULT 0'),
    ('mfa_secret_enc', 'ALTER TABLE users ADD COLUMN mfa_secret_enc TEXT'),
    ('mfa_pending_secret_enc', 'ALTER TABLE users ADD COLUMN mfa_pending_secret_enc TEXT'),
    ('mfa_recovery_json', "ALTER TABLE users ADD COLUMN mfa_recovery_json TEXT NOT NULL DEFAULT '[]'"),
    ('mfa_last_counter', 'ALTER TABLE users ADD COLUMN mfa_last_counter INTEGER NOT NULL DEFAULT -1'),
]:
    if name not in columns:
        con.execute(sql)
con.execute("INSERT INTO schema_migrations VALUES(6,'2026-11-11T00:00:00.000Z')")
row = con.execute('SELECT id,email,password_hash,display_name,mfa_enabled,mfa_recovery_json,mfa_last_counter FROM users WHERE id=?', ('existing-user',)).fetchone()
assert row == ('existing-user','owner@example.com','hash','Owner',0,'[]',-1), row
assert {r[1] for r in con.execute('PRAGMA table_info(users)')} >= {'mfa_enabled','mfa_secret_enc','mfa_pending_secret_enc','mfa_recovery_json','mfa_last_counter'}
con.executescript('''CREATE TABLE workspaces(id TEXT PRIMARY KEY); CREATE TABLE workspace_invitations(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,email TEXT NOT NULL COLLATE NOCASE,role TEXT NOT NULL CHECK(role IN ('admin','member')),token_hash TEXT NOT NULL UNIQUE,invited_by TEXT,expires_at INTEGER NOT NULL,accepted_at TEXT,created_at TEXT NOT NULL); CREATE INDEX idx_workspace_invites_scope ON workspace_invitations(workspace_id,created_at); CREATE UNIQUE INDEX idx_workspace_invites_pending ON workspace_invitations(workspace_id,email) WHERE accepted_at IS NULL;''')
assert con.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='workspace_invitations'").fetchone()
con.executescript('''CREATE TABLE calendar_events(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,user_id TEXT,title TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',location TEXT NOT NULL DEFAULT '',starts_at TEXT NOT NULL,ends_at TEXT,reminder_minutes INTEGER NOT NULL DEFAULT 0,reminder_sent_at TEXT,reminder_attempted_at TEXT,reminder_status TEXT NOT NULL DEFAULT 'pending',recurrence TEXT NOT NULL DEFAULT 'none' CHECK(recurrence IN ('none','daily','weekly','monthly')),recurrence_until TEXT,recurrence_next_created INTEGER NOT NULL DEFAULT 0,parent_event_id TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL); CREATE INDEX idx_calendar_workspace_start ON calendar_events(workspace_id,starts_at); CREATE INDEX idx_calendar_reminders ON calendar_events(reminder_status,starts_at,reminder_minutes); CREATE TABLE email_templates(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,name TEXT NOT NULL,category TEXT NOT NULL DEFAULT 'general',subject TEXT NOT NULL,body TEXT NOT NULL,created_by TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL); CREATE INDEX idx_email_templates_workspace ON email_templates(workspace_id,updated_at); CREATE TABLE email_messages(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,created_by TEXT,to_email TEXT NOT NULL,subject TEXT NOT NULL,body TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','sent')),provider_message_id TEXT,sent_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL); CREATE INDEX idx_email_messages_workspace ON email_messages(workspace_id,status,updated_at);''')
con.execute("ALTER TABLE users ADD COLUMN notification_preferences_json TEXT NOT NULL DEFAULT '{\"calendarReminders\":true}'")
assert con.execute('SELECT notification_preferences_json FROM users WHERE id=?',('existing-user',)).fetchone()[0] == '{\"calendarReminders\":true}'
con.execute('ALTER TABLE email_messages ADD COLUMN send_lock INTEGER NOT NULL DEFAULT 0')
con.execute('ALTER TABLE email_messages ADD COLUMN send_started_at TEXT')
assert {r[1] for r in con.execute('PRAGMA table_info(email_messages)')} >= {'send_lock','send_started_at'}
con.execute('ALTER TABLE workspaces ADD COLUMN stripe_last_subscription_id TEXT')
con.execute('ALTER TABLE workspaces ADD COLUMN stripe_last_event_created INTEGER NOT NULL DEFAULT 0')
assert {r[1] for r in con.execute('PRAGMA table_info(workspaces)')} >= {'stripe_last_subscription_id','stripe_last_event_created'}
con.execute("INSERT INTO workspaces(id) VALUES('workspace-test')")
con.execute("INSERT INTO email_messages(id,workspace_id,to_email,subject,body,created_at,updated_at) VALUES('email-test','workspace-test','test@example.com','Subject','Body','now','now')")
first=con.execute("UPDATE email_messages SET send_lock=1 WHERE id='email-test' AND status='draft' AND send_lock=0").rowcount
second=con.execute("UPDATE email_messages SET send_lock=1 WHERE id='email-test' AND status='draft' AND send_lock=0").rowcount
assert first==1 and second==0, (first,second)
con.executescript('''
CREATE TABLE business_memory(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,category TEXT NOT NULL DEFAULT 'other' CHECK(category IN ('goal','decision','customer','preference','lesson','process','other')),title TEXT NOT NULL,content TEXT NOT NULL,created_by TEXT REFERENCES users(id) ON DELETE SET NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE INDEX idx_business_memory_workspace ON business_memory(workspace_id,updated_at);
INSERT INTO schema_migrations VALUES(13,'2026-11-11T00:00:00.000Z');
''')
con.execute("INSERT INTO business_memory(id,workspace_id,category,title,content,created_at,updated_at) VALUES('mem-test','workspace-test','goal','Test goal','Grow recurring revenue','now','now')")
assert con.execute("SELECT content FROM business_memory WHERE workspace_id='workspace-test'").fetchone()[0]=='Grow recurring revenue'
assert con.execute("SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1").fetchone()[0]==13
print('SQLite additive migrations 6–13 compatibility, business memory persistence and email send-lock checks passed; existing account data preserved.')
