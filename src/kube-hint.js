// @flow

// const jsonschema = require('jsonschema')

/* flow-include
type lintRules = {
  version: 'string'
}
*/

class KubeHintResults {
  errors /*: Array<Object> */ = []
  warnings /*: Array<Object> */ = []
  suggestions /*: Array<Object> */ = []
  summary /*: Array<Object> */ = []

  error = (docNumber /*: number */, key /*: string */, message /*: string */) => {
    this.errors.push({ docNumber, key, message })
  }

  warn = (docNumber /*: number */, key /*: string */, message /*: string */) => {
    this.warnings.push({ docNumber, key, message })
  }

  suggest = (docNumber /*: number */, key /*: string */, message /*: string */) => {
    this.suggestions.push({ docNumber, key, message })
  }

  summarize = (docNumber /*: number */, data /*: Object */) => {
    this.summary.push({ docNumber, ...data })
  }
}

class KubeHint {
  defaultLintRules = {
    version: '1.15.4'
  }

  constructor (lintRules /*: Object|void */) {
    if (lintRules) this.defaultLintRules = lintRules
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

    const results /*: KubeHintResults */ = new KubeHintResults()

    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i]
      this.lintDocument(doc, i, results, rules)
    }

    return results
  }

  lintDocument (
    doc /*: Object */,
    docNumber /*: number */,
    results /*: KubeResults */ = new KubeHintResults(),
    rules /*: lintRules */ = this.defaultLintRules
  ) {
    const { error } = results

    // Basic structure sanity check
    if (!doc || typeof doc !== 'object') error(null, 'Document is not an object!')
    else if (!doc.apiVersion || typeof doc.apiVersion !== 'string') error('apiVersion', 'apiVersion is invalid!')
    else if (!doc.kind || typeof doc.kind !== 'string') error('kind', 'kind is invalid!')
    // Do not continue if any fatal errors above have occurred
    if (results.errors.length > 0) return results

    const kind = doc.kind.toLowerCase()
    const documentLinter = this.documentLinters[kind]

    if (documentLinter) {
      if (documentLinter[doc.apiVersion]) {
        documentLinter[doc.apiVersion](doc, docNumber, results)
      } else if (documentLinter.default) {
        documentLinter.default(doc, docNumber, results)
      }
    } else process.stdout.write(`-> Warning! No linter defined for ${doc.apiVersion}/${doc.kind}\n`)

    return results
  }

  documentLinters = {
    persistentvolumeclaim: {
      default: (doc /*: Object */, docNumber /*: number */, results /*: KubeHintResults */) => {
        const kind = doc.kind.toLowerCase()
        results.summarize(docNumber, { kind, docNumber, name: doc.metadata.name })
        return results
      }
    },
    deployment: {
      'apps/v1': (doc /*: Object */, docNumber /*: number */, results /*: KubeHintResults */) => {
        return this.documentLinters.deployment.default(doc, docNumber, results)
      },
      default: (doc /*: Object */, docNumber /*: number */, results /*: KubeHintResults */) => {
        const { suggest, error, warn, summarize } = results
        const kind = doc.kind.toLowerCase()
        const containers = []

        if (doc.spec.replicas < 2) suggest(docNumber, 'spec.replicas', 'One replica implies a single point of failure!')
        if (doc.spec.template.spec.containers.length < 1) error(docNumber, 'spec.template.spec.containers.length', 'No containers in this Deployment?')

        for (let i = 0; i < doc.spec.template.spec.containers.length; i++) {
          const container = doc.spec.template.spec.containers[i]
          containers.push({
            image: container.image,
            ports: container.ports
          })
          if (!container.resources) warn(docNumber, `spec.template.spec.containers[${i}]`, 'No resource limits defined!')
        }

        summarize(docNumber, {
          kind,
          name: doc.metadata.name,
          containers,
          message: `${doc.spec.replicas} ${doc.spec.replicas > 1 ? 'replicas' : 'replica'} of "${doc.spec.template.spec.containers.map(c => c.image).join('", "')}"`
        })

        return results
      }
    }
  }
}

module.exports = {
  KubeHint, KubeHintResults
}
