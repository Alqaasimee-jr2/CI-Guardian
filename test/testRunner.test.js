const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('node:os');
const { detectTestRunner } = require('../src/testRunner/detector');
const { parseTestMetrics } = require('../src/testRunner');

test('Test Runner Detector: detects valid npm test script with Jest', (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-guardian-jest-'));
  t.after(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
    name: 'jest-app',
    scripts: { test: 'jest' }
  }));

  const res = detectTestRunner(tmpDir);
  assert.strictEqual(res.configured, true);
  assert.strictEqual(res.framework, 'jest');
});

test('Test Runner Detector: flags default npm dummy test script as unconfigured', (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-guardian-dummy-'));
  t.after(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
    name: 'dummy-app',
    scripts: { test: 'echo "Error: no test specified" && exit 1' }
  }));

  const res = detectTestRunner(tmpDir);
  assert.strictEqual(res.configured, false);
});

test('Test Runner Metrics: parses Jest output metrics', (t) => {
  const output = `
PASS src/math.test.js
Tests:       2 failed, 8 passed, 10 total
Time:        1.2s
`;
  const metrics = parseTestMetrics(output, 1);
  assert.strictEqual(metrics.totalTests, 10);
  assert.strictEqual(metrics.passedTests, 8);
  assert.strictEqual(metrics.failedTests, 2);
});

test('Test Runner Metrics: parses Mocha output metrics', (t) => {
  const output = `
  15 passing (450ms)
  1 failing
`;
  const metrics = parseTestMetrics(output, 1);
  assert.strictEqual(metrics.totalTests, 16);
  assert.strictEqual(metrics.passedTests, 15);
  assert.strictEqual(metrics.failedTests, 1);
});
