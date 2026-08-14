# @sullux/coms-events

A generic, stateful event-sourcing and projection orchestration engine designed for offline-first, local-first environments. It operates purely on dependency-free functional JavaScript and is platform-agnostic, running identical rules on servers, terminal interfaces, mobile native apps, and web applications.

---

## Key Capabilities

1. **Monotonic Chronological ULIDs:** Automatically generates strictly increasing chronological ULID event IDs (`id`) internally, protecting against clock drift and negative time jumps.
2. **ACID Outbox Side-Effects:** Enqueues pending side effects in a dedicated `_side_effects` outbox table within the same database transaction as the event. Side effects are executed asynchronously with at-least-once guarantees, ensuring physical effects (e.g. email sends) are never executed if database transactions roll back.
3. **Automatic Upcasting:** Version forwarders automatically transform older event schemas (`1.0.0 -> 1.0.1 -> 1.0.2`) on the fly, keeping projections clean and targeted at the latest schema.
4. **Idempotency Safeguards:** Automatically intercepts and filters duplicate incoming event transmissions via deduplication IDs to prevent state distortion or side-effect double-firing.
5. **Out-of-Order Roll-Forwarding:** When a historical event arrives out of sequence (e.g., via backfill or delayed sync), the engine executes an atomic rollback, saves the event, and performs a sequential roll-forward to rebuild projections perfectly without re-running side effects.
6. **Live Backup Streaming & Debounced Checkpointing:** Automatically streams newly committed event envelopes to backup drivers (e.g., S3 or Local FS) while writing debounced side-effect cursor checkpoints to minimize backup noise and cost.
7. **Crash-Safe Checkpointing:** Persists current replay offsets and context in the host storage driver. If an unexpected power outage or application crash occurs, the engine resumes from the last validated checkpoint upon reboot.

---

## Architecture & Interfaces

### Event Definition Schema
Event definitions can be registered at construction or dynamically via `engine.registerDefinition(def)`:

```javascript
const userRegisteredDef = {
  type: 'user.registered',
  version: '1.0.0',
  validate: (payload) => {
    if (!payload.email) throw new Error('Email required')
  },
  deduplicationId: (payload) => `user#${payload.email}`,
  partitionKey: (payload) => `partition#${payload.email}`,
  projections: async (event, { db }) => {
    await db.execute('INSERT INTO users (email, name) VALUES (?, ?)', [
      event.payload.email,
      event.payload.name
    ])
  },
  effects: [
    {
      name: 'sendWelcomeEmail',
      run: async (event, { filesystem }) => {
        await sendEmail(event.payload.email, 'Welcome!')
      }
    }
  ],
  upcast: (payload_1_0_0) => ({
    ...payload_1_0_0,
    status: 'active' // Upgrades 1.0.0 payload to 1.0.1
  }),
  targetVersion: '1.0.1'
}
```

### DB Adapter Interface
The host DB driver must implement:
```javascript
const db = {
  runTransaction: async (fn) => { ... },
  saveEvent: async (event) => { ... },
  getEventByDeduplicationId: async (deduplicationId) => { ... },
  getEventsFrom: async (id) => { ... },
  getEventsSince: async (id, limit) => { ... },
  saveReplayState: async ({ id, lastProcessedId, context }) => { ... },
  getReplayState: async (id) => { ... },
  deleteReplayState: async (id) => { ... },
  
  // Side-effect outbox support
  saveSideEffectOutbox: async (records) => { ... },
  getPendingSideEffects: async (limit) => { ... },
  markSideEffectCompleted: async (id) => { ... },
  markSideEffectFailed: async (id, error) => { ... },
}
```

---

## Usage Example

### 1. Initialize the Engine
```javascript
const { EventsEngine } = require('@sullux/coms-events')
const { SqliteDb } = require('@sullux/coms-events/drivers/db/sqlite')

const db = SqliteDb({ dbPath: './events.db' })

const engine = EventsEngine({
  db,
  eventDefinitions: {
    'user.registered@1.0.0': userRegisteredDef
  }
})
```

### 2. Live Ingress
Accepts raw event input `{ type, version, payload }`:
```javascript
const receipt = await engine.ingress({
  type: 'user.registered',
  version: '1.0.0',
  payload: { email: 'alice@example.com', name: 'Alice' }
})

// receipt => { id: '01KWW0DDYN89BX4WBK4P01F53X', deduplicationId: 'user#alice@example.com', status: 'processed' }
```

### 3. Replay Engine
```javascript
await engine.replay({
  replayId: 'main-migration',
  context: { optimizeIndexes: true }
})
```
