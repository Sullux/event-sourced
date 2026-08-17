# Process Lifecycle & Supervisor

The daemon models its entire runtime lifecycle as formal state transitions ingressed into `@sullux/event-engine`.

---

## State Transition Events

```
                     ┌──────────────────────────────┐
                     │  daemon.start.requested      │
                     └──────────────┬───────────────┘
                                    │
                     ┌──────────────▼───────────────┐
                     │  daemon.started              │
                     └──────────────┬───────────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              ▼                                           ▼
   ┌───────────────────────────────┐           ┌───────────────────────────────┐
   │ daemon.plugin.start.requested │           │ daemon.plugin.failed          │
   └──────────────┬────────────────┘           └───────────────────────────────┘
                  │
   ┌──────────────▼────────────────┐
   │ daemon.plugin.started         │
   └──────────────┬────────────────┘
                  │
   ┌──────────────▼────────────────┐
   │ daemon.stop.requested         │
   └──────────────┬────────────────┘
                  │
   ┌──────────────▼────────────────┐
   │ daemon.stopped                │
   └───────────────────────────────┘
```

---

## Graceful Shutdown Guarantee

When the operating system sends a termination signal (`SIGINT` or `SIGTERM`):

1. The supervisor ingresses `daemon.stop.requested@1.0.0`.
2. All active plugin side-effect workers receive a drain notification and finish processing in-flight jobs.
3. The engine flushes all uncommitted WAL frames and side-effect checkpoint cursors to SQLite.
4. The supervisor ingresses `daemon.stopped@1.0.0` and terminates process execution cleanly with exit code `0`.
