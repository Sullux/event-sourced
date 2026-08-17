# Introduction to Event Engine Cluster Plugin

`@sullux/event-engine-cluster-plugin` delivers leaderless, fault-tolerant replication across distributed `@sullux/event-engine` instances.

Built on a **2-of-3 Quorum Mesh Consensus** model combined with tamper-evident **SHA-256 Hash Chaining**, it guarantees strong consistency, partition tolerance, and automatic catch-up recovery across peer nodes without requiring heavy external coordination services like Raft or ZooKeeper.

---

## Architectural Principles

* **Leaderless 2-of-3 Quorum**: Any node in the cluster can accept ingress requests. Ingress succeeds as soon as a quorum of peers (e.g. 2 out of 3 nodes) acknowledge the proposed event.
* **Cryptographic Hash Chain**: Every replicated event computes an immutable SHA-256 hash chaining back to the previous committed event hash (`event.prevHash`), making tampering or out-of-order execution immediately detectable.
* **Partition Resilience**: Isolated nodes that cannot achieve quorum reject local writes safely, preserving ledger integrity until network partitions resolve.
* **Streamlined Catch-Up**: Offline or reconnected nodes query missing hash ranges via `cluster.sync.requested` and roll forward automatically.

---

## The Quorum Replication Cycle

```
  Node A (Coordinator)                Node B (Peer)                  Node C (Peer)
         │                                  │                              │
         ├────── 1. Proposal (event) ───────┼─────────────────────────────►│
         │                                  │                              │
         │◄───── 2. Ack (hash) ─────────────┤                              │
         │                                  │                              │
  [Quorum 2/3 Met!]                         │                              │
         │                                  │                              │
         ├────── 3. Commit Ingress ─────────┼─────────────────────────────►│
         │                                  │                              │
```
