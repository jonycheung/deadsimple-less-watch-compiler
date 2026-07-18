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
