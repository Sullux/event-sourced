const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs/promises')
const path = require('node:path')

const { MemoryDb } = require('../drivers/db/memory')
const { SqliteDb } = require('../drivers/db/sqlite')
const { MemoryFs } = require('../drivers/fs/memory')
const { LocalFs } = require('../drivers/fs/local')

const testDbInterface = async (dbInstance) => {
  const event = {
    id: '01KWW0DDYN89BX4WBK4P01F53X',
    type: 'test.events',
    version: '1.0.0',
    timestamp: '2026-07-06T15:23:12.219Z',
    payload: { hello: 'world' },
  }

  // 1. Save Event
  await dbInstance.saveEvent(event)

  // 2. Query Events From
  const from = await dbInstance.getEventsFrom('01KWW0DDYN89BX4WBK4P01F53X')
  assert.strictEqual(from.length, 1)
  assert.strictEqual(from[0].id, '01KWW0DDYN89BX4WBK4P01F53X')
  assert.deepStrictEqual(from[0].payload, { hello: 'world' })

  // 3. Query Events Since
  const since = await dbInstance.getEventsSince('01KWW0D0000000000000000000', 10)
  assert.strictEqual(since.length, 1)

  // 4. Replay State Checkpointing
  await dbInstance.saveReplayState({
    id: 'test-replay',
    lastProcessedId: '01KWW0DDYN89BX4WBK4P01F53X',
    context: { active: true },
  })

  const state = await dbInstance.getReplayState('test-replay')
  assert.strictEqual(state.lastProcessedId, '01KWW0DDYN89BX4WBK4P01F53X')
  assert.deepStrictEqual(state.context, { active: true })

  await dbInstance.deleteReplayState('test-replay')
  const clearedState = await dbInstance.getReplayState('test-replay')
  assert.strictEqual(clearedState, null)
}

test('Drivers - MemoryDb satisfies DB interface', async () => {
  const db = MemoryDb()
  await testDbInterface(db)
})

test('Drivers - SqliteDb satisfies DB interface', async () => {
  const db = SqliteDb({ dbPath: ':memory:' })
  await testDbInterface(db)
  db.close()
})

const testFsInterface = async (fsInstance) => {
  const filePath = 'nested/dir/test.txt'
  const fileContent = 'Coms local-first payload!'

  // 1. Initially should not exist
  const initExists = await fsInstance.exists(filePath)
  assert.strictEqual(initExists, false)

  // 2. Write file
  await fsInstance.writeFile(filePath, fileContent)

  // 3. Exists should be true
  const postExists = await fsInstance.exists(filePath)
  assert.strictEqual(postExists, true)

  // 4. Read file
  const readContent = await fsInstance.readFile(filePath)
  assert.strictEqual(readContent.toString(), fileContent)

  // 4b. Streaming write
  const streamPath = 'nested/dir/stream.txt'
  const streamContent = 'Streaming chunks of data!'
  const writeStream = await fsInstance.createWriteStream(streamPath)
  writeStream.write(Buffer.from('Streaming '))
  writeStream.write(Buffer.from('chunks of data!'))
  writeStream.end()

  // Wait for stream to finish flushing
  await new Promise((resolve, reject) => {
    writeStream.on('finish', resolve)
    writeStream.on('error', reject)
  })

  const streamExists = await fsInstance.exists(streamPath)
  assert.strictEqual(streamExists, true)

  const readStreamContent = await fsInstance.readFile(streamPath)
  assert.strictEqual(readStreamContent.toString(), streamContent)

  await fsInstance.deleteFile(streamPath)

  // 5. Delete file
  await fsInstance.deleteFile(filePath)
  const finalExists = await fsInstance.exists(filePath)
  assert.strictEqual(finalExists, false)
}

test('Drivers - MemoryFs satisfies FS interface', async () => {
  const mFs = MemoryFs()
  await testFsInterface(mFs)
})

test('Drivers - LocalFs satisfies FS interface', async () => {
  const tmpDir = path.join(__dirname, '../tmp-test-fs')
  await fs.mkdir(tmpDir, { recursive: true })

  const lFs = LocalFs({ baseDir: tmpDir })
  await testFsInterface(lFs)

  // Cleanup temporary folder
  await fs.rm(tmpDir, { recursive: true, force: true })
})
