const test = require('node:test')
const assert = require('node:assert')
const { ClusteredEngine, eventHash } = require('../index')
const { SqliteDb } = require('@sullux/event-engine/db/sqlite')

test('Cluster - 3 Node Cluster performs 2-of-3 Quorum Commit and Replicates Events', async () => {
  const db1 = SqliteDb({ dbPath: ':memory:' })
  const db2 = SqliteDb({ dbPath: ':memory:' })
  const db3 = SqliteDb({ dbPath: ':memory:' })

  const node1 = ClusteredEngine({
    nodeId: 'node1',
    port: 9101,
    db: db1,
    discoverPeers: async () => ['127.0.0.1:9102', '127.0.0.1:9103'],
  })

  const node2 = ClusteredEngine({
    nodeId: 'node2',
    port: 9102,
    db: db2,
    discoverPeers: async () => ['127.0.0.1:9101', '127.0.0.1:9103'],
  })

  const node3 = ClusteredEngine({
    nodeId: 'node3',
    port: 9103,
    db: db3,
    discoverPeers: async () => ['127.0.0.1:9101', '127.0.0.1:9102'],
  })

  await node1.start()
  await node2.start()
  await node3.start()

  // Ensure peer discovery reconnects now that all nodes are listening
  await node1.getMesh().pollPeers()
  await node2.getMesh().pollPeers()
  await node3.getMesh().pollPeers()
  await new Promise((r) => setTimeout(r, 150))

  // Ingress event at Node 1
  const receipt = await node1.ingress({
    type: 'coms.actor.created',
    version: '1.0.0',
    payload: { id: 'a1', name: 'Charles' },
  })

  assert.strictEqual(receipt.status, 'processed')

  // Verify event was replicated to Node 2 and Node 3
  const n1Events = await node1.query({ predicate: { '.type': 'coms.actor.created' } })
  const n2Events = await node2.query({ predicate: { '.type': 'coms.actor.created' } })
  const n3Events = await node3.query({ predicate: { '.type': 'coms.actor.created' } })

  assert.strictEqual(n1Events.length, 1)
  assert.strictEqual(n2Events.length, 1)
  assert.strictEqual(n3Events.length, 1)
  assert.strictEqual(n2Events[0].id, receipt.id)
  assert.strictEqual(n3Events[0].id, receipt.id)

  await node1.stop()
  await node2.stop()
  await node3.stop()
})

test('Cluster - Isolated Node Fails Quorum Commit When Peers Are Offline', async () => {
  const db1 = SqliteDb({ dbPath: ':memory:' })

  const node1 = ClusteredEngine({
    nodeId: 'isolated_node',
    port: 9201,
    db: db1,
    discoverPeers: async () => ['127.0.0.1:9202', '127.0.0.1:9203'], // Offline peers
  })

  await node1.start()

  await assert.rejects(
    async () => {
      await node1.ingress({
        type: 'coms.actor.created',
        version: '1.0.0',
        payload: { id: 'a1', name: 'Isolated' },
      })
    },
    (err) => err.message.includes('Quorum not met')
  )

  await node1.stop()
})

test('Cluster - Node Catch-Up Recovery via assertConsistent()', async () => {
  const db1 = SqliteDb({ dbPath: ':memory:' })
  const db2 = SqliteDb({ dbPath: ':memory:' })

  const node1 = ClusteredEngine({
    nodeId: 'n1',
    port: 9301,
    clusterSize: 2,
    db: db1,
    discoverPeers: async () => ['127.0.0.1:9302'],
  })

  const node2 = ClusteredEngine({
    nodeId: 'n2',
    port: 9302,
    clusterSize: 2,
    db: db2,
    discoverPeers: async () => ['127.0.0.1:9301'],
  })

  await node1.start()
  await node2.start()

  await node1.getMesh().pollPeers()
  await node2.getMesh().pollPeers()
  await new Promise((r) => setTimeout(r, 100))

  // Ingress event on Node 1
  await node1.ingress({
    type: 'coms.actor.created',
    version: '1.0.0',
    payload: { id: 'a1', name: 'Original' },
  })

  // Stop Node 1 and Node 2 (simulating node 2 crash and node 1 reconfig)
  await node1.stop()
  await node2.stop()

  // Reconfigure node 1 to standalone clusterSize: 1 temporarily for test
  const node1Solo = ClusteredEngine({
    nodeId: 'n1',
    port: 9301,
    clusterSize: 1,
    db: db1,
    discoverPeers: async () => [],
  })
  await node1Solo.start()

  await node1Solo.ingress({
    type: 'coms.actor.updated',
    version: '1.0.0',
    payload: { id: 'a1', name: 'Updated While Down' },
  })

  await node1Solo.stop()

  // Restart Node 2 and connect to Node 1
  const node1Restored = ClusteredEngine({
    nodeId: 'n1',
    port: 9301,
    clusterSize: 2,
    db: db1,
    discoverPeers: async () => ['127.0.0.1:9302'],
  })
  const node2Restored = ClusteredEngine({
    nodeId: 'n2',
    port: 9302,
    clusterSize: 2,
    db: db2,
    discoverPeers: async () => ['127.0.0.1:9301'],
  })

  await node1Restored.start()
  await node2Restored.start()

  await node1Restored.getMesh().pollPeers()
  await node2Restored.getMesh().pollPeers()
  await new Promise((r) => setTimeout(r, 100))

  // Node 2 asserts consistency to catch up missing events
  await node2Restored.assertConsistent()

  const n2Events = await node2Restored.query({ predicate: { '.type': { match: 'coms.actor.*' } } })
  assert.strictEqual(n2Events.length, 2)
  assert.strictEqual(n2Events[1].payload.name, 'Updated While Down')

  await node1Restored.stop()
  await node2Restored.stop()
})

test('Hash Chain - eventHash generates deterministic SHA-256 chain', () => {
  const h0 = ''
  const h1 = eventHash(h0, '01H1234567890ABCDEFGH01')
  const h2 = eventHash(h1, '01H1234567890ABCDEFGH02')

  assert.strictEqual(typeof h1, 'string')
  assert.strictEqual(h1.length, 64)
  assert.notStrictEqual(h1, h2)

  // Parity check
  const h1Alt = eventHash(h0, '01H1234567890ABCDEFGH01')
  assert.strictEqual(h1, h1Alt)
})
