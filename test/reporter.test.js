const test = require('node:test');
const assert = require('node:assert');
const { generateSarifReport } = require('../src/reporter/sarifReporter');
const { generateMarkdownReport } = require('../src/reporter/markdownReporter');

test('SARIF Reporter: generates valid SARIF 2.1.0 JSON object', (t) => {
  const scanRes = {
    findings: [
      {
        ruleId: 'HARDCODED_SECRET',
        issue: 'Live Stripe Secret Key',
        severity: 'HIGH',
        file: 'src/config.js',
        line: 12,
        snippet: 'const key = "sk_live_12345";',
        description: 'Hardcoded key detected',
        remediation: 'Extract to env'
      }
    ]
  };

  const sarif = generateSarifReport(scanRes);
  assert.strictEqual(sarif.version, '2.1.0');
  assert.strictEqual(sarif.runs.length, 1);
  assert.strictEqual(sarif.runs[0].results.length, 1);
  assert.strictEqual(sarif.runs[0].results[0].ruleId, 'HARDCODED_SECRET');
  assert.strictEqual(sarif.runs[0].results[0].level, 'warning');
});

test('Markdown Reporter: generates context-aware PR description without hackathon boilerplate', (t) => {
  const scanRes = { scannedFilesCount: 5, findings: [] };
  const testRes = { configured: true, passed: true, totalTests: 10, passedTests: 10, failedTests: 0, durationMs: 120 };

  const { prDescription } = generateMarkdownReport(scanRes, testRes, './my-app', 'diff');

  assert.doesNotMatch(prDescription, /Bob IDE/i, 'Must not reference Bob IDE');
  assert.doesNotMatch(prDescription, /hackathon/i, 'Must not reference hackathon');
  assert.doesNotMatch(prDescription, /tiered discount/i, 'Must not reference tiered discount');
  assert.match(prDescription, /CI-Guardian/);
  assert.match(prDescription, /100% Pass Rate/);
});

test('Verdict Engine: accurately distinguishes all 4 verdict states', (t) => {
  const { determineVerdictState } = require('../src/reporter/consoleReporter');

  // 1. BLOCKED
  const blockedScan = { findings: [{ severity: 'HIGH' }] };
  const blockedRes = determineVerdictState(blockedScan, { configured: true, passed: true });
  assert.strictEqual(blockedRes.state, 'BLOCKED');

  // 2. CLEAN in standard mode for security-only repo without tests
  const warnScan = { findings: [], skippedFiles: [] };
  const cleanSecRes = determineVerdictState(warnScan, { configured: false });
  assert.strictEqual(cleanSecRes.state, 'CLEAN');

  // 3. WARNING when strict mode is active and tests are missing
  const strictWarnRes = determineVerdictState(warnScan, { configured: false }, true);
  assert.strictEqual(strictWarnRes.state, 'WARNING');

  // 4. WARNING when files are skipped due to parse error
  const warnSkipScan = { findings: [], skippedFiles: [{ file: 'foo.ts', reason: 'Parse error' }] };
  const warnSkipRes = determineVerdictState(warnSkipScan, { configured: true, passed: true });
  assert.strictEqual(warnSkipRes.state, 'WARNING');

  // 5. COULD NOT RUN
  const crashRes = determineVerdictState(warnScan, { configured: true, passed: false, exitCode: 127 });
  assert.strictEqual(crashRes.state, 'COULD_NOT_RUN');

  // 6. CLEAN (both security clean and tests passed)
  const cleanRes = determineVerdictState(warnScan, { configured: true, passed: true, totalTests: 5, passedTests: 5 });
  assert.strictEqual(cleanRes.state, 'CLEAN');
});
