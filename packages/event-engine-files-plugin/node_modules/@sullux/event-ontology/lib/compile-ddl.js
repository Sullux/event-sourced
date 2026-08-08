const compileDdlSql = (ontology) => {
  const tables = new Map()

  for (const item of ontology.resolvedMap.values()) {
    const dbSchema = item.resolved.$dbSchema
    if (!dbSchema || typeof dbSchema !== 'object') continue

    for (const [entityName, tableDef] of Object.entries(dbSchema)) {
      const tableName = tableDef.tableName || entityName
      const columns = tableDef.columns || tableDef

      const colDefs = []
      for (const [colName, colMeta] of Object.entries(columns)) {
        if (typeof colMeta === 'string') {
          colDefs.push(`  ${colName} ${colMeta}`)
        } else if (colMeta && typeof colMeta === 'object') {
          const name = colMeta.name || colName
          const dbtype = colMeta.dbtype || 'TEXT'
          colDefs.push(`  ${name} ${dbtype}`)
        }
      }

      if (colDefs.length > 0) {
        tables.set(tableName, `CREATE TABLE IF NOT EXISTS ${tableName} (\n${colDefs.join(',\n')}\n);`)
      }
    }
  }

  const sqlStatements = Array.from(tables.values())
  return sqlStatements.join('\n\n')
}

const compileDdlJs = (ontology) => {
  const sql = compileDdlSql(ontology)

  return `// Auto-generated DB DDL by @sullux/event-ontology. DO NOT EDIT DIRECTLY.
const ddlSql = ${JSON.stringify(sql)}

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
`
}

module.exports = {
  compileDdlSql,
  compileDdlJs,
}
