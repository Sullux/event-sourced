// Iterative event payload upcaster helper

const parseVersion = (v) => {
  if (typeof v !== 'string') return [0, 0, 0]
  const parts = v.split('.').map((p) => parseInt(p, 10) || 0)
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0]
}

const compareVersions = (v1, v2) => {
  const [a1, b1, c1] = parseVersion(v1)
  const [a2, b2, c2] = parseVersion(v2)
  if (a1 !== a2) return a1 - a2
  if (b1 !== b2) return b1 - b2
  return c1 - c2
}

const upcastEvent = (event, eventDefinitions = {}) => {
  if (!event || !event.type || !event.version) return event

  let currentType = event.type
  let currentVersion = event.version
  let currentPayload = event.payload

  let maxIterations = 100 // Protection against cyclic upcasters
  let currentKey = `${currentType}@${currentVersion}`

  while (maxIterations-- > 0) {
    const def = eventDefinitions[currentKey]
    if (!def || typeof def.upcast !== 'function') {
      break
    }

    const nextPayload = def.upcast(currentPayload)
    const nextVersion = def.targetVersion || def.nextVersion
    if (!nextVersion || nextVersion === currentVersion) {
      break
    }

    currentPayload = nextPayload
    currentVersion = nextVersion
    currentKey = `${currentType}@${currentVersion}`
  }

  return {
    ...event,
    type: currentType,
    version: currentVersion,
    payload: currentPayload,
  }
}

module.exports = {
  upcastEvent,
  compareVersions,
}
