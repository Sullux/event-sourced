const { Predicate } = require('./predicate')

const createSubscriptionsManager = ({ generateUlid, db }) => {
  const subscriptions = new Map()

  const subscribe = ({ id, predicate, handler, immediate = false }) => {
    const subId = id || generateUlid()
    const compiledPred = Predicate(predicate)
    subscriptions.set(subId, {
      id: subId,
      predicate: compiledPred,
      handler,
      immediate,
      activeStream: null,
    })
    return subId
  }

  const unsubscribe = (id) => {
    subscriptions.delete(id)
  }

  const subscribeActive = async ({ id, predicate, cursor = '', replayOnly = false, onEvent, onComplete }) => {
    const subId = id || generateUlid()
    const compiledPred = Predicate(predicate)
    let lastProcessedId = cursor

    if (!lastProcessedId && db.getReplayState) {
      const state = await db.getReplayState(`sub_${subId}`)
      if (state) lastProcessedId = state.lastProcessedId
    }

    let isCompleted = false

    // Phase 1: Unregistered Historical Replay
    if (db.getEventsSince) {
      let currentCursor = lastProcessedId
      while (!isCompleted) {
        const batch = await db.getEventsSince(currentCursor, 1000)
        if (!batch || batch.length === 0) break

        for (const evt of batch) {
          if (evt.id <= currentCursor) continue
          currentCursor = evt.id

          if (compiledPred.testJs(evt)) {
            await onEvent(evt)
            lastProcessedId = currentCursor
            if (db.saveReplayState) {
              await db.saveReplayState({ id: `sub_${subId}`, lastProcessedId, context: {} })
            }
          }

          if (compiledPred.hasUpperBoundExceeded(evt)) {
            isCompleted = true
            break
          }
        }

        if (batch.length < 1000) break
      }
    }

    if (replayOnly || isCompleted) {
      if (typeof onComplete === 'function') {
        try { await onComplete({ subId, lastProcessedId }) } catch (_) {}
      }
      return { subId, lastProcessedId, unsubscribe: () => {} }
    }

    // Phase 2: Register subscription & Buffer Live Stream
    const catchUpQueue = []
    let isCatchingUp = true

    const processLiveEvent = async (evt) => {
      if (!evt || evt.id <= lastProcessedId) return

      if (compiledPred.testJs(evt)) {
        await onEvent(evt)
        lastProcessedId = evt.id
        if (db.saveReplayState) {
          await db.saveReplayState({ id: `sub_${subId}`, lastProcessedId, context: {} })
        }
      } else {
        lastProcessedId = evt.id
      }

      if (compiledPred.hasUpperBoundExceeded(evt)) {
        unsubscribe(subId)
        if (typeof onComplete === 'function') {
          try { await onComplete({ subId, lastProcessedId }) } catch (_) {}
        }
      }
    }

    const subObj = {
      id: subId,
      predicate: compiledPred,
      handler: null,
      immediate: false,
      activeStream: async (evt) => {
        if (isCatchingUp) {
          catchUpQueue.push(evt)
          return
        }
        await processLiveEvent(evt)
      },
    }

    subscriptions.set(subId, subObj)

    // Phase 2b: Tail Gap Query from DB
    if (db.getEventsSince) {
      const tailBatch = await db.getEventsSince(lastProcessedId, 1000)
      if (tailBatch && tailBatch.length > 0) {
        for (const evt of tailBatch) {
          if (evt.id <= lastProcessedId) continue
          await processLiveEvent(evt)
        }
      }
    }

    // Phase 2c: Drain Catch-Up Queue
    while (catchUpQueue.length > 0) {
      const evt = catchUpQueue.shift()
      await processLiveEvent(evt)
    }

    // Phase 3: Transition to Direct Live Streaming
    isCatchingUp = false

    return {
      subId,
      lastProcessedId,
      unsubscribe: () => unsubscribe(subId),
    }
  }

  return {
    subscriptions,
    subscribe,
    unsubscribe,
    subscribeActive,
  }
}

module.exports = { createSubscriptionsManager }
