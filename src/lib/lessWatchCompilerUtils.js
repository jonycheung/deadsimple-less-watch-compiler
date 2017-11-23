if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}

define(function (require) {
  // return a value that defines the module export
  // (i.e the functionality we want to expose for consumption)
  var self = this;
  var sys = require('util'),
    fs = require('fs'),
    path = require('path'),
    events = require('events'),
    sh = require('shelljs'),
    extend = require('extend'),
    exec = require('child_process').exec,
    cwd = sh.pwd().toString(),
    defaultAllowedExtensions = [".less"],
    fileSearch = require('./filesearch'),
    filelist = [],
    fileimportlist = {};

  var lessWatchCompilerUtilsModule = {
    config: {},
    walk: function (dir, options, callback, initCallback) {
      if (!callback) {
        callback = options;
        options = {}
      }
      if (!callback.files) callback.files = {};
      if (!callback.pending) callback.pending = 0;
      callback.pending += 1;
      fs.stat(dir, function (err, stat) {
        if (err) return callback(err);
        callback.files[dir] = stat;
        fs.readdir(dir, function (err, files) {
          if (err) return callback(err);
          callback.pending -= 1;
          files.forEach(function (f, index) {
            f = path.join(dir, f);
            callback.pending += 1;
            fs.stat(f, function (err, stat) {
              var enoent = false,
                done = false;

              if (err) {
                if (err.code !== 'ENOENT') {
                  console.log(err.code)
                  return callback(err);
                } else {
                  enoent = true;
                }
              }
              callback.pending -= 1;
              done = callback.pending === 0;
              if (!enoent) {
                callback.files[f] = stat;
                if (stat.isDirectory()) {
                  lessWatchCompilerUtilsModule.walk(f, options, callback);
                } else {
                  if (options.ignoreDotFiles && path.basename(f)[0] === '.') return done && callback(null, callback.files);
                  if (options.filter && options.filter(f)) return done && callback(null, callback.files);
                  initCallback && initCallback(f);
                }

                if (done) callback(null, callback.files);
              }
            })
          })
          if (callback.pending === 0) callback(null, callback.files);
        })
        if (callback.pending === 0) callback(null, callback.files);
      })
    },
    //Setup fs.watchFile() for each file.
    watchTree: function (root, options, watchCallback, initCallback) {
      if (!watchCallback) {
        watchCallback = options;
        options = {}
      }
      lessWatchCompilerUtilsModule.walk(root, options, function (err, files) {
          if (err) throw err;
          lessWatchCompilerUtilsModule.fileWatcher(root, files, options, filelist, fileimportlist, watchCallback);
          for (var i in files) {
            lessWatchCompilerUtilsModule.fileWatcher(i, files, options, filelist, fileimportlist, watchCallback);
          }
          watchCallback(files, null, null, fileimportlist);
        },
        initCallback);
    },
    // Here's where we run the less compiler
    compileCSS: function (file, test) {
      var dirname = path.dirname(file).replace(lessWatchCompilerUtilsModule.config.watchFolder, "") + "/";
      var filename = path.basename(file, path.extname(file));
      var minifiedFlag = (lessWatchCompilerUtilsModule.config.minified === false) ? '' : ' -x';
      var sourceMap = (lessWatchCompilerUtilsModule.config.sourceMap) ? ' --source-map' : '';
      var plugins = (lessWatchCompilerUtilsModule.config.plugins) ? ' --' + lessWatchCompilerUtilsModule.config.plugins.split(',').join(' --') : '';
      var outputFilePath = lessWatchCompilerUtilsModule.config.outputFolder + '/' + filename.replace(/\s+/g, '\\ ') +
        (lessWatchCompilerUtilsModule.config.minified ? '.min' : '') + '.css';
      var command = 'lessc' + sourceMap + minifiedFlag + plugins + ' ' + file.replace(/\s+/g, '\\ ') + ' ' + outputFilePath;
      // Run the command
      // console.log(command)
      if (!test)
        exec(command, function (error, stdout, stderr) {
          if (error !== null)
            console.log(error);
          if (stdout)
            console.error(stdout);
        });
      return {
        "command": command,
        "outputFilePath": outputFilePath
      };

    },
    // This is the function we use to filter the files to watch.
    filterFiles: function (f) {
      var filename = path.basename(f);
      var extension = path.extname(f),
        allowedExtensions = lessWatchCompilerUtilsModule.config.allowedExtensions || defaultAllowedExtensions;
      if (filename.substr(0, 1) == '_' ||
        filename.substr(0, 1) == '.' ||
        filename == '' ||
        allowedExtensions.indexOf(extension) == -1
      )
        return true;
      else {
        return false;
      }
    },
    getDateTime: function () {
      var date = new Date();
      var hour = date.getHours();
      hour = (hour < 10 ? "0" : "") + hour;
      var min = date.getMinutes();
      min = (min < 10 ? "0" : "") + min;
      var sec = date.getSeconds();
      sec = (sec < 10 ? "0" : "") + sec;
      var year = date.getFullYear();
      var month = date.getMonth() + 1;
      month = (month < 10 ? "0" : "") + month;
      var day = date.getDate();
      day = (day < 10 ? "0" : "") + day;
      return hour + ":" + min + ":" + sec + " on " + day + '/' + month + "/" + year;
    },
    setupWatcher: function (f, files, options, watchCallback) {
      if (lessWatchCompilerUtilsModule.config.runOnce === true) return;
      fs.watchFile(f, options, function (c, p) {
        // Check if anything actually changed in stat
        if (files[f] && !files[f].isDirectory() && c.nlink !== 0 && files[f].mtime.getTime() == c.mtime.getTime()) return;
        files[f] = c;
        if (!files[f].isDirectory()) {
          if (options.ignoreDotFiles && (path.basename(f)[0] === '.')) return;
          if (options.filter && options.filter(f)) return;
          fs.exists(f, function (exists) {
            if (!exists) {
              console.log("Does not exist : " + f)
            } else {
              fileimportlist[f] = fileSearch.findLessImportsInFile(f);
              watchCallback(f, c, p, fileimportlist);
            }
          });
        } else {
          fs.readdir(f, function (err, nfiles) {
            if (err) return;
            nfiles.forEach(function (b) {
              var file = path.join(f, b);
              if (!files[file]) {
                fs.stat(file, function (err, stat) {
                  if (options.ignoreDotFiles && (path.basename(b)[0] === '.')) return;
                  if (options.filter && options.filter(b)) return;
                  fs.exists(file, function (exists) {
                    if (!exists) {
                      console.log("Does not exist : " + f)
                    } else {
                      fileimportlist[file] = fileSearch.findLessImportsInFile(file);
                      watchCallback(file, stat, null, fileimportlist);
                      files[file] = stat;
                      fileWatcher(file);
                    }
                  });

                })
              }
            })
          })
        }
        if (c.nlink === 0) {
          // unwatch removed files.
          delete files[f]
          fs.unwatchFile(f);
        }
      })
    },
    fileWatcher: function (f, files, options, filelist, fileimportlist, watchCallback) {
      if (filelist.indexOf(f) !== -1) return;
      filelist[filelist.length] = f;

      if (f.indexOf('.') !== -1) {
        fileimportlist[f] = fileSearch.findLessImportsInFile(f);
      }
      lessWatchCompilerUtilsModule.setupWatcher(f, files, options, watchCallback);
      for (var i in fileimportlist[f]) {
        if (filelist.indexOf(fileimportlist[f][i]) === -1) {
          lessWatchCompilerUtilsModule.setupWatcher(
            path.normalize(path.dirname(f) + '/' + fileimportlist[f][i]),
            files,
            options,
            watchCallback
          );
        }
      }
    }
  }
  return lessWatchCompilerUtilsModule;
});