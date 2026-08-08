const test = require('node:test')
const assert = require('node:assert')
const { createDaemon } = require('../index')

test('Daemon - executes full daemon.* event lifecycle and processes plugin side-effects', async () => {
  const daemonEvents = []

  const mockPlugin = {
    name: 'test-plugin',
    version: '1.0.0',
    definitions: [
      {
        type: 'test.plugin.item.created',
        version: '1.0.0',
        validate: (p) => { if (!p?.name) throw new Error('name required') },
      },
    ],
    sideEffects: [
      {
        predicate: 'daemon.plugin.start.requested',
        handler: async (evt, { engine }) => {
          if (evt.payload?.plugin === 'test-plugin') {
            await engine.ingress({
              type: 'daemon.plugin.started',
              version: '1.0.0',
              payload: { plugin: 'test-plugin', startedAt: Date.now() },
            })
          }
        },
      },
      {
        predicate: 'daemon.plugin.stop.requested',
        handler: async (evt, { engine }) => {
          if (evt.payload?.plugin === 'test-plugin') {
            await engine.ingress({
              type: 'daemon.plugin.stopped',
              version: '1.0.0',
              payload: { plugin: 'test-plugin', stoppedAt: Date.now() },
            })
          }
        },
      },
    ],
  }

  const daemon = createDaemon({
    storage: { db: ':memory:' },
    plugins: [
      { name: 'test-plugin', module: mockPlugin, config: { foo: 'bar' } },
    ],
  })

  daemon.engine.subscribe({
    predicate: 'daemon.*',
    handler: (evt) => {
      daemonEvents.push(evt.type)
    },
    immediate: true,
  })

  await daemon.start()

  assert.ok(daemonEvents.includes('daemon.start.requested'))
  assert.ok(daemonEvents.includes('daemon.plugin.start.requested'))
  assert.ok(daemonEvents.includes('daemon.plugin.started'))
  assert.ok(daemonEvents.includes('daemon.started'))

  // Ingress event defined by plugin
  const res = await daemon.engine.ingress({
    type: 'test.plugin.item.created',
    version: '1.0.0',
    payload: { name: 'Item Alpha' },
  })

  assert.strictEqual(res.status, 'processed')

  await daemon.stop()

  assert.ok(daemonEvents.includes('daemon.stop.requested'))
  assert.ok(daemonEvents.includes('daemon.plugin.stop.requested'))
  assert.ok(daemonEvents.includes('daemon.plugin.stopped'))
  assert.ok(daemonEvents.includes('daemon.stopped'))
})
