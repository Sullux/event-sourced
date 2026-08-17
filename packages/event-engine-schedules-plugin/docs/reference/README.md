# Domain Ontology Reference

Auto-generated documentation from YAML ontology definition files.

---

## Table of Contents

- [schedule](#schedule)
- [schedule.cancelled@1.0.0](#schedulecancelled100)
- [schedule.completed@1.0.0](#schedulecompleted100)
- [schedule.failed@1.0.0](#schedulefailed100)
- [schedule.missed@1.0.0](#schedulemissed100)
- [schedule.paused@1.0.0](#schedulepaused100)
- [schedule.registered@1.0.0](#scheduleregistered100)
- [schedule.resumed@1.0.0](#scheduleresumed100)
- [schedule.triggered@1.0.0](#scheduletriggered100)
- [schedule.updated@1.0.0](#scheduleupdated100)

---

<a name="schedule"></a>

### schedule

The **`schedule`** library defines a complete ontology for event-sourced timers, cron expressions, delayed event dispatches, and job tracking.

#### Properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `scheduleId` | `string` | Yes | - |
| `name` | `string` | No | Human-readable schedule identifier or description. |
| `cron` | `string` | No | Standard 5-field cron expression (e.g. "0 9 * * *"). |
| `at` | `number` | No | Millisecond timestamp from epoch for one-off scheduled triggers. |
| `targetEvent` | `object` | Yes | The event type, version, and payload to emit when triggered. |
| `status` | `string` | No | - |

#### Database Schema

* **Table:** `engine_schedules`


<a name="schedulecancelled100"></a>

### schedule.cancelled@1.0.0

Emitted when a schedule is permanently cancelled.

#### Properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `scheduleId` | `string` | Yes | - |
| `name` | `string` | No | Human-readable schedule identifier or description. |
| `cron` | `string` | No | Standard 5-field cron expression (e.g. "0 9 * * *"). |
| `at` | `number` | No | Millisecond timestamp from epoch for one-off scheduled triggers. |
| `targetEvent` | `object` | No | The event type, version, and payload to emit when triggered. |
| `status` | `string` | No | - |
| `reason` | `string` | No | - |

#### Database Schema

* **Table:** `engine_schedules`


<a name="schedulecompleted100"></a>

### schedule.completed@1.0.0

Emitted when a triggered schedule's target event or action successfully completes execution.

#### Properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `scheduleId` | `string` | Yes | - |
| `name` | `string` | No | Human-readable schedule identifier or description. |
| `cron` | `string` | No | Standard 5-field cron expression (e.g. "0 9 * * *"). |
| `at` | `number` | No | Millisecond timestamp from epoch for one-off scheduled triggers. |
| `targetEvent` | `object` | No | The event type, version, and payload to emit when triggered. |
| `status` | `string` | No | - |
| `occurrenceTimestamp` | `number` | Yes | - |

#### Database Schema

* **Table:** `engine_schedules`


<a name="schedulefailed100"></a>

### schedule.failed@1.0.0

Emitted when a schedule execution fails, enabling retry or dead-letter handling.

#### Properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `scheduleId` | `string` | Yes | - |
| `name` | `string` | No | Human-readable schedule identifier or description. |
| `cron` | `string` | No | Standard 5-field cron expression (e.g. "0 9 * * *"). |
| `at` | `number` | No | Millisecond timestamp from epoch for one-off scheduled triggers. |
| `targetEvent` | `object` | No | The event type, version, and payload to emit when triggered. |
| `status` | `string` | No | - |
| `occurrenceTimestamp` | `number` | Yes | - |
| `error` | `string` | Yes | - |

#### Database Schema

* **Table:** `engine_schedules`


<a name="schedulemissed100"></a>

### schedule.missed@1.0.0

Emitted when an offline system recovers and detects missed execution windows.

#### Properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `scheduleId` | `string` | Yes | - |
| `name` | `string` | No | Human-readable schedule identifier or description. |
| `cron` | `string` | No | Standard 5-field cron expression (e.g. "0 9 * * *"). |
| `at` | `number` | No | Millisecond timestamp from epoch for one-off scheduled triggers. |
| `targetEvent` | `object` | No | The event type, version, and payload to emit when triggered. |
| `status` | `string` | No | - |
| `occurrenceTimestamp` | `number` | Yes | - |

#### Database Schema

* **Table:** `engine_schedules`


<a name="schedulepaused100"></a>

### schedule.paused@1.0.0

Emitted when an active schedule is temporarily paused.

#### Properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `scheduleId` | `string` | Yes | - |
| `name` | `string` | No | Human-readable schedule identifier or description. |
| `cron` | `string` | No | Standard 5-field cron expression (e.g. "0 9 * * *"). |
| `at` | `number` | No | Millisecond timestamp from epoch for one-off scheduled triggers. |
| `targetEvent` | `object` | No | The event type, version, and payload to emit when triggered. |
| `status` | `string` | No | - |
| `reason` | `string` | No | - |

#### Database Schema

* **Table:** `engine_schedules`


<a name="scheduleregistered100"></a>

### schedule.registered@1.0.0

Emitted when a new delayed or recurring schedule is registered in the engine.

#### Properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `scheduleId` | `string` | Yes | - |
| `name` | `string` | No | Human-readable schedule identifier or description. |
| `cron` | `string` | No | Standard 5-field cron expression (e.g. "0 9 * * *"). |
| `at` | `number` | No | Millisecond timestamp from epoch for one-off scheduled triggers. |
| `targetEvent` | `object` | Yes | The event type, version, and payload to emit when triggered. |
| `status` | `string` | No | - |

#### Database Schema

* **Table:** `engine_schedules`


<a name="scheduleresumed100"></a>

### schedule.resumed@1.0.0

Emitted when a paused schedule is resumed.

#### Properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `scheduleId` | `string` | Yes | - |
| `name` | `string` | No | Human-readable schedule identifier or description. |
| `cron` | `string` | No | Standard 5-field cron expression (e.g. "0 9 * * *"). |
| `at` | `number` | No | Millisecond timestamp from epoch for one-off scheduled triggers. |
| `targetEvent` | `object` | No | The event type, version, and payload to emit when triggered. |
| `status` | `string` | No | - |

#### Database Schema

* **Table:** `engine_schedules`


<a name="scheduletriggered100"></a>

### schedule.triggered@1.0.0

Emitted by a scheduler node when time T arrives. Carries the occurrence timestamp and target event payload.

#### Properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `scheduleId` | `string` | Yes | - |
| `name` | `string` | No | Human-readable schedule identifier or description. |
| `cron` | `string` | No | Standard 5-field cron expression (e.g. "0 9 * * *"). |
| `at` | `number` | No | Millisecond timestamp from epoch for one-off scheduled triggers. |
| `targetEvent` | `object` | Yes | The event type, version, and payload to emit when triggered. |
| `status` | `string` | No | - |
| `occurrenceTimestamp` | `number` | Yes | Epoch millisecond timestamp of this specific trigger occurrence. |

#### Database Schema

* **Table:** `engine_schedules`


<a name="scheduleupdated100"></a>

### schedule.updated@1.0.0

Emitted when an active schedule's cron expression, target timestamp, or target event is updated.

#### Properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `scheduleId` | `string` | Yes | - |
| `name` | `string` | No | Human-readable schedule identifier or description. |
| `cron` | `string` | No | Standard 5-field cron expression (e.g. "0 9 * * *"). |
| `at` | `number` | No | Millisecond timestamp from epoch for one-off scheduled triggers. |
| `targetEvent` | `object` | No | The event type, version, and payload to emit when triggered. |
| `status` | `string` | No | - |

#### Database Schema

* **Table:** `engine_schedules`
