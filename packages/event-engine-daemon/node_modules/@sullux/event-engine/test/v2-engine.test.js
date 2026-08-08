const test = require('node:test')
const assert = require('node:assert')
const { EventsEngine } = require('../index')
const { SqliteDb } = require('../drivers/db/sqlite')
const { MemoryDb } = require('../drivers/db/memory')
const { ulidFactory } = require('../lib/ulid')
const { upcastEvent } = require('../lib/upcast')

test('ULID Generator - monotonic chronological ordering and clock-drift protection', () => {
  let simulatedTime = 1000
  const nowFn = () => simulatedTime
  const ulid = ulidFactory(nowFn)

  const id1 = ulid()
  const id2 = ulid()

  // Strict monotonicity within same millisecond
  assert.ok(id2 > id1, `Expected ${id2} > ${id1}`)

  // Negative time drift simulation
  simulatedTime = 500
  const id3 = ulid()
  assert.ok(id3 > id2, `Expected ${id3} > ${id2}`)
})

test('Upcasting Engine - transforms 1.0.0 -> 1.0.1 -> 1.0.2 iteratively', () => {
  const definitions = {
    'widget.created@1.0.0': {
      type: 'widget.created',
      version: '1.0.0',
      upcast: (payload) => ({ ...payload, status: 'active' }),
      targetVersion: '1.0.1',
    },
    'widget.created@1.0.1': {
      type: 'widget.created',
      version: '1.0.1',
      upcast: (payload) => ({ ...payload, category: 'general' }),
      targetVersion: '1.0.2',
    },
    'widget.created@1.0.2': {
      type: 'widget.created',
      version: '1.0.2',
    },
  }

  const rawEvent = {
    type: 'widget.created',
    version: '1.0.0',
    payload: { id: 'w1', name: 'Gadget' },
  }

  const upcasted = upcastEvent(rawEvent, definitions)

  assert.strictEqual(upcasted.type, 'widget.created')
  assert.strictEqual(upcasted.version, '1.0.2')
  assert.deepStrictEqual(upcasted.payload, {
    id: 'w1',
    name: 'Gadget',
    status: 'active',
    category: 'general',
  })
})

test('EventsEngine - Definition validation, outbox side-effects, and SQLite persistence', async () => {
  const db = SqliteDb({ dbPath: ':memory:' })
  const projectionsLog = []
  const sideEffectsLog = []

  const engine = EventsEngine({
    db,
    eventDefinitions: {
      'user.registered@1.0.0': {
        type: 'user.registered',
        version: '1.0.0',
        validate: (payload) => {
          if (!payload.email) throw new Error('Email is required')
        },
        deduplicationId: (payload) => `email:${payload.email}`,
        partitionKey: (payload) => `user#${payload.email}`,
        projections: async (event) => {
          projectionsLog.push(event)
        },
        effects: [
          {
            name: 'sendConfirmationEmail',
            run: async (event) => {
              sideEffectsLog.push(event.id)
            },
          },
        ],
      },
    },
  })

  // 1. Invalid payload rejection
  await assert.rejects(
    async () => {
      await engine.ingress({
        type: 'user.registered',
        version: '1.0.0',
        payload: { name: 'Alice' }, // Missing email!
      })
    },
    /Email is required/
  )

  // 2. Valid payload ingress
  const receipt1 = await engine.ingress({
    type: 'user.registered',
    version: '1.0.0',
    payload: { email: 'alice@example.com', name: 'Alice' },
  })

  assert.strictEqual(receipt1.status, 'processed')
  assert.strictEqual(receipt1.deduplicationId, 'email:alice@example.com')
  assert.strictEqual(receipt1.partitionKey, 'user#alice@example.com')
  assert.ok(receipt1.id)

  // Verify projections and side effects executed
  assert.strictEqual(projectionsLog.length, 1)
  assert.strictEqual(sideEffectsLog.length, 1)

  // 3. Duplicate ingress returns idempotent receipt
  const receipt2 = await engine.ingress({
    type: 'user.registered',
    version: '1.0.0',
    payload: { email: 'alice@example.com', name: 'Alice Duplicate' },
  })

  assert.strictEqual(receipt2.status, 'duplicate')
  assert.strictEqual(receipt2.id, receipt1.id)
  assert.strictEqual(projectionsLog.length, 1) // No duplicate projection call
  assert.strictEqual(sideEffectsLog.length, 1) // No duplicate side-effect call

  db.close()
})

test('EventsEngine - Backup stream and debounced side-effect cursor checkpointing', async () => {
  const db = MemoryDb()
  const backedUpEvents = []
  const backupCheckpoints = []

  const mockBackupDriver = {
    appendEvent: async (event) => {
      backedUpEvents.push(event)
    },
    saveCheckpoint: async (key, payload) => {
      backupCheckpoints.push({ key, payload: JSON.parse(payload) })
    },
  }

  const engine = EventsEngine({
    db,
    backup: mockBackupDriver,
    backupDebounceMs: 20, // Short debounce for testing
    effects: {
      'order.placed': async () => {},
    },
  })

  await engine.ingress({
    type: 'order.placed',
    version: '1.0.0',
    payload: { orderId: 'ord-100' },
  })

  assert.strictEqual(backedUpEvents.length, 1)
  assert.strictEqual(backedUpEvents[0].type, 'order.placed')

  // Wait for debounced backup checkpoint flush
  await new Promise((resolve) => setTimeout(resolve, 50))

  assert.strictEqual(backupCheckpoints.length, 1)
  assert.strictEqual(backupCheckpoints[0].key, 'side_effects_cursor')
  assert.strictEqual(backupCheckpoints[0].payload.lastCompletedSideEffectEventId, backedUpEvents[0].id)
})
