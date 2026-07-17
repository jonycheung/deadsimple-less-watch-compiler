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
  });

  describe('loadPlugins()', function () {
    it('rejects with a descriptive error for a plugin that cannot be resolved', async function () {
      await assert.rejects(() => lessOptions.loadPlugins('this-plugin-does-not-exist', less, {}), /Unable to load plugin this-plugin-does-not-exist/);
    });
  });
});
