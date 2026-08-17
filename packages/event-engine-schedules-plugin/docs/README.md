# Introduction to Event Engine Schedules Plugin

`@sullux/event-engine-schedules-plugin` provides deterministic, crash-resilient timer and cron scheduling for `@sullux/event-engine`.

Unlike in-memory timers (`setTimeout`/`setInterval`) that vanish on server restarts, schedule registrations in this plugin are persistent, immutable events stored in SQLite. The schedule runner monitors deadlines, handles leap years and timezone shifts, emits `schedule.triggered` events, and records missed execution recovery automatically.

---

## Supported Scheduling Patterns

* **Standard Cron Expressions**: Daily, hourly, weekly, or custom cron patterns (`0 0 * * *`).
* **Delayed Event Ingress**: Fire a one-time event after a specified delay or exact timestamp in the future (e.g. email reminders, trial expiration checks).
* **Pause & Resume**: Temporarily pause recurring schedules (`schedule.paused`) and resume them (`schedule.resumed`) without losing configuration.
* **Missed Execution Recovery**: If the host machine was offline during a scheduled trigger window, the plugin evaluates whether to trigger immediate catch-up or log a `schedule.missed` event based on configured policies.
