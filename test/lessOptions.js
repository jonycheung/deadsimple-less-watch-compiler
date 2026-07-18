const assert = require('assert'),
  lessOptions = require('../dist/lib/lessOptions.js'),
  less = require('less');

describe('lessOptions Module', function () {
  describe('splitTopLevelCommas()', function () {
    it('splits a plain comma list', function () {
      assert.deepStrictEqual(lessOptions.splitTopLevelCommas('a=1,b=2'), ['a=1', 'b=2']);
    });
    it('keeps commas inside parentheses intact', function () {
      assert.deepStrictEqual(lessOptions.splitTopLevelCommas('c=rgba(1, 2, 3, 0.5),d=4'), ['c=rgba(1, 2, 3, 0.5)', 'd=4']);
    });
    it('keeps commas inside quoted values intact', function () {
      assert.deepStrictEqual(lessOptions.splitTopLevelCommas("modify-var='font-stack=Arial, sans-serif',compress"), [
        "modify-var='font-stack=Arial, sans-serif'",
        'compress'
      ]);
    });
    it('keeps commas inside plugin option payloads intact', function () {
      assert.deepStrictEqual(lessOptions.splitTopLevelCommas("my-plugin='a,b',other-plugin"), ["my-plugin='a,b'", 'other-plugin']);
      assert.deepStrictEqual(lessOptions.splitTopLevelCommas('my-plugin=(a,b),other-plugin'), ['my-plugin=(a,b)', 'other-plugin']);
    });
    it('treats a backslash-escaped comma as a literal, not a delimiter', function () {
      assert.deepStrictEqual(lessOptions.splitTopLevelCommas('a\\,b,c'), ['a\\,b', 'c']);
    });
  });

  describe('buildRenderOptions()', function () {
    it('coerces unknown on/off values and passes unknown keys through camelCased', function () {
      const options = lessOptions.buildRenderOptions({
        inputFilePath: 'in.less',
        outputFilePath: 'out.css',
        lessArgs: 'some-future-flag=on'
      });
      assert.equal(options.someFutureFlag, true);
    });
    it('treats a bare key as a boolean flag', function () {
      const options = lessOptions.buildRenderOptions({
        inputFilePath: 'in.less',
        outputFilePath: 'out.css',
        lessArgs: 'strict-imports'
      });
      assert.equal(options.strictImports, true);
    });
    it('maps global-var into a globalVars object', function () {
      const options = lessOptions.buildRenderOptions({
        inputFilePath: 'in.less',
        outputFilePath: 'out.css',
        lessArgs: 'global-var=brand=#336699'
      });
      assert.deepStrictEqual(options.globalVars, { brand: '#336699' });
    });
    it('routes source-map arguments into the sourceMap options object', function () {
      const options = lessOptions.buildRenderOptions({
        inputFilePath: 'in.less',
        outputFilePath: 'out.css',
        sourceMap: true,
        lessArgs: 'source-map-rootpath=/static/,source-map-basepath=/src/,source-map-url=/maps/out.css.map,source-map-include-source,source-map-inline'
      });
      assert.equal(options.sourceMap.sourceMapRootpath, '/static/');
      assert.equal(options.sourceMap.sourceMapBasepath, '/src/');
      assert.equal(options.sourceMap.sourceMapURL, '/maps/out.css.map');
      assert.equal(options.sourceMap.outputSourceFiles, true);
      assert.equal(options.sourceMap.sourceMapFileInline, true);
      assert.equal(options.sourceMapRootpath, undefined);
    });
    it('enables source maps from source-map-inline alone, without the top-level sourceMap flag', function () {
      const options = lessOptions.buildRenderOptions({
        inputFilePath: 'in.less',
        outputFilePath: 'out.css',
        lessArgs: 'source-map-inline'
      });
      assert.ok(options.sourceMap, 'sourceMap object must be built even though sourceMap: true was never set');
      assert.equal(options.sourceMap.sourceMapFileInline, true);
    });
    it('enables source maps from the source-map-map-inline alias too', function () {
      const options = lessOptions.buildRenderOptions({
        inputFilePath: 'in.less',
        outputFilePath: 'out.css',
        lessArgs: 'source-map-map-inline'
      });
      assert.ok(options.sourceMap);
      assert.equal(options.sourceMap.sourceMapFileInline, true);
    });
    ['no', 'n', 'f', 'false', 'FALSE', 'No'].forEach((alias) => {
      it(`treats strict-units=${alias} as false, matching lessc's checkBooleanArg aliases`, function () {
        const options = lessOptions.buildRenderOptions({
          inputFilePath: 'in.less',
          outputFilePath: 'out.css',
          lessArgs: 'strict-units=' + alias
        });
        assert.equal(options.strictUnits, false);
      });
    });
    ['on', 't', 'true', 'y', 'yes', 'YES'].forEach((alias) => {
      it(`treats strict-units=${alias} as true, matching lessc's checkBooleanArg aliases`, function () {
        const options = lessOptions.buildRenderOptions({
          inputFilePath: 'in.less',
          outputFilePath: 'out.css',
          lessArgs: 'strict-units=' + alias
        });
        assert.equal(options.strictUnits, true);
      });
    });

    it('maps x/compress lessArgs to compress (distinct from the minified config flag)', function () {
      assert.equal(lessOptions.buildRenderOptions({ inputFilePath: 'in.less', outputFilePath: 'out.css', lessArgs: 'x' }).compress, true);
      assert.equal(lessOptions.buildRenderOptions({ inputFilePath: 'in.less', outputFilePath: 'out.css', lessArgs: 'compress=no' }).compress, false);
    });

    it('maps sm/strict-math to the math option', function () {
      assert.equal(lessOptions.buildRenderOptions({ inputFilePath: 'in.less', outputFilePath: 'out.css', lessArgs: 'sm' }).math, 'strict');
      assert.equal(lessOptions.buildRenderOptions({ inputFilePath: 'in.less', outputFilePath: 'out.css', lessArgs: 'strict-math=off' }).math, 'always');
    });

    it('maps js and no-js to javascriptEnabled', function () {
      assert.equal(lessOptions.buildRenderOptions({ inputFilePath: 'in.less', outputFilePath: 'out.css', lessArgs: 'js' }).javascriptEnabled, true);
      assert.equal(lessOptions.buildRenderOptions({ inputFilePath: 'in.less', outputFilePath: 'out.css', lessArgs: 'no-js' }).javascriptEnabled, false);
    });

    it('splits include-path on both ; and : (POSIX)', function () {
      const options = lessOptions.buildRenderOptions({
        inputFilePath: 'in.less',
        outputFilePath: 'out.css',
        lessArgs: 'include-path=./dir1:./dir2;./dir3'
      });
      assert.deepStrictEqual(options.paths, ['./dir1', './dir2', './dir3']);
    });

    it('maps insecure and ie-compat to their boolean flags', function () {
      const options = lessOptions.buildRenderOptions({
        inputFilePath: 'in.less',
        outputFilePath: 'out.css',
        lessArgs: 'insecure,ie-compat'
      });
      assert.equal(options.insecure, true);
      assert.equal(options.ieCompat, true);
    });

    it('maps l/lint to lint', function () {
      assert.equal(lessOptions.buildRenderOptions({ inputFilePath: 'in.less', outputFilePath: 'out.css', lessArgs: 'l' }).lint, true);
      assert.equal(lessOptions.buildRenderOptions({ inputFilePath: 'in.less', outputFilePath: 'out.css', lessArgs: 'lint' }).lint, true);
    });

    it('maps rp/rootpath, normalizing backslashes to forward slashes', function () {
      const options = lessOptions.buildRenderOptions({
        inputFilePath: 'in.less',
        outputFilePath: 'out.css',
        lessArgs: 'rootpath=some\\windows\\path'
      });
      assert.equal(options.rootpath, 'some/windows/path');
    });

    it('maps relative-urls to rewriteUrls: all', function () {
      const options = lessOptions.buildRenderOptions({ inputFilePath: 'in.less', outputFilePath: 'out.css', lessArgs: 'relative-urls' });
      assert.equal(options.rewriteUrls, 'all');
    });

    it('maps ru/rewrite-urls, defaulting to all when no value is given', function () {
      assert.equal(lessOptions.buildRenderOptions({ inputFilePath: 'in.less', outputFilePath: 'out.css', lessArgs: 'ru' }).rewriteUrls, 'all');
      assert.equal(
        lessOptions.buildRenderOptions({ inputFilePath: 'in.less', outputFilePath: 'out.css', lessArgs: 'rewrite-urls=local' }).rewriteUrls,
        'local'
      );
    });

    it('maps url-args to urlArgs', function () {
      const options = lessOptions.buildRenderOptions({ inputFilePath: 'in.less', outputFilePath: 'out.css', lessArgs: 'url-args=v=123' });
      assert.equal(options.urlArgs, 'v=123');
    });

    it('maps line-numbers to dumpLineNumbers', function () {
      const options = lessOptions.buildRenderOptions({ inputFilePath: 'in.less', outputFilePath: 'out.css', lessArgs: 'line-numbers=comments' });
      assert.equal(options.dumpLineNumbers, 'comments');
    });

    ['no-color', 's', 'silent', 'verbose'].forEach((flag) => {
      it(`treats ${flag} as a presentation-only no-op (no render option set)`, function () {
        const options = lessOptions.buildRenderOptions({ inputFilePath: 'in.less', outputFilePath: 'out.css', lessArgs: flag });
        assert.deepStrictEqual(Object.keys(options), ['filename']);
      });
    });
  });

  describe('loadPlugins()', function () {
    it('rejects with a descriptive error for a plugin that cannot be resolved', async function () {
      await assert.rejects(() => lessOptions.loadPlugins('this-plugin-does-not-exist', less, {}), /Unable to load plugin this-plugin-does-not-exist/);
    });
    it('preserves the underlying error message instead of masking it', async function () {
      const fakeLess = {
        PluginManager: function () {
          return {
            Loader: {
              loadPlugin: () => Promise.reject(new Error('EACCES: permission denied'))
            }
          };
        },
        FileManager: function () {
          return {};
        },
        environment: {}
      };
      await assert.rejects(() => lessOptions.loadPlugins('some-plugin', fakeLess, {}), /Unable to load plugin some-plugin.*EACCES: permission denied/s);
    });
  });
});
