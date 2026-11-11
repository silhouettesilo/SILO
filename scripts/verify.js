'use strict';
const assert = require('node:assert/strict');
const database = require('../server/database');
const { db } = database;

assert.equal(database.status().database, 'sqlite');
assert.ok(database.status().workspaceCount >= 0);
assert.ok(database.status().userCount >= 0);
assert.ok(database.status().recordCount >= 0);
const required = ['users','workspaces','memberships','workspace_records','workspace_settings','sessions','audit_log','password_reset_tokens','email_change_tokens','ai_usage','ai_execution_history','support_tickets','stripe_events','workspace_invitations','calendar_events','email_templates','email_messages','business_memory'];
for (const table of required) {
  const found = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);
  assert.ok(found, `Missing table ${table}`);
}
assert.ok(database.status().migration >= 13, 'Database migration 13 must be applied.');
for (const column of ['stripe_last_subscription_id','stripe_last_event_created']) {
  const found = db.prepare('PRAGMA table_info(workspaces)').all().some(c => c.name === column);
  assert.ok(found, `Missing workspaces.${column}`);
}
for (const column of ['send_lock','send_started_at']) {
  const found = db.prepare('PRAGMA table_info(email_messages)').all().some(c => c.name === column);
  assert.ok(found, `Missing email_messages.${column}`);
}
for (const column of ['mfa_enabled','mfa_secret_enc','mfa_pending_secret_enc','mfa_recovery_json','mfa_last_counter','notification_preferences_json']) {
  const found = db.prepare('PRAGMA table_info(users)').all().some(c => c.name === column);
  assert.ok(found, `Missing users.${column}`);
}
console.log('SILO 3.0 recovery verification passed.');
console.log(database.status());
