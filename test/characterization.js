// Characterization tests: lock in the exact observable behavior of the CLI
// (byte-identical CSS output, exit codes, crash-free watch startup) so that
// internal refactors — in particular swapping the compile engine — can be
// verified against a golden baseline.
const assert = require('assert'),
  path = require('path'),
  fs = require('fs'),
  { execSync, execFileSync, spawn } = require('child_process'),
  cwd = process.cwd(),
  outDir = path.join(cwd, 'test', 'css'),
  cliPath = path.resolve('dist/less-watch-compiler.js');

function cli(...args) {
  return execSync(`node ${cliPath} ${args.join(' ')}`);
}

function listFilesRecursive(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFilesRecursive(full));
    else out.push(full);
  }
  return out;
}

function resetOutDir() {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
}

describe('Characterization: golden-file output parity', function () {
  this.timeout(20000);

  describe('recursive compilation of a nested tree', function () {
    const goldenDir = path.join(cwd, 'test', 'examples', 'recursive', 'css');

    it('compiles every non-hidden .less file, preserving the directory structure, byte-identical to the golden output', () => {
      resetOutDir();
      cli('--run-once', 'test/less', 'test/css');

      const goldenFiles = listFilesRecursive(goldenDir)
        .map((f) => path.relative(goldenDir, f))
        .sort();
      const producedFiles = listFilesRecursive(outDir)
        .map((f) => path.relative(outDir, f))
        .sort();

      assert.deepStrictEqual(producedFiles, goldenFiles, 'the set of produced CSS files must match the golden set exactly');
      for (const rel of goldenFiles) {
        const produced = fs.readFileSync(path.join(outDir, rel));
        const golden = fs.readFileSync(path.join(goldenDir, rel));
        assert.ok(produced.equals(golden), `content mismatch for ${rel}`);
      }
      resetOutDir();
    });

    it('includes subdirectory files (regression guard: the walk filter must never skip directories)', () => {
      resetOutDir();
      cli('--run-once', 'test/less', 'test/css');
      assert.ok(fs.existsSync(path.join(outDir, 'lvl2', 'lvl2.css')), 'lvl2/lvl2.css must be produced');
      assert.ok(fs.existsSync(path.join(outDir, 'lvl2', 'lvl3', 'lvl3.css')), 'lvl2/lvl3/lvl3.css must be produced');
      resetOutDir();
    });
  });

  describe('minified config option', function () {
    it('produces a byte-identical .min.css when the config file sets minified: true', () => {
      resetOutDir();
      cli('--config', 'test/examples/with-minified/less-watch-compiler.config.json');
      const produced = fs.readFileSync(path.join(outDir, 'with-minified.min.css'));
      const golden = fs.readFileSync(path.join(cwd, 'test', 'examples', 'with-minified', 'css', 'with-minified.min.css'));
      assert.ok(produced.equals(golden));
      resetOutDir();
    });
  });

  describe('--less-args source-map-inline', function () {
    it('embeds the map as a data URI and writes no separate .map file, without --source-map', () => {
      resetOutDir();
      cli('--run-once', '--less-args', 'source-map-inline', 'test/examples/with-source-map/less', 'test/css');
      const css = fs.readFileSync(path.join(outDir, 'with-source-map.css'), 'utf8');
      assert.ok(css.includes('sourceMappingURL=data:application/json;base64,'), 'the map must be embedded as a data URI');
      assert.ok(!fs.existsSync(path.join(outDir, 'with-source-map.css.map')), 'no separate .map file should be written in inline mode');
      resetOutDir();
    });
  });

  describe('--plugins parameter', function () {
    it('loads a less plugin by its short name and applies it (byte-identical to golden)', () => {
      resetOutDir();
      cli('--run-once', '--plugins', 'clean-css', 'test/examples/with-plugin/less', 'test/css');
      const produced = fs.readFileSync(path.join(outDir, 'with-plugin.css'));
      const golden = fs.readFileSync(path.join(cwd, 'test', 'examples', 'with-plugin', 'css', 'with-plugin.css'));
      assert.ok(produced.equals(golden));
      resetOutDir();
    });

    it('exits non-zero under --run-once when a plugin cannot be loaded', () => {
      assert.throws(
        () => execSync(`node ${cliPath} --run-once --plugins no-such-plugin test/examples/with-plugin/less test/css`, { stdio: 'pipe' }),
        (err) => err.status !== 0
      );
    });
  });

  describe('config auto-discovery from cwd (issue #128)', function () {
    it('loads less-watch-compiler.config.json from the working directory when no arguments are given', () => {
      resetOutDir();
      execSync(`node ${cliPath}`, { cwd: path.join(cwd, 'test', 'examples', 'auto-config') });
      const produced = fs.readFileSync(path.join(outDir, 'auto-config.css'));
      const golden = fs.readFileSync(path.join(cwd, 'test', 'examples', 'auto-config', 'css', 'auto-config.css'));
      assert.ok(produced.equals(golden));
      resetOutDir();
    });
  });
});

describe('--cache (opt-in incremental compilation for --run-once)', function () {
  this.timeout(20000);
  const lessDir = path.join(cwd, 'test', 'examples', 'with-cache', 'less');
  const partialFile = path.join(lessDir, 'partial.less');
  const outFile = path.join(outDir, 'main.css');
  const staleMarker = '/* stale marker: must not survive a real recompile */';
  let cacheDir, cachePath;

  beforeEach(function () {
    resetOutDir();
    cacheDir = fs.mkdtempSync(path.join(cwd, 'test', 'tmp-cache-cli-'));
    cachePath = path.join(cacheDir, 'cache.json');
  });

  afterEach(function () {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    resetOutDir();
  });

  it('writes a cache file and skips recompiling an unchanged file on the next --run-once --cache run', () => {
    cli('--run-once', '--cache', '--cache-path', cachePath, lessDir, outDir);
    assert.ok(fs.existsSync(cachePath), 'cache file must be written');
    assert.ok(fs.readFileSync(outFile, 'utf8').includes('red'), 'sanity check on the first compile');

    // Corrupt the output so a real recompile would be observable.
    fs.writeFileSync(outFile, staleMarker);
    cli('--run-once', '--cache', '--cache-path', cachePath, lessDir, outDir);
    assert.equal(fs.readFileSync(outFile, 'utf8'), staleMarker, 'a cache hit must not rewrite the output file');
  });

  it('recompiles when a transitively-imported file changes, even with --cache', () => {
    const original = fs.readFileSync(partialFile, 'utf8');
    try {
      cli('--run-once', '--cache', '--cache-path', cachePath, lessDir, outDir);
      fs.writeFileSync(outFile, staleMarker);
      fs.writeFileSync(partialFile, '.partial { color: green; }');
      cli('--run-once', '--cache', '--cache-path', cachePath, lessDir, outDir);
      const recompiled = fs.readFileSync(outFile, 'utf8');
      assert.notEqual(recompiled, staleMarker);
      assert.ok(recompiled.includes('green'));
    } finally {
      fs.writeFileSync(partialFile, original);
    }
  });

  it('invalidates the whole cache (forces recompilation) when compile options change', () => {
    cli('--run-once', '--cache', '--cache-path', cachePath, lessDir, outDir);
    fs.writeFileSync(outFile, staleMarker);
    cli('--run-once', '--cache', '--cache-path', cachePath, '--less-args', 'compress', lessDir, outDir);
    assert.notEqual(fs.readFileSync(outFile, 'utf8'), staleMarker, 'an option change must force recompilation even with --cache');
  });

  it('recompiles (regenerating the .map file) when --source-map is used and a partial cache restore is missing the .map sidecar', () => {
    // Regression test: a CI cache restore that brought back the .css but not
    // its .css.map sidecar must not be treated as a hit -- the tool always
    // writes both together for a real compile, so serving only one is wrong.
    cli('--run-once', '--cache', '--cache-path', cachePath, '--source-map', lessDir, outDir);
    const mapFile = outFile + '.map';
    assert.ok(fs.existsSync(mapFile), 'sanity check: a real compile with --source-map writes a .map file');

    fs.rmSync(mapFile);
    cli('--run-once', '--cache', '--cache-path', cachePath, '--source-map', lessDir, outDir);
    assert.ok(fs.existsSync(mapFile), 'the .map file must be regenerated when missing, even though the .css cache entry looked unchanged');
  });

  it('does not create a cache file when --cache is not set', () => {
    cli('--run-once', lessDir, outDir);
    assert.ok(!fs.existsSync(cachePath));
  });
});

describe('Characterization: exit codes', function () {
  this.timeout(20000);

  it('exits non-zero when --run-once encounters a LESS compile error', () => {
    resetOutDir();
    assert.throws(
      () => execSync(`node ${cliPath} --run-once test/examples/broken/less test/css`, { stdio: 'pipe' }),
      (err) => err.status !== 0,
      'a compile failure under --run-once must produce a non-zero exit code'
    );
    resetOutDir();
  });

  it('exits non-zero when required folder arguments are missing', () => {
    assert.throws(
      () => execSync(`node ${cliPath} --run-once`, { stdio: 'pipe', cwd: outDir }),
      (err) => err.status !== 0
    );
  });

  it('exits non-zero when the specified main file does not exist', () => {
    assert.throws(
      () => execSync(`node ${cliPath} --run-once test/less test/css no-such-main.less`, { stdio: 'pipe' }),
      (err) => err.status !== 0,
      'a missing main file must abort with a non-zero exit code'
    );
  });

  it('still finishes writing every other file when one file fails to compile (issue #213)', () => {
    // compileCSS() kicks off renderLess() for every discovered file without
    // awaiting it, so under --run-once many files compile concurrently. If
    // the failing file's error surfaces before the others' async I/O
    // completes, calling process.exit(1) immediately (rather than setting
    // process.exitCode and letting the event loop drain) can kill the
    // process mid-write, losing or truncating output for files that would
    // otherwise have compiled successfully.
    const os = require('os');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lwc-issue213-'));
    const lessDir = path.join(tmpDir, 'less');
    const cssDir = path.join(tmpDir, 'css');
    fs.mkdirSync(lessDir);
    const validCount = 60;
    for (let i = 1; i <= validCount; i++) {
      let content = '.sel-' + i + ' {\n';
      for (let j = 1; j <= 40; j++) content += '  prop-' + j + ': value-' + j + ';\n';
      content += '}\n';
      fs.writeFileSync(path.join(lessDir, 'file' + i + '.less'), content);
    }
    fs.writeFileSync(path.join(lessDir, 'broken.less'), '.broken { color: @undefined-variable; }');

    let threw = false;
    try {
      // execFileSync (args as an array, no shell) rather than execSync with
      // an interpolated string: lessDir/cssDir are built from os.tmpdir(),
      // which isn't a literal, so a shell string is both unnecessary and
      // fragile (breaks on a path containing a space, and is the shape
      // CodeQL flags as command construction from an uncontrolled value).
      execFileSync(process.execPath, [cliPath, '--run-once', lessDir, cssDir], { stdio: 'pipe' });
    } catch (err) {
      threw = true;
      assert.notEqual(err.status, 0, 'a compile failure among many files must still exit non-zero');
    }
    assert.ok(threw, 'expected a non-zero exit');

    const produced = fs.existsSync(cssDir) ? fs.readdirSync(cssDir).filter((f) => f.endsWith('.css')) : [];
    assert.equal(produced.length, validCount, 'every file that would have compiled successfully must still be written');
    for (const f of produced) {
      const content = fs.readFileSync(path.join(cssDir, f), 'utf8');
      assert.ok(content.trim().endsWith('}'), f + ' was truncated mid-write: ' + JSON.stringify(content));
    }

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe('--banner (issue #82)', function () {
  this.timeout(20000);

  it('prepends nothing by default', () => {
    resetOutDir();
    cli('--run-once', 'test/less', 'test/css');
    const css = fs.readFileSync(path.join(outDir, 'lvl1.css'), 'utf8');
    assert.ok(!css.startsWith('/*'), 'no banner should appear unless requested');
    resetOutDir();
  });

  it('prepends the default message regardless of flag position relative to the positional arguments', () => {
    // --banner is a plain boolean (not an optional-value flag) specifically
    // so it can never greedily consume the next positional argument -- e.g.
    // `--banner less css` used to swallow "less" as banner text under an
    // earlier [text]-based design, breaking argument parsing entirely.
    resetOutDir();
    cli('--run-once', '--banner', 'test/less', 'test/css');
    let css = fs.readFileSync(path.join(outDir, 'lvl1.css'), 'utf8');
    assert.ok(css.startsWith('/* This file was generated by less-watch-compiler'));
    resetOutDir();

    cli('--run-once', 'test/less', 'test/css', '--banner');
    css = fs.readFileSync(path.join(outDir, 'lvl1.css'), 'utf8');
    assert.ok(css.startsWith('/* This file was generated by less-watch-compiler'));
    resetOutDir();
  });

  it('uses --banner-text as custom banner text', () => {
    resetOutDir();
    cli('--run-once', '--banner-text', '"Custom notice."', 'test/less', 'test/css');
    const css = fs.readFileSync(path.join(outDir, 'lvl1.css'), 'utf8');
    assert.ok(css.startsWith('/* Custom notice. */\n'));
    resetOutDir();
  });
});

describe('--init scaffolding', function () {
  this.timeout(20000);
  const os = require('os');

  it('creates a config template and exits 0; refuses to overwrite an existing one', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lwc-init-'));
    execSync(`node ${cliPath} --init`, { cwd: tmpDir, stdio: 'pipe' });
    const configFile = path.join(tmpDir, 'less-watch-compiler.config.json');
    assert.ok(fs.existsSync(configFile), 'config template must be created');
    const parsed = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    assert.equal(parsed.watchFolder, 'less');
    assert.throws(
      () => execSync(`node ${cliPath} --init`, { cwd: tmpDir, stdio: 'pipe' }),
      (err) => err.status !== 0,
      'a second --init must not overwrite the existing config'
    );
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe('Characterization: watch-mode startup (issue #117)', function () {
  this.timeout(20000);

  it('survives startup with an extensionless @import next to a nested folder', (done) => {
    resetOutDir();
    const child = spawn('node', [cliPath, 'test/examples/issue-117/less', 'test/css', 'site.less'], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stderr = '';
    child.stderr.on('data', (d) => (stderr += d));

    setTimeout(() => {
      const crashed = child.exitCode !== null;
      child.kill('SIGTERM');
      if (crashed) {
        done(new Error(`watch mode crashed during startup (exit ${child.exitCode}): ${stderr}`));
      } else {
        done();
      }
    }, 2500);
  });
});

describe('Characterization: external @import survives delete+recreate (issue #209)', function () {
  this.timeout(20000);

  function waitForContent(filePath, predicate, timeoutMs, cb) {
    const start = Date.now();
    (function poll() {
      fs.readFile(filePath, 'utf8', (err, content) => {
        if (!err && predicate(content)) return cb(null, content);
        if (Date.now() - start > timeoutMs) return cb(new Error('timed out waiting for ' + filePath + '; last content: ' + (content || err)));
        setTimeout(poll, 50);
      });
    })();
  }

  it('recompiles the importing file after an @import target outside watchFolder is deleted and recreated', (done) => {
    const tmpDir = fs.mkdtempSync(path.join(cwd, 'test', 'tmp-external-import-'));
    const lessDir = path.join(tmpDir, 'less');
    const externalDir = path.join(tmpDir, 'external');
    const liveOutDir = path.join(tmpDir, 'css');
    fs.mkdirSync(lessDir);
    fs.mkdirSync(externalDir);
    fs.mkdirSync(liveOutDir);
    const externalFile = path.join(externalDir, 'partial.less');
    const mainFile = path.join(lessDir, 'main.less');
    fs.writeFileSync(externalFile, '.partial { color: red; }');
    fs.writeFileSync(mainFile, "@import '../external/partial.less';\n.main { color: blue; }");

    const child = spawn('node', [cliPath, lessDir, liveOutDir], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });

    function cleanup() {
      child.kill('SIGTERM');
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    const outputCss = path.join(liveOutDir, 'main.css');
    waitForContent(
      outputCss,
      (c) => c.includes('red'),
      5000,
      (err) => {
        if (err) {
          cleanup();
          return done(err);
        }
        fs.rmSync(externalFile);
        setTimeout(() => {
          fs.writeFileSync(externalFile, '.partial { color: green; }');
          waitForContent(
            outputCss,
            (c) => c.includes('green'),
            10000,
            (err2) => {
              cleanup();
              if (err2) return done(err2);
              done();
            }
          );
        }, 500);
      }
    );
  });
});

describe('Characterization: live watch mode (real CLI process, no --run-once)', function () {
  this.timeout(20000);

  function waitForContent(filePath, predicate, timeoutMs, cb) {
    const start = Date.now();
    (function poll() {
      fs.readFile(filePath, 'utf8', (err, content) => {
        if (!err && predicate(content)) return cb(null, content);
        if (Date.now() - start > timeoutMs) return cb(new Error('timed out waiting for ' + filePath + '; last content: ' + (content || err)));
        setTimeout(poll, 50);
      });
    })();
  }

  it('prints the watching/recompile log lines (shared CLI+API change-handling) and updates the output CSS on a live edit', (done) => {
    const tmpDir = fs.mkdtempSync(path.join(cwd, 'test', 'tmp-cli-live-'));
    const lessDir = path.join(tmpDir, 'less');
    const liveOutDir = path.join(tmpDir, 'css');
    fs.mkdirSync(lessDir);
    fs.mkdirSync(liveOutDir);
    const lessFile = path.join(lessDir, 'live.less');
    fs.writeFileSync(lessFile, '.a { color: red; }');

    const child = spawn('node', [cliPath, lessDir, liveOutDir], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    child.stdout.on('data', (d) => (stdout += d));

    function cleanup() {
      child.kill('SIGTERM');
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    waitForContent(
      path.join(liveOutDir, 'live.css'),
      (c) => c.includes('red'),
      5000,
      (err) => {
        if (err) {
          cleanup();
          return done(err);
        }
        assert.ok(stdout.includes('Watching directory for file changes.'), 'expected the watch-mode startup log line; got: ' + stdout);
        fs.writeFileSync(lessFile, '.a { color: blue; }');
        waitForContent(
          path.join(liveOutDir, 'live.css'),
          (c) => c.includes('blue'),
          8000,
          (err2) => {
            cleanup();
            if (err2) return done(err2);
            assert.ok(stdout.includes('was changed. Recompiling'), 'expected the live-recompile log line; got: ' + stdout);
            done();
          }
        );
      }
    );
  });
});
