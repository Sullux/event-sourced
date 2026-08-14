#!/usr/bin/env node

const net = require('node:net')
const fs = require('node:fs')
const path = require('node:path')
const { Db, eventFactory, ulidFactory, eventsEngineFactory } = require('../index')

const SOCKET_PATH = process.env.COMS_LAKE_SOCKET || '/tmp/coms-lake.sock'
const DB_PATH = process.env.COMS_DB_PATH || path.join(process.cwd(), 'coms.db')

console.log('Starting Coms Lake Server...')
console.log(`Database: ${DB_PATH}`)
console.log(`Socket: ${SOCKET_PATH}`)

const db = Db({ dbPath: DB_PATH })
const engine = eventsEngineFactory(db)

const now = () => Date.now()
const random = () => Math.random()
const ulid = ulidFactory(now, random)
const { createEvent } = eventFactory(ulid, now)

const activeSubscribers = new Set()

const handleRequest = async (socket, req, subscriberContext) => {
  const { action } = req

  if (action === 'append') {
    const { type, version, payload } = req
    try {
      const receipt = await engine.ingress({ type, version, payload })
      const event = db.getEventsFrom(receipt.id)[0] || null
      const formattedReceipt = {
        ...receipt,
        status: receipt.status === 'processed' ? 'inserted' : receipt.status,
      }

      socket.write(JSON.stringify({ status: 'ok', event, receipt: formattedReceipt }) + '\n')

      if (receipt.status === 'processed' && event) {
        broadcastEvent(event)
      }
    } catch (error) {
      socket.write(
        JSON.stringify({
          status: 'error',
          message: error.message,
          errors: error.errors || null,
        }) + '\n'
      )
    }
  } else if (action === 'getCursor') {
    const { subscriberName } = req
    if (!subscriberName) {
      socket.write(
        JSON.stringify({ status: 'error', message: "Missing 'subscriberName'" }) + '\n'
      )
      return
    }
    try {
      const cursor = db.getSubscriberCursor(subscriberName) || ''
      socket.write(JSON.stringify({ status: 'ok', cursor }) + '\n')
    } catch (error) {
      socket.write(JSON.stringify({ status: 'error', message: error.message }) + '\n')
    }
  } else if (action === 'subscribe') {
    const { subscriberName } = req
    if (!subscriberName) {
      socket.write(
        JSON.stringify({ status: 'error', message: "Missing 'subscriberName'" }) + '\n'
      )
      return
    }

    try {
      let cursor = req.lastProcessedId || db.getSubscriberCursor(subscriberName) || ''

      // Register subscriber context first so concurrent real-time events are broadcasted
      subscriberContext.subscriberName = subscriberName
      subscriberContext.lastProcessedId = cursor
      activeSubscribers.add(subscriberContext)

      // Catch up with historical events sequentially, filtering out any already-broadcasted real-time updates
      let catchUpEvents = db.getEventsSince(cursor, 100)
      while (catchUpEvents.length > 0) {
        for (const ev of catchUpEvents) {
          if (ev.id > subscriberContext.lastProcessedId) {
            socket.write(JSON.stringify({ status: 'event', event: ev }) + '\n')
            subscriberContext.lastProcessedId = ev.id
          }
        }
        cursor = subscriberContext.lastProcessedId
        catchUpEvents = db.getEventsSince(cursor, 100)
      }

      socket.write(
        JSON.stringify({
          status: 'subscribed',
          subscriberName,
          lastProcessedId: subscriberContext.lastProcessedId,
        }) + '\n'
      )
    } catch (error) {
      socket.write(JSON.stringify({ status: 'error', message: error.message }) + '\n')
    }
  } else if (action === 'commitCursor') {
    const { subscriberName, lastProcessedId } = req
    if (!subscriberName || !lastProcessedId) {
      socket.write(
        JSON.stringify({
          status: 'error',
          message: "Missing 'subscriberName' or 'lastProcessedId'",
        }) + '\n'
      )
      return
    }

    try {
      db.updateSubscriberCursor(subscriberName, lastProcessedId)
      if (subscriberContext.subscriberName === subscriberName) {
        subscriberContext.lastProcessedId = lastProcessedId
      }
      socket.write(JSON.stringify({ status: 'ok' }) + '\n')
    } catch (error) {
      socket.write(JSON.stringify({ status: 'error', message: error.message }) + '\n')
    }
  } else {
    socket.write(JSON.stringify({ status: 'error', message: `Unknown action: '${action}'` }) + '\n')
  }
}

const broadcastEvent = (event) => {
  for (const sub of activeSubscribers) {
    if (sub.lastProcessedId < event.id) {
      try {
        sub.socket.write(JSON.stringify({ status: 'event', event }) + '\n')
        sub.lastProcessedId = event.id
      } catch (err) {
        console.error(`Failed to stream to subscriber ${sub.subscriberName}:`, err.message)
      }
    }
  }
}

const socketDir = path.dirname(SOCKET_PATH)
if (!fs.existsSync(socketDir)) {
  fs.mkdirSync(socketDir, { recursive: true })
}
if (fs.existsSync(SOCKET_PATH)) {
  fs.unlinkSync(SOCKET_PATH)
}

const server = net.createServer((socket) => {
  const subscriberContext = { socket, subscriberName: null, lastProcessedId: '' }

  let buffer = ''
  socket.on('data', (chunk) => {
    buffer += chunk.toString()
    const lines = buffer.split('\n')
    buffer = lines.pop()

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const req = JSON.parse(line)
        handleRequest(socket, req, subscriberContext)
      } catch (err) {
        socket.write(
          JSON.stringify({ status: 'error', message: 'Invalid JSON request: ' + err.message }) + '\n'
        )
      }
    }
  })

  socket.on('close', () => {
    activeSubscribers.delete(subscriberContext)
  })

  socket.on('error', (err) => {
    console.error('Socket error:', err.message)
  })
})

server.listen(SOCKET_PATH, () => {
  console.log(`Server listening on Unix Socket: ${SOCKET_PATH}`)
})

const shutdown = () => {
  console.log('Shutting down server...')
  for (const sub of activeSubscribers) {
    try { sub.socket.destroy() } catch (_) {}
  }
  server.close(() => {
    db.close()
    if (fs.existsSync(SOCKET_PATH)) {
      fs.unlinkSync(SOCKET_PATH)
    }
    console.log('Server offline.')
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
