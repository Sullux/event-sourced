# Introduction to Event Engine Daemon

`@sullux/event-engine-daemon` provides process management, supervisor event loops, and plugin lifecycle orchestration for `@sullux/event-engine`.

In a distributed or edge deployment, plugins (such as email pollers, file chunk listeners, and cron schedulers) run inside long-lived daemon background processes. `@sullux/event-engine-daemon` makes this process lifecycle completely event-sourced: every startup request, successful initialization, plugin crash, and shutdown signal is captured as an immutable event in the engine ledger.

---

## Key Features

* **Event-Sourced Supervision**: Process and plugin state transitions are recorded as `daemon.start.requested`, `daemon.plugin.started`, `daemon.plugin.failed`, and `daemon.stopped`.
* **Graceful Signal Handling**: Traps `SIGINT`, `SIGTERM`, and `SIGHUP` to cleanly flush transactional outbox queues before exiting.
* **Fault Isolation**: Uncaught exceptions in plugin event loops emit failure events and trigger isolation or restart policies without corrupting SQLite state.
* **CLI & Service Management**: Ready to run as a systemd unit or containerized daemon.
