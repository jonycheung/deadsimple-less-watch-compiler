var assert = require("assert"),
  Utils = require("../dist/lib/Utils.js"),
  Options = require("../dist/lib/Options.js").Options,
  sh = require("shelljs");

const compileCSS = Utils.compileCSS,
  resolveOutputPath = Utils.resolveOutputPath,
  getDateTime = Utils.getDateTime,
  filterFiles = Utils.filterFiles,
  Config = Options.getInstance();

describe("getDateTime()", function () {
  it("getDateTime() function should be there and has value", function () {
    assert.strictEqual(true, getDateTime().length > 0);
  });
  it("getDateTime() format should be correct [HH:MM:SS on DD/MM/YYYY]", function () {
    let pattern = new RegExp(/\d+\:\d+\:\d+ on \d+\/\d+\/\d{4}/g);
    assert.ok(pattern.test(getDateTime()));
  });
});
describe("compileCSS()", function () {
  this.beforeEach(() => {
    Config.reset();
  });

  it("compileCSS() function should be there", function () {
    assert.strictEqual("function", typeof compileCSS);
  });

  it("should run the correct command with minified flag", function () {
    Config.outputFolder = "testFolder";
    Config.minified = true;
    assert.strictEqual(
      'lessc -x "test.less" "testFolder/test.min.css"',
      compileCSS("test.less", true).command
    );
  });
  it("should run the correct command with enableJs flag", function () {
    Config.outputFolder = "testFolder";
    Config.enableJs = true;
    assert.strictEqual(
      'lessc --js "test.less" "testFolder/test.css"',
      compileCSS("test.less", true).command
    );
  });
  it("should run the correct command with sourceMap flag", function () {
    Config.outputFolder = "testFolder";
    Config.sourceMap = true;
    assert.strictEqual(
      'lessc --source-map "test.less" "testFolder/test.css"',
      compileCSS("test.less", true).command
    );
  });
  it("should run the correct command with 1 plugin", function () {
    Config.outputFolder = "testFolder";
    Config.plugins = "plugin1";
    assert.strictEqual(
      'lessc --plugin1 "test.less" "testFolder/test.css"',
      compileCSS("test.less", true).command
    );
  });
  it("should run the correct command with 2 plugins", function () {
    Config.outputFolder = "testFolder";
    Config.plugins = "plugin1,plugin2";
    assert.strictEqual(
      'lessc --plugin1 --plugin2 "test.less" "testFolder/test.css"',
      compileCSS("test.less", true).command
    );
  });

  it("should run the correct command with minified flag", function () {
    Config.outputFolder = "testFolder";
    Config.minified = true;
    assert.strictEqual(
      'lessc -x "test.less" "testFolder/test.min.css"',
      compileCSS("test.less", true).command
    );
  });

  it("should run the correct command with math LESS flag", function () {
    Config.outputFolder = "testFolder";
    Config.lessArgs = "math=strict";
    assert.strictEqual(
      'lessc --math=strict "test.less" "testFolder/test.css"',
      compileCSS("test.less", true).command
    );
  });

  it("should run the correct command with strict-unit LESS flag", function () {
    Config.outputFolder = "testFolder";
    Config.lessArgs = "strict-units=on";
    assert.strictEqual(
      'lessc --strict-units=on "test.less" "testFolder/test.css"',
      compileCSS("test.less", true).command
    );
  });

  it("should run the correct command with math, strict-unit, include-path LESS flags", function () {
    Config.outputFolder = "testFolder";
    Config.lessArgs = "math=strict,strict-units=on,include-path=./dir1;./dir2";
    assert.strictEqual(
      'lessc --math=strict --strict-units=on --include-path=./dir1;./dir2 "test.less" "testFolder/test.css"',
      compileCSS("test.less", true).command
    );
  });
});
describe("resolveOutputPath()", function () {
  // reset config
  Config.reset();

  it("should resolve filepaths correctly", function () {
    Config.watchFolder = "./inputFolder/inner";
    Config.outputFolder = "./testFolder/nested";
    Config.minified = true;

    // Walker will always return paths relative to watchFolder
    assert.strictEqual(
      resolveOutputPath("inputFolder/inner/evenmore/afile.less"),
      '"testFolder/nested/evenmore/afile.min.css"'
    );
  });

  it("should resolve always put output files in output folder", function () {
    Config.watchFolder = "./inputFolder/inner";
    Config.outputFolder = "./testFolder/nested";
    Config.minified = true;

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
  this.beforeEach(() => {
    Config.reset();
  });
  it("filterFiles() function should be there", function () {
    assert.strictEqual("function", typeof filterFiles);
  });
  it('filterFiles() function should return "false" for allowed files', function () {
    Config.allowedExtensions = [".css"];
    assert.strictEqual(true, filterFiles("file.less"));
    assert.strictEqual(false, filterFiles("file.css"));
  });
  it('filterFiles() function should return "true" for non-allowed files', function () {
    assert.strictEqual(true, filterFiles("file.js"));
  });
  it('filterFiles() function should return "true" for hidden files', function () {
    assert.strictEqual(true, filterFiles("_file.less"));
    assert.strictEqual(true, filterFiles(".file.less"));
  });
  it('filterFiles() function should return "false" for hidden files with includeHidden flag', function () {
    Config.includeHidden = true;
    Config.allowedExtensions = [".less"];
    assert.strictEqual(false, filterFiles("_file.less"));
    assert.strictEqual(false, filterFiles(".file.less"));
  });
});
