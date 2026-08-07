const assert = require('assert'),
  cwd = process.cwd(),
  path = require('path'),
  fs = require('fs'),
  execSync = require('child_process').execSync,
  outDir = cwd + '/test/css';

describe('The CLI should', function () {
  describe('run correctly with these options:', function () {
    describe('--main-file parameter', function () {
      const lessDir = cwd + '/test/examples/with-main-file/less',
        expectedCssDir = cwd + '/test/examples/with-main-file/css',
        filename = '/with-main-file.css',
        mainfilename = 'with-main-file.less',
        mainfileoutput = '/with-main-file.css';

      it('should combine css into main file with --main-file parameter', () => {
        cli('--run-once', lessDir, outDir, '--main-file', mainfilename);
        const contents = fs.readFileSync(outDir + mainfileoutput),
          contentsExpected = fs.readFileSync(expectedCssDir + filename);
        assert.ok(contents.equals(contentsExpected));
        fs.rmSync(outDir + mainfileoutput, { force: true });
      });

      it('should combine css into main file with when mainfile is passed as 3rd parameter', () => {
        const mainfilename = 'with-main-file-2.less',
          mainfileoutput = '/with-main-file-2.css';
        cli('--run-once', lessDir, outDir, mainfilename);
        const contents = fs.readFileSync(outDir + mainfileoutput),
          contentsExpected = fs.readFileSync(expectedCssDir + filename);
        assert.ok(contents.equals(contentsExpected));
        fs.rmSync(outDir + mainfileoutput, { force: true });
      });
    });

    describe('--config parameter', function () {
      const cssDir = cwd + '/test/examples/with-config/css',
        filename = '/with-config.css';
      it('should load a config json', () => {
        cli('--run-once', '--config', cwd + '/test/examples/with-config/less-watch-compiler.config.json');
        const contents = fs.readFileSync(outDir + filename),
          contentsExpected = fs.readFileSync(cssDir + filename);
        assert.ok(contents.equals(contentsExpected));

        fs.rmSync(outDir + filename, { force: true });
      });
    });

    describe('--run-once parameter', function () {
      it('exit after once', () => {
        cli('--run-once', 'test/less', 'test/css');
      });
    });

    describe('--include-hidden parameter', function () {
      const lessDir = cwd + '/test/examples/with-hidden-variables-file/less',
        expectedCSSDir = cwd + '/test/examples/with-hidden-variables-file/css',
        filename = '/with-hidden.css';

      it('should compile hidden files when parameter is specified', () => {
        cli('--include-hidden', '--run-once', lessDir, outDir);
        const contents = fs.readFileSync(outDir + filename),
          contentsExpected = fs.readFileSync(expectedCSSDir + filename);
        assert.ok(contents.equals(contentsExpected));
        fs.rmSync(outDir + filename, { force: true });
      });

      it('should not compile the hidden variables files when flag not specified', () => {
        const compiledVariablesPath = outDir + '/_variables.css',
          compiledOtherVariablesPath = outDir + '/.other-variables.css';

        // Make sure we don't detect compiled variables files left over from other runs
        fs.rmSync(compiledVariablesPath, { force: true });
        fs.rmSync(compiledOtherVariablesPath, { force: true });

        const variablesFilesWereNotCompiled = !fs.existsSync(compiledVariablesPath) && !fs.existsSync(compiledOtherVariablesPath);

        assert.ok(variablesFilesWereNotCompiled);
      });
    });

    describe('--enable-js parameter', function () {
      const lessDir = cwd + '/test/examples/with-js/less',
        expectedCssDir = cwd + '/test/examples/with-js/css',
        filename = '/with-js.css';

      it('should load a config json', () => {
        cli('--enable-js', '--run-once', lessDir, outDir);
        const contents = fs.readFileSync(outDir + filename),
          contentsExpected = fs.readFileSync(expectedCssDir + filename);
        assert.ok(contents.equals(contentsExpected));
        fs.rmSync(outDir + filename, { force: true });
      });
    });

    describe('--source-map parameter', function () {
      const lessDir = cwd + '/test/examples/with-source-map/less',
        expectedCssDir = cwd + '/test/examples/with-source-map/css',
        filename = '/with-source-map.css',
        sourcemapfile = '/with-source-map.css.map';

      before(() => {
        cli('--source-map', '--run-once', lessDir, outDir);
      });

      it('should generate the css file', () => {
        const contents = fs.readFileSync(outDir + filename),
          contentsExpected = fs.readFileSync(expectedCssDir + filename);
        assert.ok(contents.equals(contentsExpected));
        fs.rmSync(outDir + filename, { force: true });
      });
      it('should generate the sourcemap', () => {
        const contents = fs.readFileSync(outDir + sourcemapfile),
          contentsExpected = fs.readFileSync(expectedCssDir + sourcemapfile);
        assert.ok(contents.equals(contentsExpected));
        fs.rmSync(outDir + sourcemapfile, { force: true });
      });
    });

    describe('--less-args parameter', function () {
      const lessDir = cwd + '/test/examples/with-less-args/less',
        expectedCssDir = cwd + '/test/examples/with-less-args/css',
        filename = '/with-less-args.css';

      it('should generate the css file according to the less arguments', () => {
        cli(lessDir, outDir, '--run-once', '--less-args', 'math=strict,strict-units=on');
        const contents = fs.readFileSync(outDir + filename),
          contentsExpected = fs.readFileSync(expectedCssDir + filename);
        assert.ok(contents.equals(contentsExpected));
        fs.rmSync(outDir + filename, { force: true });
      });
    });
  });

  describe('fail loudly instead of silently falling back, when:', function () {
    let tmpDir;
    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(cwd, 'test/tmp-cli-'));
      fs.mkdirSync(path.join(tmpDir, 'less'));
      fs.writeFileSync(path.join(tmpDir, 'less', 'a.less'), '.a { color: red; }');
    });
    afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

    it('the config file exists but is not valid JSON', () => {
      const configPath = path.join(tmpDir, 'broken.config.json');
      fs.writeFileSync(configPath, '{ "watchFolder": "less", oops }');
      const result = cliExpectFailure('--run-once', '--config', configPath);
      assert.equal(result.status, 1);
      assert.match(result.output, /is not valid JSON/);
      assert.match(result.output, /broken\.config\.json/);
    });

    it('an explicitly requested --config file does not exist', () => {
      const result = cliExpectFailure('--run-once', '--config', path.join(tmpDir, 'typo.config.json'), path.join(tmpDir, 'less'), outDir);
      assert.equal(result.status, 1);
      assert.match(result.output, /Cannot read config file/);
    });

    it('the watch folder does not exist', () => {
      const result = cliExpectFailure('--run-once', path.join(tmpDir, 'no-such-folder'), outDir);
      assert.equal(result.status, 1);
      assert.match(result.output, /does not exist\./);
      assert.doesNotMatch(result.output, /at Object\.|node:internal/, 'must be a plain message, not an uncaught stack trace');
    });

    it('the watch folder is a file rather than a directory', () => {
      const result = cliExpectFailure('--run-once', path.join(tmpDir, 'less', 'a.less'), outDir);
      assert.equal(result.status, 1);
      assert.match(result.output, /is not a directory\./);
      assert.doesNotMatch(result.output, /at Object\.|node:internal/, 'must be a plain message, not an uncaught stack trace');
    });

    it('but still stays quiet when no config file was asked for and none exists', () => {
      // The default config path being absent is the ordinary case, not an error.
      const out = cli('--run-once', path.join(tmpDir, 'less'), path.join(tmpDir, 'css')).toString();
      assert.doesNotMatch(out, /Cannot read config file/);
      assert.ok(fs.existsSync(path.join(tmpDir, 'css', 'a.css')));
    });
  });

  describe('survive a hostile watch tree:', function () {
    it('a symlink loop does not crash the run or flood the output folder', () => {
      const tmpDir = fs.mkdtempSync(path.join(cwd, 'test/tmp-cli-loop-'));
      try {
        fs.mkdirSync(path.join(tmpDir, 'less'));
        fs.writeFileSync(path.join(tmpDir, 'less', 'a.less'), '.a { color: red; }');
        fs.symlinkSync(tmpDir, path.join(tmpDir, 'less', 'loop'), 'dir');

        cli('--run-once', path.join(tmpDir, 'less'), path.join(tmpDir, 'css'));

        assert.ok(fs.existsSync(path.join(tmpDir, 'css', 'a.css')), 'the real file must still compile');
        const dirs = fs.readdirSync(path.join(tmpDir, 'css'), { withFileTypes: true }).filter((e) => e.isDirectory());
        assert.equal(dirs.length, 0, 'following the loop must not create nested output directories');
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });
});

function cli(...args) {
  const command = `node ${path.resolve('dist/less-watch-compiler.js')} ${args.join(' ')}`;
  return execSync(command);
}

// execSync throws on a non-zero exit, which is exactly what these cases do;
// capture the status and the combined output instead of letting it propagate.
function cliExpectFailure(...args) {
  const command = `node ${path.resolve('dist/less-watch-compiler.js')} ${args.join(' ')}`;
  try {
    const output = execSync(command, { stdio: ['ignore', 'pipe', 'pipe'] });
    return { status: 0, output: output.toString() };
  } catch (err) {
    return { status: err.status, output: (err.stdout || '').toString() + (err.stderr || '').toString() };
  }
}
