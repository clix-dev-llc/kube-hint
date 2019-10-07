// @flow

const fs = require('fs')
const chai = require('chai')
const yaml = require('js-yaml')

const { KubeHint, KubeHintResults } = require('../src/kube-hint')

const { expect } = chai
const { describe } = global
const { it } = global

function loadTestDocs (name /*: string */) {
  return yaml.safeLoadAll(
    fs.readFileSync(`./test/documents/${name}.yaml`, 'utf8')
  )
}

describe('KubeHint', () => {
  it('new KubeHint()', () => {
    const kubeHint = new KubeHint()
    expect(kubeHint).to.be.an.instanceof(KubeHint)
  })

  describe('.lint()', () => {
    it('No argument provided throws an error', () => {
      const kubeHint = new KubeHint()
      let error
      try {
        kubeHint.lint()
      } catch (err) {
        error = err
      }
      expect(error).to.be.an.instanceof(Error)
    })

    it('Lints a simple document', () => {
      const kubeHint = new KubeHint()
      const docs = loadTestDocs('simple')
      const results = kubeHint.lint(docs)
      expect(results, 'results').to.be.an('object')
      expect(
        Array.isArray(results.errors),
        'Array.isArray(results.errors)'
      ).to.equal(true)
      expect(
        Array.isArray(results.warnings),
        'Array.isArray(results.warnings)'
      ).to.equal(true)
      expect(
        Array.isArray(results.suggestions),
        'Array.isArray(results.suggestions)'
      ).to.equal(true)
      expect(
        Array.isArray(results.summary),
        'Array.isArray(results.summary)'
      ).to.equal(true)
      expect(results.errors.length, 'results.errors.length').to.equal(0)
      expect(
        results.warnings.length,
        'results.warnings.length'
      ).to.be.greaterThan(0)
      expect(
        results.suggestions.length,
        'results.suggestions.length'
      ).to.be.greaterThan(0)
      expect(
        results.summary.length,
        'results.summary.length'
      ).to.be.greaterThan(0)
    })

    it('Summary combines related documents (Deployment + PVC)', () => {
      const kubeHint = new KubeHint()
      const docs = loadTestDocs('simple-pvc')
      const results = kubeHint.lint(docs)
      expect(results.summary.length, 'summaries').to.be.greaterThan(0)
      console.log(results.summary)
    })
  })
})
