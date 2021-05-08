const assert = require('assert');
const child_process = require('child_process');
const fs = require('fs');
const sh = require('shelljs');

const cwd = sh.pwd().toString();

function runLessWatchCompiler(argumentsAndOptions, callback) {
  return child_process.exec(cwd + '/dist/less-watch-compiler.js ' + argumentsAndOptions, callback)
}

describe('Using the CLI in example projects', function () {
  describe('with-hidden-variables-file', function () {
    const lessDir = cwd + '/tests/examples/with-hidden-variables-file/less'
    const cssDir = cwd + '/tests/examples/with-hidden-variables-file/css'

    it('should compile main.css correctly', function (done) {
      // Make sure we're testing against the main.css file compiled by this test run
      fs.rmSync(cssDir + '/main.css', { force: true })
      
      runLessWatchCompiler(lessDir + ' ' + cssDir + " --include-hidden")

      // Wait for compilation to happen
      setTimeout(function () {
        const contents = fs.readFileSync(cssDir + '/main.css')
        const contentsExpected = fs.readFileSync(cssDir + '/expected.css')
        
        assert.ok(contents.equals(contentsExpected))

        fs.rmSync(cssDir + '/main.css', { force: true })

        done()
      }, 500)
    })

    it('should not compile the hidden variables files', function (done) {
      const compiledVariablesPath = cssDir + '/_variables.css'
      const compiledOtherVariablesPath = cssDir + '/.other-variables.css'
      
      // Make sure we don't detect compiled variables files left over from other runs
      fs.rmSync(compiledVariablesPath, { force: true })
      fs.rmSync(compiledOtherVariablesPath, { force: true })

      runLessWatchCompiler(lessDir + ' ' + cssDir + " --include-hidden")

      // Wait for compilation to happen
      setTimeout(function () {
        console.log("ls css:" + child_process.execSync("ls " + cssDir))

        const variablesFilesWereNotCompiled = !fs.existsSync(compiledVariablesPath) &&
          !fs.existsSync(compiledOtherVariablesPath)

        assert.ok(variablesFilesWereNotCompiled)
        done()
      }, 500)
    })
  })
})
