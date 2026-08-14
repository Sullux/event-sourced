# Domain Ontology Reference

Auto-generated documentation from YAML ontology definition files.

---

## Table of Contents

- [file](#file)
- [file.access.granted@1.0.0](#fileaccessgranted100)
- [file.access.revoked@1.0.0](#fileaccessrevoked100)
- [file.blob.chunk.uploaded@1.0.0](#fileblobchunkuploaded100)
- [file.blob.purged@1.0.0](#fileblobpurged100)
- [file.blob](#fileblob)
- [file.blob.registered@1.0.0](#fileblobregistered100)
- [file.blob.verified@1.0.0](#fileblobverified100)
- [file.delta.appended@1.0.0](#filedeltaappended100)
- [file.directory.created@1.0.0](#filedirectorycreated100)
- [file.link](#filelink)
- [file.link.created@1.0.0](#filelinkcreated100)
- [file.link.moved@1.0.0](#filelinkmoved100)
- [file.link.removed@1.0.0](#filelinkremoved100)
- [file.link.updated@1.0.0](#filelinkupdated100)
- [file.meta.updated@1.0.0](#filemetaupdated100)
- [file.share.created@1.0.0](#filesharecreated100)
- [file.share.revoked@1.0.0](#filesharerevoked100)
- [file.version.tagged@1.0.0](#fileversiontagged100)

---

<a name="file"></a>

### file

The **`file`** library defines a complete ontology for content-addressable storage (CAS), virtual filesystems (VFS), versioning, and access control.


<a name="fileaccessgranted100"></a>

### file.access.granted@1.0.0

Emitted when read or write access permissions are granted on a path or link to an actor.

#### Properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `targetId` | `string` | Yes | - |
| `actorId` | `string` | Yes | - |
| `permission` | `string` | Yes | - |


<a name="fileaccessrevoked100"></a>

### file.access.revoked@1.0.0

Emitted when access permissions are revoked from an actor.

#### Properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `targetId` | `string` | Yes | - |
| `actorId` | `string` | Yes | - |
| `permission` | `string` | Yes | - |


<a name="fileblobchunkuploaded100"></a>

### file.blob.chunk.uploaded@1.0.0

Emitted when a chunk of a multipart blob write is successfully ingested.

#### Properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `blobId` | `string` | Yes | - |
| `offset` | `number` | Yes | - |
| `bytes` | `number` | Yes | - |
| `sha256` | `string` | No | - |


<a name="fileblobpurged100"></a>

### file.blob.purged@1.0.0

Emitted by garbage collection when an unlinked blob is permanently deleted from storage.

#### Properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `blobId` | `string` | Yes | - |
| `reason` | `string` | No | - |


<a name="fileblob"></a>

### file.blob

A `Blob` is an immutable binary data asset stored in Content-Addressable Storage (CAS) and indexed by content hash.

#### Properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `blobId` | `string` | Yes | Content hash (e.g. SHA-256 or BLAKE3) identifying this immutable blob. |
| `sizeInBytes` | `number` | Yes | Total payload byte length. |
| `contentType` | `string` | No | Optional MIME type hint. |
| `type` | `string` | No | Specifies if this is a raw data blob or a composite manifest listing child blobs. |

#### Database Schema

* **Table:** `file_blobs`


<a name="fileblobregistered100"></a>

### file.blob.registered@1.0.0

Emitted when a blob payload is allocated or registered prior to full binary upload.

#### Properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `blobId` | `string` | Yes | Content hash (e.g. SHA-256 or BLAKE3) identifying this immutable blob. |
| `sizeInBytes` | `number` | Yes | Total payload byte length. |
| `contentType` | `string` | No | Optional MIME type hint. |
| `type` | `string` | No | Specifies if this is a raw data blob or a composite manifest listing child blobs. |

#### Database Schema

* **Table:** `file_blobs`


<a name="fileblobverified100"></a>

### file.blob.verified@1.0.0

Emitted when a blob's storage write is finished and payload checksum integrity is verified.

#### Properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `blobId` | `string` | Yes | Content hash (e.g. SHA-256 or BLAKE3) identifying this immutable blob. |
| `sizeInBytes` | `number` | Yes | Total payload byte length. |
| `contentType` | `string` | No | Optional MIME type hint. |
| `type` | `string` | No | Specifies if this is a raw data blob or a composite manifest listing child blobs. |

#### Database Schema

* **Table:** `file_blobs`


<a name="filedeltaappended100"></a>

### file.delta.appended@1.0.0

Emitted when an incremental patch or delta blob is appended to a link's content stack.

#### Properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `linkId` | `string` | Yes | - |
| `patchBlobId` | `string` | Yes | - |


<a name="filedirectorycreated100"></a>

### file.directory.created@1.0.0

Emitted when a directory node is created in the Virtual Filesystem tree.

#### Properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `directoryId` | `string` | Yes | - |
| `path` | `string` | Yes | - |

#### Database Schema

* **Table:** `file_directories`


<a name="filelink"></a>

### file.link

A `Link` represents a Virtual Filesystem (VFS) entry binding a path/filename to underlying CAS blobs, blocks, or patches.

#### Properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `linkId` | `string` | Yes | - |
| `path` | `string` | Yes | Virtual directory path (e.g. /documents/notes.txt). |
| `blobId` | `string` | No | Single CAS content blob ID. |
| `blocks` | `array` | No | Ordered list of constituent block blobs. |
| `patches` | `array` | No | Ordered list of delta patches applied on top of a base blob. |

#### Database Schema

* **Table:** `file_links`


<a name="filelinkcreated100"></a>

### file.link.created@1.0.0

Emitted when a new Virtual Filesystem (VFS) link or file path is created.

#### Properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `linkId` | `string` | Yes | - |
| `path` | `string` | Yes | Virtual directory path (e.g. /documents/notes.txt). |
| `blobId` | `string` | No | Single CAS content blob ID. |
| `blocks` | `array` | No | Ordered list of constituent block blobs. |
| `patches` | `array` | No | Ordered list of delta patches applied on top of a base blob. |

#### Database Schema

* **Table:** `file_links`


<a name="filelinkmoved100"></a>

### file.link.moved@1.0.0

Emitted when a VFS path is renamed or moved without modifying underlying blob payloads.

#### Properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `linkId` | `string` | Yes | - |
| `oldPath` | `string` | Yes | - |
| `newPath` | `string` | Yes | - |


<a name="filelinkremoved100"></a>

### file.link.removed@1.0.0

Emitted when a VFS path is deleted, decrementing active link counts on referenced blobs/blocks.

#### Properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `linkId` | `string` | Yes | - |
| `path` | `string` | Yes | - |


<a name="filelinkupdated100"></a>

### file.link.updated@1.0.0

Emitted when an existing VFS link is updated with a replacement blob, block re-stitching, or appended patch.

#### Properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `linkId` | `string` | Yes | - |
| `path` | `string` | Yes | Virtual directory path (e.g. /documents/notes.txt). |
| `blobId` | `string` | No | Single CAS content blob ID. |
| `blocks` | `array` | No | Ordered list of constituent block blobs. |
| `patches` | `array` | No | Ordered list of delta patches applied on top of a base blob. |

#### Database Schema

* **Table:** `file_links`


<a name="filemetaupdated100"></a>

### file.meta.updated@1.0.0

Emitted when extended attributes, tags, or metadata properties are updated on a file link or blob.

#### Properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `targetId` | `string` | Yes | Unique link ID or blob ID. |
| `key` | `string` | Yes | - |
| `value` | `string` | Yes | - |


<a name="filesharecreated100"></a>

### file.share.created@1.0.0

Emitted when a share link or external access token is created for a file or folder.

#### Properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `shareId` | `string` | Yes | - |
| `linkId` | `string` | Yes | - |
| `expiresAt` | `number` | No | - |


<a name="filesharerevoked100"></a>

### file.share.revoked@1.0.0

Emitted when an active share token is revoked.

#### Properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `shareId` | `string` | Yes | - |


<a name="fileversiontagged100"></a>

### file.version.tagged@1.0.0

Emitted when a named version tag or checkpoint is pinned to a VFS link.

#### Properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `linkId` | `string` | Yes | - |
| `tagName` | `string` | Yes | - |
| `blobId` | `string` | Yes | - |
