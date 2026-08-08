const crypto = require('node:crypto')

const eventHash = (prevHash = '', eventId = '') => {
  return crypto.createHash('sha256').update(`${prevHash}:${eventId}`).digest('hex')
}

module.exports = {
  eventHash,
}
