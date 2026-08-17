# Quick Start

This guide demonstrates setting up a 3-node in-memory cluster to replicate events with quorum consensus.

---

## 1. Installation

```bash
npm install @sullux/event-engine @sullux/event-engine-cluster-plugin
# or
yarn add @sullux/event-engine @sullux/event-engine-cluster-plugin
```

---

## 2. Multi-Node Cluster Configuration

```javascript
const { EventEngine } = require('@sullux/event-engine')
const { MemoryDb } = require('@sullux/event-engine/db/memory')
const { ClusteredEngine } = require('@sullux/event-engine-cluster-plugin')

// Setup in-memory mesh network bus for testing
const bus = new Map()

const createNode = (nodeId, peerIds) => {
  const localEngine = EventEngine({ db: MemoryDb() })
  
  const transport = {
    send: async (targetNodeId, message) => {
      const targetCluster = bus.get(targetNodeId)
      if (targetCluster) {
        return targetCluster.handleMessage(nodeId, message)
      }
    },
  }

  const cluster = ClusteredEngine(localEngine, {
    nodeId,
    peers: peerIds,
    transport,
  })

  bus.set(nodeId, cluster)
  return cluster
}

const node1 = createNode('node-1', ['node-2', 'node-3'])
const node2 = createNode('node-2', ['node-1', 'node-3'])
const node3 = createNode('node-3', ['node-1', 'node-2'])

const main = async () => {
  // Ingress an event on node-1
  const event = await node1.ingress('order.placed@1.0.0', {
    orderId: 'ord_123',
    total: 49.99,
  })

  console.log('Quorum committed event:', event.id)

  // Verify node-2 and node-3 replicated the event
  const eventsOnNode2 = await node2.engine.query({ predicate: { type: 'order.placed' } })
  console.log('Events replicated to node-2:', eventsOnNode2.length)
}

main()
```
