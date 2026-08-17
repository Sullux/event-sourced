# @sullux/event-engine-files-plugin

File storage, Content-Addressable Storage (CAS) blob chunking, virtual directory trees, and versioning ontology plugin for `@sullux/event-engine`.

## Documentation

Full documentation, guides, and schema references are available at:
[https://sullux.com/projects/event-sourced/event-engine-files-plugin/](https://sullux.com/projects/event-sourced/event-engine-files-plugin/)

## Installation

```bash
npm install @sullux/event-engine @sullux/event-engine-files-plugin
# or
yarn add @sullux/event-engine @sullux/event-engine-files-plugin
```

## Quick Start

```javascript
const { EventEngine } = require('@sullux/event-engine')
const filesPlugin = require('@sullux/event-engine-files-plugin')
const { applyDdl } = require('@sullux/event-engine-files-plugin/dist/ddl')

const main = async () => {
  const engine = EventEngine({ databasePath: './events.db' })

  // Initialize DB tables and register the plugin
  await applyDdl(engine.db)
  engine.registerPlugin(filesPlugin)

  // Ingress a blob registration event
  const blobEvent = await engine.ingress('file.blob.registered@1.0.0', {
    blobId: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    sizeInBytes: 1048576,
    contentType: 'application/pdf',
    type: 'raw',
  })

  console.log('Blob registered with event ID:', blobEvent.id)
}

main()
```

## Contributing

Contributions are welcome! Please ensure all code adheres to project guidelines (Vanilla JS, functional factories, zero external dependencies, 100% test coverage).

```bash
yarn test
```

## License

[MIT](https://sullux.com/projects/event-sourced/event-engine-files-plugin/LICENSE) © 2026 Charles Sullivan
