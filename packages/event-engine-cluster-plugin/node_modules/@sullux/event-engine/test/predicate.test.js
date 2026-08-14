const test = require('node:test')
const assert = require('node:assert')
const { DatabaseSync: Database } = require('node:sqlite')
const { evaluateJs, compileSql } = require('../lib/predicate')

test('Predicate - evaluateJs and compileSql parity for exact values', () => {
  const predicate = {
    '.type': 'coms.actor.created',
    '.version': '1.0.0',
    '.payload.name': 'Charles Sullivan',
  }

  const matchEvent = {
    type: 'coms.actor.created',
    version: '1.0.0',
    payload: { name: 'Charles Sullivan' },
  }

  const nonMatchEvent = {
    type: 'coms.actor.created',
    version: '1.0.0',
    payload: { name: 'Natasha Sullivan' },
  }

  assert.strictEqual(evaluateJs(predicate, matchEvent), true)
  assert.strictEqual(evaluateJs(predicate, nonMatchEvent), false)

  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE events (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      version TEXT NOT NULL,
      payload TEXT NOT NULL
    );
  `)

  db.prepare(`
    INSERT INTO events (id, type, version, payload) VALUES (?, ?, ?, ?)
  `).run('1', matchEvent.type, matchEvent.version, JSON.stringify(matchEvent.payload))

  db.prepare(`
    INSERT INTO events (id, type, version, payload) VALUES (?, ?, ?, ?)
  `).run('2', nonMatchEvent.type, nonMatchEvent.version, JSON.stringify(nonMatchEvent.payload))

  const { sql, params } = compileSql(predicate)
  const rows = db.prepare(`SELECT * FROM events WHERE ${sql}`).all(...params)

  assert.strictEqual(rows.length, 1)
  assert.strictEqual(rows[0].id, '1')
})

test('Predicate - glob match operator for JS and SQL', () => {
  const predicate = {
    '.type': { match: 'coms.actor.*' },
  }

  const matchEvent = { type: 'coms.actor.updated', payload: {} }
  const nonMatchEvent = { type: 'coms.channel.created', payload: {} }

  assert.strictEqual(evaluateJs(predicate, matchEvent), true)
  assert.strictEqual(evaluateJs(predicate, nonMatchEvent), false)

  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE events (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      payload TEXT NOT NULL
    );
  `)

  db.prepare(`INSERT INTO events (id, type, payload) VALUES (?, ?, ?)`).run('1', 'coms.actor.updated', '{}')
  db.prepare(`INSERT INTO events (id, type, payload) VALUES (?, ?, ?)`).run('2', 'coms.channel.created', '{}')

  const { sql, params } = compileSql(predicate)
  const rows = db.prepare(`SELECT * FROM events WHERE ${sql}`).all(...params)

  assert.strictEqual(rows.length, 1)
  assert.strictEqual(rows[0].id, '1')
})

test('Predicate - string shorthand and nested object predicates', () => {
  // String shorthand
  assert.strictEqual(evaluateJs('coms.actor.created', { type: 'coms.actor.created' }), true)
  assert.strictEqual(evaluateJs('coms.actor.created', { type: 'coms.actor.updated' }), false)
  assert.strictEqual(evaluateJs('coms.actor.*', { type: 'coms.actor.updated' }), true)

  // Nested object predicate
  const nestedPredicate = {
    '.payload': {
      '.payment': { provider: 'visa' },
      '.amount': { gt: 10 },
    },
  }

  const matchEvent = {
    type: 'coms.payment.processed',
    payload: { payment: { provider: 'visa' }, amount: 15.37 },
  }

  const nonMatchEvent = {
    type: 'coms.payment.processed',
    payload: { payment: { provider: 'mastercard' }, amount: 5.00 },
  }

  assert.strictEqual(evaluateJs(nestedPredicate, matchEvent), true)
  assert.strictEqual(evaluateJs(nestedPredicate, nonMatchEvent), false)
})

test('Predicate - comparison operators gt, gte, lt, lte, in', () => {
  const predicate = {
    '.payload.age': { gte: 18, lt: 65 },
    '.payload.role': { in: ['admin', 'manager'] },
  }

  const validUser = { payload: { age: 25, role: 'admin' } }
  const tooYoung = { payload: { age: 16, role: 'admin' } }
  const wrongRole = { payload: { age: 30, role: 'guest' } }

  assert.strictEqual(evaluateJs(predicate, validUser), true)
  assert.strictEqual(evaluateJs(predicate, tooYoung), false)
  assert.strictEqual(evaluateJs(predicate, wrongRole), false)

  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE events (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      payload TEXT NOT NULL
    );
  `)

  db.prepare(`INSERT INTO events (id, type, payload) VALUES (?, ?, ?)`).run('1', 'u1', JSON.stringify(validUser.payload))
  db.prepare(`INSERT INTO events (id, type, payload) VALUES (?, ?, ?)`).run('2', 'u2', JSON.stringify(tooYoung.payload))
  db.prepare(`INSERT INTO events (id, type, payload) VALUES (?, ?, ?)`).run('3', 'u3', JSON.stringify(wrongRole.payload))

  const { sql, params } = compileSql(predicate)
  const rows = db.prepare(`SELECT * FROM events WHERE ${sql}`).all(...params)

  assert.strictEqual(rows.length, 1)
  assert.strictEqual(rows[0].id, '1')
})

test('Predicate - logical operators some and not', () => {
  const predicate = {
    some: [
      { '.type': 'coms.actor.created' },
      { '.payload.vip': true },
    ],
    not: { '.payload.blocked': true },
  }

  const actorEvent = { type: 'coms.actor.created', payload: { blocked: false } }
  const vipEvent = { type: 'coms.channel.created', payload: { vip: true, blocked: false } }
  const blockedVip = { type: 'coms.channel.created', payload: { vip: true, blocked: true } }

  assert.strictEqual(evaluateJs(predicate, actorEvent), true)
  assert.strictEqual(evaluateJs(predicate, vipEvent), true)
  assert.strictEqual(evaluateJs(predicate, blockedVip), false)
})
