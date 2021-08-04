if (typeof define !== "function") {
  var define = require("amdefine")(module);
}

define(function (require) {
  // return a value that defines the module export
  // (i.e the functionality we want to expose for consumption)
  var self = this;
  var fs = require("fs"),
    path = require("path"),
    FileSearch = require("./fileSearch.js"),
    Config = require("./Options.js").Options.getInstance(),
    filelist = [],
    fileimportlist = {},
    walk = require("./Utils.js").walk;

  var fileSearch = new FileSearch.default();

  var lessWatchCompilerUtilsModule = {
    //Setup fs.watchFile() for each file.
    // watchTree: function (root, options, watchCallback, initCallback) {
    //   if (!watchCallback) {
    //     watchCallback = options;
    //     options = {};
    //   }
    //   walk(
    //     root,
    //     options,
    //     function (err, files) {
    //       if (err) throw err;
    //       lessWatchCompilerUtilsModule.fileWatcher(
    //         root,
    //         files,
    //         options,
    //         filelist,
    //         fileimportlist,
    //         watchCallback
    //       );
    //       for (var i in files) {
    //         lessWatchCompilerUtilsModule.fileWatcher(
    //           i,
    //           files,
    //           options,
    //           filelist,
    //           fileimportlist,
    //           watchCallback
    //         );
    //       }
    //       watchCallback(files, null, null, fileimportlist);
    //     },
    //     initCallback
    //   );
    // },
    // We build the function to filter the files to watch.
    // Returning true marks a file to be ignored.
    setupWatcher: function (f, files, options, watchCallback) {
      if (Config.runOnce === true) return;
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
