# YAML Schema Reference

`@sullux/event-ontology` definitions extend JSON Schema Draft 7 with domain-specific keywords for event sourcing, database projections, deduplication, and code generation.

---

## File Naming Conventions

The ontology loader categorizes YAML files based on their naming convention:

| File Pattern | Description | Example |
| :--- | :--- | :--- |
| `<namespace>.yaml` | Base domain definitions and shared `$defs` | `file.yaml`, `coms.yaml` |
| `<namespace>.<entity>.yaml` | Entity-level base schemas and `$dbSchema` | `file.blob.yaml`, `coms.contact.yaml` |
| `<type>@<semver>.yaml` | Versioned event definitions | `file.blob.uploaded@1.0.0.yaml` |
| `<name>.js` | Helper scripts auto-injected into `context` | `utils.js` |

---

## Schema Composition with `$merge`

Use `$merge` to inherit properties, required fields, and configuration from parent definitions.

```yaml
$merge: file.blob
description: Emitted when a blob upload finishes.
properties:
  sha256:
    type: string
```

When compiled, child properties are deep-merged with parent properties. Arrays and `$defs` are preserved and merged cleanly.

---

## Special Keywords Reference

### `$partitionKey`
Defines how events are partitioned across workers or cluster nodes. Can be either a property name string or a JavaScript arrow function expression:

```yaml
# Property name shorthand:
$partitionKey: userId

# Custom arrow function:
$partitionKey: "({ tenantId, accountId }) => `${tenantId}#${accountId}`"
```

### `$deduplicationId`
Defines the unique idempotency key for event deduplication. Ingress attempts with matching deduplication IDs within the deduplication window return the existing event instead of creating duplicates.

```yaml
# Property shorthand (defaults to payload.id):
$deduplicationId: blobId

# Custom expression:
$deduplicationId: "({ fileId, version }) => `${fileId}@${version}`"
```

### `$factory`
Generates a typed payload constructor. Set to `true` to generate a standard passthrough factory `(payload) => ({ ...payload })`, or supply a custom JS function string.

```yaml
$factory: "(blobId, sizeInBytes) => ({ blobId, sizeInBytes, uploadedAt: Date.now() })"
```

### `$validate`
Custom JavaScript validation hook for multi-field cross-validation or asynchronous database checks:

```yaml
$validate: |
  (payload, db, context) => {
    const errors = []
    if (payload.startAt >= payload.endAt) {
      errors.push('startAt must be strictly before endAt')
    }
    return errors
  }
```

### `$dbSchema`
Defines database projection tables, column names, and SQLite/PostgreSQL SQL types.

```yaml
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
```

### `$projections`
JavaScript projection function that runs synchronously when the event is appended to update read tables.

```yaml
$projections: |
  async (event, db, context) => {
    await db.query(
      'INSERT OR REPLACE INTO file_blobs (blob_id, size_in_bytes) VALUES (?, ?)',
      [event.payload.blobId, event.payload.sizeInBytes]
    )
  }
```

### `$sideeffects`
JavaScript transactional outbox side-effect handler triggered asynchronously when the event is committed.

```yaml
$sideeffects: |
  async (event, context) => {
    await context.utils.notifyWebhooks(event)
  }
```

### `persisted` & `replicated`
Boolean flags to control storage and cluster replication behavior:

```yaml
# Ephemeral events (e.g. heartbeat pings) that notify active listeners but do not persist to SQLite:
persisted: false

# Local-only events that should not replicate across cluster mesh nodes:
replicated: false
```
