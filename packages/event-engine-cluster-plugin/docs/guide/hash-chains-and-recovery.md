# Hash Chains & Node Recovery

Cryptographic hash chaining turns the append-only event ledger into an immutable Merkle log.

---

## SHA-256 Hash Chaining

For every replicated event $E_i$, its cryptographic hash $H_i$ is computed deterministically:

$$H_i = \text{SHA256}(H_{i-1} \parallel E_i.\text{id} \parallel E_i.\text{type} \parallel E_i.\text{timestamp} \parallel \text{JSON}(E_i.\text{payload}))$$

Where:
* $H_0$ is the genesis hash (`'0000000000000000000000000000000000000000000000000000000000000000'`).
* $H_{i-1}$ is the previous event's hash (`event.prevHash`).

This guarantees that no historical event can be modified, re-ordered, or injected without invalidating every subsequent event hash in the chain.

---

## Node Catch-Up Recovery (`assertConsistent`)

When a node reboots or reconnects after network downtime:

1. The node calls `cluster.assertConsistent()`.
2. It queries connected peers for their latest committed head hash.
3. If the local head hash lags behind peers, the node emits `cluster.sync.requested@1.0.0` specifying its last verified hash.
4. The peer streams the missing sequence of events.
5. The local node verifies each event hash in order and commits them to its local database, restoring full synchronization.
