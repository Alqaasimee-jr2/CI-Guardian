const test = require('node:test');
const assert = require('node:assert');
const { parseCliArgs, resolveConfig } = require('../src/config');

test('CLI Parser: parses valid options', (t) => {
  const args = ['--repo', '.', '--strict', '--diff', '--no-html', '--output', './my-reports'];
  const opts = parseCliArgs(args);

  assert.strictEqual(opts.repoPath, '.');
  assert.strictEqual(opts.strict, true);
  assert.strictEqual(opts.mode, 'diff');
  assert.strictEqual(opts.generateHtml, false);
  assert.strictEqual(opts.outputDir, './my-reports');
});

test('CLI Parser: throws descriptive error on unknown option', (t) => {
  assert.throws(() => {
    parseCliArgs(['--unknown-flag']);
  }, /Unknown option: --unknown-flag/);
});

test('Config Resolver: throws on non-existent directory', (t) => {
  assert.throws(() => {
    resolveConfig({ repoPath: './does_not_exist_at_all_12345' });
  }, /Target repository directory does not exist/);
});
