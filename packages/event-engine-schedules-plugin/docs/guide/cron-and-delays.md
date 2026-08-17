# Cron Expressions & Delayed Triggers

The `schedules-plugin` tracks scheduled deadlines and manages execution states over time.

---

## State Lifecycle Events

* `schedule.registered@1.0.0`: Registers a new cron pattern or future timestamp.
* `schedule.triggered@1.0.0`: Emitted when the runner fires the scheduled deadline.
* `schedule.completed@1.0.0`: Emitted when the target event finishes successfully.
* `schedule.failed@1.0.0`: Emitted if target execution throws an error.
* `schedule.missed@1.0.0`: Emitted when downtime prevented firing during the scheduled window.
* `schedule.paused@1.0.0` / `schedule.resumed@1.0.0`: Toggles active execution state.
* `schedule.cancelled@1.0.0`: Permanently cancels the schedule.

---

## Missed Window Policies

When an engine instance restarts after downtime, it inspects all enabled schedules:

```javascript
// Example: If a schedule was due during downtime, trigger immediately if catchUp is enabled
if (schedule.catchUp && schedule.dueAt < Date.now()) {
  await engine.ingress('schedule.triggered@1.0.0', {
    scheduleId: schedule.scheduleId,
    firedAt: Date.now(),
    missedCount: 1,
  })
}
```
