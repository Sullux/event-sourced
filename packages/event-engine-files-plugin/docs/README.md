# Introduction to Event Engine Files Plugin

`@sullux/event-engine-files-plugin` is a declarative domain ontology plugin for `@sullux/event-engine` providing content-addressable storage (CAS), multipart chunk streaming, virtual filesystem hierarchies, file version tagging, and granular capability-based access control.

Compiled directly via `@sullux/event-ontology`, it provides pre-compiled Ajv schema validation, SQLite DDL migrations, and deterministic deduplication.

---

## Capabilities

* **Content-Addressable Storage (CAS)**: Immutable binary payloads indexed by cryptographic hash (`blobId`), eliminating duplication across identical files.
* **Multipart Chunk Streaming**: Ingress large binary files in discrete chunks (`file.blob.chunk.uploaded`) with verified SHA-256 integrity checks.
* **Virtual Directory Hierarchies**: Model hierarchical folders, symbolic links, and hard links across files.
* **Version Tagging**: Tag and track immutable snapshots of evolving documents (`file.version.tagged`).
* **Granular Access Control**: Issue and revoke capability grants (`file.access.granted`, `file.access.revoked`) and generate time-limited share links.

---

## Ingress Pipeline

```
  ┌───────────────────────────────────────────────────────────┐
  │ 1. Ingress file.blob.registered (blobId, sizeInBytes)     │
  └─────────────────────────────┬─────────────────────────────┘
                                │
  ┌─────────────────────────────▼─────────────────────────────┐
  │ 2. Ingress file.blob.chunk.uploaded (offset, bytes, sha256)│
  └─────────────────────────────┬─────────────────────────────┘
                                │
  ┌─────────────────────────────▼─────────────────────────────┐
  │ 3. Ingress file.blob.verified -> Blob ready for links     │
  └─────────────────────────────┬─────────────────────────────┘
                                │
  ┌─────────────────────────────▼─────────────────────────────┐
  │ 4. Ingress file.link.created (parentId, name, blobId)     │
  └───────────────────────────────────────────────────────────┘
```
