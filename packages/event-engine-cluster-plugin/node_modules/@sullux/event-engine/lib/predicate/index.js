const { compileJs, compileUpperBound } = require('./compile-js')
const { compileSql } = require('./compile-sql')

const Predicate = (schema) => {
  const testJs = compileJs(schema)
  const sqlCompiled = compileSql(schema)
  const upperBoundTester = compileUpperBound(schema)

  return {
    testJs,
    testSql: () => sqlCompiled,
    hasUpperBoundExceeded: upperBoundTester,
  }
}

const evaluateJs = (predicate, event) => {
  const p = Predicate(predicate)
  return p.testJs(event)
}

const compileSqlExport = (predicate) => {
  const p = Predicate(predicate)
  return p.testSql()
}

const hasUpperBoundExceededExport = (predicate, event) => {
  const p = Predicate(predicate)
  return p.hasUpperBoundExceeded(event)
}

module.exports = {
  Predicate,
  evaluateJs,
  compileSql: compileSqlExport,
  hasUpperBoundExceeded: hasUpperBoundExceededExport,
}
