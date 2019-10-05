// @flow

// const jsonschema = require('jsonschema')

/* flow-include
type lintRules = {
  version: 'string'
}
*/

function KubeHintResults () {
  this.errors = []
  this.warnings = []
  this.suggestions = []
  this.summary = []
  return this
}

module.exports = class KubeHint {
  defaultLintRules = {
    version: '1.15.1'
  }

  _error (results /*: KubeHintResults */, docNumber /*: number */, key /*: string */, message /*: string */) {
    results.errors.push({ docNumber, key, message })
  }

  _warn (results /*: KubeHintResults */, docNumber /*: number */, key /*: string */, message /*: string */) {
    results.warnings.push({ docNumber, key, message })
  }

  _suggest (results /*: KubeHintResults */, docNumber /*: number */, key /*: string */, message /*: string */) {
    results.suggestions.push({ docNumber, key, message })
  }

  _summarize (results /*: KubeHintResults */, message /*: string */) {
    results.summary.push({ message })
  }

  mergeLintResults (results /*: KubeHintResults */ = {}, existing /*: KubeHintResults */) {
    existing.errors = existing.errors.concat(results.errors || [])
    existing.warnings = existing.warnings.concat(results.warnings || [])
    existing.suggestions = existing.suggestions.concat(results.suggestions || [])
    existing.summary = existing.summary.concat(results.summary || [])
    return existing
  }

  lint (
    docs /*: Array<Object> */,
    rules /*: lintRules */ = this.defaultLintRules
  ) /*: KubeHintResults */ {
    if (!docs || !Array.isArray(docs)) {
      throw new Error('Lint expects an array of document objects as its first argument')
    }
    if (!rules || typeof rules !== 'object') {
      throw new Error('Lint expects a lintRules object as its second argument')
    }

    let results /*: KubeHintResults */ = new KubeHintResults()

    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i]
      results = this.mergeLintResults(this.lintDocument(doc, rules), results)
    }

    return results
  }

  lintDocument (
    doc /*: Object */,
    docNumber /*: number */,
    rules /*: lintRules */ = this.defaultLintRules
  ) {
    const results /*: KubeHintResults */ = new KubeHintResults()

    const error = this._error.bind(undefined, results, docNumber)
    // const warn = this._warn.bind(undefined, results, docNumber)
    // const suggest = this._suggest.bind(undefined, results, docNumber)
    const summarize = this._summarize.bind(undefined, results)

    // Basic structure sanity check
    if (!doc || typeof doc !== 'object') error(null, 'Document is not an object!')
    else if (!doc.apiVersion || typeof doc.apiVersion !== 'string') error('apiVersion', 'apiVersion is invalid!')
    else if (!doc.kind || typeof doc.kind !== 'string') error('kind', 'kind is invalid!')

    // Do not continue if any fatal errors above have occurred
    if (results.errors.length > 0) return results

    const documentLinter = this.documentLinters[doc.kind.toLowerCase()]
    if (documentLinter) {
      if (documentLinter[doc.apiVersion]) {
        this.mergeLintResults(documentLinter[doc.apiVersion](doc, docNumber), results)
      } else if (documentLinter[doc.apiVersion].default) {
        this.mergeLintResults(documentLinter[doc.apiVersion].default(doc, docNumber), results)
      }
    } else process.stdout.write(`-> Warning! No linter defined for ${doc.apiVersion}/${doc.kind}\n`)

    summarize('A summary of things!')

    return results
  }

  documentLinters = {
    deployment: {
      'apps/v1': (doc /*: Object */, docNumber /*: number */) => {
        return this.documentLinters.deployment.default(doc, docNumber)
      },
      default: (doc /*: Object */, docNumber /*: number */) => {
        const results = new KubeHintResults()
        const suggest = this._suggest.bind(undefined, results, docNumber)
        const error = this._error.bind(undefined, results, docNumber)
        const warn = this._warn.bind(undefined, results, docNumber)

        if (doc.spec.replicas < 2) suggest('spec.replicas', 'One replica implies a single point of failure!')
        if (doc.spec.template.spec.containers.length < 1) error('spec.template.spec.containers.length', 'No containers in this Deployment?')

        for (let i = 0; i < doc.spec.template.spec.containers.length; i++) {
          const container = doc.spec.template.spec.containers[i]
          if (!container.resources) warn(`spec.template.spec.containers[${i}]`, 'No resource limits defined!')
        }

        return results
      }
    }
  }
}
