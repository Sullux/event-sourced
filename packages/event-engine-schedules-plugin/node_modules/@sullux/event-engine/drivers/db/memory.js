const MemoryDb = () => {
  let events = []
  let sideEffects = []
  const replayStates = {}

  const saveEvent = async (event) => {
    if (!events.some(e => e.id === event.id)) {
      events.push({ ...event, status: event.status || 'committed' })
      events.sort((a, b) => a.id.localeCompare(b.id))
    }
  }

  const getEventByDeduplicationId = async (deduplicationId) => {
    if (!deduplicationId) return null
    return events.find(e => e.deduplicationId === deduplicationId && e.status !== 'draft') || null
  }

  const getEventsFrom = async (id) => {
    return events.filter(e => e.id >= id && e.status !== 'draft')
  }

  const getEventsSince = async (id, limit = 100) => {
    const filtered = events.filter(e => e.id > id && e.status !== 'draft')
    return filtered.slice(0, limit)
  }

  const markEventCommitted = async (id) => {
    const evt = events.find(e => e.id === id)
    if (evt) evt.status = 'committed'
  }

  const deleteDraftEvent = async (id) => {
    events = events.filter(e => !(e.id === id && e.status === 'draft'))
    sideEffects = sideEffects.filter(s => !(s.eventId === id && s.status.startsWith('immediate')))
  }

  const cleanOrphanedDraftEvents = async () => {
    const draftIds = new Set(events.filter(e => e.status === 'draft').map(e => e.id))
    events = events.filter(e => e.status !== 'draft')
    sideEffects = sideEffects.filter(s => !draftIds.has(s.eventId))
  }

  const runTransaction = async (fn) => {
    return fn()
  }

  const saveReplayState = async ({ id, lastProcessedId, context }) => {
    replayStates[id] = { lastProcessedId, context }
  }

  const getReplayState = async (id) => {
    return replayStates[id] || null
  }

  const deleteReplayState = async (id) => {
    delete replayStates[id]
  }

  const saveSideEffectOutbox = async (records = []) => {
    for (const rec of records) {
      sideEffects.push({
        id: rec.id,
        eventId: rec.eventId,
        eventType: rec.eventType,
        eventVersion: rec.eventVersion,
        effectName: rec.effectName,
        status: rec.status || 'pending',
        attempts: rec.attempts || 0,
        lastError: rec.lastError || null,
        createdAt: rec.createdAt || new Date().toISOString(),
      })
    }
  }

  const getPendingSideEffects = async (limit = 100) => {
    return sideEffects
      .filter(s => s.status === 'pending')
      .sort((a, b) => a.eventId.localeCompare(b.eventId))
      .slice(0, limit)
  }

  const markSideEffectCompleted = async (id) => {
    const target = sideEffects.find(s => s.id === id)
    if (target) {
      target.status = 'completed'
      target.completedAt = new Date().toISOString()
    }
  }

  const markSideEffectFailed = async (id, error) => {
    const target = sideEffects.find(s => s.id === id)
    if (target) {
      target.status = 'failed'
      target.attempts = (target.attempts || 0) + 1
      target.lastError = typeof error === 'string' ? error : (error?.message || String(error))
    }
  }

  return {
    saveEvent,
    getEventByDeduplicationId,
    getEventsFrom,
    getEventsSince,
    runTransaction,
    saveReplayState,
    getReplayState,
    deleteReplayState,
    saveSideEffectOutbox,
    getPendingSideEffects,
    markSideEffectCompleted,
    markSideEffectFailed,
    markEventCommitted,
    deleteDraftEvent,
    cleanOrphanedDraftEvents,
    close: async () => {},
    _getRawEvents: () => events,
    _getRawSideEffects: () => sideEffects,
  }
}

module.exports = { MemoryDb }
