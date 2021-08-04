var assert = require("assert"),
  lessWatchCompilerUtils = require("../dist/lib/lessWatchCompilerUtils.cjs.js"),
  sh = require("shelljs"),
  cwd = sh.pwd().toString(),
  testroot = cwd + "/test/less/",
  testRelative = "./test/less";

describe("lessWatchCompilerUtils Module API", function () {
  describe("Should have the following API's", function () {
    // describe("walk()", function () {
    //   it("walk() function should be there", function () {
    //     assert.strictEqual("function", typeof lessWatchCompilerUtils.walk);
    //   });
    //   it("walk() function should return an object of files ", async (done) => {
    //     await runCommand(done);
    //     function runCommand(done) {
    //       lessWatchCompilerUtils.walk(
    //         testroot,
    //         {},
    //         (err, files) => {
    //           for (var i in files) {
    //             assert.strictEqual("object", typeof files[i]);
    //           }
    //         },
    //         function () {}
    //       );
    //       done();
    //     }
    //   });
    // });
   
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
