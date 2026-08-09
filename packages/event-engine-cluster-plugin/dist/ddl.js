// Auto-generated DB DDL by @sullux/event-ontology. DO NOT EDIT DIRECTLY.
const ddlSql = ""

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
