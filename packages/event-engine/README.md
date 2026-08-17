# @sullux/event-engine

Stateful, crash-safe local-first event-sourcing and projection engine with SQLite storage, monotonic ULIDs, active/passive subscriptions, schema upcasting, and outbox side-effects.

## Documentation

Full documentation, architecture guides, and API references are available at:
[https://sullux.com/projects/event-sourced/event-engine/](https://sullux.com/projects/event-sourced/event-engine/)

## Installation

```bash
npm install @sullux/event-engine
# or
yarn add @sullux/event-engine
```

## Quick Start

```javascript
const { EventEngine } = require('@sullux/event-engine')

const main = async () => {
  const engine = EventEngine({
    databasePath: './events.db',
  })

  // Register an event type definition
  engine.registerDefinition({
    type: 'order.created',
    version: '1.0.0',
    validate(payload) {
      if (!payload.orderId || !payload.amount) {
        throw new Error('Invalid order payload')
      }
      return true
    },
  })

  // Subscribe to live events matching a predicate
  engine.subscribe({
    predicate: { type: 'order.created' },
    handler: async (event) => {
      console.log('New order received:', event.payload.orderId)
    },
  })

  // Ingress an event into the append-only log
  const event = await engine.ingress('order.created@1.0.0', {
    orderId: 'ord_12345',
    amount: 99.95,
  })

  console.log('Committed event ULID:', event.id)
}

main()
```

## Contributing

Contributions are welcome! Please ensure all code adheres to project guidelines (Vanilla JS, functional factories, zero external dependencies, 100% test coverage).

```bash
yarn test
```

## License

[MIT](https://sullux.com/projects/event-sourced/event-engine/LICENSE) © 2026 Charles Sullivan
