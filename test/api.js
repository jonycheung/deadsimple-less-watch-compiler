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

  it('watch() keeps watching a file that is deleted and then recreated', function (done) {
    this.timeout(30000);
    const os = require('os');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lwc-api-recreate-'));
    const lessDir = path.join(tmpDir, 'less');
    const recreateOutDir = path.join(tmpDir, 'css');
    fs.mkdirSync(lessDir);
    fs.mkdirSync(recreateOutDir);
    const lessFile = path.join(lessDir, 'gone.less');
    const outputCss = path.join(recreateOutDir, 'gone.css');
    fs.writeFileSync(lessFile, '.a { color: red; }');

    function waitFor(needle, timeoutMs, cb) {
      const start = Date.now();
      (function poll() {
        fs.readFile(outputCss, 'utf8', (err, content) => {
          if (!err && content.includes(needle)) return cb(null);
          if (Date.now() - start > timeoutMs) return cb(new Error('timed out waiting for "' + needle + '" in ' + outputCss));
          setTimeout(poll, 50);
        });
      })();
    }

    function cleanup() {
      fs.unwatchFile(lessFile);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    api.watch(lessDir, recreateOutDir);

    waitFor('red', 6000, (err) => {
      if (err) return (cleanup(), done(err));
      fs.unlinkSync(lessFile);
      // Let the removal-confirmation debounce in setupWatcher() actually fire,
      // so this exercises a confirmed delete rather than a transient miss.
      setTimeout(() => {
        fs.writeFileSync(lessFile, '.a { color: green; }');
        waitFor('green', 8000, (err2) => {
          if (err2) return (cleanup(), done(err2));
          // The real regression: the recreate itself compiles via the parent
          // directory rescan, but the file used to stay permanently unwatched
          // afterwards, so every later edit was silently dropped.
          fs.writeFileSync(lessFile, '.a { color: purple; }');
          waitFor('purple', 8000, (err3) => {
            cleanup();
            done(err3);
          });
        });
      }, 1500);
    });
  });

  it('watch() keeps recompiling importers of a hidden _partial that is deleted and recreated', function (done) {
    this.timeout(30000);
    const os = require('os');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lwc-api-partial-'));
    const lessDir = path.join(tmpDir, 'less');
    const partialOutDir = path.join(tmpDir, 'css');
    fs.mkdirSync(lessDir);
    fs.mkdirSync(partialOutDir);
    const partial = path.join(lessDir, '_shared.less');
    const importer = path.join(lessDir, 'page.less');
    const outputCss = path.join(partialOutDir, 'page.css');
    fs.writeFileSync(partial, '@c: red;');
    fs.writeFileSync(importer, '@import "_shared"; .page { color: @c; }');

    function waitFor(needle, timeoutMs, cb) {
      const start = Date.now();
      (function poll() {
        fs.readFile(outputCss, 'utf8', (err, content) => {
          if (!err && content.includes(needle)) return cb(null);
          if (Date.now() - start > timeoutMs) return cb(new Error('timed out waiting for "' + needle + '" in ' + outputCss));
          setTimeout(poll, 50);
        });
      })();
    }

    function cleanup() {
      fs.unwatchFile(partial);
      fs.unwatchFile(importer);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    api.watch(lessDir, partialOutDir);

    waitFor('red', 6000, (err) => {
      if (err) return (cleanup(), done(err));
      fs.unlinkSync(partial);
      setTimeout(() => {
        fs.writeFileSync(partial, '@c: green;');
        // The directory rescan used to run every new entry through
        // filterFiles(), which rejects hidden files, so a recreated
        // underscore-prefixed partial was never rediscovered at all.
        waitFor('green', 9000, (err2) => {
          if (err2) return (cleanup(), done(err2));
          // ...and it has to still be watched afterwards, not just compiled once.
          fs.writeFileSync(partial, '@c: purple;');
          waitFor('purple', 9000, (err3) => {
            cleanup();
            done(err3);
          });
        });
      }, 1500);
    });
  });

  it('watch() keeps transitive import tracking through a deleted and recreated middle partial', function (done) {
    this.timeout(30000);
    const os = require('os');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lwc-api-transitive-'));
    const lessDir = path.join(tmpDir, 'less');
    const chainOutDir = path.join(tmpDir, 'css');
    fs.mkdirSync(lessDir);
    fs.mkdirSync(chainOutDir);
    // main.less -> _theme.less -> colors.less, with the recreated file in the
    // middle: its own import list is dropped when it goes away, so it has to
    // be rebuilt on rediscovery or the chain from main.less to colors.less
    // stays broken and only colors.css updates.
    const colors = path.join(lessDir, 'colors.less');
    const theme = path.join(lessDir, '_theme.less');
    fs.writeFileSync(colors, '@brand: red;');
    fs.writeFileSync(theme, '@import "colors"; @text: @brand;');
    fs.writeFileSync(path.join(lessDir, 'main.less'), '@import "_theme"; .main { color: @text; }');
    const outputCss = path.join(chainOutDir, 'main.css');

    function waitFor(needle, timeoutMs, cb) {
      const start = Date.now();
      (function poll() {
        fs.readFile(outputCss, 'utf8', (err, content) => {
          if (!err && content.includes(needle)) return cb(null);
          if (Date.now() - start > timeoutMs) return cb(new Error('timed out waiting for "' + needle + '" in ' + outputCss));
          setTimeout(poll, 50);
        });
      })();
    }

    function cleanup() {
      for (const f of [colors, theme, path.join(lessDir, 'main.less')]) fs.unwatchFile(f);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    api.watch(lessDir, chainOutDir);

    waitFor('red', 6000, (err) => {
      if (err) return (cleanup(), done(err));
      fs.unlinkSync(theme);
      setTimeout(() => {
        fs.writeFileSync(theme, '@import "colors"; @text: @brand;');
        setTimeout(() => {
          // Edit the leaf, two hops from main.less, after the middle file
          // has been through a full delete/recreate cycle.
          fs.writeFileSync(colors, '@brand: green;');
          waitFor('green', 9000, (err2) => {
            cleanup();
            done(err2);
          });
        }, 2000);
      }, 1500);
    });
  });

  it('watch() throws synchronously when watchFolder is missing', function () {
    assert.throws(() => api.watch(path.join(cwd, 'test/no-such-watch-folder'), 'test/css'), /does not exist\./);
  });

  it('watch() passes asynchronous root-walk failures to listeners.onError', function (done) {
    const lessWatchCompilerUtils = require('../dist/lib/lessWatchCompilerUtils.js');
    const originalWatchTree = lessWatchCompilerUtils.watchTree;
    lessWatchCompilerUtils.watchTree = function (_root, _options, _watchCallback, _initCallback, errorCallback) {
      const err = new Error('boom');
      err.code = 'EIO';
      errorCallback(err);
    };
    try {
      api.watch('test/less', 'test/css', {}, {
        onError(error) {
          try {
            assert.match(error.message, /Watch failed/);
            assert.match(error.message, /EIO/);
            done();
          } catch (e) {
            done(e);
          }
        }
      });
    } finally {
      lessWatchCompilerUtils.watchTree = originalWatchTree;
    }
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
