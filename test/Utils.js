var assert = require("assert"),
  Utils = require("../dist/lib/Utils.js"),
  lessWatchCompilerUtils = require("../dist/lib/lessWatchCompilerUtils.cjs.js"),
  sh = require("shelljs"),
  cwd = sh.pwd().toString();

const compileCSS = Utils.compileCSS,
  resolveOutputPath = Utils.resolveOutputPath,
  getDateTime = Utils.getDateTime,
  filterFiles = Utils.filterFiles;

describe("getDateTime()", function () {
  console.log(getDateTime());
  it("getDateTime() function should be there and has value", function () {
    assert.strictEqual(true, getDateTime().length > 0);
  });
  it("getDateTime() format should be correct [HH:MM:SS on DD/MM/YYYY]", function () {
    let pattern = new RegExp(/\d+\:\d+\:\d+ on \d+\/\d+\/\d{4}/g);
    assert.ok(pattern.test(getDateTime()));
  });
});

describe("compileCSS()", function () {
  // reset config
  lessWatchCompilerUtils.config = {};

  it("compileCSS() function should be there", function () {
    assert.strictEqual("function", typeof compileCSS);
  });

  it("should run the correct command with minified flag", function () {
    lessWatchCompilerUtils.config = {
      outputFolder: "testFolder",
      minified: true,
    };
    assert.strictEqual(
      'lessc -x "test.less" "testFolder/test.min.css"',
      compileCSS("test.less", true).command
    );
  });
  it("should run the correct command with enableJs flag", function () {
    lessWatchCompilerUtils.config = {
      outputFolder: "testFolder",
      enableJs: true,
    };
    assert.strictEqual(
      'lessc --js "test.less" "testFolder/test.css"',
      compileCSS("test.less", true).command
    );
  });
  it("should run the correct command with sourceMap flag", function () {
    lessWatchCompilerUtils.config = {
      outputFolder: "testFolder",
      sourceMap: true,
    };
    assert.strictEqual(
      'lessc --source-map "test.less" "testFolder/test.css"',
      compileCSS("test.less", true).command
    );
  });
  it("should run the correct command with 1 plugin", function () {
    lessWatchCompilerUtils.config = {
      outputFolder: "testFolder",
      plugins: "plugin1",
    };
    assert.strictEqual(
      'lessc --plugin1 "test.less" "testFolder/test.css"',
      compileCSS("test.less", true).command
    );
  });
  it("should run the correct command with 2 plugins", function () {
    lessWatchCompilerUtils.config = {
      outputFolder: "testFolder",
      plugins: "plugin1,plugin2",
    };
    assert.strictEqual(
      'lessc --plugin1 --plugin2 "test.less" "testFolder/test.css"',
      compileCSS("test.less", true).command
    );
  });

  it("should run the correct command with minified flag", function () {
    lessWatchCompilerUtils.config = {
      outputFolder: "testFolder",
      minified: true,
    };
    assert.strictEqual(
      'lessc -x "test.less" "testFolder/test.min.css"',
      compileCSS("test.less", true).command
    );
  });

  it("should run the correct command with math LESS flag", function () {
    lessWatchCompilerUtils.config = {
      outputFolder: "testFolder",
      lessArgs: "math=strict",
    };
    assert.strictEqual(
      'lessc --math=strict "test.less" "testFolder/test.css"',
      compileCSS("test.less", true).command
    );
  });

  it("should run the correct command with strict-unit LESS flag", function () {
    lessWatchCompilerUtils.config = {
      outputFolder: "testFolder",
      lessArgs: "strict-units=on",
    };
    assert.strictEqual(
      'lessc --strict-units=on "test.less" "testFolder/test.css"',
      compileCSS("test.less", true).command
    );
  });

  it("should run the correct command with math, strict-unit, include-path LESS flags", function () {
    lessWatchCompilerUtils.config = {
      outputFolder: "testFolder",
      lessArgs: "math=strict,strict-units=on,include-path=./dir1;./dir2",
    };
    assert.strictEqual(
      'lessc --math=strict --strict-units=on --include-path=./dir1;./dir2 "test.less" "testFolder/test.css"',
      compileCSS("test.less", true).command
    );
  });
});
describe("resolveOutputPath()", function () {
  // reset config
  lessWatchCompilerUtils.config = {};

  it("should resolve filepaths correctly", function () {
    lessWatchCompilerUtils.config = {
      watchFolder: "./inputFolder/inner",
      outputFolder: "./testFolder/nested",
      minified: true,
    };

    // Walker will always return paths relative to watchFolder
    assert.strictEqual(
      resolveOutputPath("inputFolder/inner/evenmore/afile.less"),
      '"testFolder/nested/evenmore/afile.min.css"'
    );
  });

  it("should resolve always put output files in output folder", function () {
    lessWatchCompilerUtils.config = {
      watchFolder: "./inputFolder/inner",
      outputFolder: "./testFolder/nested",
      minified: true,
    };

    // Main file is relative to watchFolder as well, but can be a relative path
    // it should however always land in the destination folder
    assert.strictEqual(
      resolveOutputPath("inputFolder/inner/../afile.less"),
      '"testFolder/nested/afile.min.css"'
    );
  });
});
describe("filterFiles()", function () {
  // reset config
  lessWatchCompilerUtils.config = {};

  it(
    "filterFiles() function should be there" +
      JSON.stringify(lessWatchCompilerUtils.config),
    function () {
      assert.strictEqual("function", typeof filterFiles);
    }
  );
  it(
    'filterFiles() function should return "false" for allowed files:' +
      JSON.stringify(lessWatchCompilerUtils.config),
    function () {
      assert.strictEqual(false, filterFiles("file.less"));

      lessWatchCompilerUtils.config.allowedExtensions = [".css"];
      assert.strictEqual(false, filterFiles("file.css"));
      lessWatchCompilerUtils.config = {};
    }
  );
  it(
    'filterFiles() function should return "true" for non-allowed files' +
      JSON.stringify(lessWatchCompilerUtils.config),
    function () {
      assert.strictEqual(true, filterFiles("file.js"));
    }
  );
  it(
    'filterFiles() function should return "true" for hidden files' +
      JSON.stringify(lessWatchCompilerUtils.config),
    function () {
      assert.strictEqual(true, filterFiles("_file.less"));
      assert.strictEqual(true, filterFiles(".file.less"));
    }
  );
  it(
    'filterFiles() function should return "false" for hidden files with includeHidden flag' +
      JSON.stringify(lessWatchCompilerUtils.config),
    function () {
      lessWatchCompilerUtils.config.includeHidden = true;
      assert.strictEqual(false, filterFiles("_file.less"));
      assert.strictEqual(false, filterFiles(".file.less"));
      lessWatchCompilerUtils.config = {};
    }
  );
});
