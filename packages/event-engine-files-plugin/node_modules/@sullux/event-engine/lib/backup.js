const createBackupManager = ({ driver, debounceMs = 5000 } = {}) => {
  if (!driver) return null

  let pendingCursor = null
  let debounceTimer = null

  const streamEvent = async (event) => {
    try {
      if (typeof driver.appendEvent === 'function') {
        await driver.appendEvent(event)
      } else if (typeof driver.saveEvent === 'function') {
        await driver.saveEvent(event)
      } else if (typeof driver.writeFile === 'function') {
        const line = JSON.stringify(event) + '\n'
        await driver.writeFile(`events/${event.id}.json`, line)
      }
    } catch (err) {
      // Backup stream errors do not abort local database writes
      console.error('[EventEngine Backup Error]', err)
    }
  }

  const flushSideEffectCursor = async () => {
    if (!pendingCursor) return
    const cursor = pendingCursor
    pendingCursor = null

    try {
      const payload = JSON.stringify({
        lastCompletedSideEffectEventId: cursor,
        timestamp: new Date().toISOString(),
      })
      if (typeof driver.saveCheckpoint === 'function') {
        await driver.saveCheckpoint('side_effects_cursor', payload)
      } else if (typeof driver.writeFile === 'function') {
        await driver.writeFile('checkpoints/side_effects_cursor.json', payload)
      }
    } catch (err) {
      console.error('[EventEngine Backup Checkpoint Error]', err)
    }
  }

  const updateSideEffectCursor = (eventId) => {
    pendingCursor = eventId
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      debounceTimer = null
      flushSideEffectCursor()
    }, debounceMs)
  }

  const close = async () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    await flushSideEffectCursor()
  }

  return {
    streamEvent,
    updateSideEffectCursor,
    flushSideEffectCursor,
    close,
  }
}

module.exports = { createBackupManager }
