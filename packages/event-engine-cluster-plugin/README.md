# @sullux/event-engine-cluster-plugin

Leaderless 2-of-3 Quorum Mesh Replication Plugin for `@sullux/event-engine` using deterministic SHA-256 hash chains.

## Documentation

Full documentation, guides, and schema references are available at:
[https://sullux.com/projects/event-sourced/event-engine-cluster-plugin/](https://sullux.com/projects/event-sourced/event-engine-cluster-plugin/)

## Installation

```bash
npm install @sullux/event-engine @sullux/event-engine-cluster-plugin
# or
yarn add @sullux/event-engine @sullux/event-engine-cluster-plugin
```

## Quick Start

```javascript
const { EventEngine } = require('@sullux/event-engine')
const { ClusteredEngine } = require('@sullux/event-engine-cluster-plugin')

const main = async () => {
  const localEngine = EventEngine({ databasePath: './node-1.db' })

  // Initialize a 3-node quorum cluster
  const cluster = ClusteredEngine(localEngine, {
    nodeId: 'node-1',
    peers: ['node-2', 'node-3'],
    transport: {
      send: async (targetNodeId, message) => {
        // network transport (e.g. WebSocket, gRPC, HTTP)
      },
    },
  })

  // Ingress an event with 2-of-3 quorum consensus
  const event = await cluster.ingress('order.placed@1.0.0', {
    orderId: 'ord_9876',
    amount: 150.00,
  })

  console.log('Quorum committed event hash:', event.hash)
}

main()
```

## Contributing

Contributions are welcome! Please ensure all code adheres to project guidelines (Vanilla JS, functional factories, zero external dependencies, 100% test coverage).

```bash
yarn test
```

## License

[MIT](https://sullux.com/projects/event-sourced/event-engine-cluster-plugin/LICENSE) © 2026 Charles Sullivan
