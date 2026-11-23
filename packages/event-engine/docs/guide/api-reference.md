# API Reference

Complete programmatic reference for `@sullux/event-engine`.

---

## `EventEngine(options)` Factory

Creates and initializes a new Event Engine instance.

### Options

* `options.databasePath` *(string)*: File path for persistent SQLite database.
* `options.db` *(Object)*: Custom database driver instance (defaults to SQLite).
* `options.fs` *(Object)*: Custom filesystem driver instance.
* `options.now` *(Function)*: Custom timestamp clock generator (defaults to `Date.now`).
* `options.ulid` *(Function)*: Custom monotonic ULID generator.

---

## Methods

### `engine.registerDefinition(definition)`
Registers an event schema definition:
* `definition.type` *(string)*: Event type name (e.g. `'user.created'`).
* `definition.version` *(string)*: Semantic version string (e.g. `'1.0.0'`).
* `definition.validate` *(Function)*: Sync/async validator function `(payload, db) => boolean`.
* `definition.deduplicationId` *(Function)*: Extract idempotency key `(payload) => string`.
* `definition.partitionKey` *(Function)*: Extract partition key `(payload) => string`.
* `definition.persisted` *(boolean)*: Whether to write to disk (default: `true`).

### `engine.registerPlugin(plugin)`
Registers a pre-compiled plugin containing definitions, projections, side-effects, and upcasters.

### `engine.ingress(typeAndVersion, payload, options)`
Validates, assigns a ULID, and atomically appends an event to the ledger.

### `engine.subscribe(options)`
Registers an active or passive event subscriber:
* `options.predicate` *(Object)*: Query filter expression.
* `options.catchUp` *(boolean)*: Whether to replay historical events before going live.
* `options.since` *(string)*: Replay starting ULID cursor.
* `options.handler` *(Function)*: Async callback `async (event) => void`.

Returns an `unsubscribe()` function.

### `engine.query(options)`
Performs a bounded one-off query returning matching events array.

### `engine.replay(options)`
Streams historical events matching time bounds or predicates.

### `engine.flush()`
Cancels any deferred side-effect drain timer and awaits completion of all pending outbox side-effects.

### `engine.close()`
Flushes pending side-effects, flushes any pending backup checkpoint, and cleanly closes the database connection.
