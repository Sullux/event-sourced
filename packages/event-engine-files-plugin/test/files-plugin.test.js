const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const filesPlugin = require('../index')
const { EventsEngine } = require('@sullux/event-engine')
const { MemoryDb } = require('@sullux/event-engine/db/memory')
const { MemoryFs } = require('@sullux/event-engine/fs/memory')

describe('Files Plugin', () => {
  it('registers file definitions and ingresses file events', async () => {
    const db = MemoryDb()
    const fs = MemoryFs()

    const engine = EventsEngine({
      db,
      fs,
      plugins: [filesPlugin],
    })

    const regRes = await engine.ingress({
      type: 'file.blob.registered',
      version: '1.0.0',
      payload: {
        blobId: 'sha256:1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
        sizeInBytes: 1024,
        contentType: 'text/plain',
        type: 'raw',
      },
    })

    assert.equal(regRes.status, 'processed')
    assert.equal(regRes.partitionKey, 'blob#sha256:1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b')

    const linkRes = await engine.ingress({
      type: 'file.link.created',
      version: '1.0.0',
      payload: {
        linkId: 'link-123',
        path: '/documents/notes.txt',
        blobId: 'sha256:1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
      },
    })

    assert.equal(linkRes.status, 'processed')
    assert.equal(linkRes.partitionKey, 'path#/documents/notes.txt')
  })
})
