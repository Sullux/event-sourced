const compiledPlugin = require('./dist/index')

module.exports = {
  ...compiledPlugin,
  name: '@sullux/event-engine-files-plugin',
}
