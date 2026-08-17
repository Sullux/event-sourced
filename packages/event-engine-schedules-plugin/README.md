# @sullux/event-engine-schedules-plugin

Cron schedules, delayed event triggers, and resilient timer plugin for `@sullux/event-engine`.

## Documentation

Full documentation, guides, and schema references are available at:
[https://sullux.com/projects/event-sourced/event-engine-schedules-plugin/](https://sullux.com/projects/event-sourced/event-engine-schedules-plugin/)

## Installation

```bash
npm install @sullux/event-engine @sullux/event-engine-schedules-plugin
# or
yarn add @sullux/event-engine @sullux/event-engine-schedules-plugin
```

## Quick Start

```javascript
const { EventEngine } = require('@sullux/event-engine')
const schedulesPlugin = require('@sullux/event-engine-schedules-plugin')

const main = async () => {
  const engine = EventEngine({ databasePath: './events.db' })
  engine.registerPlugin(schedulesPlugin)

  // Register a recurring daily cron schedule
  const schedule = await engine.ingress('schedule.registered@1.0.0', {
    scheduleId: 'sched_daily_backup',
    cron: '0 0 * * *',
    targetEventType: 'system.backup.requested@1.0.0',
    targetPayload: { full: true },
    enabled: true,
  })

  console.log('Schedule registered:', schedule.id)
}

main()
```

## Contributing

Contributions are welcome! Please ensure all code adheres to project guidelines (Vanilla JS, functional factories, zero external dependencies, 100% test coverage).

```bash
yarn test
```

## License

[MIT](https://sullux.com/projects/event-sourced/event-engine-schedules-plugin/LICENSE) © 2026 Charles Sullivan
