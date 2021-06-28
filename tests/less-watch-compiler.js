const { doesNotMatch } = require("assert");

const assert = require("assert"),
  sh = require("shelljs"),
  cwd = sh.pwd().toString(),
  path = require("path"),
  fs = require("fs");
exec = require("child_process").exec;

describe("The CLI should", function () {
  describe("run correctly with these options:", function () {
    describe("--run-once parameter", function () {
      it("exit after once", async () => {
        let result = await cli(["--run-once", "tests/less", "tests/css"], ".");
        assert.strictEqual(result.code, 0);
      });
    });

    describe("--config parameter", function () {
      it("should load a config json", async () => {
        let result = await cli(
          ["--config", "tests/less-watch-compiler.config.json"],
          "."
        );
        assert.strictEqual(result.code, 0);
      });
    });

    describe("--include-hidden parameter", function () {
      const lessDir = cwd + "/tests/examples/with-hidden-variables-file/less";
      const cssDir = cwd + "/tests/examples/with-hidden-variables-file/css";
      it("should compile hidden files when parameter is specified", async () => {
        let result = await cli(
          ["--include-hidden"],
          lessDir,
          cssDir
        )
        setTimeout(function (){
          assert.strictEqual(result.code, 0);

          const contents = fs.readFileSync(cssDir + "/main.css");
          const contentsExpected = fs.readFileSync(cssDir + "/expected.css");

          assert.ok(contents.equals(contentsExpected));

          fs.rmSync(cssDir + "/main.css", { force: true });

          },200);
      });

      it("should not compile the hidden variables files when flag not specified", async () => {
        const compiledVariablesPath = cssDir + "/_variables.css";
        const compiledOtherVariablesPath = cssDir + "/.other-variables.css";

        // Make sure we don't detect compiled variables files left over from other runs
        fs.rmSync(compiledVariablesPath, { force: true });
        fs.rmSync(compiledOtherVariablesPath, { force: true });

        let result = await cli([], lessDir, cssDir);

        setTimeout(function () {
          assert.strictEqual(result.code, 0);

          const variablesFilesWereNotCompiled =
            !fs.existsSync(compiledVariablesPath) &&
            !fs.existsSync(compiledOtherVariablesPath);

          assert.ok(variablesFilesWereNotCompiled);
        }, 200);
      });
    });
  });
});

function cli(args) {
  return new Promise((resolve) => {
    const command = `node ${path.resolve(
      "src/less-watch-compiler.js"
    )} ${args.join(" ")}`;

    exec(command, null, (error, stdout, stderr) => {
      resolve({
        code: error && error.code ? error.code : 0,
        error,
        stdout,
        stderr,
      });
    });
  });
}
