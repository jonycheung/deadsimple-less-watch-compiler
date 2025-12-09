var assert = require("assert"),
    lessWatchCompilerUtils = require('../dist/lib/lessWatchCompilerUtils.js'),
    sh = require('shelljs'),
    cwd = sh.pwd().toString(),
    fs = require('fs'),
    path = require('path'),
    testroot = cwd+'/test/less/',
    testRelative = './test/less';

describe('lessWatchCompilerUtils Module API', function () {
    describe('Should have the following API\'s', function () {
        describe('walk()', function () {
            it('walk() function should be there', function () {
                assert.equal("function", typeof (lessWatchCompilerUtils.walk));
            });
            it('walk() function should return an object of files ', async (done) => {
                await runCommand(done);
                function runCommand (done) {
                    lessWatchCompilerUtils.walk(testroot, {}, (err, files) => {
                        for (var i in files) {
                            assert.equal("object", typeof (files[i]));
                        }
                }, function () {});
                done();
             }
                
            });
            it('walk() should respect ignoreDotFiles option', (done) => {
                const tmpDir = fs.mkdtempSync(path.join(cwd, 'test/tmp-walk-'));
                const dotFile = path.join(tmpDir, '.hidden.less');
                const visibleFile = path.join(tmpDir, 'visible.less');
                fs.writeFileSync(dotFile, '');
                fs.writeFileSync(visibleFile, '');

                lessWatchCompilerUtils.walk(tmpDir, { ignoreDotFiles: true }, (err, files) => {
                    assert.ifError(err);
                    const fileList = Object.keys(files);
                    assert.ok(fileList.some((f) => f.endsWith('visible.less')));
                    assert.ok(!fileList.some((f) => f.endsWith('.hidden.less')));
                    fs.rmSync(tmpDir, { recursive: true, force: true });
                    done();
                }, function () {});
            });
        })
        describe('watchTree()', function () {
            it('watchTree() function should be there', function () {
                assert.strictEqual("function", typeof (lessWatchCompilerUtils.watchTree));
            });
            it('watchTree() function should complete and call a callback ', async (done) => {
                await runCommand(done);
                function runCommand (done) {
                    lessWatchCompilerUtils.watchTree(testroot, {}, function () {}, function() { });
                    assert.ok("completed")
                    done()
                }
            });
        })
        describe('compileCSS()', function () {
            // reset config
            lessWatchCompilerUtils.config = {};

            it('compileCSS() function should be there', function () {
                assert.equal("function", typeof (lessWatchCompilerUtils.compileCSS));
            });
            it('should run the correct command with minified flag', function () {   
                lessWatchCompilerUtils.config = {
                    outputFolder: "testFolder",
                    minified: true
                };
                assert.equal("lessc -x \"test.less\" \"testFolder/test.min.css\"", lessWatchCompilerUtils.compileCSS("test.less", true).command);
            });
            it('should run the correct command with enableJs flag', function () {
                lessWatchCompilerUtils.config = {
                    outputFolder: "testFolder",
                    enableJs: true
                };
                assert.equal("lessc --js \"test.less\" \"testFolder/test.css\"", lessWatchCompilerUtils.compileCSS("test.less", true).command);
            });
            it('should run the correct command with sourceMap flag', function () {
                lessWatchCompilerUtils.config = {
                    outputFolder: "testFolder",
                    sourceMap: true
                };
                assert.equal("lessc --source-map \"test.less\" \"testFolder/test.css\"", lessWatchCompilerUtils.compileCSS("test.less", true).command);
            });
            it('should run the correct command with 1 plugin', function () {
                lessWatchCompilerUtils.config = {
                    outputFolder: "testFolder",
                    plugins: "plugin1"
                };
                assert.equal("lessc --plugin1 \"test.less\" \"testFolder/test.css\"", lessWatchCompilerUtils.compileCSS("test.less", true).command);
            });
            it('should run the correct command with 2 plugins', function () {
                lessWatchCompilerUtils.config = {
                    outputFolder: "testFolder",
                    plugins: "plugin1,plugin2"
                };
                assert.equal("lessc --plugin1 --plugin2 \"test.less\" \"testFolder/test.css\"", lessWatchCompilerUtils.compileCSS("test.less", true).command);
            });

            it('should run the correct command with minified flag', function () {
                lessWatchCompilerUtils.config = {
                    outputFolder: "testFolder",
                    minified: true
                };
                assert.equal("lessc -x \"test.less\" \"testFolder/test.min.css\"", lessWatchCompilerUtils.compileCSS("test.less", true).command);
            });

            it('should run the correct command with math LESS flag', function () {
                lessWatchCompilerUtils.config = {
                    outputFolder: "testFolder",
                    lessArgs: "math=strict"
                };
                assert.equal("lessc --math=strict \"test.less\" \"testFolder/test.css\"", lessWatchCompilerUtils.compileCSS("test.less", true).command);
            });

            it('should run the correct command with strict-unit LESS flag', function () {
                lessWatchCompilerUtils.config = {
                    outputFolder: "testFolder",
                    lessArgs: 'strict-units=on'
                };
                assert.equal("lessc --strict-units=on \"test.less\" \"testFolder/test.css\"", lessWatchCompilerUtils.compileCSS("test.less", true).command);
            });
            
            it('should run the correct command with math, strict-unit, include-path LESS flags', function () {
                lessWatchCompilerUtils.config = {
                    outputFolder: "testFolder",
                    lessArgs: 'math=strict,strict-units=on,include-path=./dir1\;./dir2'
                };
                assert.equal("lessc --math=strict --strict-units=on --include-path=./dir1\;./dir2 \"test.less\" \"testFolder/test.css\"", lessWatchCompilerUtils.compileCSS("test.less", true).command);
            });

            it('should not compile hidden files by default', function () {
                lessWatchCompilerUtils.config = {
                    outputFolder: "testFolder"
                };
                assert.equal(undefined, lessWatchCompilerUtils.compileCSS("_test.less", true));
            });

            it('should compile hidden files when includeHidden flag is set', function () {
                lessWatchCompilerUtils.config = {
                    outputFolder: "testFolder",
                    includeHidden: true
                };
                assert.equal("lessc \"_test.less\" \"testFolder/_test.css\"", lessWatchCompilerUtils.compileCSS("_test.less", true).command);
            });
        });
        describe('resolveOutputPath()', function () {
            // reset config
            lessWatchCompilerUtils.config = {};

            it('should resolve filepaths correctly', function () {
                lessWatchCompilerUtils.config = {
                    watchFolder: "./inputFolder/inner",
                    outputFolder: "./testFolder/nested",
                    minified: true
                };

                // Walker will always return paths relative to watchFolder
                assert.equal(lessWatchCompilerUtils.resolveOutputPath('inputFolder/inner/evenmore/afile.less'), '\"testFolder/nested/evenmore/afile.min.css\"');
            });

            it('should resolve always put output files in output folder', function () {
                lessWatchCompilerUtils.config = {
                    watchFolder: "./inputFolder/inner",
                    outputFolder: "./testFolder/nested",
                    minified: true
                };

                // Main file is relative to watchFolder as well, but can be a relative path
                // it should however always land in the destination folder
                assert.equal(lessWatchCompilerUtils.resolveOutputPath('inputFolder/inner/../afile.less'), '\"testFolder/nested/afile.min.css\"');
            });
        });
        describe('filterFiles()', function () {
            // reset config
            lessWatchCompilerUtils.config = {};

            it('filterFiles() function should be there' + JSON.stringify(lessWatchCompilerUtils.config), function () {
                assert.equal("function", typeof (lessWatchCompilerUtils.filterFiles));
            });
            it('filterFiles() function should return "false" for allowed files:' + JSON.stringify(lessWatchCompilerUtils.config), function () {
                assert.equal(false, lessWatchCompilerUtils.filterFiles("file.less"));

                lessWatchCompilerUtils.config.allowedExtensions = [".css"]
                assert.equal(false, lessWatchCompilerUtils.filterFiles("file.css"));
                lessWatchCompilerUtils.config = {}
            });
            it('filterFiles() function should return "true" for non-allowed files' + JSON.stringify(lessWatchCompilerUtils.config), function () {
                assert.equal(true, lessWatchCompilerUtils.filterFiles("file.js"));
            });
            it('filterFiles() function should return "true" for hidden files' + JSON.stringify(lessWatchCompilerUtils.config), function () {
                assert.equal(true, lessWatchCompilerUtils.filterFiles("_file.less"));
                assert.equal(true, lessWatchCompilerUtils.filterFiles(".file.less"));
            });
            it('filterFiles() function should return "false" for hidden files with includeHidden flag' + JSON.stringify(lessWatchCompilerUtils.config), function () {
                lessWatchCompilerUtils.config.includeHidden = true
                assert.equal(false, lessWatchCompilerUtils.filterFiles("_file.less"));
                assert.equal(false, lessWatchCompilerUtils.filterFiles(".file.less"));
                lessWatchCompilerUtils.config = {}
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
            it('setupWatcher() should skip watch registration when runOnce is true', function () {
                const originalWatchFile = fs.watchFile;
                let watched = false;
                fs.watchFile = () => { watched = true; };
                lessWatchCompilerUtils.config.runOnce = true;

                lessWatchCompilerUtils.setupWatcher(cwd, {}, {}, function () {});

                lessWatchCompilerUtils.config.runOnce = false;
                fs.watchFile = originalWatchFile;
                assert.equal(false, watched);
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
