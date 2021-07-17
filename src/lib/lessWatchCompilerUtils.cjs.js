if (typeof define !== "function") {
  var define = require("amdefine")(module);
}

define(function (require) {
  // return a value that defines the module export
  // (i.e the functionality we want to expose for consumption)
  var self = this;
  var sys = require("util"),
    fs = require("fs"),
    path = require("path"),
    events = require("events"),
    sh = require("shelljs"),
    extend = require("extend"),
    exec = require("child_process").exec,
    cwd = sh.pwd().toString(),
    defaultAllowedExtensions = [".less"],
    FileSearch = require("./fileSearch.js"),
    filelist = [],
    fileimportlist = {};

  var fileSearch = new FileSearch.default();

  var lessWatchCompilerUtilsModule = {
    config: {},
    walk: function (dir, options, callback, initCallback) {
      if (!callback) {
        callback = options;
        options = {};
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
                if (err.code !== "ENOENT") {
                  console.log(err.code);
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
                  lessWatchCompilerUtilsModule.walk(
                    f,
                    options,
                    callback,
                    initCallback
                  );
                } else {
                  if (options.ignoreDotFiles && path.basename(f)[0] === ".")
                    return done && callback(null, callback.files);
                  if (options.filter && options.filter(f))
                    return done && callback(null, callback.files);
                  initCallback && initCallback(f);
                }

                if (done) callback(null, callback.files);
              }
            });
          });
          if (callback.pending === 0) callback(null, callback.files);
        });
        if (callback.pending === 0) callback(null, callback.files);
      });
    },
    //Setup fs.watchFile() for each file.
    watchTree: function (root, options, watchCallback, initCallback) {
      if (!watchCallback) {
        watchCallback = options;
        options = {};
      }
      lessWatchCompilerUtilsModule.walk(
        root,
        options,
        function (err, files) {
          if (err) throw err;
          lessWatchCompilerUtilsModule.fileWatcher(
            root,
            files,
            options,
            filelist,
            fileimportlist,
            watchCallback
          );
          for (var i in files) {
            lessWatchCompilerUtilsModule.fileWatcher(
              i,
              files,
              options,
              filelist,
              fileimportlist,
              watchCallback
            );
          }
          watchCallback(files, null, null, fileimportlist);
        },
        initCallback
      );
    },
    // We build the function to filter the files to watch.
    // Returning true marks a file to be ignored.
    filterFiles: function (f) {
      var filename = path.basename(f);
      var extension = path.extname(f),
        allowedExtensions =
          lessWatchCompilerUtilsModule.config.allowedExtensions ||
          defaultAllowedExtensions;
      if (filename == "" || allowedExtensions.indexOf(extension) == -1) {
        return true;
      } else {
        // If we're including hidden files then don't ignore this file
        if (lessWatchCompilerUtilsModule.config.includeHidden) return false;
        // Otherwise, do ignore this file if it's a hidden file
        else return fileSearch.isHiddenFile(filename);
      }
    },
    setupWatcher: function (f, files, options, watchCallback) {
      if (lessWatchCompilerUtilsModule.config.runOnce === true) return;
      fs.watchFile(f, options, function (c, p) {
        // Check if anything actually changed in stat
        if (
          files[f] &&
          !files[f].isDirectory() &&
          c.nlink !== 0 &&
          files[f].mtime.getTime() == c.mtime.getTime()
        )
          return;
        files[f] = c;
        if (!files[f].isDirectory()) {
          if (options.ignoreDotFiles && path.basename(f)[0] === ".") return;
          if (options.filter && options.filter(f)) return;
          fs.exists(f, function (exists) {
            if (!exists) {
              console.log("Does not exist : " + f);
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
                  if (options.ignoreDotFiles && path.basename(b)[0] === ".")
                    return;
                  if (options.filter && options.filter(b)) return;
                  fs.exists(file, function (exists) {
                    if (!exists) {
                      console.log("Does not exist : " + f);
                    } else {
                      fileimportlist[file] =
                        fileSearch.findLessImportsInFile(file);
                      watchCallback(file, stat, null, fileimportlist);
                      files[file] = stat;
                      lessWatchCompilerUtilsModule.fileWatcher(
                        file,
                        files,
                        options,
                        filelist,
                        fileimportlist,
                        watchCallback
                      );
                    }
                  });
                });
              }
            });
          });
        }
        if (c.nlink === 0) {
          // unwatch removed files.
          delete files[f];
          fs.unwatchFile(f);
        }
      });
    },
    fileWatcher: function (
      f,
      files,
      options,
      filelist,
      fileimportlist,
      watchCallback
    ) {
      if (filelist.indexOf(f) !== -1) return;
      filelist[filelist.length] = f;

      fileimportlist[f] = fileSearch.findLessImportsInFile(f);
      lessWatchCompilerUtilsModule.setupWatcher(
        f,
        files,
        options,
        watchCallback
      );
      for (var i in fileimportlist[f]) {
        if (filelist.indexOf(fileimportlist[f][i]) === -1) {
          lessWatchCompilerUtilsModule.setupWatcher(
            path.normalize(path.dirname(f) + path.sep + fileimportlist[f][i]),
            files,
            options,
            watchCallback
          );
        }
      }
    },
  };
  return lessWatchCompilerUtilsModule;
});
