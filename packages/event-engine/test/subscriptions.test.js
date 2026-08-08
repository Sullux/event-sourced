const test = require('node:test')
const assert = require('node:assert')
const { EventsEngine } = require('../index')
const { SqliteDb } = require('../drivers/db/sqlite')
const { MemoryDb } = require('../drivers/db/memory')

test('Subscriptions - Passive subscription matches predicate and triggers handler via outbox', async () => {
  const db = MemoryDb()
  const engine = EventsEngine({ db })

  const received = []
  engine.subscribe({
    id: 'sub-actor-events',
    predicate: { '.type': { match: 'coms.actor.*' } },
    handler: async (evt) => {
      received.push(evt)
    },
  })

  await engine.ingress({
    type: 'coms.actor.created',
    version: '1.0.0',
    payload: { id: 'a1', name: 'Charles' },
  })

  await engine.ingress({
    type: 'coms.channel.created',
    version: '1.0.0',
    payload: { id: 'c1' },
  })

  assert.strictEqual(received.length, 1)
  assert.strictEqual(received[0].type, 'coms.actor.created')
  assert.strictEqual(received[0].payload.name, 'Charles')
  assert.strictEqual(typeof received[0].timestamp, 'number')
})

test('Subscriptions - Active subscription performs catch-up replay then streams live events', async () => {
  const db = SqliteDb({ dbPath: ':memory:' })
  const engine = EventsEngine({ db })

  // Seed history
  await engine.ingress({
    type: 'coms.actor.created',
    version: '1.0.0',
    payload: { id: 'a1', name: 'Charles' },
  })

  await engine.ingress({
    type: 'coms.channel.created',
    version: '1.0.0',
    payload: { id: 'c1' },
  })

  const streamed = []
  const { subId, lastProcessedId } = await engine.subscribeActive({
    id: 'client-active-1',
    predicate: { '.type': 'coms.actor.created' },
    onEvent: async (evt) => {
      streamed.push(evt)
    },
  })

  assert.strictEqual(streamed.length, 1, 'Historical actor event should be caught up on active subscribe')
  assert.strictEqual(streamed[0].payload.name, 'Charles')

  // Live event
  await engine.ingress({
    type: 'coms.actor.created',
    version: '1.0.0',
    payload: { id: 'a2', name: 'Natasha' },
  })

  assert.strictEqual(streamed.length, 2, 'Live actor event should be pushed in real-time')
  assert.strictEqual(streamed[1].payload.name, 'Natasha')
})

test('Subscriptions - One-off query API returns snapshot array and does not stay live', async () => {
  const db = SqliteDb({ dbPath: ':memory:' })
  const engine = EventsEngine({ db })

  await engine.ingress({
    type: 'coms.actor.created',
    version: '1.0.0',
    payload: { id: 'a1', name: 'Charles' },
  })

  await engine.ingress({
    type: 'coms.actor.updated',
    version: '1.0.0',
    payload: { id: 'a1', name: 'Charles Sullivan' },
  })

  const results = await engine.query({
    predicate: { '.type': { match: 'coms.actor.*' } },
  })

  assert.strictEqual(results.length, 2)
  assert.strictEqual(results[0].payload.name, 'Charles')
  assert.strictEqual(results[1].payload.name, 'Charles Sullivan')

  // Subsequent ingress should not affect query results
  await engine.ingress({
    type: 'coms.actor.updated',
    version: '1.0.0',
    payload: { id: 'a1', name: 'Charles S.' },
  })

  assert.strictEqual(results.length, 2, 'Query results should remain snapshot array')
})

test('Subscriptions - Term-limited upper-bound timestamp automatically unsubscribes', async () => {
  const db = SqliteDb({ dbPath: ':memory:' })
  let currentTime = 1000000
  const nowFn = () => currentTime

  const engine = EventsEngine({ db, nowFn })

  // Seed Event 1 at t = 1000000
  await engine.ingress({
    type: 'coms.actor.created',
    version: '1.0.0',
    payload: { id: 'a1' },
  })

  // Seed Event 2 at t = 1005000
  currentTime = 1005000
  await engine.ingress({
    type: 'coms.actor.updated',
    version: '1.0.0',
    payload: { id: 'a1', v: 2 },
  })

  // Seed Event 3 at t = 1010000
  currentTime = 1010000
  await engine.ingress({
    type: 'coms.actor.updated',
    version: '1.0.0',
    payload: { id: 'a1', v: 3 },
  })

  const received = []
  let completed = false

  await engine.subscribeActive({
    id: 'time-bound-sub',
    predicate: {
      '.timestamp': { lte: 1005000 },
    },
    onEvent: async (evt) => {
      received.push(evt)
    },
    onComplete: async () => {
      completed = true
    },
  })

  assert.strictEqual(received.length, 2, 'Should receive events 1 and 2, but not event 3')
  assert.strictEqual(completed, true, 'Subscription should complete when upper bound is reached')
})

test('Subscriptions - Concurrent ingress during replay transition is caught up without gaps or duplicates', async () => {
  const db = SqliteDb({ dbPath: ':memory:' })
  const engine = EventsEngine({ db })

  // Seed initial event
  await engine.ingress({
    type: 'coms.actor.created',
    version: '1.0.0',
    payload: { id: 'a1', name: 'Initial' },
  })

  const received = []

  // Wrap onEvent to simulate concurrent ingress during event delivery
  let subPromise
  subPromise = engine.subscribeActive({
    id: 'gap-sub',
    predicate: { '.type': { match: 'coms.actor.*' } },
    onEvent: async (evt) => {
      received.push(evt)
      // When processing the initial event, simulate a concurrent ingress hitting the system mid-replay
      if (evt.payload.name === 'Initial') {
        await engine.ingress({
          type: 'coms.actor.updated',
          version: '1.0.0',
          payload: { id: 'a1', name: 'Concurrent Ingress' },
        })
      }
    },
  })

  await subPromise

  assert.strictEqual(received.length, 2, 'Should capture both initial and concurrent ingress events')
  assert.strictEqual(received[0].payload.name, 'Initial')
  assert.strictEqual(received[1].payload.name, 'Concurrent Ingress')

  // Additional live event after full transition
  await engine.ingress({
    type: 'coms.actor.updated',
    version: '1.0.0',
    payload: { id: 'a1', name: 'Live Post-Transition' },
  })

  assert.strictEqual(received.length, 3)
  assert.strictEqual(received[2].payload.name, 'Live Post-Transition')
})

test('Immediate Side Effects - Poison pill deletes draft event on immediate failure', async () => {
  const db = SqliteDb({ dbPath: ':memory:' })

  let shouldFail = true
  const engine = EventsEngine({
    db,
    effects: {
      'coms.payment.processed': [
        {
          name: 'verify_gateway',
          immediate: true,
          run: async () => {
            if (shouldFail) {
              throw new Error('Payment Gateway Down')
            }
          },
        },
      ],
    },
  })

  await assert.rejects(
    async () => {
      await engine.ingress({
        type: 'coms.payment.processed',
        version: '1.0.0',
        payload: { id: 'p1', amount: 100 },
      })
    },
    (err) => err.message === 'Payment Gateway Down'
  )

  const events = await db.getEventsSince('', 100)
  assert.strictEqual(events.length, 0, 'Draft event must be deleted on immediate side effect failure')

  shouldFail = false
  const receipt = await engine.ingress({
    type: 'coms.payment.processed',
    version: '1.0.0',
    payload: { id: 'p1', amount: 100 },
  })

  assert.strictEqual(receipt.status, 'processed')
  assert.strictEqual(typeof receipt.timestamp, 'number')
  const committedEvents = await db.getEventsSince('', 100)
  assert.strictEqual(committedEvents.length, 1)
  assert.strictEqual(committedEvents[0].payload.amount, 100)
})
