const { Predicate } = require('./predicate')

const normalizeProjections = (projectionsInput) => {
  if (!projectionsInput) return []
  if (Array.isArray(projectionsInput)) {
    return projectionsInput.map(p => ({
      predicate: Predicate(p.predicate || null),
      run: p.run || p,
    }))
  }

  const list = []
  for (const [key, val] of Object.entries(projectionsInput)) {
    const isObj = typeof val === 'object' && val !== null && typeof val.run === 'function'
    const predSchema = isObj && val.predicate ? val.predicate : key
    const runFn = isObj ? val.run : val

    list.push({
      predicate: Predicate(predSchema),
      run: runFn,
    })
  }
  return list
}

const runProjections = async (event, activeProjections, { registry, projections, db, filesystem, context }) => {
  const def = registry.getDefinition(event.type, event.version)

  if (def && typeof def.projections === 'function') {
    await def.projections(event, { db, filesystem, context })
  }

  const targetProjections = activeProjections || projections
  const normalized = normalizeProjections(targetProjections)

  for (const proj of normalized) {
    if (proj.predicate.testJs(event)) {
      await proj.run(event, { db, filesystem, context })
    }
  }
}

module.exports = { runProjections, normalizeProjections }
