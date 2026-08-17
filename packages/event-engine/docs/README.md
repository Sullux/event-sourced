# Introduction to Event Engine

`@sullux/event-engine` is a zero-dependency, crash-safe, local-first event sourcing and projection engine built in Vanilla JavaScript.

Designed for edge nodes, daemons, local-first applications, and distributed mesh clusters, it provides an immutable append-only ledger backed by SQLite with strict monotonic ordering, transactional outbox side-effects, live and historical subscription query pipelines, and runtime schema upcasting.

---

## Key Features

* **Strict Monotonic Ordering**: Every event is assigned a 128-bit Universally Unique Lexicographically Sortable Identifier (ULID) with built-in clock-drift protection and microsecond monotonicity.
* **Crash-Safe Transactional Ingress**: Ingressing events, updating projections, and enqueuing side-effects execute in atomic SQLite transactions (WAL mode).
* **Guaranteed Idempotency**: Deduplication IDs prevent duplicate event ingestion during network retries or re-deliveries.
* **Flexible Subscriptions**: Stream live events, execute historical point-in-time catch-up replays, or perform bounded snapshot queries using rich SQL/JS predicate expressions.
* **Schema Evolution & Upcasting**: Upcast older event schemas iteratively on replay (e.g. `1.0.0` -> `1.0.1` -> `1.1.0`) without rewriting historical immutable logs.
* **Transactional Side-Effect Outbox**: Asynchronously processes external integrations (emails, webhooks, file writes) with durable cursor checkpointing and automatic retry handling.
* **Zero External Dependencies**: Built entirely with Node.js built-ins and native `node:sqlite`.

---

## Architectural Topography

```
               ┌───────────────────────────────┐
               │    engine.ingress(type, data) │
               └───────────────┬───────────────┘
                               │
            ┌──────────────────┼──────────────────┐
            ▼                  ▼                  ▼
   ┌─────────────────┐ ┌───────────────┐ ┌─────────────────┐
   │ Schema / Custom │ │ Deduplication │ │ Monotonic ULID  │
   │   Validation    │ │  Key Lookup   │ │   Generation    │
   └─────────────────┘ └───────────────┘ └─────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
   ┌────────────────────────────────────────────────────────┐
   │             Atomic SQLite Commit (WAL)                 │
   │  1. Append to `events` table (id, type, payload)       │
   │  2. Execute synchronous read-model projections         │
   │  3. Enqueue transactional side-effects in outbox       │
   └───────────────────────────┬────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
   ┌─────────────────┐                   ┌─────────────────┐
   │  Live Streams   │                   │  Async Outbox   │
   │ & Subscriptions │                   │ Side-Effects    │
   └─────────────────┘                   └─────────────────┘
```
