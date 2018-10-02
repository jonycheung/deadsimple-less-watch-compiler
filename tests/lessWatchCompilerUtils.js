var assert = require("assert"),
    lessWatchCompilerUtils = require('../dist/lib/lessWatchCompilerUtils.js'),
    sh = require('shelljs'),
    cwd = sh.pwd().toString(),
    testroot = cwd+'/tests/less/',
    testRelative = './tests/less';

describe('lessWatchCompilerUtils Module API', function () {
    describe('Should have the following API\'s', function () {
        describe('walk()', function () {
            it('walk() function should be there', function () {
                assert.equal("function", typeof (lessWatchCompilerUtils.walk));
            });
            it('walk() function should return an object of files ', function (done) {
                var timeout;
                lessWatchCompilerUtils.walk(testroot, {}, function (err, files) {
                    for (var i in files) {
                        assert.equal("object", typeof (files[i]));
                    }
                }, function () {});
                if (timeout) clearTimeout(timeout);
                timeout = setTimeout(function () {
                    //`fs` is notorious for multiple callbacks so we have to do this.
                    done();
                }, 30);
            });
        })
        describe('watchTree()', function () {
            it('watchTree() function should be there', function () {
                assert.equal("function", typeof (lessWatchCompilerUtils.watchTree));
            });
            it('watchTree() function should complete and call a callback ', function (done) {
                var timeout;
                lessWatchCompilerUtils.watchTree(testroot, {}, function () {}, function () {
                    if (timeout) clearTimeout(timeout);
                    timeout = setTimeout(function () {
                        done();
                    }, 20);
                });
            });
        })
        describe('compileCSS()', function () {
            it('compileCSS() function should be there', function () {
                assert.equal("function", typeof (lessWatchCompilerUtils.compileCSS));
            });
            it('should run the correct command with minified flag', function () {   
                lessWatchCompilerUtils.config.outputFolder = "testFolder";
                lessWatchCompilerUtils.config.minified = true;
                lessWatchCompilerUtils.config.enableJs = false;
                assert.equal("lessc -x test.less testFolder/test.min.css", lessWatchCompilerUtils.compileCSS("test.less", true).command);
            });
            it('should run the correct command with enableJs flag', function () {
                lessWatchCompilerUtils.config.outputFolder = "testFolder";
                lessWatchCompilerUtils.config.minified = false;
                lessWatchCompilerUtils.config.enableJs = true;
                assert.equal("lessc --js test.less testFolder/test.css", lessWatchCompilerUtils.compileCSS("test.less", true).command);
            });
            it('should run the correct command with sourceMap flag', function () {
                lessWatchCompilerUtils.config.outputFolder = "testFolder";
                lessWatchCompilerUtils.config.minified = false;
                lessWatchCompilerUtils.config.enableJs = false;
                lessWatchCompilerUtils.config.sourceMap = true;
                assert.equal("lessc --source-map test.less testFolder/test.css", lessWatchCompilerUtils.compileCSS("test.less", true).command);
            });
            it('should run the correct command with 1 plugin', function () {
                lessWatchCompilerUtils.config.outputFolder = "testFolder";
                lessWatchCompilerUtils.config.minified = false;
                lessWatchCompilerUtils.config.enableJs = false;
                lessWatchCompilerUtils.config.sourceMap = false;
                lessWatchCompilerUtils.config.plugins = "plugin1";
                assert.equal("lessc --plugin1 test.less testFolder/test.css", lessWatchCompilerUtils.compileCSS("test.less", true).command);
            });
            it('should run the correct command with 2 plugins', function () {
                lessWatchCompilerUtils.config.outputFolder = "testFolder";
                lessWatchCompilerUtils.config.minified = false;
                lessWatchCompilerUtils.config.enableJs = false;
                lessWatchCompilerUtils.config.sourceMap = false;
                lessWatchCompilerUtils.config.plugins = "plugin1,plugin2";
                assert.equal("lessc --plugin1 --plugin2 test.less testFolder/test.css", lessWatchCompilerUtils.compileCSS("test.less", true).command);
            });

            it('should run the correct command with minified flag', function () {
                lessWatchCompilerUtils.config.outputFolder = "testFolder";
                lessWatchCompilerUtils.config.minified = true;
                lessWatchCompilerUtils.config.enableJs = false;
                lessWatchCompilerUtils.config.sourceMap = false;
                lessWatchCompilerUtils.config.plugins = false;
                assert.equal("lessc -x test.less testFolder/test.min.css", lessWatchCompilerUtils.compileCSS("test.less", true).command);
            });
        });
        describe('resolveOutputPath()', function () {	
            it('should resolve filepaths correctly', function () {
                lessWatchCompilerUtils.config.watchFolder = "./inputFolder/inner";
                lessWatchCompilerUtils.config.outputFolder = "./testFolder/nested";
                lessWatchCompilerUtils.config.minified = true;
                lessWatchCompilerUtils.config.enableJs = false;
                lessWatchCompilerUtils.config.sourceMap = false;
                lessWatchCompilerUtils.config.plugins = false;

                // Walker will always paths relative to watchFolder
                assert.equal(lessWatchCompilerUtils.resolveOutputPath('inputFolder/inner/evenmore/afile.less'), 'testFolder/nested/evenmore/afile.min.css');
            });

            it('should resolve always put output files in output folder', function () {
                lessWatchCompilerUtils.config.watchFolder = "./inputFolder/inner";
                lessWatchCompilerUtils.config.outputFolder = "./testFolder/nested";
                lessWatchCompilerUtils.config.minified = true;
                lessWatchCompilerUtils.config.enableJs = false;
                lessWatchCompilerUtils.config.sourceMap = false;
                lessWatchCompilerUtils.config.plugins = false;

                // Main file is relative to watchFolder as well, but can be a relative path
                // it should however always land in the destination folder
                assert.equal(lessWatchCompilerUtils.resolveOutputPath('inputFolder/inner/../afile.less'), 'testFolder/nested/afile.min.css');
            });
        });
        describe('filterFiles()', function () {
            it('filterFiles() function should be there', function () {
                assert.equal("function", typeof (lessWatchCompilerUtils.filterFiles));
            });
            lessWatchCompilerUtils.config.allowedExtensions = [".css"]
            it('filterFiles() function should return "false" for allowed files', function () {
                assert.equal(false, lessWatchCompilerUtils.filterFiles("file.css"));
            });
            it('filterFiles() function should return "true" for non-allowed files', function () {
                assert.equal(true, lessWatchCompilerUtils.filterFiles("file.js"));
            });

        })
        describe('getDateTime()', function () {
            it('getDateTime() function should be there and has value', function () {
                assert.equal(true, lessWatchCompilerUtils.getDateTime().length > 0);
            });
        })
        describe('setupWatcher()', function () {
            it('setupWatcher() function should be there', function () {
                assert.equal("function", typeof (lessWatchCompilerUtils.setupWatcher));
            });
            it('setupWatcher() function should take the correct parameters', function (done) {
                lessWatchCompilerUtils.setupWatcher(cwd, {}, {}, function () {});
                done();
            });
        })
        describe('fileWatcher()', function () {
            it('fileWatcher() function should be there', function () {
                assert.equal("function", typeof (lessWatchCompilerUtils.fileWatcher));
            });
            it('fileWatcher() function should take the correct parameters', function (done) {
                lessWatchCompilerUtils.fileWatcher(cwd, {}, {}, [], [],function () {});
                done();
            });
            it('fileWatcher() function should not fail for relative paths', function (done) {
                lessWatchCompilerUtils.fileWatcher(testRelative, {}, {}, [], [],function () {});
                done();
            });
        })

    })
})