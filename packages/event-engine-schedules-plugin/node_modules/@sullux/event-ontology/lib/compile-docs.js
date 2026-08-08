const resolveWikilinks = (text = '') => {
  return text.replace(/\[\[([a-zA-Z0-9_.-]+)\]\]/g, (match, linkTarget) => {
    return `[\`${linkTarget}\`](#${linkTarget.replace(/[^a-zA-Z0-9]/g, '')})`
  })
}

const compileMarkdownDocs = (ontology) => {
  const lines = []
  lines.push(`# Domain Ontology Reference`)
  lines.push(`\nAuto-generated documentation from YAML ontology definition files.\n`)

  lines.push(`---`)
  lines.push(`\n## Table of Contents\n`)

  for (const [fullName, item] of ontology.resolvedMap.entries()) {
    const anchor = fullName.replace(/[^a-zA-Z0-9]/g, '')
    lines.push(`- [${fullName}](#${anchor})`)
  }

  lines.push(`\n---`)

  for (const [fullName, item] of ontology.resolvedMap.entries()) {
    const anchor = fullName.replace(/[^a-zA-Z0-9]/g, '')
    const resolved = item.resolved

    lines.push(`\n<a name="${anchor}"></a>`)
    lines.push(`\n### ${fullName}`)

    if (resolved.description) {
      lines.push(`\n${resolveWikilinks(resolved.description.trim())}\n`)
    }

    if (resolved.properties && Object.keys(resolved.properties).length > 0) {
      lines.push(`#### Properties\n`)
      lines.push(`| Property | Type | Required | Description |`)
      lines.push(`| --- | --- | --- | --- |`)

      const requiredList = Array.isArray(resolved.required) ? resolved.required : []
      for (const [propName, propDef] of Object.entries(resolved.properties)) {
        const isReq = requiredList.includes(propName) ? 'Yes' : 'No'
        const propType = propDef.type || (propDef.$ref ? `ref (${propDef.$ref})` : 'any')
        const desc = propDef.description ? resolveWikilinks(propDef.description.trim().replace(/\n/g, ' ')) : '-'
        lines.push(`| \`${propName}\` | \`${propType}\` | ${isReq} | ${desc} |`)
      }
      lines.push('')
    }

    if (resolved.$dbSchema) {
      lines.push(`#### Database Schema\n`)
      for (const [entityName, tableDef] of Object.entries(resolved.$dbSchema)) {
        const tableName = tableDef.tableName || entityName
        lines.push(`* **Table:** \`${tableName}\``)
      }
      lines.push('')
    }
  }

  return lines.join('\n')
}

module.exports = {
  resolveWikilinks,
  compileMarkdownDocs,
}
