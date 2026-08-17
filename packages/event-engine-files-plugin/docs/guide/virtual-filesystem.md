# Virtual Filesystem & Directories

The Virtual Filesystem (VFS) layer maps CAS blobs into user-facing directory hierarchies, paths, filenames, and semantic versions.

---

## Directory Trees (`file.directory.created@1.0.0`)

Directories are modeled as event nodes in a tree hierarchy:

```javascript
await engine.ingress('file.directory.created@1.0.0', {
  directoryId: 'dir_docs_root',
  name: 'Documents',
  parentId: null,
})
```

---

## File Links (`file.link.*`)

A File Link points a filename within a directory to an underlying immutable `blobId`:

* `file.link.created@1.0.0`: Creates a new named file in a directory.
* `file.link.updated@1.0.0`: Updates the target `blobId` (e.g. saving an edited file).
* `file.link.moved@1.0.0`: Renames a file or moves it to a different parent `directoryId`.
* `file.link.removed@1.0.0`: Deletes or unlinks a file from a directory.

---

## Version Tagging (`file.version.tagged@1.0.0`)

Snapshot version tags mark specific milestones across file history (e.g. `"v1.0.0"`, `"release-candidate"`):

```javascript
await engine.ingress('file.version.tagged@1.0.0', {
  linkId: 'link_whitepaper',
  tag: 'v2.0',
  blobId: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
  taggedAt: Date.now(),
})
```
