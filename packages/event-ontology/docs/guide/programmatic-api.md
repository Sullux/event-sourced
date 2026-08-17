# Programmatic API Reference

In addition to the CLI, `@sullux/event-ontology` exports a programmatic Node.js API for custom build tools and in-memory compilation pipelines.

---

## Importing the API

```javascript
const {
  loadOntology,
  compilePluginCode,
  compileDdlSql,
  compileDdlJs,
  compileMarkdownDocs,
  buildOntology,
} = require('@sullux/event-ontology')
```

---

## `buildOntology(options)`

Executes the full end-to-end build pipeline, reading YAML files from disk and writing compiled files to the file system.

### Arguments

* `options` *(Object)*:
  * `options.srcDir` *(string)*: Source directory containing YAML files (default: `'./src'`).
  * `options.distDir` *(string)*: Destination directory for code and SQL (default: `'./dist'`).
  * `options.docsDir` *(string)*: Destination directory for markdown docs (default: `'./docs'`).

### Returns

* *(Object)*: `{ ontology, distDir, docsDir }`

### Example

```javascript
const { buildOntology } = require('@sullux/event-ontology')

buildOntology({
  srcDir: './src',
  distDir: './dist',
  docsDir: './docs/reference',
})
```

---

## `loadOntology(srcDir)`

Walks `srcDir`, reads all YAML definition files, resolves `$merge` inheritance hierarchies, and resolves helper JavaScript modules into a structured in-memory ontology representation.

### Returns

* *(Object)*:
  * `rawMap` *(Map)*: Unresolved definition objects mapped by name.
  * `resolvedMap` *(Map)*: Fully merged, resolved definition objects.
  * `helperFiles` *(Array)*: Discovered JS helper modules.
  * `srcDir` *(string)*: Absolute path to the source directory.

---

## `compilePluginCode(ontology, options)`

Compiles an in-memory ontology into executable JavaScript source code conforming to the `@sullux/event-engine` plugin specification.

```javascript
const ontology = loadOntology('./src')
const jsCode = compilePluginCode(ontology, { distDir: './dist' })
```

---

## `compileDdlSql(ontology)` & `compileDdlJs(ontology)`

Generates database projection DDL statements declared in `$dbSchema`.

* `compileDdlSql(ontology)`: Returns raw SQL `CREATE TABLE IF NOT EXISTS` string.
* `compileDdlJs(ontology)`: Returns JavaScript helper module exporting `applyDdl(db)`.

---

## `compileMarkdownDocs(ontology)`

Generates complete GitBook/Markdown reference tables for all entities, properties, and constraints in the ontology.

```javascript
const markdown = compileMarkdownDocs(ontology)
console.log(markdown)
```
