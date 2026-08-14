const fs = require('node:fs')
const path = require('node:path')
const { loadOntology } = require('./lib/loader')
const { compilePluginCode } = require('./lib/compile-plugin')
const { compileDdlSql, compileDdlJs } = require('./lib/compile-ddl')
const { compileMarkdownDocs } = require('./lib/compile-docs')

const buildOntology = (options = {}) => {
  const srcDir = path.resolve(options.srcDir || './src')
  const distDir = path.resolve(options.distDir || './dist')
  const docsDir = path.resolve(options.docsDir || './docs')

  const ontology = loadOntology(srcDir)

  // Ensure output directories exist
  fs.mkdirSync(distDir, { recursive: true })
  fs.mkdirSync(docsDir, { recursive: true })

  // Target 1: JavaScript Plugin Contract
  const pluginCode = compilePluginCode(ontology, { distDir })
  fs.writeFileSync(path.join(distDir, 'index.js'), pluginCode, 'utf8')

  // Target 2: Database DDL
  const ddlSql = compileDdlSql(ontology)
  const ddlJs = compileDdlJs(ontology)
  fs.writeFileSync(path.join(distDir, 'schema.sql'), ddlSql, 'utf8')
  fs.writeFileSync(path.join(distDir, 'ddl.js'), ddlJs, 'utf8')

  // Target 3: Documentation
  const markdownDocs = compileMarkdownDocs(ontology)
  fs.writeFileSync(path.join(docsDir, 'README.md'), markdownDocs, 'utf8')

  return {
    ontology,
    distDir,
    docsDir,
  }
}

module.exports = {
  loadOntology,
  compilePluginCode,
  compileDdlSql,
  compileDdlJs,
  compileMarkdownDocs,
  buildOntology,
}
