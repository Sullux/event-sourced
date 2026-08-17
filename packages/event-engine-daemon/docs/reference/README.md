# Domain Ontology Reference

Auto-generated documentation from YAML ontology definition files.

---

## Table of Contents

- [daemon](#daemon)
- [daemon.plugin.failed@1.0.0](#daemonpluginfailed100)
- [daemon.plugin.start.requested@1.0.0](#daemonpluginstartrequested100)
- [daemon.plugin.started@1.0.0](#daemonpluginstarted100)
- [daemon.plugin.stop.requested@1.0.0](#daemonpluginstoprequested100)
- [daemon.plugin.stopped@1.0.0](#daemonpluginstopped100)
- [daemon.start.requested@1.0.0](#daemonstartrequested100)
- [daemon.started@1.0.0](#daemonstarted100)
- [daemon.stop.requested@1.0.0](#daemonstoprequested100)
- [daemon.stopped@1.0.0](#daemonstopped100)

---

<a name="daemon"></a>

### daemon

The **`daemon`** domain defines event-sourced lifecycle events for the `@sullux/event-engine-daemon` runner and its registered plugins.


<a name="daemonpluginfailed100"></a>

### daemon.plugin.failed@1.0.0

Emitted by a plugin if it encounters an unrecoverable failure during startup or runtime.

#### Properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `plugin` | `ref (#/$defs/pluginName)` | Yes | - |
| `reason` | `string` | Yes | - |
| `failedAt` | `number` | Yes | - |


<a name="daemonpluginstartrequested100"></a>

### daemon.plugin.start.requested@1.0.0

Emitted to signal a specific plugin to perform its startup logic.

#### Properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `plugin` | `ref (#/$defs/pluginName)` | Yes | - |
| `config` | `object` | No | - |


<a name="daemonpluginstarted100"></a>

### daemon.plugin.started@1.0.0

Emitted by a plugin to indicate it has completed its initialization.

#### Properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `plugin` | `ref (#/$defs/pluginName)` | Yes | - |
| `startedAt` | `number` | Yes | - |


<a name="daemonpluginstoprequested100"></a>

### daemon.plugin.stop.requested@1.0.0

Emitted to signal a specific plugin to perform its shutdown/cleanup logic.

#### Properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `plugin` | `ref (#/$defs/pluginName)` | Yes | - |


<a name="daemonpluginstopped100"></a>

### daemon.plugin.stopped@1.0.0

Emitted by a plugin to confirm it has finished its cleanup and stopped.

#### Properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `plugin` | `ref (#/$defs/pluginName)` | Yes | - |
| `stoppedAt` | `number` | Yes | - |


<a name="daemonstartrequested100"></a>

### daemon.start.requested@1.0.0

Emitted when the daemon process begins its boot sequence.

#### Properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `plugins` | `array` | Yes | - |


<a name="daemonstarted100"></a>

### daemon.started@1.0.0

Emitted when all configured plugins have successfully started and the daemon is fully operational.

#### Properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `plugins` | `array` | Yes | - |
| `startedAt` | `number` | Yes | - |


<a name="daemonstoprequested100"></a>

### daemon.stop.requested@1.0.0

Emitted when shutdown of the daemon process is initiated.

#### Properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `reason` | `string` | No | - |


<a name="daemonstopped100"></a>

### daemon.stopped@1.0.0

Emitted when all plugins have stopped and the daemon process completes shutdown.

#### Properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `stoppedAt` | `number` | Yes | - |
