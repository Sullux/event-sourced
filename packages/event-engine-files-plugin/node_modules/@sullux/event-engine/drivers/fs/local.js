const fs = require('node:fs/promises')
const path = require('node:path')

const LocalFs = (config = {}) => {
  const baseDir = config.baseDir || process.cwd()

  const resolvePath = (filePath) => {
    return path.isAbsolute(filePath) ? filePath : path.join(baseDir, filePath)
  }

  const readFile = async (filePath) => {
    const fullPath = resolvePath(filePath)
    return fs.readFile(fullPath)
  }

  const writeFile = async (filePath, content) => {
    const fullPath = resolvePath(filePath)
    const dir = path.dirname(fullPath)
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(fullPath, content)
  }

  const createWriteStream = async (filePath) => {
    const fullPath = resolvePath(filePath)
    const dir = path.dirname(fullPath)
    await fs.mkdir(dir, { recursive: true })
    const { createWriteStream: fsCreateWriteStream } = require('node:fs')
    return fsCreateWriteStream(fullPath)
  }

  const deleteFile = async (filePath) => {
    const fullPath = resolvePath(filePath)
    await fs.unlink(fullPath)
  }

  const exists = async (filePath) => {
    const fullPath = resolvePath(filePath)
    try {
      await fs.access(fullPath)
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

module.exports = { LocalFs }
