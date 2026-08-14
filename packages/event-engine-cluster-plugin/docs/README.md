# Domain Ontology Reference

Auto-generated documentation from YAML ontology definition files.

---

## Table of Contents

- [cluster](#cluster)
- [cluster.ack.emitted@1.0.0](#clusterackemitted100)
- [cluster.proposal.emitted@1.0.0](#clusterproposalemitted100)
- [cluster.sync.requested@1.0.0](#clustersyncrequested100)

---

<a name="cluster"></a>

### cluster

Core event definitions for leaderless quorum mesh cluster replication.


<a name="clusterackemitted100"></a>

### cluster.ack.emitted@1.0.0

Emitted when a peer node acknowledges receipt of a proposed event.

#### Properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `eventId` | `string` | Yes | ULID of the acknowledged event. |
| `status` | `string` | No | Status of acknowledgment. |


<a name="clusterproposalemitted100"></a>

### cluster.proposal.emitted@1.0.0

Emitted when a cluster node proposes an event to peers for quorum consensus.

#### Properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `event` | `object` | Yes | The proposed event object. |


<a name="clustersyncrequested100"></a>

### cluster.sync.requested@1.0.0

Emitted when a node requests catch-up sync from peer nodes.

#### Properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `fromUlid` | `string` | No | ULID threshold for catch-up query. |
