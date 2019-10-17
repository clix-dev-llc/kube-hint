// @flow

// const jsonschema = require('jsonschema')

/* flow-include
type lintRules = {
  version: 'string'
}
*/

class KubeHintResults {
  errors /*: Array<Object> */ = [];
  warnings /*: Array<Object> */ = [];
  suggestions /*: Array<Object> */ = [];

  error = (
    docNumber /*: number */,
    key /*: string */,
    message /*: string */
  ) => {
    this.errors.push({ docNumber, key, message })
  };

  warn = (
    docNumber /*: number */,
    key /*: string */,
    message /*: string */
  ) => {
    this.warnings.push({ docNumber, key, message })
  };

  suggest = (
    docNumber /*: number */,
    key /*: string */,
    message /*: string */
  ) => {
    this.suggestions.push({ docNumber, key, message })
  };
}

class KubeHint {
  defaultLintRules = {
    version: '1.15.4'
  };

  constructor (lintRules /*: Object|void */) {
    if (lintRules) this.defaultLintRules = lintRules
  }

  lint (
    docs /*: Array<Object> */,
    rules /*: lintRules */ = this.defaultLintRules
  ) /*: KubeHintResults */ {
    if (!docs || !Array.isArray(docs)) {
      throw new Error(
        'Lint expects an array of document objects as its first argument'
      )
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
    if (!doc || typeof doc !== 'object') { error(null, 'Document is not an object!') } else if (!doc.apiVersion || typeof doc.apiVersion !== 'string') { error('apiVersion', 'apiVersion is invalid!') } else if (!doc.kind || typeof doc.kind !== 'string') { error('kind', 'kind is invalid!') }
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
    } else {
      process.stdout.write(
        `-> Warning! No linter defined for ${doc.apiVersion}/${doc.kind}\n`
      )
    }

    return results
  }

  documentLinters = {
    persistentvolumeclaim: {
      default: (
        doc /*: Object */,
        docNumber /*: number */,
        results /*: KubeHintResults */
      ) => {
        // const kind = doc.kind.toLowerCase()
        return results
      }
    },
    deployment: {
      'apps/v1': (
        doc /*: Object */,
        docNumber /*: number */,
        results /*: KubeHintResults */
      ) => {
        return this.documentLinters.deployment.default(doc, docNumber, results)
      },
      default: (
        doc /*: Object */,
        docNumber /*: number */,
        results /*: KubeHintResults */
      ) => {
        const { suggest, error, warn } = results
        const kind = doc.kind.toLowerCase()

        if (doc.spec.replicas < 2) {
          suggest(
            docNumber,
            'spec.replicas',
            'One replica implies a single point of failure!'
          )
        }
        if (doc.spec.template.spec.containers.length < 1) {
          error(
            docNumber,
            'spec.template.spec.containers.length',
            'No containers in this Deployment?'
          )
        }

        for (let i = 0; i < doc.spec.template.spec.containers.length; i++) {
          const container = doc.spec.template.spec.containers[i]
          if (!container.resources) {
            warn(
              docNumber,
              `spec.template.spec.containers[${i}]`,
              'No resource limits defined!'
            )
          }
        }

        return results
      }
    }
  };

  summarizeDocuments (docs /*: Array<Object> */) {
    // subjects: pods, replicasets, daemonsets, statefulsets, deployments, cronjobs, jobs
    const summaries = []
    docs.filter(d => {
      return [
        'pod', 'replicaset', 'daemonset', 'statefulset', 'deployment', 'cronjob', 'job'
      ].indexOf(d.kind.toLowerCase().replace(/s$/, '')) > -1
    }).map(doc => {
      const spec = doc.spec.template.spec
      const summary = []
      const article = ['a', 'e', 'i', 'o', 'u'].indexOf(doc.metadata.name[0].toLowerCase()) > -1 ? 'An' : 'A'
      let subjectSummary = `${article} "${doc.metadata.name}" ${doc.kind}, with `
      const imagesSummary = []
      const servicesSummary = []

      // - Images
      // A "redis" Deployment, with 1 replica of “redis/redis”
      for (let i = 0; i < spec.containers.length; i++) {
        const container = spec.containers[i]
        imagesSummary.push(`${doc.spec.replicas} ${doc.spec.replicas > 1 ? 'replicas' : 'replica'} of "${container.image}"`)

        // - Services
        // exposed internally (not to the internet) at the DNS address “redis”
        if (container.ports) {
          // Find services that match this container/port
          const services = docs.filter(d => d.kind.toLowerCase() === 'service').filter(s => {
            let matches = true
            for (const selector in s.spec.selector) {
              if (doc.spec.template.metadata.labels[selector] !== s.spec.selector[selector]) {
                matches = false
              }
            }
            return matches
          })
          // We have a matching service
          if (services.length > 0) {
            services.map(s => {
              const ingresses = docs.filter(d => d.kind.toLowerCase() === 'ingress').filter(s => {
                let matches = false
                for (const i in s.spec.rules) {
                  const rule = s.spec.rules[i]
                  if (rule && rule.http && rule.http.paths.filter(p => p && p.backend && p.backend.serviceName === s.metadata.name)) {
                    matches = true
                  }
                }
                return matches
              })
              const portsStr = `(${s.spec.ports.map(p => p.port).join(', ')})`

              if (s.spec.type) {
                const type = s.spec.type.toLowerCase()
                if (type === 'nodeport') {
                  servicesSummary.push(`exposed externally via NodePort ${portsStr}`)
                } else if (type === 'loadbalancer') {
                  servicesSummary.push(`exposed via LoadBalancer ${portsStr}`)
                }
              }
              if (ingresses.length > 0) {
                const ingressesStr = `(${ingresses.map(i => i.metadata.name).join(', ')})`
                const noun = ingresses.length > 1 ? 'ingresses' : 'ingress'
                servicesSummary.push(`exposed externally via ${noun} ${ingressesStr}`)
              } else {
                servicesSummary.push(`exposed internally (not to the internet) at the DNS address "${s.metadata.name}" ${portsStr}`)
              }
              // check if associated ingress
            })
          }
        }
      }
      subjectSummary += imagesSummary.join(' and ')
      summary.push([subjectSummary])
      if (servicesSummary.length > 0) summary.push(servicesSummary)

      // - Volumes
      // with a 80gb volume "redis-pvc" mounted at /data
      if (spec.volumes) {
        const volumesSummary = []
        for (let i = 0; i < spec.volumes.length; i++) {
          if (spec.volumes[i].persistentVolumeClaim) {
            const pvc = docs.find(d => d.kind.toLowerCase() === 'persistentvolumeclaim' && d.metadata.name === spec.volumes[i].persistentVolumeClaim.claimName)
            spec.containers.map(c => c.volumeMounts && c.volumeMounts.map(v => {
              if (v.name === spec.volumes[i].name) {
                volumesSummary.push(`a ${pvc.spec.resources.requests.storage} volume "${pvc.metadata.name}" mounted at ${v.mountPath}`)
              }
            }))
          } else if (spec.volumes[i].secret) {
            spec.containers.map(c => c.volumeMounts && c.volumeMounts.map(v => {
              if (v.name === spec.volumes[i].name) {
                volumesSummary.push(`a volume from the secret "${v.name}" mounted at ${v.mountPath}`)
              }
            }))
          }
        }
        if (volumesSummary.length > 0) {
          summary.push(volumesSummary)
        }
      }

      summaries.push(summary)
    })
    return summaries
  }
}

module.exports = {
  KubeHint,
  KubeHintResults
}
