const fs = require('node:fs')
const path = require('node:path')
const yaml = require('js-yaml')

const deepMerge = (target, source) => {
  if (!source || typeof source !== 'object') return target
  const output = Array.isArray(target) ? [...target] : { ...target }

  for (const key of Object.keys(source)) {
    if (key === '$merge') continue
    const srcVal = source[key]
    const tgtVal = output[key]

    if (Array.isArray(srcVal)) {
      output[key] = srcVal
    } else if (srcVal && typeof srcVal === 'object' && tgtVal && typeof tgtVal === 'object') {
      output[key] = deepMerge(tgtVal, srcVal)
    } else {
      output[key] = srcVal
    }
  }

  return output
}

const loadOntology = (srcDir) => {
  if (!fs.existsSync(srcDir)) {
    throw new Error(`Source directory does not exist: ${srcDir}`)
  }

  const rawMap = new Map()
  const helperFiles = []

  const walk = (dir) => {
    const files = fs.readdirSync(dir)
    for (const file of files) {
      const fullPath = path.join(dir, file)
      const stat = fs.statSync(fullPath)

      if (stat.isDirectory()) {
        walk(fullPath)
      } else if (file.endsWith('.yaml') || file.endsWith('.yml')) {
        const content = fs.readFileSync(fullPath, 'utf8')
        const doc = yaml.load(content) || {}
        const basename = path.basename(file)
        const nameWithoutExt = basename.replace(/\.yaml$|\.yml$/, '')
        
        // Parse name and version if present e.g. coms.actor.created@1.0.0
        const [key, version] = nameWithoutExt.split('@')
        rawMap.set(nameWithoutExt, {
          key,
          version: version || '1.0.0',
          fullName: nameWithoutExt,
          filePath: fullPath,
          raw: doc,
        })
      } else if (file.endsWith('.js')) {
        const relPath = path.relative(srcDir, fullPath)
        const moduleKey = relPath.slice(0, -3).replace(/[/\\]/g, '_')
        helperFiles.push({
          key: moduleKey,
          fullPath,
          relPath,
        })
      }
    }
  }

  walk(srcDir)

  // Resolve $merge chains
  const resolvedMap = new Map()

  const resolveItem = (name, visited = new Set()) => {
    if (resolvedMap.has(name)) return resolvedMap.get(name)
    const item = rawMap.get(name)
    if (!item) {
      throw new Error(`Missing definition for $merge target: "${name}"`)
    }
    if (visited.has(name)) {
      throw new Error(`Circular $merge dependency detected: ${[...visited, name].join(' -> ')}`)
    }

    visited.add(name)
    let merged = { ...item.raw }

    if (merged.$merge) {
      const parentName = merged.$merge
      const parentItem = resolveItem(parentName, new Set(visited))
      merged = deepMerge(parentItem.resolved, merged)
    }

    const result = {
      ...item,
      resolved: merged,
    }

    resolvedMap.set(name, result)
    return result
  }

  for (const name of rawMap.keys()) {
    resolveItem(name)
  }

  return {
    rawMap,
    resolvedMap,
    helperFiles,
    srcDir,
  }
}

module.exports = {
  deepMerge,
  loadOntology,
}
