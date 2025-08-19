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
  , packagejson = require('../package.json')
  , events = require('events');

//bypass maxlistener errors because more files means more listeners #90
events.EventEmitter.defaultMaxListeners = 0;

program
  .version(packagejson.version, '-v, -V, --version', 'Output the current version')
  .usage('[options] <source_dir> <destination_dir> [main_file_name]')
  .option('--main-file <file>', "Specify <file> as the file to always re-compile e.g. '--main-file style.less'.")
  .option('--config <file>', 'Custom configuration file path.', 'less-watch-compiler.config.json')
  .option('--run-once', 'Run the compiler once without waiting for additional changes.')
  .option('--include-hidden', "Don't ignore files beginning with a '.' or a '_'")
  //Less Options
  .option('--enable-js', 'Less.js Option: To enable inline JavaScript in less files.')
  .option('--source-map', "Less.js Option: To generate source map for css files.")
  .option('--plugins <plugin-a>,<plugin-b>', 'Less.js Option: To specify plugins separated by commas.')
  .option('--less-args <less-arg1>=<less-arg1-value>,<less-arg1>=<less-arg2-value>', 'Less.js Option: To specify any other less options e.g. \'--less-args math=strict,strict-units=on,include-path=.\/dir1\\;.\/dir2\'.')
  .parse();

const programOption = program.opts();

  // Check if configuration file exists
  var configPath = programOption.config ? (path.isAbsolute(programOption.config))? programOption.config : (cwd + path.sep + programOption.config): "less-watch-compiler.config.json";

  fs.access(configPath, fs.constants.F_OK, (err) => {
    if (!err) {
      let data = fs.readFileSync(configPath);
      var customConfig = JSON.parse(data.toString());
      console.log('Config file ' + configPath + ' is loaded.');
      extend(true, lessWatchCompilerUtils.config, customConfig);
    }
    init();
  });


function init(){
  if (program.args[0])   lessWatchCompilerUtils.config.watchFolder =  program.args[0];
  if (program.args[1])   lessWatchCompilerUtils.config.outputFolder =  program.args[1];
  if (program.args[2])   lessWatchCompilerUtils.config.mainFile =  program.args[2];
  if (programOption.mainFile)   lessWatchCompilerUtils.config.mainFile =  programOption.mainFile;
  if (programOption.sourceMap) lessWatchCompilerUtils.config.sourceMap = programOption.sourceMap;
  if (programOption.plugins) lessWatchCompilerUtils.config.plugins = programOption.plugins;
  if (programOption.runOnce) lessWatchCompilerUtils.config.runOnce = programOption.runOnce;
  if (programOption.includeHidden) lessWatchCompilerUtils.config.includeHidden = programOption.includeHidden;
  if (programOption.enableJs) lessWatchCompilerUtils.config.enableJs = programOption.enableJs;
  if (programOption.lessArgs) lessWatchCompilerUtils.config.lessArgs = programOption.lessArgs;

  lessWatchCompilerUtils.config = Object.assign({}, lessWatchCompilerUtils.config, program.opts())

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
  
  lessWatchCompilerUtils.config.watchFolder = path.resolve(lessWatchCompilerUtils.config.watchFolder);
  lessWatchCompilerUtils.config.outputFolder = path.resolve(lessWatchCompilerUtils.config.outputFolder);

  if (lessWatchCompilerUtils.config.mainFile) {
    mainFilePath = path.resolve(lessWatchCompilerUtils.config.watchFolder, lessWatchCompilerUtils.config.mainFile);
    fs.exists(mainFilePath, function(exists) {
      if (!exists){
        console.log("Main file " + mainFilePath+" does not exist.");
        process.exit();
      }
    });
  }

  if (lessWatchCompilerUtils.config.runOnce === true)
    console.log('Running less-watch-compiler once.');
  else
    console.log('Watching directory for file changes.');
  lessWatchCompilerUtils.watchTree(
    lessWatchCompilerUtils.config.watchFolder,
    {
      interval: 200,
      // If we've set --include-hidden, don't ignore dotfiles
      ignoreDotFiles: !lessWatchCompilerUtils.config.includeHidden,
      filter: lessWatchCompilerUtils.filterFiles
    },
    function (f, curr, prev, fileimportlist) {
      if (typeof f == 'object' && prev === null && curr === null) {
        // Finished walking the tree
        return;
      } else if (curr.nlink === 0) {
        // f was removed
        console.log(f +' was removed.')
      } else {
        // f is a new file or changed
        // console.log(f)
        var importedFile = false;
        var filename = f.substring(lessWatchCompilerUtils.config.watchFolder.length+1)
        for (var i in fileimportlist){
          for (var k in fileimportlist[i]){
            var hasExtension = path.extname(fileimportlist[i][k]).length > 1;
            var importFile = path.join(fileimportlist[i][k], (hasExtension ? '' : '.less'));
            var normalizedPath = path.normalize(path.dirname(i) + path.sep + importFile);

            // console.log('compare ' + f + ' with import #' + k + ' in ' + i + ' value ' + normalized);
            if (f == normalizedPath && !mainFilePath) {
              // Compile changed file only if a main file is there.
              var compileResult = lessWatchCompilerUtils.compileCSS(i);
              console.log('The file: ' + i + ' was changed because '+JSON.stringify(f)+' is specified as an import.  Recompiling '+compileResult.outputFilePath+' at ' + lessWatchCompilerUtils.getDateTime());
              importedFile = true;
            }
          }
        }
        if (!importedFile){
          var compileResult = lessWatchCompilerUtils.compileCSS(mainFilePath || f);
          console.log('The file: ' + JSON.stringify(f) + ' was changed. Recompiling '+compileResult.outputFilePath+' at ' + lessWatchCompilerUtils.getDateTime());
        }
      }
    },
    // init function
    function(f){
      if (!mainFilePath || mainFilePath === f) {
        // compile each file when main file is missing or compile main file only once
        lessWatchCompilerUtils.compileCSS(f);
      }
    }
  );
}
