const createReplay = ({ db, runProjections, runSideEffectsDirect, onReplayContinue }) => {
  return async (options = {}) => {
    const {
      replayId = 'default',
      runSideEffects = options.runSideEffects !== undefined ? options.runSideEffects : true,
    } = options

    let fromId = options.fromId
    let activeProjections = options.projections
    let activeEffects = options.effects
    let activeContext = options.context || {}

    if (!fromId && db.getReplayState) {
      const state = await db.getReplayState(replayId)
      if (state) {
        fromId = state.lastProcessedId
        activeContext = Object.assign({}, state.context, options.context)
        if (onReplayContinue && typeof onReplayContinue === 'function') {
          const continuation = await onReplayContinue({ fromId, context: activeContext, replayId })
          if (continuation) {
            if (continuation.projections) activeProjections = continuation.projections
            if (continuation.effects) activeEffects = continuation.effects
          }
        }
      }
    }

    let lastProcessedId = fromId || ''
    const limit = options.limit || 100
    let hasMore = true

    while (hasMore) {
      const events = await db.getEventsSince(lastProcessedId, limit)
      if (events.length === 0) break

      for (const evt of events) {
        const runContext = { ...activeContext, isReplay: true, isRealtime: false }
        await runProjections(evt, activeProjections, runContext)

        if (runSideEffects) {
          await runSideEffectsDirect(evt, activeEffects, runContext)
        }

        lastProcessedId = evt.id
      }

      if (db.saveReplayState) {
        await db.saveReplayState({
          id: replayId,
          lastProcessedId,
          context: activeContext,
        })
      }

      if (events.length < limit) {
        hasMore = false
      }
    }

    if (db.deleteReplayState) {
      await db.deleteReplayState(replayId)
    }

    return { lastProcessedId }
  }
}

module.exports = { createReplay }
