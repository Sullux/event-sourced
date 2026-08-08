const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')
const { buildOntology } = require('../index')

test('event-ontology - loads YAML files, resolves $merge chains, and builds JS/SQL/Docs', async () => {
  const tmpDir = path.join(__dirname, '.tmp-' + Date.now())
  const srcDir = path.join(tmpDir, 'src')
  const distDir = path.join(tmpDir, 'dist')
  const docsDir = path.join(tmpDir, 'docs')

  fs.mkdirSync(srcDir, { recursive: true })

  // Write sample domain files
  fs.writeFileSync(path.join(srcDir, 'coms.yaml'), `
description: "The coms domain ontology"
persisted: true
replicated: true
$defs:
  uuid:
    type: string
    pattern: "^[0-9a-f]{32}$"
`)

  fs.writeFileSync(path.join(srcDir, 'coms.actor.yaml'), `
$merge: coms
description: "Actor entity"
$partitionKey: "({ id }) => 'actor#' + id"
$deduplicationId: "id"
type: object
properties:
  id:
    $ref: uuid
    type: string
  name:
    type: string
  type:
    type: string
    enum: [individual, agent]
required: [id, name, type]
$dbSchema:
  actors:
    tableName: coms_actors
    columns:
      id: "varchar(32) PRIMARY KEY"
      name: "varchar(32) NOT NULL"
      type: "varchar(16) NOT NULL"
`)

  fs.writeFileSync(path.join(srcDir, 'coms.actor.created@1.0.0.yaml'), `
$merge: coms.actor
description: "Emitted when a [[coms.actor]] is created"
$factory: "(payload, db, context) => ({ ...payload, id: context.utils.uuid() })"
$validate: "async (payload, db, context) => payload.name === 'bad' ? ['name is bad'] : []"
$projections: "({ payload }, db) => db.query('INSERT INTO coms_actors VALUES ($id, $name, $type)', payload)"
$sideeffects: "({ payload }, db, context) => context.utils.notify(payload)"
`)

  fs.writeFileSync(path.join(srcDir, 'utils.js'), `
module.exports = {
  uuid: () => '12345678901234567890123456789012',
  notify: () => 'notified',
}
`)

  // Run buildOntology
  const res = buildOntology({ srcDir, distDir, docsDir })

  assert.ok(fs.existsSync(path.join(distDir, 'index.js')))
  assert.ok(fs.existsSync(path.join(distDir, 'schema.sql')))
  assert.ok(fs.existsSync(path.join(distDir, 'ddl.js')))
  assert.ok(fs.existsSync(path.join(docsDir, 'README.md')))

  // Test SQL output
  const sql = fs.readFileSync(path.join(distDir, 'schema.sql'), 'utf8')
  assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS coms_actors'))

  // Test Docs output
  const docs = fs.readFileSync(path.join(docsDir, 'README.md'), 'utf8')
  assert.ok(docs.includes('[`coms.actor`](#comsactor)'))

  // Test Runtime Plugin Contract
  const plugin = require(path.join(distDir, 'index.js'))
  assert.strictEqual(plugin.definitions.length, 1)

  const def = plugin.definitions[0]
  assert.strictEqual(def.type, 'coms.actor.created')
  assert.strictEqual(def.version, '1.0.0')

  // Test factory
  const created = def.factory({ name: 'Charles', type: 'individual' }, null, plugin.context)
  assert.strictEqual(created.id, '12345678901234567890123456789012')
  assert.strictEqual(created.name, 'Charles')

  // Test custom validation
  await assert.rejects(async () => {
    await def.validate({ id: '12345678901234567890123456789012', name: 'bad', type: 'individual' }, null)
  }, /Custom Validation Error/)

  // Clean up
  fs.rmSync(tmpDir, { recursive: true, force: true })
})
