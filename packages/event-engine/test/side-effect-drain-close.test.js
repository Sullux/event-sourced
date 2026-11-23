const test = require('node:test')
const assert = require('node:assert')
const { EventsEngine } = require('../index')
const { MemoryDb } = require('../drivers/db/memory')
const { SqliteDb } = require('../drivers/db/sqlite')

const EVENT_DEF = {
  type: 'task.queued',
  version: '1.0.0',
  schema: {
    type: 'object',
    properties: { id: { type: 'string' } },
    additionalProperties: true,
  },
}

const deferred = () => {
  let resolve
  const promise = new Promise((r) => {
    resolve = r
  })
  return { promise, resolve }
}

const wrapDb = (db, log) => {
  let closed = false
  let postCloseCalls = 0
  return {
    db: {
      ...db,
      getPendingSideEffects: async (limit) => {
        if (closed) postCloseCalls++
        return db.getPendingSideEffects(limit)
      },
      close: async () => {
        log.push('db:close')
        closed = true
        return db.close()
      },
    },
    getPostCloseCalls: () => postCloseCalls,
  }
}

const DRIVERS = [
  { name: 'MemoryDb', make: () => MemoryDb() },
  { name: 'SqliteDb', make: () => SqliteDb({ dbPath: ':memory:' }) },
]

for (const driver of DRIVERS) {
  test(`${driver.name}: close() cancels scheduled setImmediate and drains pending side effects before closing DB (#4)`, async () => {
    const log = []
    const { db, getPostCloseCalls } = wrapDb(driver.make(), log)

    const engine = EventsEngine({
      db,
      eventDefinitions: { 'task.queued@1.0.0': EVENT_DEF },
      effects: {
        'task.queued': async (evt) => {
          await new Promise((r) => setTimeout(r, 10))
          log.push(`effect:${evt.payload.id}`)
        },
      },
      asyncSideEffects: true,
    })

    await engine.ingress({
      type: 'task.queued',
      version: '1.0.0',
      payload: { id: 't1' },
    })

    await engine.close()

    // Yield extra ticks to prove the cancelled setImmediate does not fire after db.close()
    await new Promise((r) => setImmediate(r))
    await new Promise((r) => setTimeout(r, 20))

    assert.deepStrictEqual(log, ['effect:t1', 'db:close'])
    assert.strictEqual(getPostCloseCalls(), 0)
  })

  test(`${driver.name}: processSideEffects(), flush(), and close() await an in-flight drain before returning (#4)`, async () => {
    const log = []
    const { db, getPostCloseCalls } = wrapDb(driver.make(), log)
    const gate = deferred()
    const started = deferred()

    const engine = EventsEngine({
      db,
      eventDefinitions: { 'task.queued@1.0.0': EVENT_DEF },
      effects: {
        'task.queued': async (evt) => {
          log.push(`start:${evt.payload.id}`)
          started.resolve()
          await gate.promise
          log.push(`done:${evt.payload.id}`)
        },
      },
      asyncSideEffects: true,
    })

    await engine.ingress({
      type: 'task.queued',
      version: '1.0.0',
      payload: { id: 't1' },
    })

    // Wait for background setImmediate drain to enter the async handler
    await started.promise

    let drainResolved = false
    let flushResolved = false
    let closeResolved = false

    const drainP = engine.processSideEffects().then(() => {
      drainResolved = true
    })
    const flushP = engine.flush().then(() => {
      flushResolved = true
    })
    const closeP = engine.close().then(() => {
      closeResolved = true
    })

    await new Promise((r) => setTimeout(r, 15))
    assert.strictEqual(
      drainResolved,
      false,
      'processSideEffects() must wait for in-flight drain'
    )
    assert.strictEqual(
      flushResolved,
      false,
      'flush() must wait for in-flight drain'
    )
    assert.strictEqual(
      closeResolved,
      false,
      'close() must wait for in-flight drain'
    )

    gate.resolve()
    await Promise.all([drainP, flushP, closeP])

    assert.deepStrictEqual(log, ['start:t1', 'done:t1', 'db:close'])
    assert.strictEqual(getPostCloseCalls(), 0)
  })

  test(`${driver.name}: close() drains events ingressed mid-drain before closing DB (#4)`, async () => {
    const log = []
    const { db } = wrapDb(driver.make(), log)
    const gate = deferred()
    const started = deferred()

    const engine = EventsEngine({
      db,
      eventDefinitions: { 'task.queued@1.0.0': EVENT_DEF },
      effects: {
        'task.queued': async (evt) => {
          log.push(`start:${evt.payload.id}`)
          if (evt.payload.id === 't1') {
            started.resolve()
            await gate.promise
          }
          log.push(`done:${evt.payload.id}`)
        },
      },
      asyncSideEffects: true,
    })

    await engine.ingress({
      type: 'task.queued',
      version: '1.0.0',
      payload: { id: 't1' },
    })

    await started.promise

    await engine.ingress({
      type: 'task.queued',
      version: '1.0.0',
      payload: { id: 't2' },
    })

    const closeP = engine.close()
    gate.resolve()
    await closeP

    assert.deepStrictEqual(log, [
      'start:t1',
      'done:t1',
      'start:t2',
      'done:t2',
      'db:close',
    ])
  })

  test(`${driver.name}: close() is idempotent and rejects subsequent ingress()`, async () => {
    let closeCount = 0
    const real = driver.make()
    const db = {
      ...real,
      close: async () => {
        closeCount++
        return real.close()
      },
    }

    const engine = EventsEngine({
      db,
      eventDefinitions: { 'task.queued@1.0.0': EVENT_DEF },
      effects: { 'task.queued': async () => {} },
      asyncSideEffects: true,
    })

    await Promise.all([engine.close(), engine.close()])
    assert.strictEqual(closeCount, 1)

    await assert.rejects(
      () =>
        engine.ingress({
          type: 'task.queued',
          version: '1.0.0',
          payload: { id: 'late' },
        }),
      /EventEngine is closed/
    )
  })
}

test('close() flushes debounced backup checkpoint immediately without waiting for timer', async () => {
  const checkpoints = []
  const db = MemoryDb()
  const engine = EventsEngine({
    db,
    backupDebounceMs: 60000,
    backup: {
      saveCheckpoint: async (key, payload) => {
        checkpoints.push({ key, payload: JSON.parse(payload) })
      },
    },
    effects: {
      'task.queued': async () => {},
    },
    asyncSideEffects: true,
  })

  const receipt = await engine.ingress({
    type: 'task.queued',
    version: '1.0.0',
    payload: { id: 'b1' },
  })

  await engine.close()

  assert.strictEqual(checkpoints.length, 1)
  assert.strictEqual(checkpoints[0].key, 'side_effects_cursor')
  assert.strictEqual(
    checkpoints[0].payload.lastCompletedSideEffectEventId,
    receipt.id
  )
})
