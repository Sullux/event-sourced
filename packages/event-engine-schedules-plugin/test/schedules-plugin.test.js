const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const schedulesPlugin = require('../index')
const { EventsEngine } = require('@sullux/event-engine')
const { MemoryDb } = require('@sullux/event-engine/db/memory')
const { MemoryFs } = require('@sullux/event-engine/fs/memory')

describe('Schedules Plugin', () => {
  it('registers schedule definitions and ingresses schedule events', async () => {
    const db = MemoryDb()
    const fs = MemoryFs()

    const engine = EventsEngine({
      db,
      fs,
      plugins: [schedulesPlugin],
    })

    const regRes = await engine.ingress({
      type: 'schedule.registered',
      version: '1.0.0',
      payload: {
        scheduleId: 'sched-123',
        name: 'Daily Backup Clean',
        cron: '0 2 * * *',
        targetEvent: {
          type: 'coms.backup.clean',
          version: '1.0.0',
          payload: { daysToKeep: 30 },
        },
      },
    })

    assert.equal(regRes.status, 'processed')
    assert.equal(regRes.partitionKey, 'schedule#sched-123')

    const triggerRes = await engine.ingress({
      type: 'schedule.triggered',
      version: '1.0.0',
      payload: {
        scheduleId: 'sched-123',
        occurrenceTimestamp: 1720000000000,
        targetEvent: {
          type: 'coms.backup.clean',
          version: '1.0.0',
          payload: { daysToKeep: 30 },
        },
      },
    })

    assert.equal(triggerRes.status, 'processed')
    assert.equal(triggerRes.deduplicationId, 'sched-123#1720000000000')
  })
})
