# @sullux/event-ontology

YAML-based event ontology compiler, validator, and projection DDL generator toolchain for `@sullux/event-engine`.

`@sullux/event-ontology` compiles declarative YAML event schema definitions into production-ready JavaScript plugin modules, SQLite projection DDL scripts, Ajv JSON Schema validators, and GitBook-compatible documentation.

## Documentation

Full documentation, guides, and API references are available at:
[https://sullux.com/projects/event-sourced/event-ontology/](https://sullux.com/projects/event-sourced/event-ontology/)

## Installation

```bash
npm install @sullux/event-ontology
# or
yarn add @sullux/event-ontology
```

## Quick Start

Create an event definition in `src/user.created@1.0.0.yaml`:

```yaml
description: Emitted when a new user account is registered.

$partitionKey: "({ userId }) => 'user#' + userId"
$deduplicationId: userId

type: object
properties:
  userId:
    type: string
  email:
    type: string
  createdAt:
    type: number

required: [userId, email, createdAt]
additionalProperties: false

$dbSchema:
  users:
    tableName: users
    columns:
      userId:
        name: user_id
        dbtype: "varchar(64) PRIMARY KEY"
      email:
        name: email
        dbtype: "varchar(255) NOT NULL"
      createdAt:
        name: created_at
        dbtype: "integer NOT NULL"
```

Compile the ontology into artifacts:

```bash
npx event-ontology build
```

This compiles:
- `dist/index.js` - Complete JS plugin for `@sullux/event-engine`
- `dist/schema.sql` - Projection database DDL statements
- `dist/ddl.js` - Programmatic DDL migration helper
- `docs/README.md` - Generated markdown schema reference

## Contributing

Contributions are welcome! Please ensure all code adheres to project guidelines (Vanilla JS, functional factories, zero external dependencies where possible, 100% test coverage).

```bash
yarn test
```

## License

[MIT](https://sullux.com/projects/event-sourced/event-ontology/LICENSE) © 2026 Charles Sullivan
