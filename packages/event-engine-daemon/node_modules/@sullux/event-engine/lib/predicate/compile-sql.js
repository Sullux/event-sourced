const { globToSqlLike, pathToSqlColumn } = require('./utils')
const { normalizePredicateSchema } = require('./compile-js')

const compileSql = (schema) => {
  const norm = normalizePredicateSchema(schema)
  if (!norm || typeof norm !== 'object') {
    return { sql: '1=1', params: [] }
  }

  const clauses = []
  const params = []

  if (Array.isArray(norm)) {
    for (const p of norm) {
      const res = compileSql(p)
      clauses.push(`(${res.sql})`)
      params.push(...res.params)
    }
    return { sql: clauses.length ? clauses.join(' AND ') : '1=1', params }
  }

  if ('some' in norm && Array.isArray(norm.some)) {
    const subClauses = []
    for (const p of norm.some) {
      const res = compileSql(p)
      subClauses.push(`(${res.sql})`)
      params.push(...res.params)
    }
    return { sql: subClauses.length ? subClauses.join(' OR ') : '1=1', params }
  }

  if ('every' in norm && Array.isArray(norm.every)) {
    const subClauses = []
    for (const p of norm.every) {
      const res = compileSql(p)
      subClauses.push(`(${res.sql})`)
      params.push(...res.params)
    }
    return { sql: subClauses.length ? subClauses.join(' AND ') : '1=1', params }
  }

  if ('not' in norm) {
    const res = compileSql(norm.not)
    return { sql: `NOT (${res.sql})`, params: res.params }
  }

  const isSomeMode = norm.some === true
  const keys = Object.keys(norm).filter(k => k !== 'some' && k !== 'every')

  for (const key of keys) {
    if (!key.startsWith('.')) continue
    const col = pathToSqlColumn(key)
    const val = norm[key]

    if (val === null || typeof val !== 'object' || Array.isArray(val)) {
      if (Array.isArray(val)) {
        const placeholders = val.map(() => '?').join(', ')
        clauses.push(`${col} IN (${placeholders})`)
        params.push(...val)
      } else {
        clauses.push(`${col} = ?`)
        params.push(val)
      }
    } else {
      for (const op of Object.keys(val)) {
        const target = val[op]
        const resolvedColTarget = typeof target === 'string' && target.startsWith('.')
          ? pathToSqlColumn(target)
          : null

        if (op === 'is') {
          if (resolvedColTarget) clauses.push(`${col} = ${resolvedColTarget}`)
          else { clauses.push(`${col} = ?`); params.push(target) }
        } else if (op === 'match') {
          clauses.push(`${col} LIKE ?`)
          params.push(globToSqlLike(target))
        } else if (op === 'gt') {
          if (resolvedColTarget) clauses.push(`${col} > ${resolvedColTarget}`)
          else { clauses.push(`${col} > ?`); params.push(target) }
        } else if (op === 'gte') {
          if (resolvedColTarget) clauses.push(`${col} >= ${resolvedColTarget}`)
          else { clauses.push(`${col} >= ?`); params.push(target) }
        } else if (op === 'lt') {
          if (resolvedColTarget) clauses.push(`${col} < ${resolvedColTarget}`)
          else { clauses.push(`${col} < ?`); params.push(target) }
        } else if (op === 'lte') {
          if (resolvedColTarget) clauses.push(`${col} <= ${resolvedColTarget}`)
          else { clauses.push(`${col} <= ?`); params.push(target) }
        } else if (op === 'in') {
          const placeholders = target.map(() => '?').join(', ')
          clauses.push(`${col} IN (${placeholders})`)
          params.push(...target)
        } else if (op === 'not') {
          clauses.push(`${col} != ?`)
          params.push(target)
        }
      }
    }
  }

  const joiner = isSomeMode ? ' OR ' : ' AND '
  return {
    sql: clauses.length ? clauses.join(joiner) : '1=1',
    params,
  }
}

module.exports = {
  compileSql,
}
