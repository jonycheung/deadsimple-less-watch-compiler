#!/usr/bin/env node

/* Copyright 2012, Jonathan Cheung Licensed and released under the MIT
   license. Refer to MIT-LICENSE.txt.

  A nodejs script that watches folders(and subfolders) for changes and automatically compile the less css files into css.

  Always give credit where it is due. Parts of this script is modified from Mikeal Rogers's watch script (https://github.com/mikeal/watch)

   Basic Usage:     less-watch-compiler FOLDER_TO_WATCH FOLDER_TO_OUTPUT
   Example:         'less-watch-compiler less css' will watch ./less folder
                    and compile the less css files into ./css when they are added/updated
*/
var sys = require('util')
  , fs = require('fs')
  , path= require('path')
  , sh = require('shelljs')
  , extend = require('extend')
  , exec = require('child_process').exec
  , lessWatchCompilerUtils = require('./lib/lessWatchCompilerUtils.js')
  , cwd = sh.pwd()
  , data
  , mainFilePath = undefined
  , program = require('commander')
  , packagejson = require('./package.json');

program
  .version(packagejson.version)
  .usage('[options] <source_dir> <destination_dir> [main_file_name]')
  .option('--source-map', "Generate source map for css files")
  .option('--main-file <file>', "Specify <file> as the file to always re-compile e.g. '--main-file style.less'")
  // .option('-p, --plugins <plugin-a>,<plugin-b>', 'List of plugins separated by commas', plugins)
  .parse(process.argv);

// See if folder cwd contains 
fs.exists(cwd+'/less-watch-compiler.config.json', function(exists) {
  if (exists) {
    data = fs.readFileSync(cwd+'/less-watch-compiler.config.json')
    var customConfig = JSON.parse(data);
    extend(true, lessWatchCompilerUtils.config, customConfig) 
  }
  init();
});

function init(){
  if (program.args[0])   lessWatchCompilerUtils.config.watchFolder =  program.args[0];
  if (program.args[1])   lessWatchCompilerUtils.config.outputFolder =  program.args[1];
  if (program.args[2])   lessWatchCompilerUtils.config.mainFile =  program.args[2];
  if (program.mainFile)   lessWatchCompilerUtils.config.mainFile =  program.mainFile;
  if (program.sourceMap) lessWatchCompilerUtils.config.sourceMap = program.sourceMap;

  /*
    3rd parameter is optional, but once you define it, then we will just compile 
    the main and generate as "{main_file_name}.css". All the files that has been 
    referenced from the main one will be minified into it.
    Assuming the 3rd is "main.less"
    - input folder: src
    src
        main.less (import aux.less)
        aux.less
    - output folder: dist
    dist
        main.css
        
    Otherwise, it will behave as previously:
    Assuming the 3rd is empty
    - input folder: src
    src
        main.less (import aux.less)
        aux.less
    - output folder: dist
    dist
        main.css
        aux.css
  */

  if ( !lessWatchCompilerUtils.config.watchFolder || !lessWatchCompilerUtils.config.outputFolder ){
    console.log('Missing arguments. Example:');
    console.log('\tnode less-watch-compiler.js FOLDER_TO_WATCH FOLDER_TO_OUTPUT');
    console.log('\tExample 1: To watch all files under the folder "less" and compile all into a folder "css".');
    console.log('\t\t less-watch-compiler less css');
    process.exit(1);
  }
  if (lessWatchCompilerUtils.config.mainFile) {
      mainFilePath = [lessWatchCompilerUtils.config.watchFolder, lessWatchCompilerUtils.config.mainFile].join('/');
      fs.exists(mainFilePath, function(exists) {
        if (!exists){
          console.log("Main file " + mainFilePath+" does not exist.");
          process.exit();
        }
      });
  }
  
  console.log('Watching directory for file changes.');
  lessWatchCompilerUtils.watchTree(
    lessWatchCompilerUtils.config.watchFolder,
    {interval: 200, ignoreDotFiles: true, filter:lessWatchCompilerUtils.filterFiles},
    function (f, curr, prev) {
      if (typeof f == 'object' && prev === null && curr === null) {
        // Finished walking the tree
        return;
      } else if (curr.nlink === 0) {
        // f was removed
        console.log(f +' was removed.')
      } else {
        // f is a new file or changed
        console.log('The file: ' + f + ' was changed. Recompiling CSS at ' + lessWatchCompilerUtils.getDateTime());
        lessWatchCompilerUtils.compileCSS(mainFilePath || f);
      }
    },
    function(f){
       lessWatchCompilerUtils.compileCSS(mainFilePath || f);
    }
  );
}
