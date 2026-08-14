const { Writable } = require('node:stream')

const MemoryFs = () => {
  const files = {}

  const readFile = async (filePath) => {
    if (files[filePath] === undefined) {
      throw new Error(`ENOENT: no such file or directory, open '${filePath}'`)
    }
    return files[filePath]
  }

  const writeFile = async (filePath, content) => {
    files[filePath] = content
  }

  const createWriteStream = async (filePath) => {
    const chunks = []
    const stream = new Writable({
      write(chunk, encoding, callback) {
        chunks.push(chunk)
        callback()
      },
    })
    stream.on('finish', () => {
      files[filePath] = Buffer.concat(chunks)
    })
    return stream
  }

  const deleteFile = async (filePath) => {
    delete files[filePath]
  }

  const exists = async (filePath) => {
    return files[filePath] !== undefined
  }

  return {
    readFile,
    writeFile,
    createWriteStream,
    deleteFile,
    exists,
    _getRawFiles: () => files,
  }
}

module.exports = { MemoryFs }
