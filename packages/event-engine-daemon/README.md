# @sullux/event-engine-daemon

Daemon process runtime, plugin lifecycle supervisor, and background service manager for `@sullux/event-engine`.

## Documentation

Full documentation, guides, and schema references are available at:
[https://sullux.com/projects/event-sourced/event-engine-daemon/](https://sullux.com/projects/event-sourced/event-engine-daemon/)

## Installation

```bash
npm install -g @sullux/event-engine-daemon
# or as a local package
npm install @sullux/event-engine-daemon
```

## Quick Start

Start a daemon supervisor running configured plugins:

```bash
npx event-engine-daemon --plugins @sullux/event-engine-files-plugin,@sullux/event-engine-schedules-plugin
```

Or initialize programmatically:

```javascript
const { createDaemon } = require('@sullux/event-engine-daemon')

const main = async () => {
  const daemon = createDaemon({
    databasePath: './daemon.db',
    plugins: [
      require('@sullux/event-engine-files-plugin'),
    ],
  })

  await daemon.start()
  console.log('Daemon running PID:', process.pid)
}

main()
```

## Contributing

Contributions are welcome! Please ensure all code adheres to project guidelines (Vanilla JS, functional factories, zero external dependencies, 100% test coverage).

```bash
yarn test
```

## License

[MIT](https://sullux.com/projects/event-sourced/event-engine-daemon/LICENSE) © 2026 Charles Sullivan
