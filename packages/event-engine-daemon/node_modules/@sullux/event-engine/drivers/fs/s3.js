const crypto = require('node:crypto')

const sha256Hex = (data) => crypto.createHash('sha256').update(data).digest('hex')
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest()

const getSignatureKey = (key, dateStamp, regionName, serviceName) => {
  const kDate = hmac('AWS4' + key, dateStamp)
  const kRegion = hmac(kDate, regionName)
  const kService = hmac(kRegion, serviceName)
  return hmac(kService, 'aws4_request')
}

const signRequest = ({
  method,
  url,
  headers = {},
  body = '',
  region,
  accessKey,
  secretKey,
}) => {
  const urlObj = new URL(url)
  const host = urlObj.host
  const pathname = urlObj.pathname
  const search = urlObj.search ? urlObj.search.slice(1).split('&').sort().join('&') : ''

  const amzDate = new Date().toISOString().replace(/[:-]/g, '').split('.')[0] + 'Z'
  const dateStamp = amzDate.slice(0, 8)

  headers['host'] = host
  headers['x-amz-date'] = amzDate

  const bodyHash = sha256Hex(body)
  headers['x-amz-content-sha256'] = bodyHash

  const sortedHeaderKeys = Object.keys(headers).map(k => k.toLowerCase()).sort()
  const canonicalHeaders = sortedHeaderKeys.map(k => `${k}:${headers[k].trim()}`).join('\n') + '\n'
  const signedHeaders = sortedHeaderKeys.join(';')

  const canonicalRequest = [
    method,
    pathname,
    search,
    canonicalHeaders,
    signedHeaders,
    bodyHash,
  ].join('\n')

  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n')

  const signingKey = getSignatureKey(secretKey, dateStamp, region, 's3')
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex')

  headers['Authorization'] = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  return headers
}

const S3Fs = (config = {}) => {
  const {
    bucket,
    region = 'us-east-1',
    accessKeyId,
    secretAccessKey,
    endpoint, // Custom endpoint (Tigris, Cloudflare R2, MinIO, etc.)
  } = config

  const getUrl = (filePath) => {
    const key = filePath.startsWith('/') ? filePath.slice(1) : filePath
    if (endpoint) {
      const epUrl = new URL(endpoint)
      return `${epUrl.protocol}//${bucket}.${epUrl.host}/${key}`
    }
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`
  }

  const request = async (method, filePath, options = {}) => {
    const url = getUrl(filePath)
    const body = options.body || ''
    const headers = options.headers || {}

    const signedHeaders = signRequest({
      method,
      url,
      headers,
      body,
      region,
      accessKey: accessKeyId,
      secretKey: secretAccessKey,
    })

    const fetchOptions = {
      method,
      headers: signedHeaders,
    }

    if (method !== 'GET' && method !== 'HEAD' && body) {
      fetchOptions.body = body
    }

    const res = await fetch(url, fetchOptions)
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`S3 operation failed: ${method} ${filePath} - Status ${res.status} ${errText}`)
    }
    return res
  }

  const readFile = async (filePath) => {
    const res = await request('GET', filePath)
    const arrayBuffer = await res.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  const writeFile = async (filePath, content, contentType = 'application/octet-stream') => {
    await request('PUT', filePath, {
      body: content,
      headers: {
        'content-type': contentType,
      },
    })
  }

  const createWriteStream = async (filePath, options = {}) => {
    const { Writable } = require('node:stream')
    const chunks = []
    const contentType = options.contentType || 'application/octet-stream'

    const stream = new Writable({
      write(chunk, encoding, callback) {
        chunks.push(chunk)
        callback()
      },
    })

    stream.on('finish', async () => {
      try {
        const content = Buffer.concat(chunks)
        await writeFile(filePath, content, contentType)
      } catch (err) {
        stream.emit('error', err)
      }
    })

    return stream
  }

  const deleteFile = async (filePath) => {
    await request('DELETE', filePath)
  }

  const exists = async (filePath) => {
    try {
      await request('HEAD', filePath)
      return true
    } catch {
      return false
    }
  }

  return {
    readFile,
    writeFile,
    createWriteStream,
    deleteFile,
    exists,
  }
}

module.exports = { S3Fs }
