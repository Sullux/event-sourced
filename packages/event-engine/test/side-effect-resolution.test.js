const test = require('node:test')
const assert = require('node:assert')
const { EventsEngine } = require('../index')
const { MemoryDb } = require('../drivers/db/memory')
const { SqliteDb } = require('../drivers/db/sqlite')

// #2: a pending row whose handler could not be resolved was marked COMPLETED without running. The
// work vanished while the outbox reported success - data loss plus a green instrument. Reachable
// without a crash: a renamed handler, an ontology that stops declaring the effect, or a drain
// ordered before registration (which made "drain pending rows at boot" a destructive fix).
//
// Neither driver exposes a read for non-pending rows, so this pins the engine's DECISION at the
// injected `db` seam: which marking call it made, with what error. That is the behaviour under test,
// and it is driver-independent rather than a peek at one driver's internals.

const DECLARED = {
  type: 'note.taken',
  version: '1.0.0',
  schema: { type: 'object', properties: {}, additionalProperties: true },
}
const EFFECT_NAME = 'note.taken@1.0.0'
const PREDICATE = { '.type': 'note.taken', '.version': '1.0.0' }
const plugin = { name: 'px', version: '1.0.0', definitions: [DECLARED] }

const recorder = (db) => {
  const completed = []
  const failed = []
  return {
    db: {
      ...db,
      markSideEffectCompleted: async (id) => {
        completed.push(id)
        return db.markSideEffectCompleted(id)
      },
      markSideEffectFailed: async (id, error) => {
        failed.push({ id, error })
        return db.markSideEffectFailed(id, error)
      },
    },
    completed,
    failed,
  }
}

// phase 1 commits an effect and never drains it, standing in for a crash between commit and drain.
const orphanedRow = async (db) => {
  const first = EventsEngine({
    db,
    plugins: [plugin],
    effects: [{ name: EFFECT_NAME, predicate: PREDICATE, run: async () => {} }],
    projections: {},
    asyncSideEffects: true,
  })
  await first.ingress({ type: 'note.taken', version: '1.0.0', payload: {} })
  const pending = await db.getPendingSideEffects()
  assert.equal(
    pending.length,
    1,
    'the row must be queued before the drain, or this pin measures nothing'
  )
  return pending[0]
}

const engineWith = (db, effects) =>
  EventsEngine({
    db,
    plugins: [plugin],
    effects,
    projections: {},
    asyncSideEffects: true,
  })

const DRIVERS = [
  { name: 'MemoryDb', make: () => MemoryDb() },
  { name: 'SqliteDb', make: () => SqliteDb({ filename: ':memory:' }) },
]

for (const driver of DRIVERS) {
  test(`${driver.name}: an unresolvable handler is FAILED, never silently completed (#2)`, async () => {
    const real = driver.make()
    await real.init?.()
    const row = await orphanedRow(real)

    const fired = []
    const seam = recorder(real)
    // a NEW engine over the same db: the original handler is gone, a different name is registered
    const restarted = engineWith(seam.db, [
      {
        name: 'a.different.name@1.0.0',
        predicate: PREDICATE,
        run: async () => fired.push('wrong'),
      },
    ])
    await restarted.processSideEffects()

    assert.deepEqual(fired, [], 'no handler may run for a row it does not own')
    assert.deepEqual(
      seam.completed,
      [],
      'this is the bug: the row was retired as succeeded'
    )
    assert.deepEqual(
      seam.failed.map((f) => f.id),
      [row.id],
      'the unrunnable row must be marked failed exactly once'
    )
    assert.match(seam.failed[0].error, /no handler registered/)
    assert.ok(
      seam.failed[0].error.includes(EFFECT_NAME),
      'the error must name the effect that could not run'
    )
    assert.equal(
      (await real.getPendingSideEffects()).length,
      0,
      'and it must not be left spinning in the drain loop'
    )
  })

  test(`${driver.name}: discriminator - a resolvable handler still COMPLETES and runs exactly once`, async () => {
    // without this arm the fix could "pass" by failing every row, which is a different data loss.
    const real = driver.make()
    await real.init?.()
    const row = await orphanedRow(real)

    const fired = []
    const seam = recorder(real)
    const restarted = engineWith(seam.db, [
      {
        name: EFFECT_NAME,
        predicate: PREDICATE,
        run: async () => fired.push('ran'),
      },
    ])
    await restarted.processSideEffects()

    assert.deepEqual(
      fired,
      ['ran'],
      'the registered handler must run, exactly once'
    )
    assert.deepEqual(seam.completed, [row.id])
    assert.deepEqual(seam.failed, [], 'a healthy row must not be marked failed')
    assert.equal((await real.getPendingSideEffects()).length, 0)
  })
}
