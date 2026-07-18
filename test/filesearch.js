var assert = require('assert'),
  path = require('path'),
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
    describe('resolveImportPath()', function () {
      it('appends .less to an extensionless import target', function () {
        assert.equal(filesearch.resolveImportPath('/a/b/main.less', 'color'), path.normalize('/a/b/color.less'));
      });
      it('resolves relative to the importing file, leaving an existing extension untouched', function () {
        assert.equal(filesearch.resolveImportPath('/a/b/main.less', 'lvl2/lvl2.less'), path.normalize('/a/b/lvl2/lvl2.less'));
      });
    });
    describe('collectTransitiveImports()', function () {
      it('includes the file itself plus every direct import, deduped', function () {
        var result = filesearch
          .collectTransitiveImports('./test/less/test.less')
          .map(function (f) {
            return path.relative(process.cwd(), f).split(path.sep).join('/');
          })
          .sort();
        var expected = [
          'test/less/test.less',
          'test/less/lvl1.less',
          'test/less/lvl2/lvl2.less',
          'test/less/lvl2/lvl3/lvl3.less',
          'test/less/hidden/_hidden.less',
          'test/less/hidden/.hidden2.less'
        ].sort();
        assert.deepStrictEqual(result, expected);
      });
      it('does not loop forever on a circular @import', function () {
        var result = filesearch
          .collectTransitiveImports('./test/examples/circular-import/less/a.less')
          .map(function (f) {
            return path.relative(process.cwd(), f).split(path.sep).join('/');
          })
          .sort();
        assert.deepStrictEqual(result, ['test/examples/circular-import/less/a.less', 'test/examples/circular-import/less/b.less'].sort());
      });
      it('returns just the file itself when it has no imports', function () {
        var result = filesearch.collectTransitiveImports('./test/less/lvl1.less');
        assert.deepStrictEqual(result, [path.resolve('./test/less/lvl1.less')]);
      });
    });
  });
});
