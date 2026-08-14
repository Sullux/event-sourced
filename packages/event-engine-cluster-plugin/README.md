# @sullux/coms-cluster

Leaderless 2-of-3 Quorum Mesh Replication Engine for `@sullux/coms-events`.

## Features

- **Leaderless 2-of-3 Quorum**: Ensures 100% mathematical certainty of consistency without leader election, split-brain risk, or external coordination daemons (Raft, Paxos, Etcd).
- **Persistent TCP Mesh**: Sub-millisecond wire framing over Node.js `net` module for fast inter-node communication in Fly.io / 6PN WireGuard private networks.
- **SHA-256 Event Chain Verification**: Running cryptographic state hash verifying exact append-only log parity across nodes.
- **Zero Third-Party Dependencies**: Built entirely on Node.js standard modules (`net`, `crypto`).
- **Functional Composition API**: Higher-order factory `ClusteredEngine` wraps `EventsEngine` cleanly with zero hidden object mutations.

## Usage

### Primary API: `ClusteredEngine`

```javascript
const { ClusteredEngine } = require('@sullux/coms-cluster')
const { SqliteDb } = require('@sullux/coms-events/db/sqlite')

const db = SqliteDb({ dbPath: './lake.db' })

const engine = ClusteredEngine({
  nodeId: 'node_1',
  port: 9090,
  clusterSize: 3,
  discoverPeers: async () => ['10.0.0.2:9090', '10.0.0.3:9090'],
  db,
  eventDefinitions: { ... },
})

await engine.start()

// Ingress automatically replicates to peer nodes and awaits 2-of-3 ACKs
const receipt = await engine.ingress({
  type: 'coms.actor.created',
  version: '1.0.0',
  payload: { id: 'a1', name: 'Charles' },
})

// Enforce read consistency before running local queries
await engine.assertConsistent()
const events = await engine.query({ predicate: { '.type': 'coms.actor.created' } })

await engine.stop()
```

## License

MIT
