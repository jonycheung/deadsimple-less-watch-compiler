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
