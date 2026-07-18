var assert = require('assert'),
  lessWatchCompilerUtils = require('../dist/lib/lessWatchCompilerUtils.js'),
  cwd = process.cwd(),
  fs = require('fs'),
  path = require('path'),
  testroot = cwd + '/test/less/',
  testRelative = './test/less';

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
    });
    describe('watchTree()', function () {
      it('watchTree() function should be there', function () {
        assert.strictEqual('function', typeof lessWatchCompilerUtils.watchTree);
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
