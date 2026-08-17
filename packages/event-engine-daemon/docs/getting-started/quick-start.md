# Quick Start

Get started running plugins inside an event-sourced daemon process.

---

## 1. CLI Execution

You can run the daemon directly from the command line:

```bash
npx event-engine-daemon --db ./var/events.db --plugins @sullux/event-engine-files-plugin
```

### CLI Flags

| Flag | Default | Description |
| :--- | :--- | :--- |
| `--db <path>` | `./events.db` | File path to persistent SQLite database |
| `--plugins <list>` | `""` | Comma-separated list of plugin package names or paths |
| `--log-level <lvl>` | `info` | Logging verbosity (`debug`, `info`, `warn`, `error`) |

---

## 2. Programmatic Supervisor Execution

```javascript
const { createDaemon } = require('@sullux/event-engine-daemon')

const main = async () => {
  const daemon = createDaemon({
    databasePath: './events.db',
    plugins: [
      require('@sullux/event-engine-files-plugin'),
      require('@sullux/event-engine-schedules-plugin'),
    ],
  })

  // Start the supervisor loop
  await daemon.start()

  console.log('Daemon supervisor started successfully.')
}

main()
```
