# Quick Start

Get started scheduling events with `@sullux/event-engine-schedules-plugin`.

---

## 1. Installation

```bash
npm install @sullux/event-engine @sullux/event-engine-schedules-plugin
# or
yarn add @sullux/event-engine @sullux/event-engine-schedules-plugin
```

---

## 2. Registering a Schedule

```javascript
const { EventEngine } = require('@sullux/event-engine')
const schedulesPlugin = require('@sullux/event-engine-schedules-plugin')

const main = async () => {
  const engine = EventEngine({ databasePath: './events.db' })
  engine.registerPlugin(schedulesPlugin)

  // 1. One-time delayed trigger (fires in 1 hour)
  await engine.ingress('schedule.registered@1.0.0', {
    scheduleId: 'sched_trial_reminder_user_1',
    dueAt: Date.now() + (60 * 60 * 1000),
    targetEventType: 'notification.email.send@1.0.0',
    targetPayload: { userId: 'user_1', template: 'trial-ending' },
    enabled: true,
  })

  // 2. Recurring weekly report schedule
  await engine.ingress('schedule.registered@1.0.0', {
    scheduleId: 'sched_weekly_summary',
    cron: '0 9 * * 1', // Mondays at 9:00 AM
    targetEventType: 'report.summary.generated@1.0.0',
    targetPayload: { type: 'weekly' },
    enabled: true,
  })
}

main()
```
