# Quorum Consensus Protocol

The cluster uses a fast 2-phase leaderless consensus protocol designed for small high-availability meshes (typically 3 nodes where $Q = \lfloor N/2 \rfloor + 1 = 2$).

---

## The 2-Phase Flow

### Phase 1: Proposal Distribution
When an ingress request arrives at any node (the *Coordinator*):
1. The coordinator assigns the prospective event monotonic ULID and computes the candidate SHA-256 hash using its current head hash.
2. The coordinator ingresses a local `cluster.proposal.emitted@1.0.0` event.
3. The coordinator transmits the proposal payload to all known peers concurrently.

### Phase 2: Acknowledgment & Quorum Commit
1. Each receiving peer verifies the proposal against its local head state and responds with `cluster.ack.emitted@1.0.0` containing its signed hash approval.
2. As soon as the coordinator collects $Q$ acknowledgments (including its own), quorum is reached.
3. The coordinator commits the event to its permanent log and broadcasts the commit confirmation to peers.

---

## Fault Tolerance & Split-Brain Prevention

* **Single Node Failure**: If 1 of 3 nodes goes offline, the remaining 2 nodes still achieve $2/3$ quorum and continue accepting writes uninterrupted.
* **Network Partition / Minority Isolation**: If 1 node is isolated from the other 2, it receives only $1/3$ votes and rejects incoming writes immediately, preventing ledger divergence.
