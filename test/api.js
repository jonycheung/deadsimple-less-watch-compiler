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

  it('compileFile() with cache: true skips recompiling an unchanged file, and recompiles once the source changes', async function () {
    const os = require('os');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lwc-api-cache-'));
    const lessDir = path.join(tmpDir, 'less');
    const cacheOutDir = path.join(tmpDir, 'css');
    fs.mkdirSync(lessDir);
    fs.mkdirSync(cacheOutDir);
    const lessFile = path.join(lessDir, 'cached.less');
    const cachePath = path.join(tmpDir, 'cache.json');
    const staleMarker = '/* stale marker */';
    fs.writeFileSync(lessFile, '.a { color: red; }');

    try {
      const output = await api.compileFile(lessFile, cacheOutDir, { cache: true, cachePath });
      assert.ok(fs.readFileSync(output, 'utf8').includes('red'));

      fs.writeFileSync(output, staleMarker);
      await api.compileFile(lessFile, cacheOutDir, { cache: true, cachePath });
      assert.equal(fs.readFileSync(output, 'utf8'), staleMarker, 'a cache hit must not rewrite the output file');

      fs.writeFileSync(lessFile, '.a { color: blue; }');
      await api.compileFile(lessFile, cacheOutDir, { cache: true, cachePath });
      assert.ok(fs.readFileSync(output, 'utf8').includes('blue'), 'a real source change must still trigger a recompile');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('watch() throws synchronously when mainFile does not exist, instead of watching silently forever', function () {
    assert.throws(() => api.watch('test/less', 'test/css', { mainFile: 'no-such-main.less', runOnce: true }), /no-such-main\.less does not exist/);
  });

  it('watch() throws synchronously for an invalid rebuildAllOn pattern, instead of watching silently forever', function () {
    assert.throws(
      () => api.watch('test/less', 'test/css', { rebuildAllOn: ['('], runOnce: true }),
      /Invalid rebuildAllOn pattern.*Unterminated group/
    );
  });

  it('watch() with rebuildAllOn recompiles every tracked file when a matching shared partial changes, even files that do not import it (issue #241)', function (done) {
    this.timeout(15000);
    const os = require('os');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lwc-api-rebuildallon-'));
    const lessDir = path.join(tmpDir, 'less');
    const watchOutDir = path.join(tmpDir, 'css');
    const sharedDir = path.join(lessDir, 'shared');
    fs.mkdirSync(sharedDir, { recursive: true });
    fs.mkdirSync(watchOutDir, { recursive: true });
    const sharedFile = path.join(sharedDir, 'tokens.less');
    const aFile = path.join(lessDir, 'a.less');
    const bFile = path.join(lessDir, 'b.less');
    // Neither a.less nor b.less imports tokens.less at all -- a plain
    // import-graph watch would never reconnect them to it.
    fs.writeFileSync(sharedFile, '.shared { color: red; }');
    fs.writeFileSync(aFile, '.a { color: green; }');
    fs.writeFileSync(bFile, '.b { color: green; }');

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
      fs.unwatchFile(sharedFile);
      fs.unwatchFile(aFile);
      fs.unwatchFile(bFile);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    api.watch(lessDir, watchOutDir, { rebuildAllOn: ['shared'] });

    const aOut = path.join(watchOutDir, 'a.css');
    const bOut = path.join(watchOutDir, 'b.css');
    const staleMarker = '/* stale marker */';

    waitForContent(aOut, (c) => c.includes('green'), 5000, (err) => {
      if (err) {
        cleanup();
        return done(err);
      }
      waitForContent(bOut, (c) => c.includes('green'), 5000, (err2) => {
        if (err2) {
          cleanup();
          return done(err2);
        }
        // Overwrite both outputs with a stale marker, then edit only the
        // shared partial -- if rebuildAllOn is doing its job, both get
        // overwritten with fresh output again despite neither importing it.
        fs.writeFileSync(aOut, staleMarker);
        fs.writeFileSync(bOut, staleMarker);
        fs.writeFileSync(sharedFile, '.shared { color: blue; }');
        waitForContent(aOut, (c) => c !== staleMarker && c.includes('green'), 8000, (err3) => {
          if (err3) {
            cleanup();
            return done(err3);
          }
          waitForContent(bOut, (c) => c !== staleMarker && c.includes('green'), 8000, (err4, finalContent) => {
            cleanup();
            if (err4) return done(err4);
            assert.ok(finalContent.includes('green'));
            done();
          });
        });
      });
    });
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
