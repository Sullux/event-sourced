const { DatabaseSync } = require('node:sqlite')

const SqliteDb = (config = {}) => {
  const dbPath = config.dbPath || ':memory:'
  const db = new DatabaseSync(dbPath)

  // Enable WAL mode for high concurrency
  db.exec('PRAGMA journal_mode = WAL;')

  // Initialize core system tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      partition_key TEXT,
      deduplication_id TEXT UNIQUE,
      type TEXT NOT NULL,
      version TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT DEFAULT 'committed'
    );

    CREATE TABLE IF NOT EXISTS replay_states (
      id TEXT PRIMARY KEY,
      last_processed_id TEXT NOT NULL,
      context TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS _side_effects (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      event_version TEXT NOT NULL,
      effect_name TEXT NOT NULL,
      status TEXT NOT NULL,
      attempts INTEGER DEFAULT 0,
      last_error TEXT,
      created_at TEXT NOT NULL,
      completed_at TEXT
    );
  `)

  try {
    db.exec("ALTER TABLE events ADD COLUMN status TEXT DEFAULT 'committed';")
  } catch (_) {}

  const insertEventStmt = db.prepare(`
    INSERT INTO events (id, partition_key, deduplication_id, type, version, timestamp, payload)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  const getEventByDeduplicationIdStmt = db.prepare(`
    SELECT id, partition_key, deduplication_id, type, version, timestamp, payload
    FROM events
    WHERE deduplication_id = ?
  `)

  const getEventsFromStmt = db.prepare(`
    SELECT id, partition_key, deduplication_id, type, version, timestamp, payload
    FROM events
    WHERE id >= ?
    ORDER BY id ASC
  `)

  const getEventsSinceStmt = db.prepare(`
    SELECT id, partition_key, deduplication_id, type, version, timestamp, payload
    FROM events
    WHERE id > ?
    ORDER BY id ASC
    LIMIT ?
  `)

  const saveReplayStateStmt = db.prepare(`
    INSERT INTO replay_states (id, last_processed_id, context)
    VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET last_processed_id = excluded.last_processed_id, context = excluded.context
  `)

  const getReplayStateStmt = db.prepare(`
    SELECT last_processed_id, context FROM replay_states WHERE id = ?
  `)

  const deleteReplayStateStmt = db.prepare(`
    DELETE FROM replay_states WHERE id = ?
  `)

  const insertSideEffectStmt = db.prepare(`
    INSERT INTO _side_effects (id, event_id, event_type, event_version, effect_name, status, attempts, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const getPendingSideEffectsStmt = db.prepare(`
    SELECT id, event_id, event_type, event_version, effect_name, status, attempts, last_error, created_at
    FROM _side_effects
    WHERE status = 'pending'
    ORDER BY event_id ASC
    LIMIT ?
  `)

  const markSideEffectCompletedStmt = db.prepare(`
    UPDATE _side_effects SET status = 'completed', completed_at = ? WHERE id = ?
  `)

  const markSideEffectFailedStmt = db.prepare(`
    UPDATE _side_effects SET status = 'failed', attempts = attempts + 1, last_error = ? WHERE id = ?
  `)

  const saveEvent = async (event) => {
    try {
      insertEventStmt.run(
        event.id,
        event.partitionKey || '',
        event.deduplicationId || event.id,
        event.type,
        event.version,
        event.timestamp,
        JSON.stringify(event.payload)
      )
    } catch (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return
      }
      throw err
    }
  }

  const parseTimestamp = (val) => {
    const num = Number(val)
    return Number.isFinite(num) ? num : val
  }

  const getEventByDeduplicationId = async (deduplicationId) => {
    if (!deduplicationId) return null
    const row = getEventByDeduplicationIdStmt.get(deduplicationId)
    if (!row) return null
    return {
      id: row.id,
      partitionKey: row.partition_key,
      deduplicationId: row.deduplication_id,
      type: row.type,
      version: row.version,
      timestamp: parseTimestamp(row.timestamp),
      payload: JSON.parse(row.payload),
    }
  }

  const getEventsFrom = async (id) => {
    const rows = getEventsFromStmt.all(id)
    return rows.map(r => ({
      id: r.id,
      partitionKey: r.partition_key,
      deduplicationId: r.deduplication_id,
      type: r.type,
      version: r.version,
      timestamp: parseTimestamp(r.timestamp),
      payload: JSON.parse(r.payload),
    }))
  }

  const getEventsSince = async (id, limit = 100) => {
    const rows = getEventsSinceStmt.all(id, limit)
    return rows.map(r => ({
      id: r.id,
      partitionKey: r.partition_key,
      deduplicationId: r.deduplication_id,
      type: r.type,
      version: r.version,
      timestamp: parseTimestamp(r.timestamp),
      payload: JSON.parse(r.payload),
    }))
  }

  const runTransaction = async (fn) => {
    db.exec('BEGIN IMMEDIATE')
    try {
      const result = await fn()
      db.exec('COMMIT')
      return result
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
  }

  const saveReplayState = async ({ id, lastProcessedId, context }) => {
    saveReplayStateStmt.run(id, lastProcessedId, JSON.stringify(context || {}))
  }

  const getReplayState = async (id) => {
    const row = getReplayStateStmt.get(id)
    if (!row) return null
    return {
      lastProcessedId: row.last_processed_id,
      context: JSON.parse(row.context),
    }
  }

  const deleteReplayState = async (id) => {
    deleteReplayStateStmt.run(id)
  }

  const saveSideEffectOutbox = async (records = []) => {
    for (const rec of records) {
      insertSideEffectStmt.run(
        rec.id,
        rec.eventId,
        rec.eventType || '',
        rec.eventVersion || '',
        rec.effectName,
        rec.status || 'pending',
        rec.attempts || 0,
        rec.createdAt || new Date().toISOString()
      )
    }
  }

  const getPendingSideEffects = async (limit = 100) => {
    const rows = getPendingSideEffectsStmt.all(limit)
    return rows.map(r => ({
      id: r.id,
      eventId: r.event_id,
      eventType: r.event_type,
      eventVersion: r.event_version,
      effectName: r.effect_name,
      status: r.status,
      attempts: r.attempts,
      lastError: r.last_error,
      createdAt: r.created_at,
    }))
  }

  const markSideEffectCompleted = async (id) => {
    markSideEffectCompletedStmt.run(new Date().toISOString(), id)
  }

  const markSideEffectFailed = async (id, error) => {
    const errStr = typeof error === 'string' ? error : (error?.message || String(error))
    markSideEffectFailedStmt.run(errStr, id)
  }

  const markEventCommitted = async (id) => {
    db.prepare(`UPDATE events SET status = 'committed' WHERE id = ?`).run(id)
  }

  const deleteDraftEvent = async (id) => {
    db.prepare(`DELETE FROM events WHERE id = ?`).run(id)
    db.prepare(`DELETE FROM _side_effects WHERE event_id = ?`).run(id)
  }

  const cleanOrphanedDraftEvents = async () => {
    try {
      const drafts = db.prepare(`SELECT id FROM events WHERE status = 'draft'`).all()
      for (const d of drafts) {
        db.prepare(`DELETE FROM events WHERE id = ?`).run(d.id)
        db.prepare(`DELETE FROM _side_effects WHERE event_id = ?`).run(d.id)
      }
    } catch (_) {}
  }

  return {
    saveEvent,
    getEventByDeduplicationId,
    getEventsFrom,
    getEventsSince,
    runTransaction,
    saveReplayState,
    getReplayState,
    deleteReplayState,
    saveSideEffectOutbox,
    getPendingSideEffects,
    markSideEffectCompleted,
    markSideEffectFailed,
    markEventCommitted,
    deleteDraftEvent,
    cleanOrphanedDraftEvents,
    close: () => db.close(),
    _getDb: () => db,
  }
}

module.exports = { SqliteDb }
