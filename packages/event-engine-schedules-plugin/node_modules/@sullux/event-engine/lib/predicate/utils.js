const globToRegex = (pattern) => {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  const regexStr = '^' + escaped.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
  return new RegExp(regexStr, 'i')
}

const globToSqlLike = (pattern) => {
  return pattern.replace(/\*/g, '%').replace(/\?/g, '_')
}

const envelopeProps = [
  'type',
  'version',
  'partitionKey',
  'deduplicationId',
  'id',
  'timestamp',
  'status',
  'payload',
]

const pathToPropertyAccess = (pathStr) => {
  const cleanPath = pathStr.startsWith('.') ? pathStr.slice(1) : pathStr
  const parts = cleanPath.split('.')
  return parts.length === 1 && envelopeProps.includes(parts[0])
    ? `e.${parts[0]}`
    : `e.${parts.join('?.')}`
}

const columnMap = {
  '.type': 'type',
  '.version': 'version',
  '.partitionKey': 'partition_key',
  '.deduplicationId': 'deduplication_id',
  '.id': 'id',
  '.timestamp': 'timestamp',
  '.status': 'status',
}

const pathToSqlColumn = (pathStr) => {
  if (columnMap[pathStr]) return columnMap[pathStr]
  const cleanPath = pathStr.startsWith('.') ? pathStr.slice(1) : pathStr
  if (cleanPath.startsWith('payload.')) {
    const jsonPath = '$.' + cleanPath.slice(8)
    return `json_extract(payload, '${jsonPath}')`
  }
  return `json_extract(payload, '$.${cleanPath}')`
}

module.exports = {
  globToRegex,
  globToSqlLike,
  pathToPropertyAccess,
  pathToSqlColumn,
  envelopeProps,
}
