# Drivers & Storage Subsystems

`@sullux/event-engine` defines clean, swappable driver interfaces for database backends and file storage layers.

---

## Database Drivers (`db`)

Database drivers handle event persistence, projection execution, and transaction isolation.

### 1. SQLite Driver (`@sullux/event-engine/db/sqlite`)
The primary driver for local-first systems. Backed by `node:sqlite` with Write-Ahead Logging (WAL) and `IMMEDIATE` transaction locking.

```javascript
const { SqliteDb } = require('@sullux/event-engine/db/sqlite')

const db = SqliteDb({
  path: './events.db',
  wal: true,
})
```

### 2. In-Memory Driver (`@sullux/event-engine/db/memory`)
High-speed in-memory database driver for unit tests and ephemeral runtime simulations.

```javascript
const { MemoryDb } = require('@sullux/event-engine/db/memory')

const db = MemoryDb()
```

---

## File System Drivers (`fs`)

File system drivers provide content-addressable storage (CAS) and blob persistence.

### 1. Local Filesystem (`@sullux/event-engine/fs/local`)
Stores chunked blobs in local directories:

```javascript
const { LocalFs } = require('@sullux/event-engine/fs/local')

const fsDriver = LocalFs({
  rootPath: '/var/lib/coms/blobs',
})
```

### 2. S3 Compatible Storage (`@sullux/event-engine/fs/s3`)
Streams binary payloads to AWS S3, Cloudflare R2, or MinIO buckets:

```javascript
const { S3Fs } = require('@sullux/event-engine/fs/s3')

const s3Driver = S3Fs({
  bucket: 'my-event-blobs',
  endpoint: 'https://...',
})
```

### 3. In-Memory FS (`@sullux/event-engine/fs/memory`)
In-memory buffer storage for fast integration test isolation.
