const { ClusteredEngine } = require('./lib/clustered-engine')
const { ClusterMesh } = require('./lib/mesh')
const { eventHash } = require('./lib/hash-chain')

const pluginName = '@sullux/event-engine-cluster-plugin'

const definitions = [
  {
    type: 'cluster.proposal.emitted',
    version: '1.0.0',
    persisted: false,
    replicated: false,
    validate: (p) => { if (!p?.event) throw new Error('cluster proposal requires event') },
  },
  {
    type: 'cluster.ack.emitted',
    version: '1.0.0',
    persisted: false,
    replicated: false,
    validate: (p) => { if (!p?.eventId) throw new Error('cluster ack requires eventId') },
  },
  {
    type: 'cluster.sync.requested',
    version: '1.0.0',
    persisted: false,
    replicated: false,
    validate: () => {},
  },
]

let activeMesh = null

const sideEffects = [
  {
    predicate: {
      '.type': 'node.daemon.plugin.start.requested',
      '.payload.plugin': pluginName,
    },
    handler: async (event) => {
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
    },
  },
  {
    predicate: {
      '.type': 'node.daemon.plugin.stop.requested',
      '.payload.plugin': pluginName,
    },
    handler: async () => {
      if (activeMesh) {
        await activeMesh.stop()
        activeMesh = null
      }
    },
  },
]

module.exports = {
  name: pluginName,
  version: '1.0.0',
  definitions,
  upcasters: {},
  projections: [],
  sideEffects,
  ClusteredEngine,
  ClusterMesh,
  eventHash,
}
