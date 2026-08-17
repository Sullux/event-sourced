# Introduction to Event Ontology

`@sullux/event-ontology` is a declarative, schema-driven toolchain for building, validating, and projecting event-sourced domains in Node.js.

In event-driven and event-sourced architectures, maintaining parity between validation schemas (Ajv/JSON Schema), database projection DDLs (SQL tables and indexes), side-effect handlers, and documentation across multiple evolving versions is notoriously error-prone. 

`@sullux/event-ontology` solves this by introducing a **single source of truth** defined entirely in human-readable YAML definitions.

---

## Core Capabilities

* **Declarative Schemas**: Define domain entities and versioned events using standard JSON Schema syntax with clean, expressive YAML shorthand.
* **Schema Inheritance (`$merge`)**: Compose common structures, shared types, and domain metadata hierarchically without code duplication.
* **Zero-Runtime Plugin Compilation**: Generates self-contained, pre-compiled JavaScript modules ready to register directly into `@sullux/event-engine`.
* **Automated Projection DDL**: Automatically generates SQL `CREATE TABLE IF NOT EXISTS` migration statements from the `$dbSchema` declarations on your events.
* **First-Class Partitioning & Deduplication**: Declare custom `$partitionKey` and `$deduplicationId` handlers directly in YAML expressions.
* **Automatic Documentation**: Compiles complete markdown ontology references directly from the inline YAML comments and properties.

---

## The Compilation Pipeline

```
  ┌────────────────────────────────────────────────────────┐
  │                   src/*.yaml files                     │
  │  (Domain types, Entity schemas, Versioned events)      │
  └───────────────────────────┬────────────────────────────┘
                              │
                    npx event-ontology build
                              │
             ┌────────────────┼────────────────┐
             ▼                ▼                ▼
     ┌───────────────┐ ┌──────────────┐ ┌──────────────┐
     │ dist/index.js │ │dist/schema.sql│ │docs/README.md│
     │ Event-Engine  │ │Database DDL  │ │ Domain Doc   │
     │    Plugin     │ │  Migrations  │ │  Reference   │
     └───────────────┘ └──────────────┘ └──────────────┘
```

---

## Next Steps

- Check out the [Quick Start Guide](getting-started/quick-start.md) to set up your first event ontology.
- Explore the [YAML Schema Reference](guide/yaml-schema.md) for full syntax details on `$merge`, `$partitionKey`, `$deduplicationId`, and `$dbSchema`.
- Learn how `@sullux/event-engine-files-plugin` uses `event-ontology` in [Plugin Integration](guide/plugin-integration.md).
