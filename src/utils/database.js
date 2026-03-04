/**
 * SQLite database for tracking AI-verified users.
 *
 * Schema:
 *   verified_users(user_id, guild_id, verified, joined_at, verified_at)
 *
 * A row is inserted when a user JOINS a server the bot is in.
 * `verified` is 0 (pending) until their first message passes AI analysis,
 * at which point it becomes 1.
 */

const path = require('node:path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'verified.db');

// Ensure the data directory exists
const fs = require('node:fs');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');

// Create table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS verified_users (
    user_id    TEXT    NOT NULL,
    guild_id   TEXT    NOT NULL,
    verified   INTEGER NOT NULL DEFAULT 0,
    joined_at  TEXT    NOT NULL,
    verified_at TEXT,
    PRIMARY KEY (user_id, guild_id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS guild_settings (
    guild_id         TEXT PRIMARY KEY NOT NULL,
    ai_moderation    INTEGER NOT NULL DEFAULT 1,
    automod_channel  TEXT    NOT NULL DEFAULT 'automod',
    timeout_duration INTEGER NOT NULL DEFAULT 86400000
  )
`);

/* ------------------------------------------------------------------ */
/*  Prepared statements                                                */
/* ------------------------------------------------------------------ */

const stmtInsert = db.prepare(`
  INSERT OR IGNORE INTO verified_users (user_id, guild_id, verified, joined_at)
  VALUES (?, ?, 0, ?)
`);

const stmtIsUnverified = db.prepare(`
  SELECT 1 FROM verified_users
  WHERE user_id = ? AND guild_id = ? AND verified = 0
`);

const stmtMarkVerified = db.prepare(`
  UPDATE verified_users
  SET verified = 1, verified_at = ?
  WHERE user_id = ? AND guild_id = ?
`);

const stmtSetStatus = db.prepare(`
  UPDATE verified_users
  SET verified = ?, verified_at = CASE WHEN ? = 1 THEN ? ELSE NULL END
  WHERE user_id = ? AND guild_id = ?
`);

const stmtGetUser = db.prepare(`
  SELECT * FROM verified_users
  WHERE user_id = ? AND guild_id = ?
`);

const stmtListByGuild = db.prepare(`
  SELECT * FROM verified_users
  WHERE guild_id = ?
  ORDER BY joined_at DESC
  LIMIT ? OFFSET ?
`);

const stmtCountByGuild = db.prepare(`
  SELECT COUNT(*) as total FROM verified_users
  WHERE guild_id = ?
`);

const stmtDelete = db.prepare(`
  DELETE FROM verified_users
  WHERE user_id = ? AND guild_id = ?
`);

/* ------------------------------------------------------------------ */
/*  Exported helpers                                                   */
/* ------------------------------------------------------------------ */

/** Insert a new joiner as unverified. Does nothing if already exists. */
function addJoiner(userId, guildId) {
  stmtInsert.run(userId, guildId, new Date().toISOString());
}

/** Returns true if the user exists in the DB and is NOT yet verified. */
function isUnverified(userId, guildId) {
  return !!stmtIsUnverified.get(userId, guildId);
}

/** Mark a user as AI-verified. */
function markVerified(userId, guildId) {
  stmtMarkVerified.run(new Date().toISOString(), userId, guildId);
}

/** Manually set verified status (1 or 0). */
function setVerified(userId, guildId, status) {
  const now = new Date().toISOString();
  stmtSetStatus.run(status, status, now, userId, guildId);
}

/** Get a single user record. Returns object or undefined. */
function getUser(userId, guildId) {
  return stmtGetUser.get(userId, guildId);
}

/** List users for a guild with pagination. */
function listUsers(guildId, limit = 10, offset = 0) {
  return stmtListByGuild.all(guildId, limit, offset);
}

/** Count total users for a guild. */
function countUsers(guildId) {
  return stmtCountByGuild.get(guildId).total;
}

/** Delete a user record from the DB. */
function deleteUser(userId, guildId) {
  return stmtDelete.run(userId, guildId);
}

/* ------------------------------------------------------------------ */
/*  Guild settings                                                     */
/* ------------------------------------------------------------------ */

const stmtGetSettings = db.prepare(`
  SELECT * FROM guild_settings WHERE guild_id = ?
`);

const stmtUpsertSettings = db.prepare(`
  INSERT INTO guild_settings (guild_id, ai_moderation, automod_channel, timeout_duration)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(guild_id) DO UPDATE SET
    ai_moderation    = excluded.ai_moderation,
    automod_channel  = excluded.automod_channel,
    timeout_duration = excluded.timeout_duration
`);

const DEFAULTS = {
  ai_moderation: 1,
  automod_channel: 'automod',
  timeout_duration: 86400000, // 24h in ms
};

/** Get guild settings, returning defaults if none are stored. */
function getSettings(guildId) {
  return stmtGetSettings.get(guildId) || { guild_id: guildId, ...DEFAULTS };
}

/** Save guild settings. */
function saveSettings(guildId, settings) {
  const merged = { ...DEFAULTS, ...getSettings(guildId), ...settings };
  stmtUpsertSettings.run(
    guildId,
    merged.ai_moderation,
    merged.automod_channel,
    merged.timeout_duration
  );
}

module.exports = {
  addJoiner,
  isUnverified,
  markVerified,
  setVerified,
  getUser,
  listUsers,
  countUsers,
  deleteUser,
  getSettings,
  saveSettings,
};
