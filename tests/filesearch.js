var assert = require("assert"),
    filesearch = require('../dist/lib/filesearch.js'),
    sh = require('shelljs'),
    cwd = sh.pwd().toString();


// TODO - Add meaningful tests duh!

describe('filesearch Module', function () {
    describe('Should have the following API\'s', function () {

        describe('findLessImportsInFile()', function () {
            it('should be a function', function () {
                assert.equal("function", typeof (filesearch.findLessImportsInFile));
            });

            it('should search through a file and find LESS @import statements ', function (done) {
                var file = "./tests/less/test.less";
                var result = ['lvl1.less', 'lvl2/lvl2.less', 'lvl2/lvl3/lvl3.less'],
                    filesearchresult = filesearch.findLessImportsInFile(file);
                assert.equal(result.toString(), filesearchresult.toString());
                done();
            });
        })

    })
})