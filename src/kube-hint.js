// @flow

/* flow-include
type lintResults = {
  errors: [],
  warnings: [],
  suggestions: [],
  summary: []
}
*/

module.exports = class KubeHint {
  lint (docs /*: Array<Object> */) /*: lintResults */ {
    if (!docs || !Array.isArray(docs)) {
      throw new Error('Lint expects an array of document objects as its first argument')
    }

    const results /*: lintResults */ = {
      errors: [],
      warnings: [],
      suggestions: [],
      summary: []
    }

    return results
  }
}
