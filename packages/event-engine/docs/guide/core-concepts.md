# Core Concepts

`@sullux/event-engine` is designed around core invariants that make local-first, distributed event systems robust and deterministic.

---

## 1. Monotonic ULID Ordering

Every event committed to the log is assigned a **Universally Unique Lexicographically Sortable Identifier (ULID)**.

* **Timestamp Prefix (48 bits)**: Encodes millisecond epoch time (`Date.now()`).
* **Random Component (80 bits)**: High-entropy cryptographic randomness.
* **Monotonic Sequence Protection**: If multiple events occur within the exact same millisecond or if local clock-drift occurs, the randomness bits are monotonically incremented, ensuring strict alphabetical and chronological sort parity (`eventA.id < eventB.id`).

---

## 2. The Append-Only Log Invariant

Events are immutable. Once written to the `events` table, an event is never modified or deleted. 

```sql
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  version TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  partition_key TEXT,
  deduplication_id TEXT,
  payload TEXT NOT NULL
);
```

State is computed as a fold or projection over historical events rather than mutable column updates.

---

## 3. Idempotency & Deduplication

Network retries or distributed replays can cause duplicate event submissions. When a definition declares `deduplicationId`:

```javascript
engine.registerDefinition({
  type: 'payment.processed',
  version: '1.0.0',
  deduplicationId: (payload) => payload.transactionId,
})
```

If an event with that `deduplicationId` was already committed, `engine.ingress()` returns the existing persisted event without appending a duplicate.

---

## 4. Transactional Outbox Pattern

Side-effects (e.g. sending emails, making API calls, publishing network packets) should never occur inside synchronous database write locks.

Instead:
1. When an event is committed, matching side-effect jobs are written to the outbox queue in the same transaction.
2. A background processor drains the outbox asynchronously.
3. If an external service fails, the processor retries with exponential backoff while durable cursor checkpointing tracks progress.
