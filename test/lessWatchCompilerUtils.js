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
    });
  });
});
