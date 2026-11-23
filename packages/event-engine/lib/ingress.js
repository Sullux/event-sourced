const { upcastEvent } = require('./upcast')
const { gatherSideEffects } = require('./side-effects')

const createIngress = ({
  registry,
  generateUlid,
  nowFn = Date.now,
  db,
  filesystem,
  backupMgr,
  subscriptions,
  effects,
  asyncSideEffects,
  runProjections,
  runSideEffectsDirect,
  processSideEffects,
  scheduleSideEffects,
}) => {
  return async (input) => {
    if (!input || !input.type) {
      throw new Error('Ingress payload must specify "type"')
    }

    const version = input.version || '1.0.0'
    const upcasted = upcastEvent({ ...input, version }, registry.rawDefinitions())

    await registry.validatePayload(upcasted.type, upcasted.version, upcasted.payload)

    const deduplicationId = upcasted.deduplicationId || registry.getDeduplicationId(upcasted.type, upcasted.version, upcasted.payload)
    const partitionKey = upcasted.partitionKey || registry.getPartitionKey(upcasted.type, upcasted.version, upcasted.payload)

    const def = registry.getDefinition(upcasted.type, upcasted.version)
    const isPersisted = def?.persisted !== false && def?.isEphemeral !== true
    const isReplicated = def?.replicated !== false && def?.isLocal !== true

    if (isPersisted && deduplicationId && db.getEventByDeduplicationId) {
      const existing = await db.getEventByDeduplicationId(deduplicationId)
      if (existing) {
        return {
          id: existing.id,
          partitionKey: existing.partitionKey,
          deduplicationId: existing.deduplicationId,
          timestamp: existing.timestamp,
          status: 'duplicate',
        }
      }
    }

    const eventId = upcasted.id || generateUlid()
    const timestamp = upcasted.timestamp || nowFn()

    const eventEnvelope = {
      id: eventId,
      partitionKey,
      deduplicationId,
      type: upcasted.type,
      version: upcasted.version,
      timestamp,
      payload: upcasted.payload,
      persisted: isPersisted,
      replicated: isReplicated,
    }

    if (isPersisted && upcasted.id && db.getEventsFrom) {
      const existing = await db.getEventsFrom(upcasted.id)
      if (existing.length > 0 && existing[0].id === upcasted.id) {
        return {
          id: existing[0].id,
          partitionKey: existing[0].partitionKey,
          deduplicationId: existing[0].deduplicationId,
          timestamp: existing[0].timestamp,
          status: 'duplicate',
        }
      }
    }

    const { sideEffectRecords, immediateHandlers, activeStreamsToPush } = gatherSideEffects({
      eventEnvelope,
      upcasted,
      def,
      effects,
      subscriptions,
      timestamp,
    })

    if (!isPersisted) {
      const runContext = { isReplay: false, isRealtime: true }
      await runProjections(eventEnvelope, null, runContext)

      for (const handler of immediateHandlers) {
        await handler(eventEnvelope, { filesystem, context: runContext })
      }

      for (const streamFn of activeStreamsToPush) {
        try { await streamFn(eventEnvelope) } catch (_) {}
      }

      await runSideEffectsDirect(eventEnvelope, null, runContext)

      return {
        id: eventEnvelope.id,
        partitionKey: eventEnvelope.partitionKey,
        deduplicationId: eventEnvelope.deduplicationId,
        timestamp: eventEnvelope.timestamp,
        status: 'processed',
        persisted: false,
      }
    }

    const hasImmediate = immediateHandlers.length > 0

    await db.runTransaction(async () => {
      await db.saveEvent({ ...eventEnvelope, status: hasImmediate ? 'draft' : 'committed' })

      if (!hasImmediate) {
        const runContext = { isReplay: false, isRealtime: true }
        await runProjections(eventEnvelope, null, runContext)
      }

      if (sideEffectRecords.length > 0 && db.saveSideEffectOutbox) {
        await db.saveSideEffectOutbox(sideEffectRecords)
      }

      if (db.getEventsFrom) {
        const existingSubsequent = await db.getEventsFrom(eventId)
        if (existingSubsequent.length > 1) {
          const runContext = { isReplay: false, isRealtime: true }
          for (const subsequent of existingSubsequent.slice(1)) {
            if (subsequent.status !== 'draft') {
              await runProjections(subsequent, null, runContext)
            }
          }
        }
      }
    })

    if (hasImmediate) {
      const runContext = { isReplay: false, isRealtime: true }
      try {
        for (const handler of immediateHandlers) {
          await handler(eventEnvelope, { filesystem, context: runContext })
        }
        if (db.markEventCommitted) {
          await db.markEventCommitted(eventId)
        }
        await db.runTransaction(async () => {
          await runProjections(eventEnvelope, null, runContext)
        })
      } catch (err) {
        if (db.deleteDraftEvent) {
          await db.deleteDraftEvent(eventId)
        }
        throw err
      }
    }

    for (const streamFn of activeStreamsToPush) {
      try { await streamFn(eventEnvelope) } catch (_) {}
    }

    if (backupMgr) {
      backupMgr.streamEvent(eventEnvelope)
    }

    const runContext = { isReplay: false, isRealtime: true }
    if (db.saveSideEffectOutbox) {
      if (asyncSideEffects) {
        scheduleSideEffects()
      } else {
        await processSideEffects()
      }
    } else {
      await runSideEffectsDirect(eventEnvelope, null, runContext)
    }

    return {
      id: eventEnvelope.id,
      partitionKey: eventEnvelope.partitionKey,
      deduplicationId: eventEnvelope.deduplicationId,
      timestamp: eventEnvelope.timestamp,
      status: 'processed',
      persisted: true,
    }
  }
}

module.exports = { createIngress }
