// Auto-generated DB DDL by @sullux/event-ontology. DO NOT EDIT DIRECTLY.
const ddlSql = "CREATE TABLE IF NOT EXISTS file_blobs (\n  blob_id varchar(64) PRIMARY KEY,\n  size_in_bytes integer NOT NULL,\n  content_type varchar(64),\n  type varchar(16) DEFAULT 'raw'\n);\n\nCREATE TABLE IF NOT EXISTS file_directories (\n  directory_id varchar(32) PRIMARY KEY,\n  path varchar(255) NOT NULL UNIQUE\n);\n\nCREATE TABLE IF NOT EXISTS file_links (\n  link_id varchar(32) PRIMARY KEY,\n  path varchar(255) NOT NULL,\n  blob_id varchar(64),\n  blocks TEXT,\n  patches TEXT\n);"

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
