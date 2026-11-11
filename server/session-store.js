'use strict';
const session = require('express-session');
const { db } = require('./database');

class SQLiteSessionStore extends session.Store {
  constructor() {
    super();
    this.getStmt = db.prepare('SELECT session_json,expires_at FROM sessions WHERE sid=?');
    this.setStmt = db.prepare(`INSERT INTO sessions(sid,session_json,expires_at) VALUES(?,?,?)
      ON CONFLICT(sid) DO UPDATE SET session_json=excluded.session_json,expires_at=excluded.expires_at`);
    this.destroyStmt = db.prepare('DELETE FROM sessions WHERE sid=?');
    this.touchStmt = db.prepare('UPDATE sessions SET expires_at=? WHERE sid=?');
    this.cleanupStmt = db.prepare('DELETE FROM sessions WHERE expires_at <= ?');
    this.cleanupStmt.run(Date.now());
  }
  get(sid, callback) {
    try {
      const row = this.getStmt.get(sid);
      if (!row) return callback(null, null);
      if (row.expires_at <= Date.now()) {
        this.destroyStmt.run(sid);
        return callback(null, null);
      }
      callback(null, JSON.parse(row.session_json));
    } catch (e) { callback(e); }
  }
  set(sid, sess, callback=()=>{}) {
    try {
      const expires = sess.cookie && sess.cookie.expires ? new Date(sess.cookie.expires).getTime() : Date.now()+86400000;
      this.setStmt.run(sid, JSON.stringify(sess), expires);
      callback(null);
    } catch (e) { callback(e); }
  }
  destroy(sid, callback=()=>{}) {
    try { this.destroyStmt.run(sid); callback(null); } catch (e) { callback(e); }
  }
  touch(sid, sess, callback=()=>{}) {
    try {
      const expires = sess.cookie && sess.cookie.expires ? new Date(sess.cookie.expires).getTime() : Date.now()+86400000;
      this.touchStmt.run(expires, sid);
      callback(null);
    } catch (e) { callback(e); }
  }
}
module.exports = SQLiteSessionStore;
