const crypto = require('node:crypto')

const sha256 = (str) => crypto.createHash('sha256').update(String(str)).digest('hex')
const uuid = () => crypto.randomUUID().replaceAll('-', '')

module.exports = {
  sha256,
  uuid,
}
