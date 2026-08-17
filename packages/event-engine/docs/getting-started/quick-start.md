# Quick Start

Get up and running with `@sullux/event-engine` in minutes.

---

## 1. Installation

```bash
npm install @sullux/event-engine
# or
yarn add @sullux/event-engine
```

---

## 2. Basic Initialization

Initialize an engine instance with an SQLite database file or in-memory storage:

```javascript
const { EventEngine } = require('@sullux/event-engine')

// Persistent SQLite engine:
const engine = EventEngine({
  databasePath: './events.db',
})

// Or purely in-memory engine (useful for testing):
const testEngine = EventEngine({
  db: require('@sullux/event-engine/db/memory').MemoryDb(),
})
```

---

## 3. Registering Event Definitions

Register definitions with optional validation, deduplication IDs, and partition keys:

```javascript
engine.registerDefinition({
  type: 'customer.registered',
  version: '1.0.0',
  deduplicationId: (payload) => payload.customerId,
  partitionKey: (payload) => `customer#${payload.customerId}`,
  validate(payload) {
    if (!payload.customerId || !payload.email) {
      throw new Error('customerId and email are required')
    }
    return true
  },
})
```

---

## 4. Ingressing Events

Ingress an event into the append-only log:

```javascript
const event = await engine.ingress('customer.registered@1.0.0', {
  customerId: 'cust_98765',
  email: 'natasha@example.com',
  name: 'Natasha Sullivan',
  registeredAt: Date.now(),
})

console.log('Ingressed Event ID:', event.id)
console.log('Timestamp:', event.timestamp)
```

---

## 5. Subscribing to Events

Listen to events matching predicates in real time:

```javascript
// Active subscription: catches up on historical events then streams live:
const unsubscribe = engine.subscribe({
  predicate: { type: 'customer.registered' },
  catchUp: true,
  handler: async (event) => {
    console.log(`[Event: ${event.type}]`, event.payload)
  },
})

// Clean up when done:
// unsubscribe()
```
