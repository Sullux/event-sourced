const net = require('node:net')
const { eventHash } = require('./hash-chain')

const ClusterMesh = (options = {}) => {
  const {
    nodeId = `node_${Math.random().toString(36).slice(2, 8)}`,
    port = 9090,
    discoverPeers = async () => [],
    clusterSize = 3,
    db,
    engine,
    timeoutMs = 1000,
    netModule = net,
  } = options

  let server = null
  const peerConnections = new Map()
  const inboundSockets = new Set()
  let isRunning = false
  let discoveryInterval = null

  const getHeadState = async () => {
    if (!db || typeof db.getEventsSince !== 'function') {
      return { headId: '', headHash: '' }
    }
    const recent = await db.getEventsSince('', 100000)
    let currentHash = ''
    let lastId = ''
    if (recent && recent.length > 0) {
      for (const evt of recent) {
        currentHash = eventHash(currentHash, evt.id)
        lastId = evt.id
      }
    }
    return { headId: lastId, headHash: currentHash }
  }

  const handleInboundMessage = async (msg, socket) => {
    if (!msg || !msg.type) return

    if (msg.type === 'PROPOSE') {
      const { event, expectedPrevId } = msg
      const { headId, headHash } = await getHeadState()

      if (expectedPrevId && headId && headId !== expectedPrevId) {
        socket.write(JSON.stringify({ type: 'REJECT_STALE', headId, headHash, id: msg.id }) + '\n')
        return
      }

      try {
        if (engine && typeof engine.ingress === 'function') {
          await engine.ingress({ ...event, isReplication: true })
        } else if (db && typeof db.saveEvent === 'function') {
          await db.saveEvent(event)
        }
        const updatedState = await getHeadState()
        socket.write(JSON.stringify({ type: 'ACK', headId: updatedState.headId, headHash: updatedState.headHash, id: msg.id }) + '\n')
      } catch (err) {
        socket.write(JSON.stringify({ type: 'REJECT_ERROR', error: err.message, id: msg.id }) + '\n')
      }
      return
    }

    if (msg.type === 'SYNC_REQUEST') {
      const { cursor } = msg
      const events = db ? await db.getEventsSince(cursor || '', 1000) : []
      socket.write(JSON.stringify({ type: 'SYNC_RESPONSE', events, id: msg.id }) + '\n')
      return
    }

    if (msg.type === 'PING') {
      const { headId, headHash } = await getHeadState()
      socket.write(JSON.stringify({ type: 'PONG', headId, headHash, id: msg.id }) + '\n')
    }
  }

  const connectToPeer = (address) => {
    if (peerConnections.has(address) || address.includes(`:${port}`) || address.endsWith(`:${port}`)) return
    const [host, peerPortStr] = address.split(':')
    const peerPort = peerPortStr ? parseInt(peerPortStr, 10) : port

    const socket = netModule.connect({ host, port: peerPort })
    socket.pendingRequests = new Map()
    socket.isConnected = false

    let buffer = ''
    socket.on('connect', () => {
      socket.isConnected = true
    })

    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8')
      const lines = buffer.split('\n')
      buffer = lines.pop()
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const msg = JSON.parse(line)
          if (socket.pendingRequests.has(msg.id)) {
            const resolver = socket.pendingRequests.get(msg.id)
            socket.pendingRequests.delete(msg.id)
            resolver(msg)
          }
        } catch (_) {}
      }
    })

    socket.sendRequest = (req) => {
      return new Promise((resolve) => {
        if (!socket.isConnected) {
          return resolve({ type: 'DISCONNECTED' })
        }
        const reqId = `${nodeId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
        socket.pendingRequests.set(reqId, resolve)
        socket.write(JSON.stringify({ ...req, id: reqId }) + '\n')
        setTimeout(() => {
          if (socket.pendingRequests.has(reqId)) {
            socket.pendingRequests.delete(reqId)
            resolve({ type: 'TIMEOUT' })
          }
        }, timeoutMs)
      })
    }

    socket.on('error', () => {
      socket.isConnected = false
      peerConnections.delete(address)
    })
    socket.on('close', () => {
      socket.isConnected = false
      peerConnections.delete(address)
    })

    peerConnections.set(address, socket)
  }

  const pollPeers = async () => {
    if (!isRunning) return
    try {
      const peers = await discoverPeers()
      for (const p of peers) {
        connectToPeer(p)
      }
    } catch (_) {}
  }

  const start = async () => {
    if (isRunning) return
    isRunning = true

    await new Promise((resolve, reject) => {
      server = netModule.createServer((socket) => {
        inboundSockets.add(socket)
        socket.on('close', () => inboundSockets.delete(socket))
        let buffer = ''
        socket.on('data', (chunk) => {
          buffer += chunk.toString('utf8')
          const lines = buffer.split('\n')
          buffer = lines.pop()
          for (const line of lines) {
            if (!line.trim()) continue
            try {
              const msg = JSON.parse(line)
              handleInboundMessage(msg, socket)
            } catch (_) {}
          }
        })
      })
      server.listen(port, () => resolve())
      server.on('error', reject)
    })

    await pollPeers()
    discoveryInterval = setInterval(pollPeers, 500)
  }

  const stop = async () => {
    isRunning = false
    if (discoveryInterval) clearInterval(discoveryInterval)
    for (const [addr, socket] of peerConnections.entries()) {
      socket.destroy()
    }
    peerConnections.clear()
    for (const socket of inboundSockets) {
      socket.destroy()
    }
    inboundSockets.clear()
    if (server) {
      await new Promise((resolve) => server.close(resolve))
    }
  }

  const propose = async (event) => {
    const { headId, headHash } = await getHeadState()

    const peersList = await discoverPeers()
    const expectedSize = Math.max(clusterSize, peersList.length + 1)
    const requiredAcks = Math.floor(expectedSize / 2) + 1

    let ackCount = 1 // Self ACK

    const activeSockets = Array.from(peerConnections.values()).filter(s => s.isConnected)

    const reqPayload = {
      type: 'PROPOSE',
      event,
      expectedPrevId: headId,
      expectedPrevHash: headHash,
    }

    const responses = await Promise.all(
      activeSockets.map(socket => socket.sendRequest(reqPayload))
    )

    for (const res of responses) {
      if (res && res.type === 'ACK') {
        ackCount++
      }
    }

    const success = ackCount >= requiredAcks
    return { success, ackCount, requiredAcks, totalNodes: expectedSize }
  }

  const syncTail = async () => {
    const { headId } = await getHeadState()
    const activeSockets = Array.from(peerConnections.values()).filter(s => s.isConnected)
    for (const socket of activeSockets) {
      const res = await socket.sendRequest({ type: 'SYNC_REQUEST', cursor: headId })
      if (res && res.type === 'SYNC_RESPONSE' && Array.isArray(res.events)) {
        for (const evt of res.events) {
          if (engine && typeof engine.ingress === 'function') {
            await engine.ingress({ ...evt, isReplication: true })
          } else if (db && typeof db.saveEvent === 'function') {
            await db.saveEvent(evt)
          }
        }
      }
    }
  }

  return {
    start,
    stop,
    propose,
    pollPeers,
    syncTail,
    getHeadState,
    getPeers: () => Array.from(peerConnections.keys()),
  }
}

module.exports = { ClusterMesh }
