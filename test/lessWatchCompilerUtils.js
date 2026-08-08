var assert = require('assert'),
  lessWatchCompilerUtils = require('../dist/lib/lessWatchCompilerUtils.js'),
  cwd = process.cwd(),
  fs = require('fs'),
  path = require('path'),
  testroot = cwd + '/test/less/',
  testRelative = './test/less';

// fs.symlinkSync needs SeCreateSymbolicLinkPrivilege on Windows, which an
// ordinary developer shell doesn't have. What's under test is how walk()
// behaves once such a link exists, not the ability to create one, so report
// the failure to the caller and let it skip rather than fail the suite on
// machines where links can't be made at all.
function trySymlink(target, linkPath, type) {
  try {
    fs.symlinkSync(target, linkPath, type);
    return true;
  } catch (err) {
    if (err.code === 'EPERM' || err.code === 'EACCES' || err.code === 'ENOSYS' || err.code === 'ENOTSUP') return false;
    throw err;
  }
}

describe('lessWatchCompilerUtils Module API', function () {
  describe("Should have the following API's", function () {
    describe('walk()', function () {
      it('walk() function should be there', function () {
        assert.equal('function', typeof lessWatchCompilerUtils.walk);
      });
      it('walk() function should return an object of files ', (done) => {
        lessWatchCompilerUtils.walk(
          testroot,
          {},
          (err, files) => {
            try {
              assert.ifError(err);
              assert.ok(files);
              for (var i in files) {
                assert.equal('object', typeof files[i]);
              }
              done();
            } catch (e) {
              done(e);
            }
          },
          function () {}
        );
      });
      it('walk() should respect ignoreDotFiles option', (done) => {
        const tmpDir = fs.mkdtempSync(path.join(cwd, 'test/tmp-walk-'));
        const dotFile = path.join(tmpDir, '.hidden.less');
        const visibleFile = path.join(tmpDir, 'visible.less');
        fs.writeFileSync(dotFile, '');
        fs.writeFileSync(visibleFile, '');

        lessWatchCompilerUtils.walk(
          tmpDir,
          { ignoreDotFiles: true },
          (err, files) => {
            assert.ifError(err);
            const fileList = Object.keys(files);
            assert.ok(fileList.some((f) => f.endsWith('visible.less')));
            assert.ok(!fileList.some((f) => f.endsWith('.hidden.less')));
            fs.rmSync(tmpDir, { recursive: true, force: true });
            done();
          },
          function () {}
        );
      });
      it('walk() should respect the exclude pattern, for both files and directories (issue #72)', (done) => {
        const tmpDir = fs.mkdtempSync(path.join(cwd, 'test/tmp-walk-exclude-'));
        fs.mkdirSync(path.join(tmpDir, 'node_modules', 'some-pkg'), { recursive: true });
        fs.writeFileSync(path.join(tmpDir, 'node_modules', 'some-pkg', 'style.less'), '');
        fs.writeFileSync(path.join(tmpDir, 'mine.less'), '');

        lessWatchCompilerUtils.walk(
          tmpDir,
          { exclude: /node_modules/ },
          (err, files) => {
            assert.ifError(err);
            const fileList = Object.keys(files);
            assert.ok(fileList.some((f) => f.endsWith('mine.less')));
            assert.ok(!fileList.some((f) => f.includes('node_modules')), 'the excluded directory must not be recursed into at all');
            fs.rmSync(tmpDir, { recursive: true, force: true });
            done();
          },
          function () {}
        );
      });
      it('does not descend into a symlink loop, and still finds the real files', function (done) {
        const tmpDir = fs.mkdtempSync(path.join(cwd, 'test/tmp-walk-loop-'));
        fs.writeFileSync(path.join(tmpDir, 'real.less'), '');
        // A link back into its own tree: fs.stat follows symlinks, so an
        // unguarded walk recurses tmpDir/loop/loop/... until the OS refuses
        // with ELOOP, and that error takes down the whole walk.
        if (!trySymlink(tmpDir, path.join(tmpDir, 'loop'), 'dir')) {
          fs.rmSync(tmpDir, { recursive: true, force: true });
          return this.skip();
        }

        lessWatchCompilerUtils.walk(
          tmpDir,
          {},
          (err, files) => {
            try {
              assert.ifError(err);
              const fileList = Object.keys(files);
              assert.ok(
                fileList.some((f) => f.endsWith('real.less')),
                'the real file must still be discovered'
              );
              assert.ok(!fileList.some((f) => f.includes(`loop${path.sep}loop`)), 'the walk must not re-enter a directory it has already visited');
              fs.rmSync(tmpDir, { recursive: true, force: true });
              done();
            } catch (e) {
              fs.rmSync(tmpDir, { recursive: true, force: true });
              done(e);
            }
          },
          function () {}
        );
      });
      it('walks every alias of a directory, so which path survives is never a race', function (done) {
        const tmpDir = fs.mkdtempSync(path.join(cwd, 'test/tmp-walk-alias-'));
        const realDir = path.join(tmpDir, 'real');
        fs.mkdirSync(realDir);
        fs.writeFileSync(path.join(realDir, 'once.less'), '');
        if (!trySymlink(realDir, path.join(tmpDir, 'link-a'), 'dir') || !trySymlink(realDir, path.join(tmpDir, 'link-b'), 'dir')) {
          fs.rmSync(tmpDir, { recursive: true, force: true });
          return this.skip();
        }

        // Sibling aliases are not a cycle. Collapsing them to one would leave
        // the surviving path decided by whichever fs.stat callback landed
        // first -- and resolveOutputPath() derives the output path from it, so
        // the same tree would compile to css/link-a/once.css on one run and
        // css/link-b/once.css on the next.
        lessWatchCompilerUtils.walk(
          tmpDir,
          {},
          (err, files) => {
            try {
              assert.ifError(err);
              const via = Object.keys(files)
                .filter((f) => f.endsWith('once.less'))
                .map((f) => path.basename(path.dirname(f)))
                .sort();
              assert.deepEqual(via, ['link-a', 'link-b', 'real'], 'every alias must be walked, not whichever one won the race');
              fs.rmSync(tmpDir, { recursive: true, force: true });
              done();
            } catch (e) {
              fs.rmSync(tmpDir, { recursive: true, force: true });
              done(e);
            }
          },
          function () {}
        );
      });
      it('still walks the whole tree on a filesystem that reports no inode numbers', (done) => {
        const tmpDir = fs.mkdtempSync(path.join(cwd, 'test/tmp-walk-noino-'));
        for (const d of ['one', 'two', 'three']) {
          fs.mkdirSync(path.join(tmpDir, d));
          fs.writeFileSync(path.join(tmpDir, d, d + '.less'), '');
        }

        // FAT/exFAT volumes and some Windows network shares report ino 0 for
        // every entry. Deduping on a 0 identity would match everything and
        // silently skip the entire tree after the first directory.
        const originalStat = fs.stat;
        fs.stat = function (target, cb) {
          return originalStat(target, (err, stat) => {
            if (stat) stat.ino = 0;
            cb(err, stat);
          });
        };

        lessWatchCompilerUtils.walk(
          tmpDir,
          {},
          (err, files) => {
            fs.stat = originalStat;
            try {
              assert.ifError(err);
              const found = Object.keys(files)
                .filter((f) => f.endsWith('.less'))
                .map((f) => path.basename(f))
                .sort();
              assert.deepEqual(found, ['one.less', 'three.less', 'two.less'], 'every directory must still be walked when identities are unavailable');
              fs.rmSync(tmpDir, { recursive: true, force: true });
              done();
            } catch (e) {
              fs.rmSync(tmpDir, { recursive: true, force: true });
              done(e);
            }
          },
          function () {}
        );
      });
      it('reports a bad root directory through the callback instead of walking a partial tree', (done) => {
        lessWatchCompilerUtils.walk(
          path.join(cwd, 'test', 'no-such-directory-at-all'),
          {},
          (err) => {
            assert.ok(err, 'a missing root must surface as an error');
            assert.equal(err.code, 'ENOENT');
            done();
          },
          function () {}
        );
      });
      it('steps over an unreadable entry deeper in the tree instead of aborting the whole walk', function (done) {
        const tmpDir = fs.mkdtempSync(path.join(cwd, 'test/tmp-walk-badentry-'));
        fs.writeFileSync(path.join(tmpDir, 'good.less'), '');
        // A pair of symlinks pointing at each other: stat fails with ELOOP,
        // which is neither ENOENT nor anything the walk can act on.
        if (!trySymlink(path.join(tmpDir, 'b'), path.join(tmpDir, 'a')) || !trySymlink(path.join(tmpDir, 'a'), path.join(tmpDir, 'b'))) {
          fs.rmSync(tmpDir, { recursive: true, force: true });
          return this.skip();
        }

        lessWatchCompilerUtils.walk(
          tmpDir,
          {},
          (err, files) => {
            try {
              assert.ifError(err);
              assert.ok(
                Object.keys(files).some((f) => f.endsWith('good.less')),
                'the rest of the tree must still be walked'
              );
              fs.rmSync(tmpDir, { recursive: true, force: true });
              done();
            } catch (e) {
              fs.rmSync(tmpDir, { recursive: true, force: true });
              done(e);
            }
          },
          function () {}
        );
      });
      it('calls its completion callback exactly once when an entry fails to stat', function (done) {
        const tmpDir = fs.mkdtempSync(path.join(cwd, 'test/tmp-walk-once-'));
        // Several unresolvable entries alongside real ones: aborting on the
        // first without settling its pending count let a later finalize()
        // invoke the callback again, after it had already fired with an error.
        for (const name of ['x', 'y', 'z']) {
          if (!trySymlink(path.join(tmpDir, name + '2'), path.join(tmpDir, name)) || !trySymlink(path.join(tmpDir, name), path.join(tmpDir, name + '2'))) {
            fs.rmSync(tmpDir, { recursive: true, force: true });
            return this.skip();
          }
        }
        fs.writeFileSync(path.join(tmpDir, 'good.less'), '');

        let calls = 0;
        lessWatchCompilerUtils.walk(
          tmpDir,
          {},
          () => {
            calls += 1;
          },
          function () {}
        );

        setTimeout(() => {
          fs.rmSync(tmpDir, { recursive: true, force: true });
          try {
            assert.equal(calls, 1, 'walk() must settle exactly once, not once per failing entry');
            done();
          } catch (e) {
            done(e);
          }
        }, 500);
      });
      it('keeps an unreadable directory in the files map, so it is still watched and can recover', function (done) {
        const tmpDir = fs.mkdtempSync(path.join(cwd, 'test/tmp-walk-eacces-'));
        const lockedDir = path.join(tmpDir, 'locked');
        fs.mkdirSync(lockedDir);
        fs.writeFileSync(path.join(tmpDir, 'top.less'), '');

        const originalReaddir = fs.readdir;
        fs.readdir = function (target, cb) {
          if (String(target) === lockedDir) {
            const err = new Error('EACCES: permission denied');
            err.code = 'EACCES';
            return process.nextTick(() => cb(err));
          }
          return originalReaddir(target, cb);
        };

        lessWatchCompilerUtils.walk(
          tmpDir,
          {},
          (err, files) => {
            fs.readdir = originalReaddir;
            try {
              assert.ifError(err);
              // watchTree() only watches paths present in this map. Dropping
              // the directory because its contents couldn't be listed would
              // leave nothing watching it, so the subtree could never be
              // picked up even after permissions are restored -- keeping it
              // is what lets the directory rescan recover the whole subtree.
              assert.ok(files[lockedDir], 'an unreadable directory must stay watchable so its contents can be found later');
              assert.ok(
                Object.keys(files).some((f) => f.endsWith('top.less')),
                'the rest of the tree must still be walked'
              );
              fs.rmSync(tmpDir, { recursive: true, force: true });
              done();
            } catch (e) {
              fs.rmSync(tmpDir, { recursive: true, force: true });
              done(e);
            }
          },
          function () {}
        );
      });
      it('propagates a systemic failure like EMFILE instead of reporting a partial walk', function (done) {
        const tmpDir = fs.mkdtempSync(path.join(cwd, 'test/tmp-walk-emfile-'));
        fs.mkdirSync(path.join(tmpDir, 'sub'));
        fs.writeFileSync(path.join(tmpDir, 'sub', 'nested.less'), '');
        fs.writeFileSync(path.join(tmpDir, 'top.less'), '');

        // Descriptor exhaustion is a condition of the process, not of this
        // path: most of the tree fails the same way, so skipping it and
        // returning "success" would bring a watcher up over a fraction of the
        // files with nothing to say so.
        const originalReaddir = fs.readdir;
        fs.readdir = function (target, cb) {
          if (String(target).endsWith('sub')) {
            const err = new Error('EMFILE: too many open files');
            err.code = 'EMFILE';
            return process.nextTick(() => cb(err));
          }
          return originalReaddir(target, cb);
        };

        let calls = 0;
        let reported = null;
        lessWatchCompilerUtils.walk(
          tmpDir,
          {},
          (err) => {
            calls += 1;
            reported = err;
          },
          function () {}
        );

        setTimeout(() => {
          fs.readdir = originalReaddir;
          fs.rmSync(tmpDir, { recursive: true, force: true });
          try {
            assert.equal(calls, 1, 'walk() must still settle exactly once');
            assert.ok(reported, 'descriptor exhaustion must not be reported as a successful walk');
            assert.equal(reported.code, 'EMFILE');
            done();
          } catch (e) {
            done(e);
          }
        }, 400);
      });
    });
    describe('assertWatchableFolder()', function () {
      it('assertWatchableFolder() function should be there', function () {
        assert.equal('function', typeof lessWatchCompilerUtils.assertWatchableFolder);
      });
      it('accepts a real, readable directory', function () {
        assert.doesNotThrow(() => lessWatchCompilerUtils.assertWatchableFolder(testroot));
      });
      it('throws a readable error for a folder that does not exist', function () {
        assert.throws(() => lessWatchCompilerUtils.assertWatchableFolder(path.join(cwd, 'test', 'no-such-folder')), /does not exist\./);
      });
      it('throws a readable error when the path is a file rather than a directory', function () {
        assert.throws(() => lessWatchCompilerUtils.assertWatchableFolder(path.join(testroot, 'test.less')), /is not a directory\./);
      });
      it('throws rather than returning when the directory cannot be listed', function () {
        // stat succeeds on a directory the process may not list, so the EACCES
        // that walk()'s readdir would hit needs its own check.
        const tmpDir = fs.mkdtempSync(path.join(cwd, 'test/tmp-unreadable-'));
        const originalAccess = fs.accessSync;
        fs.accessSync = function (target, mode) {
          if (String(target) === tmpDir) {
            const err = new Error('EACCES: permission denied');
            err.code = 'EACCES';
            throw err;
          }
          return originalAccess(target, mode);
        };
        try {
          assert.throws(() => lessWatchCompilerUtils.assertWatchableFolder(tmpDir), /cannot be read: EACCES/);
        } finally {
          fs.accessSync = originalAccess;
          fs.rmSync(tmpDir, { recursive: true, force: true });
        }
      });
    });
    describe('watchTree()', function () {
      it('watchTree() function should be there', function () {
        assert.strictEqual('function', typeof lessWatchCompilerUtils.watchTree);
      });
      it('assertWatchableFolder() validates root readability and traversal', function () {
        assert.strictEqual('function', typeof lessWatchCompilerUtils.assertWatchableFolder);
        const tmpDir = fs.mkdtempSync(path.join(cwd, 'test/tmp-watchable-'));
        const originalAccess = fs.accessSync;
        let observedMode;
        fs.accessSync = function (target, mode) {
          if (String(target) === tmpDir) observedMode = mode;
          return originalAccess(target, mode);
        };
        try {
          assert.doesNotThrow(() => lessWatchCompilerUtils.assertWatchableFolder(tmpDir));
          assert.strictEqual(observedMode, fs.constants.R_OK | fs.constants.X_OK);
        } finally {
          fs.accessSync = originalAccess;
          fs.rmSync(tmpDir, { recursive: true, force: true });
        }
      });
      it('watchTree() routes root errors to the provided error callback', function (done) {
        const missingRoot = path.join(cwd, 'test/no-such-watch-root');
        lessWatchCompilerUtils.watchTree(
          missingRoot,
          {},
          function () {},
          function () {},
          function (err) {
            try {
              assert.ok(err);
              assert.equal(err.code, 'ENOENT');
              done();
            } catch (e) {
              done(e);
            }
          }
        );
      });
      it('watchTree() routes runtime subtree-walk failures to the provided error callback', function (done) {
        const tmpDir = fs.mkdtempSync(path.join(cwd, 'test/tmp-watchtree-runtime-error-'));
        const watchedCallbacks = {};
        const originalWatchFile = fs.watchFile;
        const originalWalk = lessWatchCompilerUtils.walk;

        fs.watchFile = function (target, _options, callback) {
          watchedCallbacks[String(target)] = callback;
        };
        lessWatchCompilerUtils.walk = function (dir, _options, callback) {
          if (String(dir) === tmpDir) return callback(null, { [tmpDir]: fs.statSync(tmpDir) });
          const err = new Error('boom');
          err.code = 'EIO';
          return callback(err, null);
        };

        lessWatchCompilerUtils.watchTree(
          tmpDir,
          {},
          function () {},
          function () {},
          function (err) {
            try {
              assert.ok(err);
              assert.equal(err.code, 'EIO');
              done();
            } catch (e) {
              done(e);
            } finally {
              lessWatchCompilerUtils.walk = originalWalk;
              fs.watchFile = originalWatchFile;
              fs.rmSync(tmpDir, { recursive: true, force: true });
            }
          }
        );

        const nestedDir = path.join(tmpDir, 'new-subdir');
        fs.mkdirSync(nestedDir);
        const callback = watchedCallbacks[tmpDir];
        const prev = fs.statSync(tmpDir);
        const curr = fs.statSync(tmpDir);
        callback(curr, prev);
      });
      it('watchTree() function should complete and call a callback ', function (done) {
        let doneCalled = false;
        lessWatchCompilerUtils.watchTree(
          testroot,
          {},
          (f, curr, prev) => {
            if (!doneCalled && typeof f === 'object' && curr === null && prev === null) {
              doneCalled = true;
              done();
            }
          },
          function () {}
        );
      });
      it('supports the 2-argument overload (options omitted, callback as the 2nd argument)', function (done) {
        const tmpDir = fs.mkdtempSync(path.join(cwd, 'test/tmp-watchtree2-'));
        fs.writeFileSync(path.join(tmpDir, 'a.less'), '');
        lessWatchCompilerUtils.watchTree(tmpDir, (f, curr, prev) => {
          if (typeof f === 'object' && curr === null && prev === null) {
            fs.rmSync(tmpDir, { recursive: true, force: true });
            done();
          }
        });
      });
    });
    describe('live watch mode (real fs.watchFile polling)', function () {
      this.timeout(10000);

      function waitForFileContent(filePath, predicate, timeoutMs, cb) {
        const start = Date.now();
        (function poll() {
          fs.readFile(filePath, 'utf8', (err, content) => {
            if (!err && predicate(content)) return cb(null, content);
            if (Date.now() - start > timeoutMs) return cb(new Error('timed out waiting for ' + filePath + '; last content: ' + (content || err)));
            setTimeout(poll, 40);
          });
        })();
      }

      it('recompiles the output file when a watched .less file is edited', function (done) {
        const tmpDir = fs.mkdtempSync(path.join(cwd, 'test/tmp-live-edit-'));
        const outDir = path.join(tmpDir, 'css');
        fs.mkdirSync(outDir);
        const lessFile = path.join(tmpDir, 'live.less');
        fs.writeFileSync(lessFile, '.a { color: red; }');

        lessWatchCompilerUtils.config = { watchFolder: tmpDir, outputFolder: outDir };

        function cleanup() {
          fs.unwatchFile(lessFile);
          fs.rmSync(tmpDir, { recursive: true, force: true });
        }

        lessWatchCompilerUtils.watchTree(
          tmpDir,
          { interval: 30, filter: lessWatchCompilerUtils.filterFiles },
          function (f, curr) {
            if (typeof f === 'object' && curr === null) return; // initial walk done
            if (curr && curr.nlink !== 0) lessWatchCompilerUtils.compileCSS(f);
          },
          function (f) {
            lessWatchCompilerUtils.compileCSS(f);
          }
        );

        waitForFileContent(
          path.join(outDir, 'live.css'),
          (c) => c.includes('red'),
          3000,
          (err) => {
            if (err) {
              cleanup();
              return done(err);
            }
            fs.writeFileSync(lessFile, '.a { color: blue; }');
            waitForFileContent(
              path.join(outDir, 'live.css'),
              (c) => c.includes('blue'),
              5000,
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

      it('detects and compiles a new .less file added to a watched directory', function (done) {
        const tmpDir = fs.mkdtempSync(path.join(cwd, 'test/tmp-live-newfile-'));
        const outDir = path.join(tmpDir, 'css');
        fs.mkdirSync(outDir);
        fs.writeFileSync(path.join(tmpDir, 'existing.less'), '.x { color: red; }');

        lessWatchCompilerUtils.config = { watchFolder: tmpDir, outputFolder: outDir };

        function cleanup() {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        }

        lessWatchCompilerUtils.watchTree(
          tmpDir,
          { interval: 30, filter: lessWatchCompilerUtils.filterFiles },
          function (f, curr) {
            if (typeof f === 'object' && curr === null) return;
            if (curr && curr.nlink !== 0) lessWatchCompilerUtils.compileCSS(f);
          },
          function (f) {
            lessWatchCompilerUtils.compileCSS(f);
          }
        );

        waitForFileContent(
          path.join(outDir, 'existing.css'),
          (c) => c.includes('red'),
          3000,
          (err) => {
            if (err) {
              cleanup();
              return done(err);
            }
            setTimeout(() => {
              fs.writeFileSync(path.join(tmpDir, 'new-file.less'), '.y { color: green; }');
              waitForFileContent(
                path.join(outDir, 'new-file.css'),
                (c) => c.includes('green'),
                5000,
                (err2) => {
                  cleanup();
                  if (err2) return done(err2);
                  done();
                }
              );
            }, 100);
          }
        );
      });

      it('detects and compiles a .less file inside a newly created directory (issue #73)', function (done) {
        // filterFiles() rejects anything without an allowed extension, and a
        // bare directory name never has one -- applying that filter to new
        // directories (instead of only new files, like walk() already does
        // for the initial scan) silently skipped watching them, and
        // anything created inside them, forever.
        const tmpDir = fs.mkdtempSync(path.join(cwd, 'test/tmp-live-newdir-'));
        const outDir = path.join(tmpDir, 'css');
        fs.mkdirSync(outDir);
        fs.writeFileSync(path.join(tmpDir, 'existing.less'), '.x { color: red; }');

        lessWatchCompilerUtils.config = { watchFolder: tmpDir, outputFolder: outDir };

        function cleanup() {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        }

        lessWatchCompilerUtils.watchTree(
          tmpDir,
          { interval: 30, filter: lessWatchCompilerUtils.filterFiles },
          function (f, curr) {
            if (typeof f === 'object' && curr === null) return;
            if (curr && curr.nlink !== 0) lessWatchCompilerUtils.compileCSS(f);
          },
          function (f) {
            lessWatchCompilerUtils.compileCSS(f);
          }
        );

        waitForFileContent(
          path.join(outDir, 'existing.css'),
          (c) => c.includes('red'),
          3000,
          (err) => {
            if (err) {
              cleanup();
              return done(err);
            }
            setTimeout(() => {
              // Create the directory and the file inside it back-to-back,
              // matching the original report ("create new directory, create
              // xxx.less inside") and exercising the tighter race where the
              // file already exists by the time the new directory itself is
              // discovered.
              fs.mkdirSync(path.join(tmpDir, 'newdir'));
              fs.writeFileSync(path.join(tmpDir, 'newdir', 'nested.less'), '.y { color: green; }');
              waitForFileContent(
                path.join(outDir, 'newdir', 'nested.css'),
                (c) => c.includes('green'),
                5000,
                (err2) => {
                  cleanup();
                  if (err2) return done(err2);
                  done();
                }
              );
            }, 100);
          }
        );
      });

      it('never watches or compiles a file added that matches the exclude pattern (issue #72)', function (done) {
        // Regression note: this must exercise a FILE directly inside the
        // already-watched root, not a file inside a newly-created excluded
        // directory. A newly-created directory is discovered via the
        // readdir-rescan path, which (on this branch, independent of the
        // exclude feature) is also where issue #73's extension-filter bug
        // lives — a directory-based test would pass regardless of whether
        // the exclude check below does anything, confounding the result.
        const tmpDir = fs.mkdtempSync(path.join(cwd, 'test/tmp-live-exclude-'));
        const outDir = path.join(tmpDir, 'css');
        fs.mkdirSync(outDir);
        fs.writeFileSync(path.join(tmpDir, 'existing.less'), '.x { color: red; }');

        lessWatchCompilerUtils.config = { watchFolder: tmpDir, outputFolder: outDir };

        function cleanup() {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        }

        lessWatchCompilerUtils.watchTree(
          tmpDir,
          { interval: 30, filter: lessWatchCompilerUtils.filterFiles, exclude: /excluded-file/ },
          function (f, curr) {
            if (typeof f === 'object' && curr === null) return;
            if (curr && curr.nlink !== 0) lessWatchCompilerUtils.compileCSS(f);
          },
          function (f) {
            lessWatchCompilerUtils.compileCSS(f);
          }
        );

        waitForFileContent(
          path.join(outDir, 'existing.css'),
          (c) => c.includes('red'),
          3000,
          (err) => {
            if (err) {
              cleanup();
              return done(err);
            }
            setTimeout(() => {
              fs.writeFileSync(path.join(tmpDir, 'excluded-file.less'), '.pkg { color: blue; }');
              // Give the (if unguarded) readdir-rescan/compile chain for the
              // excluded file a dedicated window to prove itself before a
              // control file's own compile could otherwise mask a race.
              setTimeout(() => {
                // A control file, started only now, proves the watcher is
                // still alive and reacting normally.
                fs.writeFileSync(path.join(tmpDir, 'control.less'), '.z { color: green; }');
                waitForFileContent(
                  path.join(outDir, 'control.css'),
                  (c) => c.includes('green'),
                  5000,
                  (err2) => {
                    try {
                      if (err2) throw err2;
                      assert.ok(
                        !fs.existsSync(path.join(outDir, 'excluded-file.css')),
                        'a file matching the exclude pattern should never be watched or compiled'
                      );
                      cleanup();
                      done();
                    } catch (e) {
                      cleanup();
                      done(e);
                    }
                  }
                );
              }, 500);
            }, 100);
          }
        );
      });

      it('never watches or recompiles because of an @import target that matches the exclude pattern (issue #72)', function (done) {
        const tmpDir = fs.mkdtempSync(path.join(cwd, 'test/tmp-live-exclude-import-'));
        const outDir = path.join(tmpDir, 'css');
        fs.mkdirSync(outDir);
        fs.mkdirSync(path.join(tmpDir, 'excluded-dir'));
        fs.writeFileSync(path.join(tmpDir, 'excluded-dir', 'style.less'), '.pkg { color: blue; }');
        fs.writeFileSync(path.join(tmpDir, 'main.less'), '@import "excluded-dir/style.less";\n.a { color: red; }');

        lessWatchCompilerUtils.config = { watchFolder: tmpDir, outputFolder: outDir };

        function cleanup() {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        }

        // Use the real makeWatchHandler(), not the simplified inline
        // callback used elsewhere in this file -- only makeWatchHandler()
        // implements "recompile the importing parent when the changed file
        // is one of its imports", which is the exact path this regression
        // goes through (issue #72 follow-up: fileWatcher() used to register
        // an @import target with setupWatcher() unconditionally, bypassing
        // exclude).
        lessWatchCompilerUtils.watchTree(
          tmpDir,
          { interval: 30, filter: lessWatchCompilerUtils.filterFiles, exclude: /excluded-dir/ },
          lessWatchCompilerUtils.makeWatchHandler(undefined, {}),
          function (f) {
            lessWatchCompilerUtils.compileCSS(f);
          }
        );

        waitForFileContent(
          path.join(outDir, 'main.css'),
          (c) => c.includes('blue') && c.includes('red'),
          3000,
          (err) => {
            if (err) {
              cleanup();
              return done(err);
            }
            setTimeout(() => {
              fs.writeFileSync(path.join(tmpDir, 'excluded-dir', 'style.less'), '.pkg { color: green; }');
              // Give the (if unguarded) @import-target watch a dedicated
              // window to prove itself before a control file's own compile
              // could otherwise mask a race.
              setTimeout(() => {
                // A control file, started only now, proves the watcher is
                // still alive and reacting normally.
                fs.writeFileSync(path.join(tmpDir, 'control.less'), '.z { color: yellow; }');
                waitForFileContent(
                  path.join(outDir, 'control.css'),
                  (c) => c.includes('yellow'),
                  5000,
                  (err2) => {
                    try {
                      if (err2) throw err2;
                      const mainCss = fs.readFileSync(path.join(outDir, 'main.css'), 'utf8');
                      assert.ok(
                        mainCss.includes('blue') && !mainCss.includes('green'),
                        'editing an @import target matching the exclude pattern must not recompile the importing file'
                      );
                      cleanup();
                      done();
                    } catch (e) {
                      cleanup();
                      done(e);
                    }
                  }
                );
              }, 500);
            }, 100);
          }
        );
      });

      it('invokes the watch callback with nlink 0 (and does not crash) when a watched file is deleted', function (done) {
        const tmpDir = fs.mkdtempSync(path.join(cwd, 'test/tmp-live-remove-'));
        const outDir = path.join(tmpDir, 'css');
        fs.mkdirSync(outDir);
        const lessFile = path.join(tmpDir, 'gone.less');
        fs.writeFileSync(lessFile, '.a { color: red; }');

        lessWatchCompilerUtils.config = { watchFolder: tmpDir, outputFolder: outDir };

        function cleanup() {
          fs.unwatchFile(lessFile);
          fs.rmSync(tmpDir, { recursive: true, force: true });
        }

        lessWatchCompilerUtils.watchTree(
          tmpDir,
          { interval: 30, filter: lessWatchCompilerUtils.filterFiles },
          function (f, curr) {
            if (typeof f === 'object' && curr === null) return;
            if (curr && curr.nlink === 0 && f === lessFile) {
              try {
                assert.equal(f, lessFile);
                cleanup();
                done();
              } catch (e) {
                cleanup();
                done(e);
              }
            }
          },
          function (f) {
            lessWatchCompilerUtils.compileCSS(f);
          }
        );

        setTimeout(() => {
          fs.unlinkSync(lessFile);
        }, 200);
      });

      it('survives a transient delete+recreate (e.g. a non-atomic editor save) without permanently unwatching (issue #197)', function (done) {
        // fs.watchFile only fires once on the exists->gone transition and
        // never again while the path stays missing, so a single missing
        // poll used to be treated as a confirmed removal and unwatched
        // immediately -- permanently orphaning the watcher if that poll
        // happened to land inside an editor's delete-then-recreate save
        // window instead of a real deletion.
        const tmpDir = fs.mkdtempSync(path.join(cwd, 'test/tmp-live-transient-'));
        const file = path.join(tmpDir, 'main.less');
        fs.writeFileSync(file, '.a { color: red; }');
        const files = { [file]: fs.statSync(file) };
        const events = [];

        function cleanup() {
          fs.unwatchFile(file);
          fs.rmSync(tmpDir, { recursive: true, force: true });
        }

        lessWatchCompilerUtils.setupWatcher(file, files, { interval: 30 }, (f, curr) => {
          events.push(curr.nlink === 0 ? 'removed' : 'changed');
        });

        setTimeout(() => {
          fs.unlinkSync(file);
          // Recreate well within the debounce window (>= 300ms), simulating
          // a delete-then-recreate save landing inside a single poll gap.
          setTimeout(() => {
            fs.writeFileSync(file, '.a { color: green; }');
            setTimeout(() => {
              // A separate, later real edit must still be detected --
              // proving the watcher wasn't torn down by the blip.
              fs.writeFileSync(file, '.a { color: blue; }');
              setTimeout(() => {
                try {
                  assert.ok(!events.includes('removed'), 'a transient blip must not fire a removal event; got: ' + JSON.stringify(events));
                  assert.ok(events.includes('changed'), 'the recreation and/or later edit must still be detected; got: ' + JSON.stringify(events));
                  cleanup();
                  done();
                } catch (e) {
                  cleanup();
                  done(e);
                }
              }, 300);
            }, 300);
          }, 100);
        }, 100);
      });

      it('ignores a stale removal-debounce timer superseded by a later delete+recreate (issue #197 follow-up)', function (done) {
        // A first missing poll schedules a recheck timer. If, before that
        // timer fires, the file is recreated and then deleted *again*, the
        // first timer's fs.access check can land exactly inside that SECOND
        // gap and mistake it for confirmation of the FIRST poll's removal --
        // unwatching a file that's still actively being saved. The timer
        // must recognize it's been superseded and do nothing.
        const tmpDir = fs.mkdtempSync(path.join(cwd, 'test/tmp-live-stale-timer-'));
        const file = path.join(tmpDir, 'main.less');
        fs.writeFileSync(file, '.a { color: red; }');
        const files = { [file]: fs.statSync(file) };
        const events = [];

        function cleanup() {
          fs.unwatchFile(file);
          fs.rmSync(tmpDir, { recursive: true, force: true });
        }

        lessWatchCompilerUtils.setupWatcher(file, files, { interval: 30 }, (f, curr) => {
          events.push(curr.nlink === 0 ? 'removed' : 'changed');
        });

        // t=100: delete #1 (schedules a recheck ~300ms later, at ~t=400+).
        setTimeout(() => {
          fs.unlinkSync(file);
          setTimeout(() => {
            // t=150: recreate -- delete #1's timer is now stale.
            fs.writeFileSync(file, '.a { color: green; }');
            setTimeout(() => {
              // t=350: delete #2, shortly before delete #1's ~400ms recheck fires.
              fs.unlinkSync(file);
              setTimeout(() => {
                // t=450: recreate again -- this should end up alive and watched.
                fs.writeFileSync(file, '.a { color: blue; }');
                setTimeout(() => {
                  // A later, unrelated real edit must still be detected.
                  fs.writeFileSync(file, '.a { color: purple; }');
                  setTimeout(() => {
                    try {
                      assert.ok(!events.includes('removed'), 'no removal event should fire across this sequence; got: ' + JSON.stringify(events));
                      assert.ok(events.includes('changed'), 'at least the later edits must still be detected; got: ' + JSON.stringify(events));
                      cleanup();
                      done();
                    } catch (e) {
                      cleanup();
                      done(e);
                    }
                  }, 500);
                }, 750);
              }, 100);
            }, 200);
          }, 50);
        }, 100);
      });

      it('does not fire the watch callback for a path that never existed (e.g. a broken @import target)', function (done) {
        // setupWatcher() is called directly by fileWatcher() for @import
        // targets, which may not resolve to a real file. fs.watchFile fires
        // once with curr.nlink === 0 AND prev.nlink === 0 the first time it
        // polls such a path -- that must not be reported as a removal.
        const tmpDir = fs.mkdtempSync(path.join(cwd, 'test/tmp-live-neverexisted-'));
        const neverExisted = path.join(tmpDir, 'never-existed.less');
        let fired = false;

        lessWatchCompilerUtils.setupWatcher(neverExisted, {}, { interval: 30 }, () => {
          fired = true;
        });

        setTimeout(() => {
          fs.unwatchFile(neverExisted);
          fs.rmSync(tmpDir, { recursive: true, force: true });
          assert.equal(fired, false, 'watchCallback must not fire for a path that never existed');
          done();
        }, 500);
      });

      it('recompiles the top-level entry file when a doubly-nested hidden partial changes (issue #59)', function (done) {
        // homepage.less -> _theme.less -> _colors.less, both partials named
        // with the conventional leading underscore (never compiled on their
        // own). This exercises two compounding bugs together: (1)
        // setupWatcher()'s per-file change callback used to apply the
        // filter/hidden check before ever invoking watchCallback, silently
        // swallowing changes to hidden @import targets entirely; and (2)
        // makeWatchHandler() used to only check one hop of the import graph,
        // so even with (1) fixed, a change to _colors.less would recompile
        // _theme.less but never reach homepage.less two levels up.
        const tmpDir = fs.mkdtempSync(path.join(cwd, 'test/tmp-live-transitive-'));
        const outDir = path.join(tmpDir, 'css');
        fs.mkdirSync(outDir);
        fs.writeFileSync(path.join(tmpDir, 'homepage.less'), '@import "_theme.less";\n.a { color: red; }');
        fs.writeFileSync(path.join(tmpDir, '_theme.less'), '@import "_colors.less";\n.theme { .mixin(); }');
        fs.writeFileSync(path.join(tmpDir, '_colors.less'), '.mixin() { color: blue; }');

        lessWatchCompilerUtils.config = { watchFolder: tmpDir, outputFolder: outDir };

        function cleanup() {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        }

        lessWatchCompilerUtils.watchTree(
          tmpDir,
          { interval: 30, filter: lessWatchCompilerUtils.filterFiles },
          lessWatchCompilerUtils.makeWatchHandler(undefined, {}),
          function (f) {
            lessWatchCompilerUtils.compileCSS(f);
          }
        );

        waitForFileContent(
          path.join(outDir, 'homepage.css'),
          (c) => c.includes('blue') && c.includes('red'),
          3000,
          (err) => {
            if (err) {
              cleanup();
              return done(err);
            }
            setTimeout(() => {
              fs.writeFileSync(path.join(tmpDir, '_colors.less'), '.mixin() { color: green; }');
              waitForFileContent(
                path.join(outDir, 'homepage.css'),
                (c) => c.includes('green'),
                5000,
                (err2) => {
                  try {
                    if (err2) throw err2;
                    assert.ok(
                      !fs.existsSync(path.join(outDir, '_theme.css')) && !fs.existsSync(path.join(outDir, '_colors.css')),
                      'hidden partials must never produce their own standalone output'
                    );
                    cleanup();
                    done();
                  } catch (e) {
                    cleanup();
                    done(e);
                  }
                }
              );
            }, 100);
          }
        );
      });

      it('never chases or produces standalone output for a non-.less @import target (issue #59 review follow-up)', function (done) {
        // main.less -> reset.css -> fonts.css. Less doesn't inline a plain
        // `@import "x.css"` by default (it stays a literal @import url(...)
        // reference in the output), so following such a target's own
        // imports for recompile purposes is both pointless and, by treating
        // it as its own watchable/compilable entry, wrong: it must never
        // produce a standalone .css output of its own, and editing
        // something *it* imports must not propagate at all.
        const tmpDir = fs.mkdtempSync(path.join(cwd, 'test/tmp-live-css-import-'));
        const outDir = path.join(tmpDir, 'css');
        fs.mkdirSync(outDir);
        fs.writeFileSync(path.join(tmpDir, 'main.less'), '@import "reset.css";\n.a { color: red; }');
        fs.writeFileSync(path.join(tmpDir, 'reset.css'), '@import "fonts.css";');
        fs.writeFileSync(path.join(tmpDir, 'fonts.css'), '/* fonts */');

        lessWatchCompilerUtils.config = { watchFolder: tmpDir, outputFolder: outDir };

        function cleanup() {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        }

        lessWatchCompilerUtils.watchTree(
          tmpDir,
          { interval: 30, filter: lessWatchCompilerUtils.filterFiles },
          lessWatchCompilerUtils.makeWatchHandler(undefined, {}),
          function (f) {
            lessWatchCompilerUtils.compileCSS(f);
          }
        );

        waitForFileContent(
          path.join(outDir, 'main.css'),
          (c) => c.includes('red'),
          3000,
          (err) => {
            if (err) {
              cleanup();
              return done(err);
            }
            setTimeout(() => {
              fs.writeFileSync(path.join(tmpDir, 'fonts.css'), '/* changed */');
              // Give the (if unguarded) chase through reset.css a dedicated
              // window to prove itself before a control file's own compile
              // could otherwise mask a race.
              setTimeout(() => {
                // A control file, started only now, proves the watcher is
                // still alive and reacting normally.
                fs.writeFileSync(path.join(tmpDir, 'control.less'), '.z { color: green; }');
                waitForFileContent(
                  path.join(outDir, 'control.css'),
                  (c) => c.includes('green'),
                  5000,
                  (err2) => {
                    try {
                      if (err2) throw err2;
                      assert.ok(!fs.existsSync(path.join(outDir, 'reset.css')), 'a non-.less @import target must never produce its own standalone output');
                      cleanup();
                      done();
                    } catch (e) {
                      cleanup();
                      done(e);
                    }
                  }
                );
              }, 500);
            }, 100);
          }
        );
      });
    });
    describe('makeWatchHandler()', function () {
      let originalCompileCSS;
      beforeEach(function () {
        originalCompileCSS = lessWatchCompilerUtils.compileCSS;
      });
      afterEach(function () {
        lessWatchCompilerUtils.compileCSS = originalCompileCSS;
      });

      it('makeWatchHandler() function should be there', function () {
        assert.equal('function', typeof lessWatchCompilerUtils.makeWatchHandler);
      });

      it('is a no-op for the initial "finished walking" call', function () {
        const calls = [];
        lessWatchCompilerUtils.compileCSS = () => {
          calls.push('compiled');
          return { outputFilePath: '"out.css"' };
        };
        const handler = lessWatchCompilerUtils.makeWatchHandler(undefined, {
          onCompile: () => calls.push('onCompile'),
          onImportCompile: () => calls.push('onImportCompile'),
          onRemove: () => calls.push('onRemove')
        });
        handler({}, null, null, {});
        assert.deepStrictEqual(calls, []);
      });

      it('notifies onRemove and does not compile when a file is removed (nlink === 0)', function () {
        const calls = [];
        lessWatchCompilerUtils.compileCSS = () => {
          calls.push('compiled');
          return { outputFilePath: '"out.css"' };
        };
        const handler = lessWatchCompilerUtils.makeWatchHandler(undefined, {
          onRemove: (f) => calls.push('onRemove:' + f)
        });
        handler('/a/b.less', { nlink: 0 }, {}, {});
        assert.deepStrictEqual(calls, ['onRemove:/a/b.less']);
      });

      it("compiles the changed file directly when it isn't anyone's import", function () {
        const calls = [];
        lessWatchCompilerUtils.compileCSS = (file) => {
          calls.push('compiled:' + file);
          return { outputFilePath: '"' + file + '.css"' };
        };
        const handler = lessWatchCompilerUtils.makeWatchHandler(undefined, {
          onCompile: (f, result) => calls.push('onCompile:' + f + '->' + result.outputFilePath)
        });
        handler('/a/standalone.less', { nlink: 1 }, {}, {});
        assert.deepStrictEqual(calls, ['compiled:/a/standalone.less', 'onCompile:/a/standalone.less->"/a/standalone.less.css"']);
      });

      it('recompiles the importing parent when the changed file is one of its imports', function () {
        const calls = [];
        lessWatchCompilerUtils.compileCSS = (file) => {
          calls.push('compiled:' + file);
          return { outputFilePath: '"' + file + '.css"' };
        };
        const handler = lessWatchCompilerUtils.makeWatchHandler(undefined, {
          onCompile: (f) => calls.push('onCompile:' + f),
          onImportCompile: (importingFile, changedFile) => calls.push('onImportCompile:' + importingFile + '<-' + changedFile)
        });
        const changedFile = path.normalize('/a/partial.less');
        const fileimports = { '/a/main.less': ['partial.less'] };
        handler(changedFile, { nlink: 1 }, {}, fileimports);
        assert.deepStrictEqual(calls, ['compiled:/a/main.less', 'onImportCompile:/a/main.less<-' + changedFile]);
      });

      it('always recompiles mainFile when configured, ignoring import relationships', function () {
        const calls = [];
        lessWatchCompilerUtils.compileCSS = (file) => {
          calls.push('compiled:' + file);
          return { outputFilePath: '"main.css"' };
        };
        const handler = lessWatchCompilerUtils.makeWatchHandler('/a/main.less', {
          onCompile: (f) => calls.push('onCompile-for-change:' + f),
          onImportCompile: () => calls.push('onImportCompile')
        });
        const changedFile = path.normalize('/a/partial.less');
        // Even though partial.less is a declared import of main.less, the
        // "f === normalizedPath && !mainFilePath" guard never matches once
        // mainFilePath is set, so onImportCompile must never fire here.
        const fileimports = { '/a/main.less': ['partial.less'] };
        handler(changedFile, { nlink: 1 }, {}, fileimports);
        assert.deepStrictEqual(calls, ['compiled:/a/main.less', 'onCompile-for-change:' + changedFile]);
      });

      it('recompiles every ancestor in a multi-level @import chain, not just the direct importer (issue #59)', function () {
        const calls = [];
        lessWatchCompilerUtils.compileCSS = (file) => {
          calls.push('compiled:' + file);
          return { outputFilePath: '"' + file + '.css"' };
        };
        const handler = lessWatchCompilerUtils.makeWatchHandler(undefined, {
          onImportCompile: (importingFile, changedFile) => calls.push('onImportCompile:' + importingFile + '<-' + changedFile)
        });
        // homepage.less -> theme.less -> colors.less
        const changedFile = path.normalize('/a/colors.less');
        const fileimports = {
          '/a/homepage.less': ['theme.less'],
          '/a/theme.less': ['colors.less']
        };
        handler(changedFile, { nlink: 1 }, {}, fileimports);
        assert.deepStrictEqual(
          calls.sort(),
          [
            'compiled:' + path.normalize('/a/theme.less'),
            'compiled:' + path.normalize('/a/homepage.less'),
            'onImportCompile:' + path.normalize('/a/theme.less') + '<-' + changedFile,
            'onImportCompile:' + path.normalize('/a/homepage.less') + '<-' + changedFile
          ].sort()
        );
      });

      it('does not loop forever on a circular @import chain', function () {
        const calls = [];
        lessWatchCompilerUtils.compileCSS = (file) => {
          calls.push('compiled:' + file);
          return { outputFilePath: '"' + file + '.css"' };
        };
        const handler = lessWatchCompilerUtils.makeWatchHandler(undefined, {
          onImportCompile: (importingFile, changedFile) => calls.push('onImportCompile:' + importingFile + '<-' + changedFile)
        });
        // a.less <-> b.less import each other: since each one is a genuine
        // (transitive, via the cycle) ancestor of the other, editing b.less
        // legitimately recompiles both exactly once each -- the point of
        // this test is that the walk terminates rather than looping forever
        // chasing the cycle, not that only one side gets recompiled.
        const fileimports = {
          '/a/a.less': ['b.less'],
          '/a/b.less': ['a.less']
        };
        handler(path.normalize('/a/b.less'), { nlink: 1 }, {}, fileimports);
        assert.deepStrictEqual(
          calls.sort(),
          [
            'compiled:' + path.normalize('/a/a.less'),
            'compiled:' + path.normalize('/a/b.less'),
            'onImportCompile:' + path.normalize('/a/a.less') + '<-' + path.normalize('/a/b.less'),
            'onImportCompile:' + path.normalize('/a/b.less') + '<-' + path.normalize('/a/b.less')
          ].sort()
        );
      });

      it('recompiles the parent for a bare-name import that resolves to `_partial.less` on disk (issue #240)', function () {
        const calls = [];
        lessWatchCompilerUtils.compileCSS = (file) => {
          calls.push('compiled:' + file);
          return { outputFilePath: '"' + file + '.css"' };
        };
        const handler = lessWatchCompilerUtils.makeWatchHandler(undefined, {
          onImportCompile: (importingFile, changedFile) => calls.push('onImportCompile:' + importingFile + '<-' + changedFile)
        });
        const mainFile = path.resolve('./test/examples/issue-240/less/main.less');
        const changedFile = path.resolve('./test/examples/issue-240/less/_buttons.less');
        // main.less imports the partial via `@import (reference) "buttons";`
        // -- no extension, no underscore -- which must still resolve to the
        // on-disk `_buttons.less` file.
        const fileimports = { [mainFile]: ['buttons'] };
        handler(changedFile, { nlink: 1 }, {}, fileimports);
        assert.deepStrictEqual(calls, ['compiled:' + mainFile, 'onImportCompile:' + mainFile + '<-' + changedFile]);
      });
    });
    describe('compileCSS()', function () {
      // reset config
      lessWatchCompilerUtils.config = {};

      it('compileCSS() function should be there', function () {
        assert.equal('function', typeof lessWatchCompilerUtils.compileCSS);
      });
      it('should map the minified flag to compress and a .min.css output', function () {
        lessWatchCompilerUtils.config = {
          outputFolder: 'testFolder',
          minified: true
        };
        const result = lessWatchCompilerUtils.compileCSS('test.less', true);
        assert.equal(result.outputFilePath, '"testFolder/test.min.css"');
        assert.equal(result.options.compress, true);
      });
      it('should map the enableJs flag to javascriptEnabled', function () {
        lessWatchCompilerUtils.config = {
          outputFolder: 'testFolder',
          enableJs: true
        };
        const result = lessWatchCompilerUtils.compileCSS('test.less', true);
        assert.equal(result.outputFilePath, '"testFolder/test.css"');
        assert.equal(result.options.javascriptEnabled, true);
      });
      it('should map the sourceMap flag to lessc-compatible source map options', function () {
        lessWatchCompilerUtils.config = {
          outputFolder: 'testFolder',
          sourceMap: true
        };
        const result = lessWatchCompilerUtils.compileCSS('test.less', true);
        assert.deepStrictEqual(result.options.sourceMap, {
          sourceMapInputFilename: 'test.less',
          sourceMapOutputFilename: 'test.css',
          sourceMapFullFilename: 'testFolder/test.css.map',
          sourceMapFilename: 'test.css.map',
          sourceMapBasepath: '.',
          sourceMapRootpath: '..'
        });
      });
      it('should resolve the input filename to an absolute path for import resolution', function () {
        lessWatchCompilerUtils.config = {
          outputFolder: 'testFolder'
        };
        const result = lessWatchCompilerUtils.compileCSS('test.less', true);
        assert.equal(result.options.filename, path.resolve('test.less'));
      });

      it('should map the math LESS flag', function () {
        lessWatchCompilerUtils.config = {
          outputFolder: 'testFolder',
          lessArgs: 'math=strict'
        };
        assert.equal(lessWatchCompilerUtils.compileCSS('test.less', true).options.math, 'strict');
      });

      it('should map the strict-units LESS flag to a boolean', function () {
        lessWatchCompilerUtils.config = {
          outputFolder: 'testFolder',
          lessArgs: 'strict-units=on'
        };
        assert.equal(lessWatchCompilerUtils.compileCSS('test.less', true).options.strictUnits, true);
      });

      it('should map math, strict-units, and include-path together', function () {
        lessWatchCompilerUtils.config = {
          outputFolder: 'testFolder',
          lessArgs: 'math=strict,strict-units=on,include-path=./dir1;./dir2'
        };
        const options = lessWatchCompilerUtils.compileCSS('test.less', true).options;
        assert.equal(options.math, 'strict');
        assert.equal(options.strictUnits, true);
        assert.deepStrictEqual(options.paths, ['./dir1', './dir2']);
      });

      it('should keep commas inside parentheses in modify-var values (issue #103)', function () {
        lessWatchCompilerUtils.config = {
          outputFolder: 'testFolder',
          lessArgs: "modify-var='text-color=rgba(23, 34, 45, 0.5)'"
        };
        const options = lessWatchCompilerUtils.compileCSS('test.less', true).options;
        assert.deepStrictEqual(options.modifyVars, { 'text-color': 'rgba(23, 34, 45, 0.5)' });
      });

      it('should not compile hidden files by default', function () {
        lessWatchCompilerUtils.config = {
          outputFolder: 'testFolder'
        };
        assert.equal(undefined, lessWatchCompilerUtils.compileCSS('_test.less', true));
      });

      it('should compile hidden files when includeHidden flag is set', function () {
        lessWatchCompilerUtils.config = {
          outputFolder: 'testFolder',
          includeHidden: true
        };
        assert.equal(lessWatchCompilerUtils.compileCSS('_test.less', true).outputFilePath, '"testFolder/_test.css"');
      });
    });
    describe('renderLess() banner comments (issue #82)', function () {
      const { SourceMapConsumer } = require('source-map');
      let tmpDir, lessFile, outPath;

      beforeEach(function () {
        tmpDir = fs.mkdtempSync(path.join(cwd, 'test/tmp-banner-'));
        lessFile = path.join(tmpDir, 'main.less');
        outPath = path.join(tmpDir, 'main.css');
        fs.writeFileSync(lessFile, '.a {\n  color: red;\n}\n.b {\n  color: blue;\n}\n');
        lessWatchCompilerUtils.config = {};
      });

      afterEach(function () {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      });

      it('does not prepend anything when banner is not configured (off by default)', async function () {
        await lessWatchCompilerUtils.renderLess(lessFile, outPath, {});
        const css = fs.readFileSync(outPath, 'utf8');
        assert.ok(!css.includes('/*'), 'no banner comment should be present by default');
      });

      it('prepends a default message when banner: true', async function () {
        lessWatchCompilerUtils.config = { banner: true };
        await lessWatchCompilerUtils.renderLess(lessFile, outPath, {});
        const css = fs.readFileSync(outPath, 'utf8');
        assert.ok(css.startsWith('/* This file was generated by less-watch-compiler'));
        assert.ok(css.includes('.a {'));
      });

      it('prepends custom text as a single-line comment', async function () {
        lessWatchCompilerUtils.config = { banner: 'Do not touch this file.' };
        await lessWatchCompilerUtils.renderLess(lessFile, outPath, {});
        const css = fs.readFileSync(outPath, 'utf8');
        assert.ok(css.startsWith('/* Do not touch this file. */\n'));
      });

      it('wraps multi-line custom text as a block comment', async function () {
        lessWatchCompilerUtils.config = { banner: 'Line one.\nLine two.' };
        await lessWatchCompilerUtils.renderLess(lessFile, outPath, {});
        const css = fs.readFileSync(outPath, 'utf8');
        assert.ok(css.startsWith('/*\n * Line one.\n * Line two.\n */\n'));
      });

      it('neutralizes a literal */ in custom banner text so it cannot break out of the comment', async function () {
        // A raw "*/" inside custom banner text would otherwise prematurely
        // close the comment, turning whatever followed it into live CSS.
        lessWatchCompilerUtils.config = { banner: 'evil */ .injected { color: blue; } /*' };
        await lessWatchCompilerUtils.renderLess(lessFile, outPath, {});
        const css = fs.readFileSync(outPath, 'utf8');
        const closingDelimiters = (css.match(/\*\//g) || []).length;
        assert.equal(closingDelimiters, 1, "only the banner's own closing delimiter must exist; a raw */ from the custom text would add extra ones");
        assert.ok(css.indexOf('.a {') > css.indexOf('*/'), '.a { must come after the single comment-closing delimiter, not be exposed by an early one');
      });

      it('keeps the sourcemap resolving to the correct original line once shifted by a separate .map file', async function () {
        lessWatchCompilerUtils.config = { banner: true };
        const options = { sourceMap: { sourceMapFullFilename: outPath + '.map', sourceMapOutputFilename: 'main.css' } };
        await lessWatchCompilerUtils.renderLess(lessFile, outPath, options);
        const css = fs.readFileSync(outPath, 'utf8');
        const map = JSON.parse(fs.readFileSync(outPath + '.map', 'utf8'));
        const lines = css.split('\n');
        const bLine = lines.findIndex((l) => l.trim() === '.b {') + 1;
        // The default banner is exactly one comment line, so .b { must have
        // moved to generated line 5 (not 4, where it'd sit unshifted) --
        // asserting the shift actually happened, not just that whatever
        // line it landed on happens to resolve correctly.
        assert.ok(css.startsWith('/* This file was generated'), 'banner must actually be present');
        assert.equal(bLine, 5, '.b { must be shifted down by the one-line banner');

        const consumer = await new SourceMapConsumer(map);
        const pos = consumer.originalPositionFor({ line: bLine, column: 0 });
        assert.equal(pos.line, 4, '.b { in the banner-shifted output must still resolve to its real line in main.less');
      });

      it('keeps an inline sourcemap resolving correctly once shifted', async function () {
        lessWatchCompilerUtils.config = { banner: true };
        const options = { sourceMap: { sourceMapFileInline: true, sourceMapOutputFilename: 'main.css' } };
        await lessWatchCompilerUtils.renderLess(lessFile, outPath, options);
        const css = fs.readFileSync(outPath, 'utf8');
        const lines = css.split('\n');
        const bLine = lines.findIndex((l) => l.trim() === '.b {') + 1;
        assert.ok(css.startsWith('/* This file was generated'), 'banner must actually be present');
        assert.equal(bLine, 5, '.b { must be shifted down by the one-line banner');

        const encoded = css.match(/sourceMappingURL=data:application\/json;base64,([^\s*]+)/)[1];
        const map = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
        const consumer = await new SourceMapConsumer(map);
        const pos = consumer.originalPositionFor({ line: bLine, column: 0 });
        assert.equal(pos.line, 4, '.b { in the banner-shifted inline map must still resolve to its real line in main.less');
      });
    });
    describe('resolveOutputPath()', function () {
      // reset config
      lessWatchCompilerUtils.config = {};

      it('should resolve filepaths correctly', function () {
        lessWatchCompilerUtils.config = {
          watchFolder: './inputFolder/inner',
          outputFolder: './testFolder/nested',
          minified: true
        };

        // Walker will always return paths relative to watchFolder
        assert.equal(lessWatchCompilerUtils.resolveOutputPath('inputFolder/inner/evenmore/afile.less'), '"testFolder/nested/evenmore/afile.min.css"');
      });

      it('should resolve always put output files in output folder', function () {
        lessWatchCompilerUtils.config = {
          watchFolder: './inputFolder/inner',
          outputFolder: './testFolder/nested',
          minified: true
        };

        // Main file is relative to watchFolder as well, but can be a relative path
        // it should however always land in the destination folder
        assert.equal(lessWatchCompilerUtils.resolveOutputPath('inputFolder/inner/../afile.less'), '"testFolder/nested/afile.min.css"');
      });
    });
    describe('filterFiles()', function () {
      // reset config
      lessWatchCompilerUtils.config = {};

      it('filterFiles() function should be there' + JSON.stringify(lessWatchCompilerUtils.config), function () {
        assert.equal('function', typeof lessWatchCompilerUtils.filterFiles);
      });
      it('filterFiles() function should return "false" for allowed files:' + JSON.stringify(lessWatchCompilerUtils.config), function () {
        assert.equal(false, lessWatchCompilerUtils.filterFiles('file.less'));

        lessWatchCompilerUtils.config.allowedExtensions = ['.css'];
        assert.equal(false, lessWatchCompilerUtils.filterFiles('file.css'));
        lessWatchCompilerUtils.config = {};
      });
      it('filterFiles() function should return "true" for non-allowed files' + JSON.stringify(lessWatchCompilerUtils.config), function () {
        assert.equal(true, lessWatchCompilerUtils.filterFiles('file.js'));
      });
      it('filterFiles() function should return "true" for hidden files' + JSON.stringify(lessWatchCompilerUtils.config), function () {
        assert.equal(true, lessWatchCompilerUtils.filterFiles('_file.less'));
        assert.equal(true, lessWatchCompilerUtils.filterFiles('.file.less'));
      });
      it('filterFiles() function should return "false" for hidden files with includeHidden flag' + JSON.stringify(lessWatchCompilerUtils.config), function () {
        lessWatchCompilerUtils.config.includeHidden = true;
        assert.equal(false, lessWatchCompilerUtils.filterFiles('_file.less'));
        assert.equal(false, lessWatchCompilerUtils.filterFiles('.file.less'));
        lessWatchCompilerUtils.config = {};
      });
    });
    describe('resolveExcludePattern()', function () {
      it('resolveExcludePattern() function should be there', function () {
        assert.equal('function', typeof lessWatchCompilerUtils.resolveExcludePattern);
      });
      it('excludes node_modules and .git by default, without any user pattern', function () {
        const pattern = lessWatchCompilerUtils.resolveExcludePattern();
        assert.ok(pattern.test('/project/node_modules/pkg/style.less'));
        assert.ok(pattern.test('/project/.git/HEAD'));
        assert.ok(!pattern.test('/project/less/style.less'));
      });
      it('does not false-positive on names that merely contain node_modules or .git as a substring', function () {
        const pattern = lessWatchCompilerUtils.resolveExcludePattern();
        assert.ok(!pattern.test('/project/my-node_modules-backup/style.less'));
        assert.ok(!pattern.test('/project/.gitignore'));
      });
      it('adds a user pattern on top of the defaults rather than replacing them', function () {
        const pattern = lessWatchCompilerUtils.resolveExcludePattern('dist');
        assert.ok(pattern.test('/project/node_modules/pkg/style.less'), 'default exclusion must still apply');
        assert.ok(pattern.test('/project/dist/style.less'), 'user pattern must also apply');
        assert.ok(!pattern.test('/project/less/style.less'));
      });
      it('throws a clean error referencing just the user pattern when it is not a valid regex', function () {
        assert.throws(() => lessWatchCompilerUtils.resolveExcludePattern('['), /Unterminated character class/);
      });
      it('rejects a pattern with catastrophic backtracking potential instead of accepting it silently', function () {
        // exclude is tested against every path on every scan; a pattern like
        // this can take exponential time on certain inputs and hang the
        // watcher, so it must be rejected up front rather than accepted and
        // only discovered to be a problem once it actually pathologically
        // backtracks against some path in the tree.
        assert.throws(() => lessWatchCompilerUtils.resolveExcludePattern('(x+x+)+y'), /catastrophic backtracking/);
      });
      it('accepts an ordinary user pattern that safe-regex2 does not flag', function () {
        assert.doesNotThrow(() => lessWatchCompilerUtils.resolveExcludePattern('dist|build'));
      });
    });
    describe('getDateTime()', function () {
      it('getDateTime() function should be there and has value', function () {
        assert.equal(true, lessWatchCompilerUtils.getDateTime().length > 0);
      });
    });
    describe('formatLessError()', function () {
      it('numbers extract lines by their original position, not their filtered index', function () {
        // Error on line 1: no line-before-context, so extract[0] is undefined
        const message = lessWatchCompilerUtils.formatLessError({
          message: 'Unrecognised input',
          line: 1,
          column: 0,
          filename: 'test.less',
          extract: [undefined, '.broken {', '  color: @x;']
        });
        assert.ok(message.includes('\n1 .broken {'), 'the error line itself must be numbered 1, not 0: ' + message);
        assert.ok(message.includes('\n2   color: @x;'), 'the following context line must be numbered 2: ' + message);
        assert.ok(!message.includes('\n0 '), 'no line should be mislabeled as line 0: ' + message);
      });
      it('still numbers correctly when the trailing context line is undefined', function () {
        const message = lessWatchCompilerUtils.formatLessError({
          message: 'Unrecognised input',
          line: 5,
          column: 0,
          filename: 'test.less',
          extract: ['  prior line;', '.broken {', undefined]
        });
        assert.ok(message.includes('\n4   prior line;'));
        assert.ok(message.includes('\n5 .broken {'));
      });
    });
    describe('setupWatcher()', function () {
      it('setupWatcher() function should be there', function () {
        assert.equal('function', typeof lessWatchCompilerUtils.setupWatcher);
      });
      it('setupWatcher() function should take the correct parameters', function (done) {
        lessWatchCompilerUtils.setupWatcher(cwd, {}, {}, function () {});
        done();
      });
      it('setupWatcher() should skip watch registration when runOnce is true', function () {
        const originalWatchFile = fs.watchFile;
        let watched = false;
        fs.watchFile = () => {
          watched = true;
        };
        lessWatchCompilerUtils.config.runOnce = true;

        lessWatchCompilerUtils.setupWatcher(cwd, {}, {}, function () {});

        lessWatchCompilerUtils.config.runOnce = false;
        fs.watchFile = originalWatchFile;
        assert.equal(false, watched);
      });
    });
    describe('fileWatcher()', function () {
      it('fileWatcher() function should be there', function () {
        assert.equal('function', typeof lessWatchCompilerUtils.fileWatcher);
      });
      it('fileWatcher() function should take the correct parameters', function (done) {
        lessWatchCompilerUtils.fileWatcher(cwd, {}, {}, [], [], function () {});
        done();
      });
      it('fileWatcher() function should not fail for relative paths', function (done) {
        lessWatchCompilerUtils.fileWatcher(testRelative, {}, {}, [], [], function () {});
        done();
      });

      it('registers only one fs.watchFile listener for a file imported by two different files', function () {
        const tmpDir = fs.mkdtempSync(path.join(cwd, 'test/tmp-shared-import-'));
        const shared = path.join(tmpDir, 'shared.less');
        const a = path.join(tmpDir, 'a.less');
        const b = path.join(tmpDir, 'b.less');
        fs.writeFileSync(shared, '.shared {}');
        fs.writeFileSync(a, "@import 'shared.less';\n.a {}");
        fs.writeFileSync(b, "@import 'shared.less';\n.b {}");

        const files = { [a]: fs.statSync(a), [b]: fs.statSync(b) };
        const filelistArr = [];
        const originalWatchFolder = lessWatchCompilerUtils.config.watchFolder;
        lessWatchCompilerUtils.config.watchFolder = tmpDir;

        let watchFileCalls = 0;
        const originalWatchFile = fs.watchFile;
        fs.watchFile = function (f, ...rest) {
          if (f === shared) watchFileCalls++;
          return originalWatchFile.call(fs, f, ...rest);
        };

        try {
          lessWatchCompilerUtils.fileWatcher(a, files, { interval: 9999 }, filelistArr, {}, function () {});
          lessWatchCompilerUtils.fileWatcher(b, files, { interval: 9999 }, filelistArr, {}, function () {});
          assert.equal(watchFileCalls, 1, 'a file imported by two different importers must only be watched once');
        } finally {
          fs.watchFile = originalWatchFile;
          lessWatchCompilerUtils.config.watchFolder = originalWatchFolder;
          fs.unwatchFile(shared);
          fs.unwatchFile(a);
          fs.unwatchFile(b);
          fs.rmSync(tmpDir, { recursive: true, force: true });
        }
      });

      it('watches the `_partial.less` file for a bare-name `@import (options) "partial";` (issue #240)', function () {
        const tmpDir = fs.mkdtempSync(path.join(cwd, 'test/tmp-partial-import-'));
        const partial = path.join(tmpDir, '_partial.less');
        const main = path.join(tmpDir, 'main.less');
        fs.writeFileSync(partial, '.partial {}');
        // No extension, no underscore, plus a (reference) options clause --
        // the exact form issue #240 reports as not being tracked.
        fs.writeFileSync(main, '@import (reference) "partial";\n.main { .partial; }');

        const files = { [main]: fs.statSync(main) };
        const filelistArr = [];
        const originalWatchFolder = lessWatchCompilerUtils.config.watchFolder;
        lessWatchCompilerUtils.config.watchFolder = tmpDir;

        let watchedPartial = false;
        const originalWatchFile = fs.watchFile;
        fs.watchFile = function (f, ...rest) {
          if (f === partial) watchedPartial = true;
          return originalWatchFile.call(fs, f, ...rest);
        };

        try {
          lessWatchCompilerUtils.fileWatcher(main, files, { interval: 9999 }, filelistArr, {}, function () {});
          assert.equal(watchedPartial, true, 'the underscore-prefixed partial must be watched for the bare-name import');
        } finally {
          fs.watchFile = originalWatchFile;
          lessWatchCompilerUtils.config.watchFolder = originalWatchFolder;
          fs.unwatchFile(partial);
          fs.unwatchFile(main);
          fs.rmSync(tmpDir, { recursive: true, force: true });
        }
      });
    });
    describe('watchExternalImportDir() (issue #209: external @import survives delete+recreate)', function () {
      let originalWatchFolder;
      beforeEach(function () {
        originalWatchFolder = lessWatchCompilerUtils.config.watchFolder;
      });
      afterEach(function () {
        lessWatchCompilerUtils.config.watchFolder = originalWatchFolder;
      });

      it('watchExternalImportDir() function should be there', function () {
        assert.equal('function', typeof lessWatchCompilerUtils.watchExternalImportDir);
      });

      it('registers a directory watch for an @import target that resolves outside watchFolder', function () {
        const tmpDir = fs.mkdtempSync(path.join(cwd, 'test/tmp-external-dir-'));
        const watchFolder = path.join(tmpDir, 'less');
        const externalDir = path.join(tmpDir, 'external');
        fs.mkdirSync(watchFolder);
        fs.mkdirSync(externalDir);
        const externalFile = path.join(externalDir, 'partial.less');
        fs.writeFileSync(externalFile, '.partial {}');
        lessWatchCompilerUtils.config.watchFolder = watchFolder;

        const files = {};
        const filelistArr = [];
        lessWatchCompilerUtils.watchExternalImportDir(externalFile, files, { interval: 30 }, filelistArr, {}, function () {});

        try {
          assert.ok(files[externalDir], 'the external directory must be recorded in the files map');
          assert.ok(filelistArr.indexOf(externalDir) !== -1, 'the external directory must be added to the dedup list');
        } finally {
          fs.unwatchFile(externalDir);
          fs.rmSync(tmpDir, { recursive: true, force: true });
        }
      });

      it('is a no-op for an @import target inside watchFolder (already covered by the recursive walk)', function () {
        const tmpDir = fs.mkdtempSync(path.join(cwd, 'test/tmp-internal-dir-'));
        const watchFolder = path.join(tmpDir, 'less');
        fs.mkdirSync(watchFolder);
        const internalFile = path.join(watchFolder, 'partial.less');
        fs.writeFileSync(internalFile, '.partial {}');
        lessWatchCompilerUtils.config.watchFolder = watchFolder;

        const files = {};
        const filelistArr = [];
        lessWatchCompilerUtils.watchExternalImportDir(internalFile, files, { interval: 30 }, filelistArr, {}, function () {});

        assert.deepStrictEqual(files, {});
        assert.deepStrictEqual(filelistArr, []);
        fs.rmSync(tmpDir, { recursive: true, force: true });
      });

      it('is a no-op when watchFolder is not configured', function () {
        lessWatchCompilerUtils.config.watchFolder = undefined;
        const files = {};
        const filelistArr = [];
        lessWatchCompilerUtils.watchExternalImportDir('/some/external/file.less', files, {}, filelistArr, {}, function () {});
        assert.deepStrictEqual(files, {});
        assert.deepStrictEqual(filelistArr, []);
      });

      it('does not throw when the external directory does not exist (nothing to watch until it does)', function () {
        lessWatchCompilerUtils.config.watchFolder = path.join(cwd, 'test/less');
        const files = {};
        const filelistArr = [];
        assert.doesNotThrow(() => {
          lessWatchCompilerUtils.watchExternalImportDir(path.join(cwd, 'test/does-not-exist/partial.less'), files, {}, filelistArr, {}, function () {});
        });
        assert.deepStrictEqual(files, {});
      });

      it('seeds every pre-existing sibling in the external directory into the files map', function () {
        // Regression test: without seeding, setupWatcher's directory branch
        // (`if (!files[file])`) would treat every pre-existing sibling as
        // newly added on the next unrelated directory change, firing a
        // spurious watchCallback/compile for files that were never touched
        // and aren't anyone's @import.
        const tmpDir = fs.mkdtempSync(path.join(cwd, 'test/tmp-external-seed-'));
        const externalDir = path.join(tmpDir, 'external');
        fs.mkdirSync(externalDir);
        const importTarget = path.join(externalDir, 'partial.less');
        const sibling = path.join(externalDir, 'unrelated.less');
        fs.writeFileSync(importTarget, '.partial {}');
        fs.writeFileSync(sibling, '.unrelated {}');
        lessWatchCompilerUtils.config.watchFolder = path.join(tmpDir, 'less');

        const files = {};
        const filelistArr = [];
        lessWatchCompilerUtils.watchExternalImportDir(importTarget, files, { interval: 30 }, filelistArr, {}, function () {});

        try {
          assert.ok(files[sibling], 'a pre-existing sibling of the import target must be seeded, not treated as new later');
        } finally {
          fs.unwatchFile(externalDir);
          fs.rmSync(tmpDir, { recursive: true, force: true });
        }
      });
    });
  });
});
