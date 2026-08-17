# CLI Reference

`@sullux/event-ontology` provides a fast command-line interface for compiling and watching domain ontologies.

---

## Global Options & Syntax

```bash
npx event-ontology <command> [options]
```

### Options

| Flag | Shorthand / Alternative | Default | Description |
| :--- | :--- | :--- | :--- |
| `--src <dir>` | `-s` | `./src` | Directory containing YAML definitions and helper scripts |
| `--dist <dir>` | `-d` | `./dist` | Destination directory for compiled JS plugin and SQL DDL |
| `--docs <dir>` | `-o` | `./docs` | Destination directory for generated markdown schema docs |

---

## Commands

### `build`
Compiles all YAML files in `--src` once into distribution artifacts.

```bash
# Default paths (src -> dist, docs)
npx event-ontology build

# Custom directory layout
npx event-ontology build --src ./ontology --dist ./build/dist --docs ./docs/reference
```

### `watch`
Compiles the ontology immediately and then watches `--src` recursively, rebuilding on every file change.

```bash
npx event-ontology watch
```

Output:

```
[event-ontology] Build successful:
  JS Plugin -> dist/index.js
  SQL DDL   -> dist/schema.sql
  Docs      -> docs/README.md
[event-ontology] Watching for changes in ./src...
[event-ontology] File changed (user.created@1.0.0.yaml), rebuilding...
[event-ontology] Build successful:
  JS Plugin -> dist/index.js
  SQL DDL   -> dist/schema.sql
  Docs      -> docs/README.md
```
