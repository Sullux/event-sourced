// Auto-generated DB DDL by @sullux/event-ontology. DO NOT EDIT DIRECTLY.
const ddlSql = "CREATE TABLE IF NOT EXISTS engine_schedules (\n  schedule_id varchar(32) PRIMARY KEY,\n  name varchar(128),\n  cron varchar(64),\n  at bigint,\n  target_event TEXT NOT NULL,\n  status varchar(16) NOT NULL DEFAULT 'active'\n);"

const applyDdl = async (db) => {
  if (!db || typeof db.query !== 'function') {
    throw new Error('Invalid db driver passed to applyDdl')
  }

  const statements = ddlSql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  for (const stmt of statements) {
    await db.query(stmt)
  }
}

module.exports = {
  ddlSql,
  applyDdl,
}
