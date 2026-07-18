const assert = require('assert'),
  path = require('path'),
  fs = require('fs'),
  api = require('../dist/index.js'),
  cwd = process.cwd(),
  outDir = path.join(cwd, 'test', 'css');

describe('Programmatic API (require("less-watch-compiler"))', function () {
  this.timeout(10000);

  it('exposes compileFile, watch, findLessImportsInFile, and buildRenderOptions', function () {
    assert.equal(typeof api.compileFile, 'function');
    assert.equal(typeof api.watch, 'function');
    assert.equal(typeof api.findLessImportsInFile, 'function');
    assert.equal(typeof api.buildRenderOptions, 'function');
  });

  it('compileFile() compiles a single file and resolves with the output path', async function () {
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });
    const output = await api.compileFile('test/examples/with-config/less/with-config.less', 'test/css');
    assert.equal(output, path.join('test', 'css', 'with-config.css'));
    const produced = fs.readFileSync(output);
    const golden = fs.readFileSync(path.join(cwd, 'test', 'examples', 'with-config', 'css', 'with-config.css'));
    assert.ok(produced.equals(golden), 'API output must match the CLI golden output');
  });

  it('compileFile() honors the minified option', async function () {
    const output = await api.compileFile('test/examples/with-minified/less/with-minified.less', 'test/css', { minified: true });
    assert.equal(output, path.join('test', 'css', 'with-minified.min.css'));
    const produced = fs.readFileSync(output);
    const golden = fs.readFileSync(path.join(cwd, 'test', 'examples', 'with-minified', 'css', 'with-minified.min.css'));
    assert.ok(produced.equals(golden));
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });
  });

  it('compileFile() rejects with a structured error for invalid LESS', async function () {
    await assert.rejects(
      () => api.compileFile('test/examples/broken/less/broken.less', 'test/css'),
      (err) => err.line !== undefined
    );
  });

  it('watch() throws synchronously when mainFile does not exist, instead of watching silently forever', function () {
    assert.throws(() => api.watch('test/less', 'test/css', { mainFile: 'no-such-main.less', runOnce: true }), /no-such-main\.less does not exist/);
  });

  it('watch() compiles on start and recompiles the output when a watched file is later edited', function (done) {
    this.timeout(15000);
    const os = require('os');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lwc-api-watch-'));
    const lessDir = path.join(tmpDir, 'less');
    const watchOutDir = path.join(tmpDir, 'css');
    fs.mkdirSync(lessDir);
    fs.mkdirSync(watchOutDir);
    const lessFile = path.join(lessDir, 'live.less');
    fs.writeFileSync(lessFile, '.a { color: red; }');

    function waitForContent(filePath, predicate, timeoutMs, cb) {
      const start = Date.now();
      (function poll() {
        fs.readFile(filePath, 'utf8', (err, content) => {
          if (!err && predicate(content)) return cb(null, content);
          if (Date.now() - start > timeoutMs) return cb(new Error('timed out waiting for ' + filePath));
          setTimeout(poll, 50);
        });
      })();
    }

    function cleanup() {
      fs.unwatchFile(lessFile);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    api.watch(lessDir, watchOutDir);

    const outputCss = path.join(watchOutDir, 'live.css');
    waitForContent(
      outputCss,
      (c) => c.includes('red'),
      5000,
      (err) => {
        if (err) {
          cleanup();
          return done(err);
        }
        fs.writeFileSync(lessFile, '.a { color: blue; }');
        waitForContent(
          outputCss,
          (c) => c.includes('blue'),
          8000,
          (err2, finalContent) => {
            cleanup();
            if (err2) return done(err2);
            assert.ok(finalContent.includes('blue'));
            done();
          }
        );
      }
    );
  });
});
