# Plugin Integration: Real-World Example

To understand how `@sullux/event-ontology` powers real-world event-driven systems, let's explore `@sullux/event-engine-files-plugin` as the reference implementation.

---

## Architectural Breakdown of `files-plugin`

The `files-plugin` provides Content-Addressable Storage (CAS), blob chunking, directory hierarchies, and file sharing for `@sullux/event-engine`.

Its directory layout is cleanly partitioned into declarative YAML files under `src/`:

```
event-engine-files-plugin/
├── src/
│   ├── file.yaml                          # Domain base & UUID schemas
│   ├── file.blob.yaml                     # CAS blob entity schema & DDL
│   ├── file.blob.registered@1.0.0.yaml    # Blob registration event
│   ├── file.blob.chunk.uploaded@1.0.0.yaml# Multipart upload chunk
│   ├── file.blob.verified@1.0.0.yaml      # Hash verification event
│   ├── file.directory.created@1.0.0.yaml  # VFS directory hierarchy
│   ├── file.link.yaml                     # Symlink/hardlink entity
│   ├── file.share.created@1.0.0.yaml      # Access control & link sharing
│   └── utils.js                           # Custom validation helpers
├── build.js
└── package.json
```

---

## 1. Domain Base Schema (`file.yaml`)

`file.yaml` establishes shared validation types across all file-related events:

```yaml
description: |
  The file library defines content-addressable storage (CAS) and virtual filesystems (VFS).

persisted: true
replicated: true

$defs:
  uuid:
    type: string
    minLength: 1
```

---

## 2. Entity Schema with DDL Projections (`file.blob.yaml`)

`file.blob.yaml` inherits from `file.yaml` using `$merge: file` and declares projection database tables:

```yaml
$merge: file
description: |
  A Blob is an immutable binary asset stored in Content-Addressable Storage.

$partitionKey: "({ blobId }) => 'blob#' + blobId"
$deduplicationId: blobId

type: object
properties:
  blobId:
    type: string
    description: Content hash (e.g. SHA-256 or BLAKE3).
  sizeInBytes:
    type: number
    description: Total byte length.
  contentType:
    type: string
  type:
    type: string
    enum: [raw, manifest]

required: [blobId, sizeInBytes]
additionalProperties: false

$dbSchema:
  blobs:
    tableName: file_blobs
    columns:
      blobId:
        name: blob_id
        dbtype: "varchar(64) PRIMARY KEY"
      sizeInBytes:
        name: size_in_bytes
        dbtype: "integer NOT NULL"
      contentType:
        name: content_type
        dbtype: "varchar(64)"
      type: "varchar(16) DEFAULT 'raw'"
```

---

## 3. Versioned Event Definition (`file.blob.chunk.uploaded@1.0.0.yaml`)

Event definitions inherit from the base domain or entity, defining specific event payload properties and compound deduplication keys:

```yaml
$merge: file
description: |
  Emitted when a chunk of a multipart blob write is successfully ingested.

$partitionKey: "({ blobId }) => 'blob#' + blobId"
$deduplicationId: "({ blobId, offset }) => blobId + '#' + offset"

type: object
properties:
  blobId:
    type: string
  offset:
    type: number
  bytes:
    type: number
  sha256:
    type: string

required: [blobId, offset, bytes]
additionalProperties: false
```

---

## 4. Build Automation (`build.js`)

In the plugin's `build.js`, `event-ontology build` is executed automatically before staging:

```javascript
const { execSync } = require('node:child_process')

// Automatically compile YAML definitions to dist/ and docs/
execSync('npx event-ontology build', { stdio: 'inherit' })
```

When built:
1. `dist/index.js` contains the compiled JS plugin definitions with pre-compiled Ajv schema validation.
2. `dist/schema.sql` contains the SQL `CREATE TABLE IF NOT EXISTS file_blobs (...)` statement.
3. `dist/ddl.js` exports `applyDdl(db)` to initialize tables on engine startup.
4. Consumers simply `engine.registerPlugin(filesPlugin)` and call `engine.ingress(...)`.
