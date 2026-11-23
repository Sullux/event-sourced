const { ulidFactory } = require('./lib/ulid')
const { createDefinitionsRegistry } = require('./lib/definitions')
const { createBackupManager } = require('./lib/backup')
const { runProjections } = require('./lib/projections')
const { runSideEffectsDirect, createSideEffectProcessor } = require('./lib/side-effects')
const { createSubscriptionsManager } = require('./lib/subscriptions')
const { createIngress } = require('./lib/ingress')
const { createReplay } = require('./lib/replay')

const EventsEngine = (options = {}) => {
  const {
    eventDefinitions = {},
    projections = {},
    effects = {},
    db,
    filesystem,
    backup,
    backupDebounceMs = 5000,
    asyncSideEffects = false,
    onReplayContinue,
    nowFn = Date.now,
    randomFn,
  } = options

  const generateUlid = ulidFactory(nowFn, randomFn)
  const registry = createDefinitionsRegistry(eventDefinitions)
  if (Array.isArray(options.plugins)) {
    options.plugins.forEach(plugin => {
      const defs = plugin.definitions || (Array.isArray(plugin) ? plugin : [])
      defs.forEach(def => registry.registerDefinition(def))
    })
  }
  const backupMgr = createBackupManager({ driver: backup, debounceMs: backupDebounceMs })

  const bootCleanupPromise =
    db && typeof db.cleanOrphanedDraftEvents === 'function'
      ? db.cleanOrphanedDraftEvents().catch(err => console.error('[EventEngine Boot Cleanup Error]', err))
      : Promise.resolve()

  const { subscriptions, subscribe, unsubscribe, subscribeActive } = createSubscriptionsManager({ generateUlid, db })

  const runProj = (evt, activeProj, ctx) => runProjections(evt, activeProj, { registry, projections, db, filesystem, context: ctx })
  const runSideEffDirect = (evt, activeEff, ctx) => runSideEffectsDirect(evt, activeEff, { registry, effects, filesystem, context: ctx })

  const { processSideEffects, scheduleSideEffects, stopScheduling } = createSideEffectProcessor({ db, registry, effects, subscriptions, filesystem, backupMgr })

  const rawIngress = createIngress({
    registry,
    generateUlid,
    nowFn,
    db,
    filesystem,
    backupMgr,
    subscriptions,
    effects,
    asyncSideEffects,
    runProjections: runProj,
    runSideEffectsDirect: runSideEffDirect,
    processSideEffects,
    scheduleSideEffects,
  })

  const inFlightIngress = new Set()
  let isClosing = false
  let isClosed = false
  let closePromise

  const ingress = (input) => {
    if (isClosing) {
      return Promise.reject(new Error('EventEngine is closed'))
    }
    const promise = rawIngress(input)
    inFlightIngress.add(promise)
    return promise.finally(() => {
      inFlightIngress.delete(promise)
    })
  }

  const safeProcessSideEffects = () => (isClosed ? Promise.resolve() : processSideEffects())

  const flush = () => {
    if (closePromise) return closePromise
    if (isClosed) return Promise.resolve()
    return processSideEffects()
  }

  const close = () => {
    if (closePromise) return closePromise
    isClosing = true
    stopScheduling()
    closePromise = (async () => {
      await Promise.allSettled([bootCleanupPromise, ...inFlightIngress])
      await processSideEffects()
      isClosed = true
      if (backupMgr) {
        await backupMgr.close()
      }
      if (db && typeof db.close === 'function') {
        await db.close()
      }
    })()
    return closePromise
  }

  const replay = createReplay({
    db,
    runProjections: runProj,
    runSideEffectsDirect: runSideEffDirect,
    onReplayContinue,
  })

  const query = async ({ predicate, cursor = '', limit }) => {
    const results = []
    let count = 0
    await subscribeActive({
      predicate,
      cursor,
      replayOnly: true,
      onEvent: async (evt) => {
        if (!limit || count < limit) {
          results.push(evt)
          count++
        }
      },
    })
    return results
  }

  return {
    ingress,
    replay,
    query,
    registerDefinition: (def) => registry.registerDefinition(def),
    processSideEffects: safeProcessSideEffects,
    flush,
    close,
    subscribe,
    unsubscribe,
    subscribeActive,
    _getRegistry: () => registry,
  }
}

module.exports = { EventsEngine, ulidFactory }
