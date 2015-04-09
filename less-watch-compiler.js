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
  , sh = require('shelljs')
  , extend = require('extend')
  , exec = require('child_process').exec
  , lessWatchCompilerUtils = require('./lib/lessWatchCompilerUtils.js')
  , cwd = sh.pwd()
  , data;

// See if folder cwd contains 
data = fs.readFileSync('config.json');
extend(true, lessWatchCompilerUtils.config, JSON.parse(data));
fs.exists(cwd+'/less-watch-compiler.config.json', function(exists) {
  if (exists) {
    data = fs.readFileSync(cwd+'/less-watch-compiler.config.json')
    var customConfig = JSON.parse(data);
    extend(true, lessWatchCompilerUtils.config, customConfig)
  }
  init();
});

// Check to see if we have the correct number of arguments
var argvs = process.argv.slice(2);

function init(){
  // Here's where we setup the watch function
  try{
    lessWatchCompilerUtils.config.watchFolder = argvs[0] || lessWatchCompilerUtils.config.defaults.watchFolder;
    lessWatchCompilerUtils.config.outputFolder = argvs[1] || lessWatchCompilerUtils.config.defaults.outputFolder;  
  }
  catch(e){}

  if (argvs[0] == "test-only") return;

  // console.log("Watch Folder: "+lessWatchCompilerUtils.config.watchFolder)
  // console.log("Output Folder: "+lessWatchCompilerUtils.config.outputFolder)
  if ( !lessWatchCompilerUtils.config.watchFolder || !lessWatchCompilerUtils.config.outputFolder ){
    console.log('Missing arguments. Example:');
    console.log('\tnode less-watch-compiler.js FOLDER_TO_WATCH FOLDER_TO_OUTPUT');
    console.log('\tExample 1: To watch all files under the folder "less" and compile all into a folder "css".');
    console.log('\t\t less-watch-compiler less css');
    process.exit(1);
  }
  console.log('Watching directory for file changes.');
  console.log('');
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
        lessWatchCompilerUtils.compileCSS(f);
      }
    },
    function(f){
       lessWatchCompilerUtils.compileCSS(f);
    }
  );
}
