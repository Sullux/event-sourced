# Quick Start

This guide will walk you through creating an event ontology project from scratch, writing your first event definition, compiling it with `event-ontology`, and loading the resulting plugin into `@sullux/event-engine`.

---

## 1. Installation

Install `@sullux/event-ontology` and the engine runtime:

```bash
npm install @sullux/event-engine @sullux/event-ontology
# or with yarn
yarn add @sullux/event-engine @sullux/event-ontology
```

---

## 2. Directory Structure

A standard ontology package follows this structure:

```
my-domain-plugin/
├── src/
│   ├── account.yaml                     # Domain root types
│   ├── account.user.yaml                # Entity definition
│   └── account.user.created@1.0.0.yaml  # Versioned event
├── package.json
└── build.js
```

---

## 3. Writing YAML Definitions

### Base Domain Definition: `src/account.yaml`

```yaml
description: |
  Root domain definition for the Account management service.

persisted: true
replicated: true

$defs:
  uuid:
    type: string
    pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
```

### Entity Definition: `src/account.user.yaml`

```yaml
$merge: account
description: |
  A `User` entity representing an authenticated account holder.

$partitionKey: "({ userId }) => 'user#' + userId"
$deduplicationId: userId

type: object
properties:
  userId:
    $ref: uuid
  email:
    type: string
    format: email
  displayName:
    type: string
    minLength: 1

required: [userId, email, displayName]
additionalProperties: false

$dbSchema:
  users:
    tableName: users
    columns:
      userId:
        name: user_id
        dbtype: "varchar(36) PRIMARY KEY"
      email:
        name: email
        dbtype: "varchar(255) UNIQUE NOT NULL"
      displayName:
        name: display_name
        dbtype: "varchar(255) NOT NULL"
```

### Versioned Event: `src/account.user.created@1.0.0.yaml`

```yaml
$merge: account.user
description: |
  Emitted when a new user account is successfully registered.

properties:
  createdAt:
    type: number
    description: Milliseconds from epoch timestamp.

required: [userId, email, displayName, createdAt]
```

---

## 4. Compiling the Ontology

Run the `event-ontology` build command:

```bash
npx event-ontology build
```

You will see output similar to:

```
[event-ontology] Build successful:
  JS Plugin -> dist/index.js
  SQL DDL   -> dist/schema.sql
  Docs      -> docs/README.md
```

---

## 5. Registering with `@sullux/event-engine`

Now load your generated plugin into `@sullux/event-engine`:

```javascript
const { EventEngine } = require('@sullux/event-engine')
const accountPlugin = require('./dist')
const { applyDdl } = require('./dist/ddl')

const main = async () => {
  const engine = EventEngine()

  // 1. Apply auto-generated SQL DDL to SQLite/DB
  await applyDdl(engine.db)

  // 2. Register the compiled ontology plugin
  engine.registerPlugin(accountPlugin)

  // 3. Ingress typed, validated events
  const event = await engine.ingress('account.user.created@1.0.0', {
    userId: '123e4567-e89b-12d3-a456-426614174000',
    email: 'alice@example.com',
    displayName: 'Alice Cooper',
    createdAt: Date.now(),
  })

  console.log('Event successfully ingressed:', event.id)
}

main()
```
