var assert = require("assert"),
  FileSearch = require("../dist/lib/fileSearch.js"),
  sh = require("shelljs"),
  cwd = sh.pwd().toString(),
  filesearch = new FileSearch.default();

// TODO - Add meaningful tests duh!

describe("filesearch Module", function () {
  describe("Should have the following API's", function () {
    describe("findLessImportsInFile()", function () {
      it("should be a function", function () {
        assert.strictEqual("function", typeof filesearch.findLessImportsInFile);
      });

      it("should search through a file and find LESS @import statements ", function (done) {
        var file = "./test/less/test.less";
        var result = [
            "lvl1.less",
            "lvl2/lvl2.less",
            "lvl2/lvl3/lvl3.less",
            "hidden/_hidden.less",
            "hidden/.hidden2.less",
          ],
          filesearchresult = filesearch.findLessImportsInFile(file);
        assert.strictEqual(result.toString(), filesearchresult.toString());
        done();
      });
      it("should return empty array if argument isn't a file ", function (done) {
        var file = "./test/less";
        var result = [],
          filesearchresult = filesearch.findLessImportsInFile(file);
        assert.strictEqual(result.toString(), filesearchresult.toString());
        done();
      });
    });
    describe("isHiddenFile()", function () {
      it("should return `true` on hidden files", function () {
        assert.strictEqual(filesearch.isHiddenFile(".hidden.less"), true);
        assert.strictEqual(filesearch.isHiddenFile("_hidden.less"), true);
      });
      it("should return `false` on non-hidden files", function () {
        assert.strictEqual(filesearch.isHiddenFile("non-hidden.less"), false);
      });
    });
  });
});
