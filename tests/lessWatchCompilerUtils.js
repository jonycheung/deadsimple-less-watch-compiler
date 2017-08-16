var assert = require("assert"),
    lessWatchCompilerUtils = require('../dist/lib/lessWatchCompilerUtils.js'),
    sh = require('shelljs'),
    cwd = sh.pwd().toString(),
    testfile = '/tests/less/test.less';

describe('lessWatchCompilerUtils Module API', function () {
    describe('Should have the following API\'s', function () {
        describe('walk()', function () {
            it('walk() function should be there', function () {
                assert.equal("function", typeof (lessWatchCompilerUtils.walk));
            });
            it('walk() function should return an object of files ', function (done) {
                var timeout;
                lessWatchCompilerUtils.walk(cwd, {}, function (err, files) {
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
                lessWatchCompilerUtils.watchTree(cwd, {}, function () {}, function () {
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
                assert.equal("lessc -x test testFolder/test.min.css", lessWatchCompilerUtils.compileCSS("test", true).command);
            });
            it('should run the correct command with sourceMap flag', function () {
                lessWatchCompilerUtils.config.outputFolder = "testFolder";
                lessWatchCompilerUtils.config.minified = false;
                lessWatchCompilerUtils.config.sourceMap = true;
                assert.equal("lessc --source-map test testFolder/test.css", lessWatchCompilerUtils.compileCSS("test", true).command);
            });
            it('should run the correct command with 1 plugin', function () {
                lessWatchCompilerUtils.config.outputFolder = "testFolder";
                lessWatchCompilerUtils.config.minified = false;
                lessWatchCompilerUtils.config.sourceMap = false;
                lessWatchCompilerUtils.config.plugins = "plugin1";
                assert.equal("lessc --plugin1 test testFolder/test.css", lessWatchCompilerUtils.compileCSS("test", true).command);
            });
            it('should run the correct command with 2 plugins', function () {
                lessWatchCompilerUtils.config.outputFolder = "testFolder";
                lessWatchCompilerUtils.config.minified = false;
                lessWatchCompilerUtils.config.sourceMap = false;
                lessWatchCompilerUtils.config.plugins = "plugin1,plugin2";
                assert.equal("lessc --plugin1 --plugin2 test testFolder/test.css", lessWatchCompilerUtils.compileCSS("test", true).command);
            });

            it('should run the correct command with minified flag', function () {
                lessWatchCompilerUtils.config.outputFolder = "testFolder";
                lessWatchCompilerUtils.config.minified = true;
                lessWatchCompilerUtils.config.sourceMap = false;
                lessWatchCompilerUtils.config.plugins = false;
                assert.equal("lessc -x test testFolder/test.min.css", lessWatchCompilerUtils.compileCSS("test", true).command);
            });
        })
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
        })

    })
})