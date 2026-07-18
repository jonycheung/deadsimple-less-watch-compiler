const assert = require('assert'),
  path = require('path'),
  fs = require('fs'),
  cwd = process.cwd();

// Each test needs a fresh module instance (to simulate a new process's
// module-level state, e.g. for "does the cache survive a restart" tests).
// Every fresh instance registers its own process.on('exit', flush) the
// first time it's used, so instances created here are tracked and their
// exit listener is removed in afterEach -- otherwise the accumulate across
// this file's tests and can trip MaxListenersExceededWarning.
let liveInstances = [];
function freshCache() {
  const resolved = require.resolve('../dist/lib/cache.js');
  delete require.cache[resolved];
  const instance = require('../dist/lib/cache.js');
  liveInstances.push(instance);
  return instance;
}

describe('cache Module', function () {
  let tmpDir, lessFile, importedFile, outFile, cachePath;
  const fp = { lessArgs: undefined };

  beforeEach(function () {
    tmpDir = fs.mkdtempSync(path.join(cwd, 'test', 'tmp-cache-'));
    importedFile = path.join(tmpDir, 'partial.less');
    lessFile = path.join(tmpDir, 'main.less');
    outFile = path.join(tmpDir, 'main.css');
    cachePath = path.join(tmpDir, '.cache.json');
    fs.writeFileSync(importedFile, '.partial { color: red; }');
    fs.writeFileSync(lessFile, "@import 'partial.less';\n.main { color: blue; }");
    fs.writeFileSync(outFile, '.partial{color:red}.main{color:blue}');
  });

  afterEach(function () {
    for (const instance of liveInstances) process.removeListener('exit', instance.flush);
    liveInstances = [];
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('resolvePath() defaults to <cwd>/.less-watch-compiler-cache.json', function () {
    const cache = freshCache();
    assert.equal(cache.resolvePath(undefined), path.join(cwd, '.less-watch-compiler-cache.json'));
  });

  it('resolvePath() honors a configured path', function () {
    const cache = freshCache();
    assert.equal(cache.resolvePath('some/where.json'), path.resolve('some/where.json'));
  });

  it('reports a miss when no entry has been recorded yet', function () {
    const cache = freshCache();
    assert.equal(cache.isUpToDate(cachePath, fp, lessFile, outFile), false);
  });

  it('reports a hit after record(), and the hit survives a simulated process restart via flush()', function () {
    const cache = freshCache();
    cache.record(cachePath, fp, lessFile, outFile);
    assert.equal(cache.isUpToDate(cachePath, fp, lessFile, outFile), true);
    cache.flush();
    assert.ok(fs.existsSync(cachePath), 'flush() must write the cache file to disk');

    const reloaded = freshCache();
    assert.equal(reloaded.isUpToDate(cachePath, fp, lessFile, outFile), true);
  });

  it('reports a miss after the entry file itself changes', function () {
    const cache = freshCache();
    cache.record(cachePath, fp, lessFile, outFile);
    fs.writeFileSync(lessFile, "@import 'partial.less';\n.main { color: green; }");
    assert.equal(cache.isUpToDate(cachePath, fp, lessFile, outFile), false);
  });

  it('reports a miss after a transitively-imported file changes, even though the entry file itself did not', function () {
    const cache = freshCache();
    cache.record(cachePath, fp, lessFile, outFile);
    fs.writeFileSync(importedFile, '.partial { color: green; }');
    assert.equal(cache.isUpToDate(cachePath, fp, lessFile, outFile), false);
  });

  it('reports a miss when the previously-recorded output file is missing', function () {
    const cache = freshCache();
    cache.record(cachePath, fp, lessFile, outFile);
    fs.rmSync(outFile);
    assert.equal(cache.isUpToDate(cachePath, fp, lessFile, outFile), false);
  });

  it('reports a miss when a recorded expected file (e.g. a .css.map sidecar) is missing', function () {
    // Regression test: a partially-restored CI cache (e.g. the .css was
    // restored but the .css.map sidecar was not) must not be treated as a
    // hit just because outputFilePath itself exists.
    const mapFile = outFile + '.map';
    fs.writeFileSync(mapFile, '{}');
    const cache = freshCache();
    cache.record(cachePath, fp, lessFile, outFile);
    assert.equal(cache.isUpToDate(cachePath, fp, lessFile, outFile, [mapFile]), true, 'sanity check: hit while the map file is present');
    fs.rmSync(mapFile);
    assert.equal(cache.isUpToDate(cachePath, fp, lessFile, outFile, [mapFile]), false, 'a missing expected file must force a miss');
  });

  it('creates the cache-path parent directory if it does not exist yet, instead of silently dropping the write', function () {
    const nestedCachePath = path.join(tmpDir, 'does', 'not', 'exist', 'cache.json');
    const cache = freshCache();
    cache.record(nestedCachePath, fp, lessFile, outFile);
    cache.flush();
    assert.ok(fs.existsSync(nestedCachePath), 'flush() must create any missing parent directories');
  });

  it('invalidates the whole cache when the option fingerprint changes', function () {
    const cache = freshCache();
    cache.record(cachePath, fp, lessFile, outFile);
    assert.equal(cache.isUpToDate(cachePath, { lessArgs: 'compress' }, lessFile, outFile), false);
  });

  it('treats a corrupt cache file as an empty cache instead of throwing', function () {
    fs.writeFileSync(cachePath, 'not json');
    const cache = freshCache();
    assert.equal(cache.isUpToDate(cachePath, fp, lessFile, outFile), false);
  });

  it('prunes entries whose source file no longer exists on the next load', function () {
    const cache = freshCache();
    cache.record(cachePath, fp, lessFile, outFile);
    cache.flush();

    fs.rmSync(lessFile);
    fs.rmSync(outFile);

    const goneKey = path.relative(cwd, lessFile).split(path.sep).join('/');
    const onDiskBefore = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    assert.ok(goneKey in onDiskBefore.entries, 'sanity check: entry must exist before pruning');

    const reloaded = freshCache();
    // Force a (re)load by asking about an unrelated file, then flush and inspect disk.
    reloaded.isUpToDate(cachePath, fp, importedFile, outFile);
    reloaded.flush();
    const onDiskAfter = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    assert.ok(!(goneKey in onDiskAfter.entries), 'entry for a deleted source file must be pruned on load');
  });
});
