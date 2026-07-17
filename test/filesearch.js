var assert = require('assert'),
  filesearch = require('../dist/lib/filesearch.js');

describe('filesearch Module', function () {
  describe("Should have the following API's", function () {
    describe('findLessImportsInFile()', function () {
      it('should be a function', function () {
        assert.equal('function', typeof filesearch.findLessImportsInFile);
      });

      it('should search through a file and find LESS @import statements ', function (done) {
        var file = './test/less/test.less';
        var result = ['lvl1.less', 'lvl2/lvl2.less', 'lvl2/lvl3/lvl3.less', 'hidden/_hidden.less', 'hidden/.hidden2.less'],
          filesearchresult = filesearch.findLessImportsInFile(file);
        assert.equal(result.toString(), filesearchresult.toString());
        done();
      });
      it("should return empty array if argument isn't a file ", function (done) {
        var file = './test/less';
        var result = [],
          filesearchresult = filesearch.findLessImportsInFile(file);
        assert.equal(result.toString(), filesearchresult.toString());
        done();
      });
      it('should return empty array when file is missing', function () {
        var file = './test/less/does-not-exist.less';
        var filesearchresult = filesearch.findLessImportsInFile(file);
        assert.deepStrictEqual(filesearchresult, []);
      });
      it('should not throw on a missing extensionless path (issue #117)', function () {
        var filesearchresult = filesearch.findLessImportsInFile('./test/examples/issue-117/less/color');
        assert.deepStrictEqual(filesearchresult, []);
      });
      it('should extract extensionless @import targets as written (issue #117)', function () {
        var filesearchresult = filesearch.findLessImportsInFile('./test/examples/issue-117/less/site.less');
        assert.deepStrictEqual(filesearchresult, ['color']);
      });
      it('should handle url() and reference @import syntaxes with flexible formatting', function () {
        var file = './test/less/_importVariants.less';
        var result = ['plain-url.less', 'reference.less', 'ref-url.less', 'spaced.less', 'tight.less', 'no-semicolon.less'],
          filesearchresult = filesearch.findLessImportsInFile(file);
        assert.deepStrictEqual(filesearchresult, result);
      });
    });
    describe('isHiddenFile()', function () {
      it('should return `true` on hidden files', function () {
        assert.equal(filesearch.isHiddenFile('.hidden.less'), true);
        assert.equal(filesearch.isHiddenFile('_hidden.less'), true);
      });
      it('should return `false` on non-hidden files', function () {
        assert.equal(filesearch.isHiddenFile('non-hidden.less'), false);
      });
    });
  });
});
