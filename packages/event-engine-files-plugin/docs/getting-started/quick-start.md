# Quick Start

This guide demonstrates how to install `@sullux/event-engine-files-plugin`, apply its schema to SQLite, and ingress file events.

---

## 1. Installation

```bash
npm install @sullux/event-engine @sullux/event-engine-files-plugin
# or
yarn add @sullux/event-engine @sullux/event-engine-files-plugin
```

---

## 2. Setting Up the Engine

```javascript
const { EventEngine } = require('@sullux/event-engine')
const filesPlugin = require('@sullux/event-engine-files-plugin')
const { applyDdl } = require('@sullux/event-engine-files-plugin/dist/ddl')

const main = async () => {
  const engine = EventEngine({ databasePath: './files-app.db' })

  // Initialize SQLite projection tables
  await applyDdl(engine.db)

  // Register the compiled files ontology
  engine.registerPlugin(filesPlugin)

  // 1. Register a new binary asset
  const blob = await engine.ingress('file.blob.registered@1.0.0', {
    blobId: 'a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890',
    sizeInBytes: 2048,
    contentType: 'image/png',
    type: 'raw',
  })

  // 2. Create a virtual folder
  const folder = await engine.ingress('file.directory.created@1.0.0', {
    directoryId: 'dir_photos_2026',
    name: 'Photos 2026',
    parentId: null,
  })

  // 3. Link the blob into the directory
  const fileLink = await engine.ingress('file.link.created@1.0.0', {
    linkId: 'link_logo_png',
    directoryId: 'dir_photos_2026',
    name: 'logo.png',
    blobId: blob.payload.blobId,
  })

  console.log('File successfully linked:', fileLink.id)
}

main()
```
