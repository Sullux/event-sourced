#!/usr/bin/env node
const fs = require('node:fs')
const path = require('node:path')
const { buildOntology } = require('../index')

const args = process.argv.slice(2)
const command = args[0] || 'build'

const parseOption = (flag, defaultVal) => {
  const idx = args.indexOf(flag)
  if (idx !== -1 && args[idx + 1]) {
    return args[idx + 1]
  }
  return defaultVal
}

const srcDir = parseOption('--src', './src')
const distDir = parseOption('--dist', './dist')
const docsDir = parseOption('--docs', './docs')

const runBuild = () => {
  try {
    const res = buildOntology({ srcDir, distDir, docsDir })
    console.log(`[event-ontology] Build successful:`)
    console.log(`  JS Plugin -> ${path.join(distDir, 'index.js')}`)
    console.log(`  SQL DDL   -> ${path.join(distDir, 'schema.sql')}`)
    console.log(`  Docs      -> ${path.join(docsDir, 'README.md')}`)
  } catch (err) {
    console.error(`[event-ontology] Build failed: ${err.message}`)
    if (!command.includes('watch')) {
      process.exit(1)
    }
  }
}

if (command === 'build') {
  runBuild()
} else if (command === 'watch') {
  runBuild()
  console.log(`[event-ontology] Watching for changes in ${srcDir}...`)
  fs.watch(path.resolve(srcDir), { recursive: true }, (eventType, filename) => {
    if (filename) {
      console.log(`[event-ontology] File changed (${filename}), rebuilding...`)
      runBuild()
    }
  })
} else {
  console.log(`Usage: event-ontology [build|watch] [--src ./src] [--dist ./dist] [--docs ./docs]`)
  process.exit(1)
}
