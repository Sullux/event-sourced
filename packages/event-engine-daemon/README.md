# @sullux/coms-lake

A high-performance, local-first, event-sourced data lake that serves as the single source of truth for the Coms communication ecosystem. It runs locally as an immutable transaction ledger using Node's native SQLite capability in Write-Ahead Log (WAL) mode.

---

## Architecture Overview

`coms-lake` enforces a strictly decoupled, event-sourced schema layout. Communication adapters (like email daemons or SMS bridges) emit immutable events to the lake over a high-performance local Unix Domain Socket IPC interface.

```
                  [ Emitters / Client UI ]
                             │
                             ▼  (IPC Socket: /tmp/coms-lake.sock)
                    [ coms-lake-server ]
                             │
            ┌────────────────┴────────────────┐
            ▼ (Strict Ajv Validation)         ▼ (JSON-L Broadcast)
   [ Immutable SQLite Ledger ]           [ Real-time Subscribers ]
```

### Core Design Principles:
* **Zero-dependency SQLite Engine:** Leverages the native, pre-compiled `node:sqlite` (`DatabaseSync` API) to eliminate heavy C++ rebuilds.
* **Network & Storage Efficiency:** Employs Write-Ahead Logging (WAL) for ultra-fast, concurrent non-blocking reads (writes complete in `<2ms`).
* **Strict Schema Verification:** Incorporates high-performance `ajv` validators to strictly inspect, validate, and register structured JSON schemas before persisting events.
* **Decoupled Subscriber Cursor Tracking:** Subscriber bookmarks (cursors) are tracked out-of-band in a separate table, preventing index-bloat in the immutable ledger.

---

## Quick Start

### 1. Launch the IPC Server
By default, the server listens on `/tmp/coms-lake.sock` and persists the ledger to `coms.db`.

```bash
# From workspace root
yarn workspace @sullux/coms-lake start
```

#### Environment Variables:
* `COMS_LAKE_SOCKET`: Custom path to the Unix Domain Socket (Default: `/tmp/coms-lake.sock`).
* `COMS_DB_PATH`: Custom path to the SQLite ledger (Default: `coms.db`).

### 2. Connect from Client Code
```javascript
const { LakeClient } = require('@sullux/coms-lake')

const client = LakeClient({ socketPath: '/tmp/coms-lake.sock' })

async function run() {
  // Append an event
  const res = await client.append('coms.actor.created', '1.0.0', {
    id: '01H4AB1Z7R9B2G8H9M11AA',
    name: 'Charles Sullivan',
    type: 'individual'
  })
  console.log('Event persisted:', res.id)
}
run()
```

---

## Client API Reference

The `coms-lake` package exports `LakeClient()`, which provides four primary promise-based actions:

### `append(type, version, payload)`
Validates, envelopes, and commits an event to the ledger.
* **`type`**: Dotted namespace identifier (e.g. `coms.interaction.emitted`).
* **`version`**: Semantic version string (e.g. `1.0.0`).
* **`payload`**: The raw domain object containing the event details.
* **Returns**: A receipt containing the assigned sequential `id` (ULID), `deduplicationId`, `partitionKey`, and write `timestamp`.

### `subscribe({ subscriberName, lastProcessedId, onEvent, onError })`
Starts a real-time, push-based JSON-Lines stream subscription over the Unix Domain socket. If the subscriber falls behind, the server automatically catches it up from the database ledger first.
* **`subscriberName`**: The unique cursor identifier of the subscriber.
* **`lastProcessedId`**: Optional starting ULID.
* **`onEvent(event)`**: Callback invoked for every incoming event in exact sequence.
* **`onError(error)`**: Callback invoked on socket failures.

### `commitCursor(subscriberName, lastProcessedId)`
Saves the subscriber's progress bookmark to the ledger.
* **Returns**: `{ success: true }`.

### `getCursor(subscriberName)`
Retrieves the last committed sequence bookmark for the given subscriber.
* **Returns**: The sequential `lastProcessedId` (ULID) or `null`.

---

## IPC JSON-Lines Protocol

For polyglot support (e.g. Zig, Rust, Python), the IPC server communicates using a lightweight, newline-delimited JSON-Lines protocol.

### 1. Send an Append Request
Send a single JSON line to the socket ending with `\n`:
```json
{"action":"append","type":"coms.actor.created","version":"1.0.0","payload":{"id":"01H4AB1Z7R9B","name":"Charles","type":"individual"}}
```
The server responds with a single line response:
```json
{"id":"01H3ZX9Y2K7R9B2G8H9M","status":"ok","receipt":{"id":"01H3ZX9Y2K7R9B2G8H9M","deduplicationId":"01H4AB1Z7R9B","partitionKey":"actor#01H4AB1Z7R9B","timestamp":1719273600000}}
```

### 2. Register a Subscription
Send a subscribe command line:
```json
{"action":"subscribe","subscriberName":"my_daemon_cursor","lastProcessedId":"01H3ZX9Y2K7R9B2G8H9M"}
```
The server will pipe matching ledger events down the socket line-by-line as they occur:
```json
{"id":"01H3ZX9Y2K7R9B2G8H9M","type":"coms.actor.created","version":"1.0.0","payload":{...}}
```
