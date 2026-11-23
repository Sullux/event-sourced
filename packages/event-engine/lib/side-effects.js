const { Predicate } = require('./predicate')

const normalizeEffects = (effectsInput) => {
  if (!effectsInput) return []
  if (Array.isArray(effectsInput)) {
    return effectsInput.map((eff, idx) => ({
      name: eff.name || `effect_${idx}`,
      predicate: Predicate(eff.predicate || null),
      immediate: Boolean(eff.immediate),
      run: eff.run || eff,
    }))
  }

  const list = []
  for (const [key, val] of Object.entries(effectsInput)) {
    if (Array.isArray(val)) {
      val.forEach((eff, idx) => {
        const isObj = typeof eff === 'object' && eff !== null && typeof eff.run === 'function'
        const predSchema = isObj && eff.predicate ? eff.predicate : key
        list.push({
          name: isObj ? (eff.name || `${key}_effect_${idx}`) : `${key}_effect_${idx}`,
          predicate: Predicate(predSchema),
          immediate: Boolean(isObj && eff.immediate),
          run: isObj ? eff.run : eff,
        })
      })
    } else {
      const isObj = typeof val === 'object' && val !== null && typeof val.run === 'function'
      const predSchema = isObj && val.predicate ? val.predicate : key
      list.push({
        name: isObj ? (val.name || `${key}_effect`) : `${key}_effect`,
        predicate: Predicate(predSchema),
        immediate: Boolean(isObj && val.immediate),
        run: isObj ? val.run : val,
      })
    }
  }
  return list
}

const gatherSideEffects = ({ eventEnvelope, upcasted, def, effects, subscriptions, timestamp }) => {
  const sideEffectRecords = []
  const immediateHandlers = []

  const addEffectRecord = (name, isImmediate, runFn) => {
    if (isImmediate && typeof runFn === 'function') {
      immediateHandlers.push(runFn)
    } else {
      sideEffectRecords.push({
        id: `${eventEnvelope.id}:${name}`,
        eventId: eventEnvelope.id,
        eventType: upcasted.type,
        eventVersion: upcasted.version,
        effectName: name,
        status: 'pending',
        createdAt: timestamp,
      })
    }
  }

  if (def && Array.isArray(def.effects)) {
    def.effects.forEach((eff, idx) => {
      const isObj = typeof eff === 'object'
      const name = isObj ? eff.name : `effect_${idx}`
      const isImmediate = isObj && eff.immediate
      const runFn = isObj ? eff.run : eff
      addEffectRecord(name, isImmediate, runFn)
    })
  }

  const normalized = normalizeEffects(effects)
  for (const eff of normalized) {
    if (eff.predicate.testJs(eventEnvelope)) {
      addEffectRecord(eff.name, eff.immediate, eff.run)
    }
  }

  const activeStreamsToPush = []
  for (const [subId, sub] of subscriptions.entries()) {
    if (sub.predicate.testJs(eventEnvelope)) {
      if (typeof sub.activeStream === 'function') {
        activeStreamsToPush.push(sub.activeStream)
      } else if (sub.immediate && typeof sub.handler === 'function') {
        immediateHandlers.push(sub.handler)
      } else if (sub.handler) {
        addEffectRecord(`sub:${subId}`, false, sub.handler)
      }
    }
  }

  return { sideEffectRecords, immediateHandlers, activeStreamsToPush }
}

const runSideEffectsDirect = async (event, activeEffects, { registry, effects, filesystem, context }) => {
  const def = registry.getDefinition(event.type, event.version)

  if (def && Array.isArray(def.effects)) {
    for (const eff of def.effects) {
      const fn = typeof eff === 'object' ? eff.run : eff
      if (typeof fn === 'function') {
        await fn(event, { filesystem, context })
      }
    }
  }

  const targetEffects = activeEffects || effects
  const normalized = normalizeEffects(targetEffects)

  for (const eff of normalized) {
    if (eff.predicate.testJs(event) && typeof eff.run === 'function') {
      await eff.run(event, { filesystem, context })
    }
  }
}

const createSideEffectProcessor = ({ db, registry, effects, subscriptions, filesystem, backupMgr }) => {
  let activeDrain
  let rerunRequested = false
  let scheduledHandle
  let closing = false

  const cancelScheduled = () => {
    if (scheduledHandle !== undefined) {
      clearImmediate(scheduledHandle)
      scheduledHandle = undefined
    }
  }

  const drainLoop = async () => {
    try {
      do {
        rerunRequested = false
        while (true) {
          const pending = await db.getPendingSideEffects(50)
          if (!pending || pending.length === 0) break

          for (const rec of pending) {
            try {
              const def = registry.getDefinition(rec.eventType, rec.eventVersion)

              let effectFn = null
              if (def && Array.isArray(def.effects)) {
                const matched = def.effects.find(e => (typeof e === 'object' ? e.name === rec.effectName : e === rec.effectName))
                if (matched) effectFn = typeof matched === 'object' ? matched.run : matched
              }

              if (!effectFn) {
                const normalized = normalizeEffects(effects)
                const matched = normalized.find(e => e.name === rec.effectName)
                if (matched) effectFn = matched.run
              }

              if (!effectFn && rec.effectName.startsWith('sub:')) {
                const subId = rec.effectName.slice(4)
                const sub = subscriptions.get(subId)
                if (sub && sub.handler) effectFn = sub.handler
              }

              // A row whose handler cannot be resolved must never be retired as succeeded: the work
              // would be lost while the outbox reported success. Reachable without a crash - a renamed
              // handler, an ontology that stops declaring the effect, or a drain ordered before
              // registration. `failed` is the visible outcome (status, attempts, lastError).
              //
              // Leaving it `pending` instead is NOT the fix: getPendingSideEffects selects pending
              // only, and the enclosing loop runs until that comes back empty, so a skipped pending
              // row is returned forever. Retrying needs a visited guard, which is a separate change.
              if (!effectFn) {
                await db.markSideEffectFailed(rec.id, `no handler registered for side effect "${rec.effectName}"`)
                continue
              }

              const runContext = { isReplay: false, isRealtime: true }
              const matchedEvts = db.getEventsFrom ? await db.getEventsFrom(rec.eventId) : []
              const targetEvent = matchedEvts.find(e => e.id === rec.eventId) || {
                id: rec.eventId,
                type: rec.eventType,
                version: rec.eventVersion,
              }
              await effectFn(targetEvent, { filesystem, context: runContext })

              await db.markSideEffectCompleted(rec.id)
              if (backupMgr) {
                backupMgr.updateSideEffectCursor(rec.eventId)
              }
            } catch (err) {
              await db.markSideEffectFailed(rec.id, err.message)
            }
          }
        }
      } while (rerunRequested)
    } finally {
      rerunRequested = false
      activeDrain = undefined
    }
  }

  const processSideEffects = () => {
    cancelScheduled()
    if (!db?.getPendingSideEffects) return Promise.resolve()
    if (activeDrain) {
      rerunRequested = true
      return activeDrain
    }
    activeDrain = drainLoop()
    return activeDrain
  }

  const scheduleSideEffects = () => {
    if (closing || scheduledHandle !== undefined) return
    scheduledHandle = setImmediate(() => {
      scheduledHandle = undefined
      if (closing) return
      processSideEffects().catch(err => console.error('[EventEngine SideEffects Error]', err))
    })
  }

  const stopScheduling = () => {
    closing = true
    cancelScheduled()
  }

  return { processSideEffects, scheduleSideEffects, stopScheduling }
}

module.exports = {
  normalizeEffects,
  gatherSideEffects,
  runSideEffectsDirect,
  createSideEffectProcessor,
}
