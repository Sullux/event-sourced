#!/usr/bin/env node
const path = require('node:path')
const { createDaemon, loadConfigFile } = require('../lib/daemon')

const args = process.argv.slice(2)
let configPath = null

for (let i = 0; i < args.length; i++) {
  if (args[i] === '-c' || args[i] === '--config') {
    configPath = args[i + 1]
    break
  }
}

if (!configPath) {
  if (require('node:fs').existsSync('daemon.yaml')) configPath = 'daemon.yaml'
  else if (require('node:fs').existsSync('settings.json')) configPath = 'settings.json'
}

const config = configPath ? loadConfigFile(configPath) : {}
const daemon = createDaemon(config)

daemon.start().then(() => {
  console.log(`[event-engine-daemon] Started node "${daemon.nodeId}" successfully.`)
}).catch((err) => {
  console.error('[event-engine-daemon] Boot failed:', err)
  process.exit(1)
})

const handleSignal = async (signal) => {
  console.log(`[event-engine-daemon] Received ${signal}, shutting down...`)
  try {
    await daemon.stop()
    console.log('[event-engine-daemon] Stopped cleanly.')
    process.exit(0)
  } catch (err) {
    console.error('[event-engine-daemon] Shutdown error:', err)
    process.exit(1)
  }
}

process.on('SIGINT', () => handleSignal('SIGINT'))
process.on('SIGTERM', () => handleSignal('SIGTERM'))
