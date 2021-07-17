var assert = require("assert"),
  lessWatchCompilerUtils = require("../dist/lib/lessWatchCompilerUtils.cjs.js"),
  sh = require("shelljs"),
  cwd = sh.pwd().toString(),
  testroot = cwd + "/test/less/",
  testRelative = "./test/less";

describe("lessWatchCompilerUtils Module API", function () {
  describe("Should have the following API's", function () {
    describe("walk()", function () {
      it("walk() function should be there", function () {
        assert.strictEqual("function", typeof lessWatchCompilerUtils.walk);
      });
      it("walk() function should return an object of files ", async (done) => {
        await runCommand(done);
        function runCommand(done) {
          lessWatchCompilerUtils.walk(
            testroot,
            {},
            (err, files) => {
              for (var i in files) {
                assert.strictEqual("object", typeof files[i]);
              }
            },
            function () {}
          );
          done();
        }
      });
    });
    describe("watchTree()", function () {
      it("watchTree() function should be there", function () {
        assert.strictEqual("function", typeof lessWatchCompilerUtils.watchTree);
      });
      it("watchTree() function should complete and call a callback ", async (done) => {
        await runCommand(done);
        function runCommand(done) {
          lessWatchCompilerUtils.watchTree(
            testroot,
            {},
            function () {},
            function () {}
          );
          assert.ok("completed");
          done();
        }
      });
    });
    describe("filterFiles()", function () {
      // reset config
      lessWatchCompilerUtils.config = {};

      it(
        "filterFiles() function should be there" +
          JSON.stringify(lessWatchCompilerUtils.config),
        function () {
          assert.strictEqual(
            "function",
            typeof lessWatchCompilerUtils.filterFiles
          );
        }
      );
      it(
        'filterFiles() function should return "false" for allowed files:' +
          JSON.stringify(lessWatchCompilerUtils.config),
        function () {
          assert.strictEqual(
            false,
            lessWatchCompilerUtils.filterFiles("file.less")
          );

          lessWatchCompilerUtils.config.allowedExtensions = [".css"];
          assert.strictEqual(
            false,
            lessWatchCompilerUtils.filterFiles("file.css")
          );
          lessWatchCompilerUtils.config = {};
        }
      );
      it(
        'filterFiles() function should return "true" for non-allowed files' +
          JSON.stringify(lessWatchCompilerUtils.config),
        function () {
          assert.strictEqual(
            true,
            lessWatchCompilerUtils.filterFiles("file.js")
          );
        }
      );
      it(
        'filterFiles() function should return "true" for hidden files' +
          JSON.stringify(lessWatchCompilerUtils.config),
        function () {
          assert.strictEqual(
            true,
            lessWatchCompilerUtils.filterFiles("_file.less")
          );
          assert.strictEqual(
            true,
            lessWatchCompilerUtils.filterFiles(".file.less")
          );
        }
      );
      it(
        'filterFiles() function should return "false" for hidden files with includeHidden flag' +
          JSON.stringify(lessWatchCompilerUtils.config),
        function () {
          lessWatchCompilerUtils.config.includeHidden = true;
          assert.strictEqual(
            false,
            lessWatchCompilerUtils.filterFiles("_file.less")
          );
          assert.strictEqual(
            false,
            lessWatchCompilerUtils.filterFiles(".file.less")
          );
          lessWatchCompilerUtils.config = {};
        }
      );
    });
    describe("setupWatcher()", function () {
      it("setupWatcher() function should be there", function () {
        assert.strictEqual(
          "function",
          typeof lessWatchCompilerUtils.setupWatcher
        );
      });
      it("setupWatcher() function should take the correct parameters", function (done) {
        lessWatchCompilerUtils.setupWatcher(cwd, {}, {}, function () {});
        done();
      });
    });
    describe("fileWatcher()", function () {
      it("fileWatcher() function should be there", function () {
        assert.strictEqual(
          "function",
          typeof lessWatchCompilerUtils.fileWatcher
        );
      });
      it("fileWatcher() function should take the correct parameters", function (done) {
        lessWatchCompilerUtils.fileWatcher(cwd, {}, {}, [], [], function () {});
        done();
      });
      it("fileWatcher() function should not fail for relative paths", function (done) {
        lessWatchCompilerUtils.fileWatcher(
          testRelative,
          {},
          {},
          [],
          [],
          function () {}
        );
        done();
      });
    });
  });
});
