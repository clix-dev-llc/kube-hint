// @flow

const fs = require('fs')
const chai = require('chai')
const yaml = require('js-yaml')

const KubeHint = require('../src/kube-hint')

const expect = chai.expect
const describe = global.describe
const it = global.it

function loadTestDocs (name /*: string */) {
  return yaml.safeLoadAll(fs.readFileSync(`./test/documents/${name}.yaml`, 'utf8'))
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
      expect(results).to.be.an('object')
      expect(Array.isArray(results.errors)).to.equal(true)
      expect(Array.isArray(results.warnings)).to.equal(true)
      expect(Array.isArray(results.suggestions)).to.equal(true)
      expect(Array.isArray(results.summary)).to.equal(true)
    })
  })
})
