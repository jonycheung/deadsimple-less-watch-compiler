const { doesNotMatch } = require("assert");

let assert = require("assert"),
    filesearch = require('../dist/lib/filesearch.js'),
    sh = require('shelljs'),
    cwd = sh.pwd().toString(),
    path= require('path'),
    exec = require('child_process').exec;

    describe('less-watch-compiler.js', function () {
        describe('recognize these options:', function () {
    
            describe('--run-once parameter', function () {
                it('exit after once',  async () =>  {
                    let result = await  cli(['--run-once','tests/less', 'tests/css'], '.');
                    assert.equal(result.code, 0);
                });
            })

            describe('--config parameter', function () {
                it('should load a config json',  async () =>  {
                    let result = await  cli(['--config','tests/less-watch-compiler.config.json'], '.');
                    assert.equal(result.code, 0);
                });
            })
    
        })
    })



function cli(args) {
  return new Promise(resolve => { 
    const command = `node ${path.resolve('src/less-watch-compiler.js')} ${args.join(' ')}`;
    exec(command,
    null, 
    (error, stdout, stderr) => { resolve({
    code: error && error.code ? error.code : 0,
    error,
    stdout,
    stderr })
  })
})
}
