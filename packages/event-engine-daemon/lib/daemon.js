const fs = require('node:fs')
const net = require('node:net')
const { EventsEngine } = require('@sullux/event-engine')
const { SqliteDb } = require('@sullux/event-engine/db/sqlite')
const compiledDaemonOntology = require('../dist/index')

const createDaemon = (config = {}) => {
  const dbPath = config.storage?.db || ':memory:'
  const socketPath = config.ipc?.socket || null
  const pluginTimeoutMs = config.pluginTimeoutMs || 5000

  const db = SqliteDb({ path: dbPath })
  const loadedPlugins = new Map()

  const engine = EventsEngine({
    db,
  })

  // Register internal daemon ontology definitions
  if (Array.isArray(compiledDaemonOntology.definitions)) {
    compiledDaemonOntology.definitions.forEach((def) => engine.registerDefinition(def))
  }

  // Load plugins declared in config
  if (Array.isArray(config.plugins)) {
    for (const pluginSpec of config.plugins) {
      const pluginName = typeof pluginSpec === 'string' ? pluginSpec : pluginSpec.name
      const pluginConfig = typeof pluginSpec === 'object' ? pluginSpec.config : {}

      let pluginModule = pluginSpec.module
      if (!pluginModule) {
        try {
          pluginModule = require(pluginName)
        } catch (err) {
          throw new Error(`Failed to load plugin "${pluginName}": ${err.message}`)
        }
      }

      const plugin = typeof pluginModule === 'function' ? pluginModule(pluginConfig) : pluginModule
      const name = plugin.name || pluginName

      if (Array.isArray(plugin.definitions)) {
        plugin.definitions.forEach((def) => engine.registerDefinition(def))
      }

      if (Array.isArray(plugin.sideEffects)) {
        plugin.sideEffects.forEach((eff) => {
          engine.subscribe({
            predicate: eff.predicate,
            handler: (evt, ctx) => eff.handler(evt, { ...ctx, engine, context: { config: pluginConfig } }),
            immediate: eff.immediate ?? true,
          })
        })
      }

      loadedPlugins.set(name, { name, plugin, config: pluginConfig })
    }
  }

  let ipcServer = null

  const waitForPluginEvents = (expectedType, expectedPlugins, timeoutMs) => {
    return new Promise((resolve) => {
      const remaining = new Set(expectedPlugins)
      if (remaining.size === 0) return resolve()

      const timer = setTimeout(() => {
        unsubscribe()
        resolve()
      }, timeoutMs)

      const subId = engine.subscribe({
        predicate: { '.type': expectedType },
        handler: (evt) => {
          if (evt.payload?.plugin && remaining.has(evt.payload.plugin)) {
            remaining.delete(evt.payload.plugin)
            if (remaining.size === 0) {
              clearTimeout(timer)
              unsubscribe()
              resolve()
            }
          }
        },
        immediate: true,
      })

      const unsubscribe = () => {
        if (typeof engine.unsubscribe === 'function') engine.unsubscribe(subId)
      }
    })
  }

  const start = async () => {
    // Setup UDS IPC Server if socketPath specified
    if (socketPath) {
      try { if (fs.existsSync(socketPath)) fs.unlinkSync(socketPath) } catch (_) {}
      ipcServer = net.createServer((socket) => {
        socket.on('data', async (data) => {
          try {
            const req = JSON.parse(data.toString('utf8'))
            if (req.action === 'ingress') {
              const res = await engine.ingress(req.payload)
              socket.write(JSON.stringify({ status: 'ok', data: res }) + '\n')
            } else if (req.action === 'query') {
              const res = await engine.query(req.payload || {})
              socket.write(JSON.stringify({ status: 'ok', data: res }) + '\n')
            }
          } catch (err) {
            socket.write(JSON.stringify({ status: 'error', message: err.message }) + '\n')
          }
        })
      })
      ipcServer.listen(socketPath)
    }

    const pluginNames = Array.from(loadedPlugins.keys())

    await engine.ingress({
      type: 'daemon.start.requested',
      version: '1.0.0',
      payload: { plugins: pluginNames },
    })

    const startWaitPromise = waitForPluginEvents('daemon.plugin.started', pluginNames, pluginTimeoutMs)

    // Request start for each loaded plugin
    for (const [name, { config: pluginConfig }] of loadedPlugins.entries()) {
      await engine.ingress({
        type: 'daemon.plugin.start.requested',
        version: '1.0.0',
        payload: { plugin: name, config: pluginConfig },
      })
    }

    await startWaitPromise

    await engine.ingress({
      type: 'daemon.started',
      version: '1.0.0',
      payload: { plugins: pluginNames, startedAt: Date.now() },
    })

    return { engine, plugins: loadedPlugins }
  }

  const stop = async () => {
    const pluginNames = Array.from(loadedPlugins.keys())

    await engine.ingress({
      type: 'daemon.stop.requested',
      version: '1.0.0',
      payload: {},
    })

    const stopWaitPromise = waitForPluginEvents('daemon.plugin.stopped', pluginNames, pluginTimeoutMs)

    for (const name of loadedPlugins.keys()) {
      await engine.ingress({
        type: 'daemon.plugin.stop.requested',
        version: '1.0.0',
        payload: { plugin: name },
      })
    }

    await stopWaitPromise

    await engine.ingress({
      type: 'daemon.stopped',
      version: '1.0.0',
      payload: { stoppedAt: Date.now() },
    })

    if (ipcServer) {
      ipcServer.close()
      try { if (fs.existsSync(socketPath)) fs.unlinkSync(socketPath) } catch (_) {}
    }
  }

  return {
    engine,
    start,
    stop,
  }
}

module.exports = {
  createDaemon,
}
