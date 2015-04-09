var assert = require("assert")
, lessWatchCompilerUtils = require('../lib/lessWatchCompilerUtils.js');


// TODO - Add meaningful tests duh!

describe('lessWatchCompilerUtils Module API', function(){
  describe('Should have ', function(){
    it('walk()', function(){
      assert.equal("function", typeof(lessWatchCompilerUtils.walk));
    })
    it('watchTree()', function(){
      assert.equal("function", typeof(lessWatchCompilerUtils.watchTree));
    })
    it('compileCSS()', function(){
      assert.equal("function", typeof(lessWatchCompilerUtils.compileCSS));
    })
    it('filterFiles()', function(){
      assert.equal("function", typeof(lessWatchCompilerUtils.filterFiles));
    })
    it('getDateTime()', function(){
      assert.equal("function", typeof(lessWatchCompilerUtils.getDateTime));
    })


  })
})
