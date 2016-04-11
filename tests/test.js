var assert = require("assert")
, lessWatchCompilerUtils = require('../lib/lessWatchCompilerUtils.js')
, sh = require('shelljs')
, cwd = sh.pwd();


// TODO - Add meaningful tests duh!

describe('lessWatchCompilerUtils Module API', function(){
  describe('Should have the following API\'s', function(){
    describe('walk()', function(){
        it('walk() function should be there', function(){
            assert.equal("function", typeof(lessWatchCompilerUtils.walk));
        });
        it('walk() function should return an object of files ', function(done){
            var timeout ;
            lessWatchCompilerUtils.walk(cwd, {}, function(err, files){
                for (var i in files) {
                    assert.equal("object", typeof(files[i]));
                } 
                //Hacky: walk() is calling back multiple times. This should be fixed.
                if (timeout) clearTimeout(timeout);
                timeout = setTimeout(function(){
                    done();
                },5)        
            }, function(){});
        });
    })
     describe('watchTree()', function(){
        it('watchTree() function should be there', function(){
            assert.equal("function", typeof(lessWatchCompilerUtils.watchTree));
        });
        it('watchTree() function should complete and call a callback ', function(done){
            var timeout ;
            lessWatchCompilerUtils.watchTree(cwd, {}, function(){}, function(){
                if (timeout) clearTimeout(timeout);
                timeout = setTimeout(function(){
                    done();
                },2);
            });
        });
    })
    describe('compileCSS()', function(){
        it('compileCSS() function should be there', function(){
            assert.equal("function", typeof(lessWatchCompilerUtils.compileCSS));
        });
        it('should run the correct command with minified flag', function(){
            lessWatchCompilerUtils.config.outputFolder = "testFolder";
            lessWatchCompilerUtils.config.minified = true;
            assert.equal("lessc -x test > testFolder/test.css", lessWatchCompilerUtils.compileCSS("test", true));
        });
    })
    describe('filterFiles()', function(){
        it('filterFiles() function should be there', function(){
            assert.equal("function", typeof(lessWatchCompilerUtils.filterFiles));
        });
        lessWatchCompilerUtils.config.allowedExtensions = [".css"]
        it('filterFiles() function should return "false" for allowed files', function(){
            assert.equal(false, lessWatchCompilerUtils.filterFiles("file.css"));
        });
        it('filterFiles() function should return "true" for non-allowed files', function(){
            assert.equal(true, lessWatchCompilerUtils.filterFiles("file.js"));
        });
        
    })
    describe('getDateTime()', function(){
        it('getDateTime() function should be there and has value', function(){
            assert.equal(true, lessWatchCompilerUtils.getDateTime().length > 0);
        });
    })


  })
})
