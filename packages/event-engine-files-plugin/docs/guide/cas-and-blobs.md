# CAS & Blob Storage

Content-Addressable Storage (CAS) decouples file storage from file paths by identifying payloads strictly by cryptographic hash.

---

## The Blob Lifecycle

### 1. Registration (`file.blob.registered@1.0.0`)
Announces that a blob is intended for upload, establishing its total expected size and MIME type.

```javascript
await engine.ingress('file.blob.registered@1.0.0', {
  blobId: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
  sizeInBytes: 5242880,
  contentType: 'video/mp4',
  type: 'raw',
})
```

### 2. Chunk Ingestion (`file.blob.chunk.uploaded@1.0.0`)
For large assets, binary chunks are uploaded sequentially or in parallel. Each chunk specifies byte offset and hash checksum:

```javascript
await engine.ingress('file.blob.chunk.uploaded@1.0.0', {
  blobId: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
  offset: 0,
  bytes: 1048576,
  sha256: 'chunk_hash_0',
})
```

### 3. Verification (`file.blob.verified@1.0.0`)
Once all chunks are written to disk or S3, verification confirms the combined payload matches the expected `blobId`.

### 4. Purge (`file.blob.purged@1.0.0`)
Garbage collects unreferenced blobs or deletes expired temporary files.
