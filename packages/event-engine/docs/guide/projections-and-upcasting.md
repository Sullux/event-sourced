# Projections & Schema Upcasting

Event-sourced architectures require fast read access to aggregated state and seamless migration strategies as schemas evolve over time.

---

## Synchronous Projections

Projections compile event streams into fast relational SQL read tables or materialized views.

```javascript
engine.registerProjection({
  type: 'file.blob.registered',
  version: '1.0.0',
  handler: async (event, db) => {
    const { blobId, sizeInBytes, contentType } = event.payload
    await db.query(
      `INSERT INTO file_blobs (blob_id, size_in_bytes, content_type)
       VALUES (?, ?, ?)
       ON CONFLICT(blob_id) DO UPDATE SET size_in_bytes = excluded.size_in_bytes`,
      [blobId, sizeInBytes, contentType]
    )
  },
})
```

When an event is ingressed, its projection runs in the exact same atomic transaction as the append to the log.

---

## Rebuilding Projections

If a projection schema changes or new read tables are added, you can replay historical events from the log:

```javascript
await engine.replay({
  from: 0,
  to: Date.now(),
  batchSize: 1000,
  handler: async (event) => {
    await applyProjection(event)
  },
})
```

---

## Schema Evolution via Upcasting

In a distributed or long-lived system, event payloads from years ago (`1.0.0`) must be readable by today's code (`1.2.0`). Instead of mutating the historical database, `@sullux/event-engine` uses **Upcasters**.

Upcasters transform event payloads on the fly during replay or subscription ingestion:

```javascript
// Upcast v1.0.0 -> v1.1.0 (adds missing fullName field)
engine.registerUpcaster({
  type: 'user.created',
  fromVersion: '1.0.0',
  toVersion: '1.1.0',
  upcast: (payload) => ({
    ...payload,
    fullName: `${payload.firstName} ${payload.lastName}`,
  }),
})

// Upcast v1.1.0 -> v1.2.0 (renames accountId to tenantId)
engine.registerUpcaster({
  type: 'user.created',
  fromVersion: '1.1.0',
  toVersion: '1.2.0',
  upcast: (payload) => {
    const { accountId, ...rest } = payload
    return { ...rest, tenantId: accountId }
  },
})
```

When an event at `1.0.0` is queried, the engine runs the transformation pipeline `1.0.0 -> 1.1.0 -> 1.2.0` automatically.
