const { EventsEngine } = require('@sullux/event-engine')
const compiledOntology = require('../dist/index')
const { ClusterMesh } = require('./mesh')

const ClusteredEngine = (options = {}) => {
  const {
    db,
    port = 9090,
    discoverPeers = async () => [],
    clusterSize = 3,
    netModule,
    timeoutMs = 2000,
    nodeId,
    ...engineOptions
  } = options

  let mesh = null

  const replicationSideEffect = async (event) => {
    if (event.isReplication) return
    if (!mesh) return
    const result = await mesh.propose(event)
    if (!result.success) {
      throw new Error(`Cluster replication failed: Quorum not met (${result.ackCount}/${result.requiredAcks} ACKs)`)
    }
  }

  const mergedEffects = {
    ...(engineOptions.effects || {}),
    '*': [
      ...((engineOptions.effects && engineOptions.effects['*']) || []),
      {
        name: 'cluster_replication',
        immediate: true,
        run: replicationSideEffect,
      },
    ],
  }

  const innerEngine = EventsEngine({
    ...engineOptions,
    db,
    effects: mergedEffects,
  })

  if (Array.isArray(compiledOntology.definitions)) {
    compiledOntology.definitions.forEach((def) => innerEngine.registerDefinition(def))
  }

  mesh = ClusterMesh({
    nodeId,
    port,
    discoverPeers,
    clusterSize,
    db,
    engine: innerEngine,
    timeoutMs,
    netModule,
  })

  const start = async () => {
    await mesh.start()
    await mesh.syncTail()
  }

  const stop = async () => {
    await mesh.stop()
  }

  const assertConsistent = async () => {
    await mesh.syncTail()
  }

  return {
    ingress: (input) => innerEngine.ingress(input),
    query: (params) => innerEngine.query(params),
    replay: (params) => innerEngine.replay(params),
    subscribe: (params) => innerEngine.subscribe(params),
    unsubscribe: (id) => innerEngine.unsubscribe(id),
    subscribeActive: (params) => innerEngine.subscribeActive(params),
    processSideEffects: () => innerEngine.processSideEffects(),
    registerDefinition: (def) => innerEngine.registerDefinition(def),
    start,
    stop,
    assertConsistent,
    getMesh: () => mesh,
    _getInnerEngine: () => innerEngine,
  }
}

module.exports = { ClusteredEngine }
