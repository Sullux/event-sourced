const { globToRegex, pathToPropertyAccess } = require('./utils')

const normalizePredicateSchema = (schema) => {
  if (!schema) return null
  if (typeof schema === 'string') {
    return schema.includes('*') || schema.includes('?')
      ? { '.type': { match: schema } }
      : { '.type': schema }
  }
  return flattenPredicate(schema)
}

const flattenPredicate = (obj, prefix = '') => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj

  const result = {}
  for (const [key, val] of Object.entries(obj)) {
    if (key === 'some' || key === 'every' || key === 'not') {
      result[key] = Array.isArray(val)
        ? val.map(v => flattenPredicate(v, prefix))
        : flattenPredicate(val, prefix)
      continue
    }

    const fullKey = prefix
      ? (key.startsWith('.') ? `${prefix}${key}` : `${prefix}.${key}`)
      : key

    if (key.startsWith('.') && val !== null && typeof val === 'object' && !Array.isArray(val)) {
      const keys = Object.keys(val)
      const hasNestedKeys = keys.some(k => k.startsWith('.'))
      if (hasNestedKeys) {
        const flattenedChild = flattenPredicate(val, fullKey)
        Object.assign(result, flattenedChild)
        continue
      }
    }

    result[fullKey] = val
  }
  return result
}

const compileJs = (schema) => {
  const norm = normalizePredicateSchema(schema)
  if (!norm || typeof norm !== 'object') {
    return () => true
  }

  const regexList = []

  const buildExpr = (pred) => {
    if (!pred || typeof pred !== 'object') return 'true'
    if (Array.isArray(pred)) {
      return '(' + pred.map(buildExpr).join(' && ') + ')'
    }

    const exprs = []

    if ('some' in pred && Array.isArray(pred.some)) {
      exprs.push('(' + pred.some.map(buildExpr).join(' || ') + ')')
    }
    if ('every' in pred && Array.isArray(pred.every)) {
      exprs.push('(' + pred.every.map(buildExpr).join(' && ') + ')')
    }
    if ('not' in pred) {
      exprs.push('!(' + buildExpr(pred.not) + ')')
    }

    const isSomeMode = pred.some === true
    const keys = Object.keys(pred).filter(k => k !== 'some' && k !== 'every' && k !== 'not')

    for (const key of keys) {
      if (!key.startsWith('.')) continue
      const propAccess = pathToPropertyAccess(key)
      const val = pred[key]
      exprs.push(buildConditionExpr(propAccess, val, regexList))
    }

    if (exprs.length === 0) return 'true'
    const joiner = isSomeMode ? ' || ' : ' && '
    return '(' + exprs.join(joiner) + ')'
  }

  const exprStr = buildExpr(norm)
  const fnCode = `return ${exprStr};`

  try {
    const rawFn = new Function('e', 'regexList', fnCode)
    return (e) => rawFn(e, regexList)
  } catch (err) {
    throw new Error(`Failed to compile predicate JS expression: ${exprStr} (${err.message})`)
  }
}

const buildConditionExpr = (propAccess, cond, regexList) => {
  if (cond === null || typeof cond !== 'object' || Array.isArray(cond)) {
    if (Array.isArray(cond)) {
      return `${JSON.stringify(cond)}.includes(${propAccess})`
    }
    return `${propAccess} === ${JSON.stringify(cond)}`
  }

  const parts = []
  for (const op of Object.keys(cond)) {
    const target = cond[op]
    const targetPropAccess = typeof target === 'string' && target.startsWith('.')
      ? pathToPropertyAccess(target)
      : null

    if (op === 'is') {
      parts.push(`${propAccess} === ${targetPropAccess || JSON.stringify(target)}`)
    } else if (op === 'match') {
      const idx = regexList.length
      regexList.push(globToRegex(target))
      parts.push(`regexList[${idx}].test(${propAccess} ?? '')`)
    } else if (op === 'gt') {
      parts.push(`${propAccess} > ${targetPropAccess || JSON.stringify(target)}`)
    } else if (op === 'gte') {
      parts.push(`${propAccess} >= ${targetPropAccess || JSON.stringify(target)}`)
    } else if (op === 'lt') {
      parts.push(`${propAccess} < ${targetPropAccess || JSON.stringify(target)}`)
    } else if (op === 'lte') {
      parts.push(`${propAccess} <= ${targetPropAccess || JSON.stringify(target)}`)
    } else if (op === 'in') {
      parts.push(`${JSON.stringify(target)}.includes(${propAccess})`)
    } else if (op === 'not') {
      parts.push(`${propAccess} !== ${JSON.stringify(target)}`)
    }
  }
  return parts.length ? '(' + parts.join(' && ') + ')' : 'true'
}

const compileUpperBound = (schema) => {
  const norm = normalizePredicateSchema(schema)
  if (!norm || typeof norm !== 'object') return () => false

  const checkKeys = ['.id', '.timestamp']
  const bounds = []

  const inspect = (p) => {
    if (!p || typeof p !== 'object') return
    if (Array.isArray(p)) {
      p.forEach(inspect)
      return
    }
    if ('every' in p && Array.isArray(p.every)) {
      p.every.forEach(inspect)
      return
    }

    for (const key of checkKeys) {
      const cond = p[key]
      if (cond && typeof cond === 'object' && !Array.isArray(cond)) {
        const propAccess = pathToPropertyAccess(key)
        if ('lt' in cond) bounds.push(`${propAccess} >= ${JSON.stringify(cond.lt)}`)
        if ('lte' in cond) bounds.push(`${propAccess} > ${JSON.stringify(cond.lte)}`)
      }
    }
  }

  inspect(norm)
  if (bounds.length === 0) return () => false

  const code = `return ${bounds.join(' || ')};`
  const rawFn = new Function('e', code)
  return (e) => rawFn(e)
}

module.exports = {
  normalizePredicateSchema,
  compileJs,
  compileUpperBound,
}
