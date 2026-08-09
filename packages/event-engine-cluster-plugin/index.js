const compiledOntology = require('./dist/index')
const { ClusteredEngine } = require('./lib/clustered-engine')
const { ClusterMesh } = require('./lib/mesh')
const { eventHash } = require('./lib/hash-chain')

const pluginName = '@sullux/event-engine-cluster-plugin'

let activeMesh = null

const sideEffects = [
  {
    predicate: {
      '.type': 'daemon.plugin.start.requested',
      '.payload.plugin': pluginName,
    },
    handler: async (event, { engine }) => {
      const config = event.payload?.config || {}
      if (config.port && !activeMesh) {
        activeMesh = ClusterMesh({
          nodeId: event.payload.nodeId,
          port: config.port,
          discoverPeers: async () => config.peers || [],
          clusterSize: config.clusterSize || 3,
        })
        await activeMesh.start()
      }

      if (engine) {
        await engine.ingress({
          type: 'daemon.plugin.started',
          version: '1.0.0',
          payload: { plugin: pluginName, startedAt: Date.now() },
        })
      }
    },
  },
  {
    predicate: {
      '.type': 'daemon.plugin.stop.requested',
      '.payload.plugin': pluginName,
    },
    handler: async (event, { engine }) => {
      if (activeMesh) {
        await activeMesh.stop()
        activeMesh = null
      }

      if (engine) {
        await engine.ingress({
          type: 'daemon.plugin.stopped',
          version: '1.0.0',
          payload: { plugin: pluginName, stoppedAt: Date.now() },
        })
      }
    },
  },
]

module.exports = {
  name: pluginName,
  version: '1.0.0',
  definitions: compiledOntology.definitions,
  upcasters: compiledOntology.upcasters || {},
  projections: compiledOntology.projections || [],
  sideEffects,
  ClusteredEngine,
  ClusterMesh,
  eventHash,
}
